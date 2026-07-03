# 集结杯三者部署总 runbook（web 展示层 + admin 后台 + backend PocketBase）

> 产出：一份可在 devbox 落地的三层共存部署清单 + 启停/端口/反代/容灾口径。
> 范围：devbox 内网（10.37.220.128）nginx:8080 同源托管三者；**不实际上线**（CF Pages 跨域/公网暴露留 SRE，见 §caveat）。
> 真相基线：`backend/deploy/runbook.md`（后端单层）+ `admin/deploy/nginx-admin.conf`（admin 片段）+ `backend/deploy/nginx-api.conf`（/api 片段）+ `backend/deploy/nginx-triple.conf`（本 round 合并的完整 server 块）。
> 红线：不自行 commit/push、不部署真 devbox、不改三皮肤 token / admin 源码 / 算分逻辑。

---

## 1. 三者职责与端口

| 层 | 产物 | 端口 | 职责 |
|---|---|---|---|
| **web 展示层** | `web/dist`（vite build，base=/） | nginx:8080 `location /` | SC2 三皮肤主站：obs 横条 / select / battle / result / ladder，直播采集 + 观众 |
| **admin 后台** | `admin/dist`（vite build，base=/admin/） | nginx:8080 `location /admin/` | Arco 业务后台：选手/对局/积分管理 5 模块 |
| **backend** | `pocketbase` 单二进制 | 127.0.0.1:8090（不对外） | PocketBase REST + Admin UI：5 集合 + hooks 算分 + /api/rankings 天梯 |

三者同源（nginx:8080）→ 前端 `fetch('/api/...')` 免 CORS；backend 仅监听 127.0.0.1:8090，由 nginx 反代暴露。

---

## 2. 部署顺序（devbox，从零到通）

### 2.1 backend 先起（数据层，web/admin 都依赖）

```bash
# 本地交叉编译 linux/amd64 二进制（devbox 外网受限，二进制随产物 scp 推，不在 devbox 现拉）
cd /Users/bytedance/项目/jijiebei/backend
GOOS=linux GOARCH=amd64 go build -o pocketbase-linux-amd64 .

# scp 推到 devbox
scp pocketbase-linux-amd64 10.37.220.128:/opt/jjb-backend/pocketbase
scp -r config            10.37.220.128:/opt/jjb-backend/config      # scoring.json 系数表
scp -r pb_migrations     10.37.220.128:/opt/jjb-backend/pb_migrations  # 编译进二进制，推仅供审阅

# devbox 上：建用户 + 目录 + systemd 守护
ssh 10.37.220.128
useradd -r jjb 2>/dev/null || true
mkdir -p /opt/jjb-backend/pb_data && chown -R jjb:jjb /opt/jjb-backend
scp deploy/jjb-backend.service 10.37.220.128:/etc/systemd/system/   # 本地侧已推
systemctl daemon-reload && systemctl enable --now jjb-backend
curl -s http://127.0.0.1:8090/api/health   # 健康检查（应返 {"code":200}）
```

migrate up（首次或 schema 升级）：
```bash
sudo -u jjb /opt/jjb-backend/pocketbase migrate up --dir /opt/jjb-backend/pb_data
# 件1 后应见：Applied 1782000003_scores_wins_games.go
```

### 2.2 web + admin 静态产物（构建本地、scp 推）

```bash
# 本地构建（三皮肤 token 不动，纯 build）
cd /Users/bytedance/项目/jijiebei/web   && npm run build   # → web/dist
cd /Users/bytedance/项目/jijiebei/admin && npm run build   # → admin/dist（vite base=/admin/）

# scp 推到 devbox 统一目录
ssh 10.37.220.128 'mkdir -p /opt/jjb/web /opt/jjb/admin'
scp -r web/dist/*   10.37.220.128:/opt/jjb/web/dist/
scp -r admin/dist/* 10.37.220.128:/opt/jjb/admin/dist/
```

### 2.3 nginx 三者共存 conf（合并 server 块）

```bash
# 推 nginx-triple.conf（本 round 产物，合并 web+admin+/api 三片）
scp /Users/bytedance/项目/jijiebei/backend/deploy/nginx-triple.conf 10.37.220.128:/etc/nginx/conf.d/jjb-triple.conf

# devbox 上：nginx 容器挂载或裸 nginx，按实际拓扑 include
nginx -t                  # 语法检查
nginx -s reload           # 热加载
curl -s http://127.0.0.1:8080/                | head -1   # web 首页
curl -s http://127.0.0.1:8080/admin/          | head -1   # admin 首页
curl -s http://127.0.0.1:8080/api/rankings    | head -c 200  # backend 天梯
curl -s http://127.0.0.1:8080/_/              | head -1   # PocketBase Admin UI
```

四条 curl 都 200/有内容 = 三者共存通。

---

## 3. 启停速查

| 动作 | 命令 |
|---|---|
| 重启 backend | `systemctl restart jjb-backend` |
| reload nginx（改 conf 后） | `nginx -s reload` |
| 重发 web/admin 产物 | 本地 build → scp 覆盖 → 无需重启 nginx（静态文件即换即生效，hash 文件名避免缓存） |
| 看 backend 日志 | `journalctl -u jjb-backend -f` |
| 看 nginx 日志 | `tail -f /var/log/nginx/access.log /var/log/nginx/error.log` |

---

## 4. 容灾（Litestream sidecar，backend 层）

backend SQLite 实时增量复制到对象存储，服务器炸了从桶恢复最多丢几秒。
```bash
# devbox 上（密钥走临时 env，不落盘）：
export LITESTREAM_ACCESS_KEY_ID=<...>
export LITESTREAM_SECRET_ACCESS_KEY=<...>
litestream replicate -config /opt/jjb-backend/litestream.yml &   # 或另起 systemd unit

# 灾难恢复演练：
litestream restore -o /opt/jjb-backend/pb_data/data.db s3://jjb-backend-backup/pb_data
```
> endpoint/bucket/path 占位待 yb 拍板实际对象存储（国内 OSS / MinIO / COS S3 兼容）。详见 `backend/deploy/litestream.yml` + `backend/deploy/runbook.md` §2.4。

---

## 5. caveat（需 hub/yb 拍板，spoke 不自决）

### caveat 1 — CF Pages 跨域 vs devbox nginx 同源（公网暴露红线）
本 round 只做 devbox 内 nginx:8080 同源反代（三者共存）。**CF Pages 前端连 devbox 后端的公网暴露受内网穿透红线约束**（`jjb-public-deploy-policy`：严禁内网穿透，公网走 SRE/TLB 正规流程）——是独立后续事项，不阻塞 devbox 三者联通。最终拓扑（CF Pages 前端 + devbox 后端 / 或全 CF Pages + 后端公网）须 yb/SRE 单独定。

### caveat 2 — 积分难度系数表未定稿
`backend/config/scoring.json` 取最简纯累加（std8=1.0 … rescue/hard=1.3）。真实系数（点金×2 / 双打 / 连胜 / 赛季周期）须 yb/土豆拍板，改 JSON 重启即生效不动 schema。**天梯上线前必须定稿系数**。件1 的 wins/games 战绩列不受系数影响（纯计数），可先于系数定稿上线。

### caveat 3 — admin 部署物理隔离
admin/ 是独立子应用（Arco），build base=/admin/，不碰 web/ 三皮肤 token。三者同 nginx 共存仅共享同源 /api 后端，前端代码物理隔离（不同 repo 目录、不同 build、不同路由前缀）。

---

## 6. 配置文件清单（本 round 产出 + 既有）

| 文件 | 作用 | 状态 |
|---|---|---|
| `backend/deploy/nginx-triple.conf` | **本 round 新增**：三者合并完整 server 块 | 新 |
| `backend/deploy/runbook-triple.md` | **本 round 新增**：本文件，三者总 runbook | 新 |
| `backend/deploy/nginx-api.conf` | 既有：仅 /api + /_/ 反代片段（被 triple 含） | 既有 |
| `admin/deploy/nginx-admin.conf` | 既有：仅 /admin/ 片段（被 triple 含） | 既有 |
| `backend/deploy/runbook.md` | 既有：backend 单层 runbook（litestream/systemd 细节） | 既有 |
| `backend/deploy/jjb-backend.service` | 既有：backend systemd unit | 既有 |
| `backend/deploy/litestream.yml` | 既有：Litestream 容灾配置 | 既有 |
| `backend/deploy/Dockerfile` | 既有：backend docker 备选形态 | 既有 |
