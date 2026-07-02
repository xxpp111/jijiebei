# 集结杯 · 部署（Deployment）

> 范围：devbox（10.37.220.128）三层同源部署 + 交叉编译 + nginx conf + Litestream 容灾 + 回滚。
> 真相源：`backend/deploy/runbook-triple.md`（最新部署 runbook）+ `backend/deploy/{nginx-docker-triple.conf, litestream.yml, jjb-backend.service, Dockerfile, seed-hosts.sh}`。

---

## 0. 部署目标与约束

**目标**：把 web（展示层）+ admin（业务后台）+ backend（PocketBase）三层部署到 devbox 共享 `nginx:8080`，前端 `fetch /api` 走同源、免 CORS。

**约束**：
- **公网暴露红线**：严禁内网穿透 / 临时 cloudflared quick tunnel 长期方案 → 长期正解 = 外部静态托管（CF Pages / 国内 OSS 备案）。详见 `jjb-public-deploy-policy`。
- **三方 key 字面量不落盘**：Litestream 的 S3 凭据走 env（`LITESTREAM_*`）；不写进任何文档/conf/commit。
- **devbox 外网受限**：Docker 镜像不能在 devbox 拉 → 全部产物本地交叉编译 → scp 推。
- **重部署 = 重建**：纯静态 web / admin `npm run build` → scp 覆盖即可，无需重启 nginx（hash 文件名避免缓存）；backend `systemctl restart jjb-backend` 一条命令生效。

---

## 1. 部署拓扑

```
浏览器 → nginx:8080（同源）
         ├─ /            → web SPA（vite build，hash 文件名，CDN 友好）
         ├─ /admin/      → admin SPA（vite build base=/admin/）
         ├─ /api/        → proxy_pass → 127.0.0.1:8090（PocketBase REST + SSE）
         └─ /_/          → proxy_pass → 127.0.0.1:8090（PocketBase Admin UI）

backend（systemd jjb-backend，127.0.0.1:8090，对外不可见）
├─ PocketBase 二进制（含 6 个 Go embed migrations）
├─ config/scoring.json（系数表）
└─ pb_data/data.db + WAL + SHM（SQLite）
   └─ Litestream sidecar（每 1s 增量复制 → S3 兼容对象存储）
```

三层同源 = 前端 `fetch('/api/...')` 走同 origin → 浏览器不报 CORS。

---

## 2. 部署步骤（devbox · 从零到通）

### 2.1 前置 · devbox 准备

```bash
ssh 10.37.220.128                # 用户需有 sudo（建用户 + 目录 + systemd）
```

devbox 上的目标目录结构：
```
/opt/jjb-backend/
├── pocketbase                    # 单二进制（linux/amd64）
├── config/scoring.json           # 系数表
└── pb_data/                      # SQLite 数据（runtime 生成）
/opt/jjb/web/dist/                # web 静态产物
/opt/jjb/admin/dist/              # admin 静态产物
/etc/systemd/system/jjb-backend.service
/etc/nginx/conf.d/jjb-triple.conf
```

### 2.2 backend · 编译 + 推 + 起

```bash
# 本机 mac/linux 交叉编译 linux/amd64
cd /Users/bytedance/项目/jijiebei/backend
GOOS=linux GOARCH=amd64 go build -o pocketbase-linux-amd64 .
# 单二进制内嵌 pb_migrations/*.go（init() 自动注册）

# scp 推（devbox 外网受限，二进制随产物推，不在 devbox 拉）
scp pocketbase-linux-amd64  10.37.220.128:/opt/jjb-backend/pocketbase
scp -r config               10.37.220.128:/opt/jjb-backend/config
scp -r pb_migrations        10.37.220.128:/opt/jjb-backend/pb_migrations  # 仅供审阅

# devbox 上：建用户 + 目录 + systemd 守护
ssh 10.37.220.128
useradd -r jjb 2>/dev/null || true
mkdir -p /opt/jjb-backend/pb_data && chown -R jjb:jjb /opt/jjb-backend

# systemd unit（已在 backend/deploy/jjb-backend.service 准备好）
scp /Users/bytedance/项目/jijiebei/backend/deploy/jjb-backend.service \
  10.37.220.128:/etc/systemd/system/

systemctl daemon-reload
systemctl enable --now jjb-backend

# 健康检查
curl -s http://127.0.0.1:8090/api/health
# 期望: {"code":200,"message":"API is healthy.","data":{}}
```

### 2.3 migrations（首次或 schema 升级）

```bash
# devbox 上
sudo -u jjb /opt/jjb-backend/pocketbase migrate up --dir /opt/jjb-backend/pb_data
# 期望输出: Applied 1782000001_init_collections.go / 1782000002_lock_default_users.go / 1782000003_scores_wins_games.go
#          / 1782000004_event_rules.go / 1782000005_player_accounts.go / 1782000006_matches_practice_rule.go

# 注意：serve 启动时会自动跑未应用的迁移（Automigrate: false），migrate up 是显式补跑
```

6 个 Go embed 迁移：
| migration | 内容 |
|---|---|
| `1782000001_init_collections.go` | 5 集合 schema + 权限矩阵 |
| `1782000002_lock_default_users.go` | PB v0.39.4 自带 `users` 锁 createRule/updateRule = NULL（graceful no-op） |
| `1782000003_scores_wins_games.go` | scores 加 `wins` / `games` 战绩字段（幂等：字段已存在跳过） |
| `1782000004_event_rules.go` | event_rules 集合（赛事临时 ban 因子/地图/指挥官） |
| `1782000005_player_accounts.go` | player_accounts 选手账号集合（注册/登录，phone 唯一索引） |
| `1782000006_matches_practice_rule.go` | matches 练习局自助落库权限规则 |

### 2.4 web + admin · 静态产物构建 + 推

```bash
# 本机构建（devbox 外网受限，npm install 也在本机完成）
cd /Users/bytedance/项目/jijiebei/web     && npm install && npm run build  # → web/dist
cd /Users/bytedance/项目/jijiebei/admin  && npm install && npm run build  # → admin/dist (vite base=/admin/)

# scp 推（devbox 目标目录已 mkdir）
ssh 10.37.220.128 'mkdir -p /opt/jjb/web/dist /opt/jjb/admin/dist'
scp -r web/dist/*    10.37.220.128:/opt/jjb/web/dist/
scp -r admin/dist/*  10.37.220.128:/opt/jjb/admin/dist/
```

> hash 文件名：web/admin 都是 Vite 默认带 hash，浏览器走强缓存，**重部署无需清浏览器缓存**。

### 2.5 nginx 三者共存 conf（Docker 容器版）

devbox 上跑 nginx 容器（`nginx:1.27-alpine`），挂载产物 + conf：

```bash
# 推 nginx conf
scp /Users/bytedance/项目/jijiebei/backend/deploy/nginx-docker-triple.conf \
  10.37.220.128:~/jijiebei-deploy/nginx-conf/default.conf

# 容器 run（已有则 stop+rm+run 重建同镜像）
ssh 10.37.220.128 <<'EOF'
docker stop jijiebei-nginx 2>/dev/null
docker rm   jijiebei-nginx 2>/dev/null
docker run -d --name jijiebei-nginx --restart=always \
  -p 8080:80 \
  -v ~/jijiebei-deploy/web/dist:/usr/share/nginx/html:ro \
  -v ~/jijiebei-deploy/admin/dist:/admin/dist:ro \
  -v ~/jijiebei-deploy/nginx-conf/default.conf:/etc/nginx/conf.d/default.conf:ro \
  nginx:1.27-alpine

# 健康检查
curl -s -o /dev/null -w "web:    %{http_code}\n" http://127.0.0.1:8080/
curl -s -o /dev/null -w "admin:  %{http_code}\n" http://127.0.0.1:8080/admin/
curl -s -o /dev/null -w "api:    %{http_code}\n" http://127.0.0.1:8080/api/health
curl -s -o /dev/null -w "pbuies: %{http_code}\n" http://127.0.0.1:8080/_/
EOF
```

四条 200 = 三层联通成功。

**关键点（容器 vs 宿主）**：
- 容器内 nginx listen **80**（非 8080），宿主 `-p 8080:80` 映射。
- 容器内 `/usr/share/nginx/html` 是 web 挂载点；`/admin/dist/` 是 admin 挂载点。
- `proxy_pass http://172.17.0.1:8090`（**非** `127.0.0.1:8090`）：Docker 18.09 不支持 `host.docker.internal`，**用 docker0 网桥网关**访问宿主 backend（前提 backend listen `*:8090`）。
- `proxy_buffering off` + `proxy_read_timeout 86400s`：SSE 长连接必需。
- `client_max_body_size 10m`：头像上传。

> 裸 nginx 宿主版（不走容器）见 `backend/deploy/nginx-triple.conf`，区别仅 listen / root / alias / proxy_pass 四行。

---

## 3. 启停速查

| 动作 | 命令 |
|---|---|
| **重启 backend** | `ssh 10.37.220.128 'sudo systemctl restart jjb-backend'` |
| **重发 web/admin 产物** | 本地 build → scp 覆盖 → 无需重启 nginx（hash 文件名避免缓存） |
| **reload nginx** | `ssh 10.37.220.128 'docker exec jijiebei-nginx nginx -s reload'`（改 conf 后） |
| **看 backend 日志** | `ssh 10.37.220.128 'sudo journalctl -u jjb-backend -f'` |
| **看 nginx 错误日志** | `ssh 10.37.220.128 'docker logs -f jijiebei-nginx'` |
| **看 backend stdout/stderr** | `ssh 10.37.220.128 'cat /opt/jjb-backend/pocketbase.log'`（若已重定向） |
| **看 Litestream 同步状态** | `ssh 10.37.220.128 'ps -ef \| grep litestream \| grep -v grep'` |
| **手动触发 backup** | `ssh 10.37.220.128 'litestream snapshots -config /opt/jjb-backend/litestream.yml /opt/jjb-backend/pb_data/data.db'` |

---

## 4. 容灾（Litestream sidecar · backend 层）

backend SQLite 实时增量复制到对象存储，**服务器炸了从桶恢复最多丢几秒**。

```bash
# devbox 上：密钥走临时 env，不落盘
ssh 10.37.220.128
export LITESTREAM_ACCESS_KEY_ID=<your-access-key>     # 临时 env
export LITESTREAM_SECRET_ACCESS_KEY=<your-secret-key> # 临时 env

# 跑 sidecar（裸进程或独立 systemd unit）
litestream replicate -config /opt/jjb-backend/litestream.yml &

# 灾难恢复演练（验证流程，不破坏生产）
litestream restore -o /opt/jjb-backend/pb_data/data.db \
  s3://jjb-backend-backup/pb_data
```

配置（`backend/deploy/litestream.yml`）：
```yaml
dbs:
  - path: /opt/jjb-backend/pb_data/data.db
    replicas:
      - type: s3
        bucket: jjb-backend-backup
        path: pb_data
        endpoint: <S3 兼容 endpoint>   # OSS / MinIO / COS S3 兼容端点（待 yb 定）
        access-key-id: ${LITESTREAM_ACCESS_KEY_ID}        # env 注入
        secret-access-key: ${LITESTREAM_SECRET_ACCESS_KEY} # env 注入
        sync-interval: 1s
```

> **endpoint / bucket / path 占位待 yb 拍板实际对象存储**（国内 OSS / MinIO / COS S3 兼容）。密钥仅走 env（litestream 支持 `${VAR}` 扩展），不写进文件、不写进 git、不写进文档示例。

---

## 5. systemd unit（`backend/deploy/jjb-backend.service`）

```ini
[Unit]
Description=Jijiebei PocketBase Backend
After=network.target

[Service]
Type=simple
User=jjb
WorkingDirectory=/opt/jjb-backend
ExecStart=/opt/jjb-backend/pocketbase serve --http 0.0.0.0:8090 --dir /opt/jjb-backend/pb_data
Restart=on-failure
RestartSec=5
# 系数表路径可由 JJB_SCORING_CONFIG 覆盖；默认 config/scoring.json
Environment=JJB_SCORING_CONFIG=/opt/jjb-backend/config/scoring.json
# 不在 systemd unit 写密钥；Litestream 密钥走临时 env 或独立 unit

[Install]
WantedBy=multi-user.target
```

要点：
- backend listen `0.0.0.0:8090`（容器从 docker0 网桥访问）；nginx 反代到 `127.0.0.1:8090`。
- `Restart=on-failure` + `RestartSec=5`：崩了 5 秒内自动拉起。
- `User=jjb`：非 root 运行，权限最小化。

---

## 6. 健康检查 / 冒烟

部署完成后必跑：

```bash
# 后端
curl -s http://127.0.0.1:8090/api/health
# → {"code":200,"message":"API is healthy.","data":{}}

# 前端主站（200 + index.html 内容）
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/

# 后台（200 + index.html）
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/admin/

# /api 反代（200 + JSON 数组或对象）
curl -s http://127.0.0.1:8080/api/collections/players/records?perPage=5 | head -c 200

# Admin UI（200 + HTML）
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/_/

# 天梯
curl -s http://127.0.0.1:8080/api/rankings | head -c 300

# 系数
curl -s http://127.0.0.1:8080/api/scoring
```

全部 200 + 内容非空 = 部署成功。

---

## 7. 回滚 / 灾难恢复

### 7.1 软回滚（改 conf 或重启）

| 场景 | 回滚动作 |
|---|---|
| nginx 报错（502/504） | `docker exec jijiebei-nginx nginx -t` 检语法；`nginx -s reload` 重读 |
| web/admin 资源 404 | 检查 `dist/` 是否 scp 全；`/opt/jjb/web/dist/index.html` 应存在 |
| backend 报错 | `journalctl -u jjb-backend -n 50` 看错误；`systemctl restart jjb-backend` |
| 后台打不开 | 检查 admin build：`base=/admin/` 应在 `vite.config.ts`；alias 路径对得上 |

### 7.2 硬回滚（替换产物）

```bash
# web 回滚到上一个 git tag（或本地 build）
cd /Users/bytedance/项目/jijiebei/web
git checkout <prev-tag> -- src/
npm run build
scp -r dist/* 10.37.220.128:/opt/jjb/web/dist/

# admin 同样
cd /Users/bytedance/项目/jijiebei/admin
git checkout <prev-tag> -- src/
npm run build
scp -r dist/* 10.37.220.128:/opt/jjb/admin/dist/

# backend 二进制回滚（保守：保留旧 binary，新 binary 放边备）
ssh 10.37.220.128
mv /opt/jjb-backend/pocketbase /opt/jjb-backend/pocketbase.bak
scp <旧 pocketbase 二进制> 10.37.220.128:/opt/jjb-backend/pocketbase
systemctl restart jjb-backend
```

### 7.3 数据灾难恢复（数据库被毁）

```bash
# 1. 停 backend
ssh 10.37.220.128 'sudo systemctl stop jjb-backend'

# 2. 用 Litestream 恢复
ssh 10.37.220.128
export LITESTREAM_ACCESS_KEY_ID=<your-access-key>
export LITESTREAM_SECRET_ACCESS_KEY=<your-secret-key>
mv /opt/jjb-backend/pb_data /opt/jjb-backend/pb_data.crashed  # 备份现场
mkdir -p /opt/jjb-backend/pb_data
litestream restore -o /opt/jjb-backend/pb_data/data.db \
  s3://jjb-backend-backup/pb_data

# 3. 启动 backend（migrations 已嵌进二进制，serve 启动自动跑未应用迁移）
sudo systemctl start jjb-backend
curl -s http://127.0.0.1:8090/api/health
```

> **RPO ≈ 1s**（litestream sync-interval）；**RTO ≈ 数分钟**（恢复 + 启动 + 反代生效）。

---

## 8. 端口矩阵

| 服务 | 端口 | 监听方 | 暴露方 |
|---|---|---|---|
| nginx | 8080（容器内 80） | 0.0.0.0（容器内） | 宿主 `-p 8080:80` |
| PocketBase | 8090 | 0.0.0.0（宿主机） | **不对外**，仅 nginx 反代 |
| Litestream | — | — | 主动连对象存储（出站） |
| Vite dev (local) | 7788 / 7790 / 8686 等 | 127.0.0.1 | 仅本地 |
| Docker bridge 网关 | 172.17.0.1 | docker0 | 容器 → 宿主 backend |

---

## 9. 部署 checklist（首次 / 升级）

```markdown
- [ ] 本机：node 18+ / go 1.22+ 已装
- [ ] 本机：web / admin / backend 依赖装齐
- [ ] devbox：用户 jjb 已建，目录 /opt/jjb-backend 属主 jjb
- [ ] devbox：jjb-backend.service 已 enable
- [ ] 本机：交叉编译 linux/amd64 二进制
- [ ] 本机：web/dist 和 admin/dist 构建完成
- [ ] scp：pocketbase + config + pb_migrations 推完
- [ ] scp：dist/* 推完（web + admin）
- [ ] devbox：migrations 跑完（migrate up 或 serve 自动）
- [ ] devbox：nginx 容器启动，三层挂载对齐
- [ ] 验证：5 条 curl 都 200
- [ ] （可选）Litestream sidecar 起跑，验证第一次 backup
- [ ] （可选）verify-all.sh 跑完 10 段
```

---

## 10. 已知 caveat（部署层 · 待 hub/yb 拍板）

1. **CF Pages 跨域 vs devbox nginx 同源（公网暴露红线）**：
   devbox 仅内网 8080；公网走 CF Pages **必须经 SRE / TLB 正规流程**（`jjb-public-deploy-policy`：严禁内网穿透，公网走 SRE 正规流程）。cloudflared quick tunnel 是治标（重启换 URL），长期正解 = 外部静态托管。

2. **Litestream endpoint / bucket 未定稿**：
   `backend/deploy/litestream.yml` 是模板，endpoint / bucket / path 占位待 yb 拍板实际对象存储（国内 OSS / MinIO / COS S3 兼容）。**密钥走 env，不写文件**。

3. **admin 前后端契约一致性**：
   devbox 三层版本对齐（web 来自 `jjb-live-dock`、admin 来自本地 `jjb-platform` build、backend 独立二进制）— 留 P2 round 验证。

4. **系数表定稿**：
   `backend/config/scoring.json` 取最简纯累加。真实系数（点金 ×2 / 连胜 / 双打 / 赛季周期）须 yb/土豆拍板，改 JSON 重启即生效，**不动 schema**。天梯上线前必须定稿系数。

5. **PocketBase 版本锁**：
   当前用 v0.39.4。升版前必跑 `verify-all.sh` 全 10 段 + 测 SSE 长连接（`/_/` realtime）+ 测 Admin UI 渲染。