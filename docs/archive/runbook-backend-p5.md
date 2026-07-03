# 集结杯 P5 后端部署 runbook（PocketBase + Litestream）

> 产出：可在本地起跑验证的后端实例 + devbox 部署清单 + Litestream 容灾配置。
> 真相基线：`docs/research-backend-p5.md`（§2 部署 + §3 前端对接）+ `tmp/platform-research-report.md` §1.2/§2。
> 红线：**不自行 commit/push、不部署到真 devbox**（本 runbook 供 hub/yb 拍板执行）。

---

## 1. 本地起跑验证（mac，有外网）

### 1.1 编译单二进制

```bash
cd /Users/bytedance/项目/jijiebei/backend
go mod tidy                                   # 拉依赖（首次，需外网）
go build -o pocketbase .                      # 编译（pb_migrations 编译进二进制）
```

### 1.2 migrations 从零重放（验证 schema 可重建）

```bash
rm -rf pb_data && ./pocketbase migrate up     # 清库重放 → 5 集合齐
ls pb_migrations/                             # 确认迁移文件
```

### 1.3 起跑 + Admin UI

```bash
./pocketbase serve --http 127.0.0.1:8090 &    # Admin UI: http://127.0.0.1:8090/_/
```

### 1.4 验证门（done-when proof，逐条真实跑并贴回响）

详见 P5 派发契约 `<validation>` 段（migrations 重放 / 权限 curl 矩阵 / hook 派生 scores / practice 反证 / 天梯聚合 / SQLite 导出）。

---

## 2. devbox 部署（10.37.220.128，外网受限）

### 2.1 二进制随产物 scp 推（绕开外网受限，核心约束）

devbox 外网受限、拉镜像难 — PocketBase/Litestream 二进制**本地下好随产物 scp 推**，不在 devbox 现拉（与现有 `jjb-deploy` 静态产物同信道）。

```bash
# 本地（有外网）交叉编译 linux/amd64 二进制
cd /Users/bytedance/项目/jijiebei/backend
GOOS=linux GOARCH=amd64 go build -o pocketbase-linux-amd64 .

# scp 推到 devbox（目录 /opt/jjb-backend 需先建，属主 jjb）
scp pocketbase-linux-amd64 10.37.220.128:/opt/jjb-backend/pocketbase
scp -r config 10.37.220.128:/opt/jjb-backend/config
scp deploy/jjb-backend.service 10.37.220.128:/etc/systemd/system/
scp deploy/litestream.yml 10.37.220.128:/opt/jjb-backend/litestream.yml

# Litestream 二进制同样本地下载后 scp（https://litestream.io/install/）
scp litestream 10.37.220.128:/opt/jjb-backend/
```

### 2.2 裸进程 + systemd 守护（推荐形态）

裸进程优先于 docker：避免在 devbox 拉 base image；PocketBase 静态二进制裸跑零依赖；持久卷挂宿主目录最简（research §2.2）。

```bash
# devbox 上：
useradd -r jjb 2>/dev/null || true
mkdir -p /opt/jjb-backend/pb_data && chown -R jjb:jjb /opt/jjb-backend
systemctl daemon-reload && systemctl enable --now jjb-backend
systemctl status jjb-backend   # 确认 active
curl -s http://127.0.0.1:8090/api/health   # 健康检查
```

systemd unit 见 `deploy/jjb-backend.service`（监听 127.0.0.1:8090，`--dir /opt/jjb-backend/pb_data`，`JJB_SCORING_CONFIG` 指向系数表）。

### 2.3 nginx /api 反代（加在现有 8080 server 块内，不动 location /）

反代片段见 `deploy/nginx-api.conf`。前端 `fetch('/api/...')` 同源 → 免 CORS。
含 realtime SSE 配置（`proxy_buffering off` + `proxy_read_timeout 86400s`）+ Admin UI（`/_/`）反代。

```bash
# devbox 上（docker nginx 容器，挂载宿主 nginx.conf 或 server 段 include）：
# 把 nginx-api.conf 内容追加到现有 8080 server 块内，nginx -t && nginx -s reload
```

### 2.4 Litestream 容灾（sidecar）

配置模板见 `deploy/litestream.yml`。实时增量复制 SQLite WAL → 对象存储，服务器炸了从桶恢复最多丢几秒。

```bash
# devbox 上（密钥走临时 env，不落盘）：
export LITESTREAM_ACCESS_KEY_ID=<...>
export LITESTREAM_SECRET_ACCESS_KEY=<...>
litestream replicate -config /opt/jjb-backend/litestream.yml &   # 或另起 systemd unit

# 灾难恢复演练：
litestream restore -o /opt/jjb-backend/pb_data/data.db s3://jjb-backend-backup/pb_data
```

> endpoint/bucket/path 占位待 yb 拍板实际对象存储（国内 OSS / MinIO / COS S3 兼容）。

---

## 3. schema ↔ live 同形映射表

见 `backend/README.md`「schema ↔ live 同形映射表」段（matches POST payload 字段 ↔ live `getSelectState`/`winLoseList`/`getScore` 的映射，证明 schema 与 live 选择状态同形）。

---

## 4. 三处需 hub/yb 拍板的 caveat（spoke 不自决，留 runbook 交 hub）

### caveat 1 — CF Pages 跨域 vs devbox nginx 同源
本 round 只在 devbox 内做 `/api` 同源反代（research §2.4-a，建议路线）。CF Pages 前端连后端的跨域/公网暴露受**内网穿透红线**约束（`jjb-public-deploy-policy`：严禁内网穿透，公网走 SRE/TLB 正规流程），是独立后续事项，**不阻塞 P5 本地/devbox 联通**，但 yb 需知「CF Pages 前端 + devbox 后端」最终拓扑要单独定。

### caveat 2 — payload_code 编码器归属
P3（码方案）与 P5（落库）复用同一编码器。本 round 只定 `matches.payload_code` 字段 + 长度上限 ~512，**编码器实现属前端/P3**。若 P3 未先做，P5 落库可先存「完整 JSON 快照」过渡（schema 字段不变，仅内容形态过渡），P3 编码器就绪后切索引码。建议 P3 先于「前端落库接线」完成。

### caveat 3 — 积分难度系数表未定稿（开放问题 #1）
本 round 取最简（std8=1.0 … rescue/hard=1.3，纯累加）+ 系数配置化（`config/scoring.json`）。真实系数（点金×2 是否计分 / 双打系数 / 连胜加成 / 赛季周期）须 **yb/土豆拍板** — schema 用 `delta+reason+season` 已留足空间，系数改不动 schema（改 JSON 重启即可），但**天梯上线前必须定稿系数**，否则积分无意义。
