---
name: jjb-deploy
description: 集结杯部署到开发机 devbox-tianlang（10.37.220.128）的持久化 docker nginx 链路。核心解决"开发机外网受限、拉不到镜像"这一最大障碍。要把站点部署/更新到开发机、排查 8080 不可达、换机器重新部署时使用。
---

# 集结杯开发机部署

## 🎯 目标
把集结杯 React/Vite 站点跑成 **docker nginx `--restart=always`** 服务，托管于开发机
`devbox-tianlang`（`10.37.220.128`）的 **8080** 端口，公司内网任意机器经 IP 可访问、机器重启自愈。

## ✅ 外网已通（2026-06-18 配好 dockerd proxy）—— 直接 pull 即可
- **现状**：dockerd 已配公司透明代理，开发机可直接 `docker pull`。配置在
  `/etc/systemd/system/docker.service.d/http-proxy.conf`：
  `HTTP(S)_PROXY=http://sys-proxy-rd-relay.byted.org:8118`、`NO_PROXY=.byted.org,localhost,127.0.0.1,::1`，已持久化（重启保留）。
- **历史教训（换机器/proxy 失效时回看）**：dockerd **不读 shell 的 http_proxy env**——curl 经 proxy 通≠`docker pull` 通，
  必须配在 systemd 层并 `sudo systemctl daemon-reload && sudo systemctl restart docker` 才生效。
  重启 daemon 前确认 `live-restore: true`（重启不杀 running 容器）。
- **proxy 故障/换无代理机器的 fallback** = 从本地灌镜像（见末尾「附：本地灌镜像 fallback」）。

## 🧱 前置依赖
- `ssh devbox-tianlang` 通（`~/.ssh/config` alias，User=baitianlang，gssapi Kerberos）。先 `ssh devbox-tianlang echo ok`；失败先 `kinit` 续 Kerberos ticket。
- 开发机：node v22 / npm / git / docker（18.09，daemon `is-enabled=enabled`、`live-restore=true`）均已具备；github / npm registry / docker registry（经 proxy）均通。

### 🔍 部署前必查：迁移核对
任何「只更新 web」的部署前，先在本地仓库根目录跑：
```bash
node backend/scripts/check-migrations.mjs
```

它会读取本地 `backend/pb_migrations/*.go` 的迁移 id，并通过 `devbox-tianlang` 只读查询 PocketBase `_migrations.file`。若输出缺口或命令非 0，**必须先做 backend 部署**：推送包含这些 migrations 的新二进制，并在 backend 侧完成 `migrate up`，不能只更新 web。

2026-07-02 真实事故：backend 二进制停在 Jun 26，web `682f09b` 上了依赖 `player_accounts` / `event_rules` 新 collection 的注册功能，公网用户实测注册 404 `Missing or invalid collection context`。

## 🛠 部署步骤

### ① 准备 nginx 镜像（proxy 已通，开发机直接拉 native amd64）
```bash
ssh devbox-tianlang 'docker pull nginx:1.27-alpine'   # 经 dockerd proxy 直连，自动 amd64
```
> proxy 失效 / 换无代理机器时改用本地灌镜像（见末尾 fallback）。

### ② 开发机 clone + build（独立临时目录，不碰本地工作树）
```bash
ssh devbox-tianlang 'set -e
cd ~ && rm -rf jijiebei-deploy
git clone https://github.com/xxpp111/jijiebei jijiebei-deploy
cd jijiebei-deploy && git checkout jjb-live-dock
echo "HEAD=$(git rev-parse --short HEAD)"   # 记录基线；应为 origin 已 push 的稳定 commit
cd web && npm ci && npm run build
test -f dist/index.html && echo "build ok ($(du -sh dist|cut -f1))"'
```

### ③ 起持久化容器
```bash
ssh devbox-tianlang 'cd ~/jijiebei-deploy/web
docker rm -f jijiebei-nginx 2>/dev/null || true
docker run -d --name jijiebei-nginx --restart=always -p 8080:80 \
  -v "$(pwd)/dist":/usr/share/nginx/html:ro nginx:1.27-alpine'
```

## ✅ 验证
```bash
# 开发机自检
ssh devbox-tianlang 'docker ps --filter name=jijiebei-nginx --format "{{.Status}}"; \
  docker inspect -f "restart={{.HostConfig.RestartPolicy.Name}} count={{.RestartCount}}" jijiebei-nginx'
# 期望：Up / restart=always / count=0（count>0 多半是架构不对在崩溃循环）
# 外部可达（在自己机器上跑，验"大家能访问"）
curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" http://10.37.220.128:8080   # 期望 200
curl -s http://10.37.220.128:8080 | grep -o 集结杯                                   # 期望命中
```
持久化保证：`systemctl is-enabled docker`=enabled + 容器 restart=always → 机器重启 docker 自启、容器自动恢复；进程崩溃自动拉起。

## 🔁 更新线上（站点改了/双打 round 合并后）
dist 是只读挂载，**rebuild 后重启容器即生效**，无需重建容器。
**⚠️ git 不走 dockerd proxy**——`git fetch`/`pull` 走 https，必须自带 shell proxy env，否则连 github 443 超时（dockerd 的 systemd proxy 只对 `docker pull` 生效）。
且 fetch 失败时务必**强校验 HEAD**：`a && b && c` 列表中间命令失败时 `set -e` **不触发**，会静默 build 旧码：
```bash
ssh devbox-tianlang 'set -e
export http_proxy=http://sys-proxy-rd-relay.byted.org:8118 https_proxy=http://sys-proxy-rd-relay.byted.org:8118 no_proxy=.byted.org,localhost,127.0.0.1
cd ~/jijiebei-deploy
git fetch origin jjb-live-dock
git reset --hard origin/jjb-live-dock
H=$(git rev-parse --short HEAD); echo "HEAD=$H"
[ "$H" = "<期望commit>" ] || { echo "FETCH-FAILED 仍非目标 commit，中止"; exit 1; }
cd web && npm run build && docker restart jijiebei-nginx'
# 外部复验服务的是新构建（JS 哈希应随改动变）：
curl -s http://10.37.220.128:8080 | grep -oE "index-[A-Za-z0-9_]+\.js"
```
> 历史基线：dist 曾来自 `5f9380c`→`2186144`(R5)→`b407227`(R7 双打真引擎，JS 哈希 `BS3hM_hn`)。

## 🚨 故障排查
| 现象 | 根因 | 处置 |
|---|---|---|
| `docker pull` 超时 | dockerd proxy 失效/未配 | 查 `cat /etc/systemd/system/docker.service.d/http-proxy.conf` + `sudo systemctl show docker --property=Environment`；缺失则重配（见顶部）或用本地灌镜像 fallback |
| `git fetch/pull` 连 github 443 超时 | git 不走 dockerd proxy | 更新命令前 `export http_proxy/https_proxy=…:8118`（见🔁更新段）；fetch 后**强校验 HEAD**，否则 build 旧码 |
| 容器 `Restarting`，`docker logs` 报 `exec format error` | 镜像架构不对（灌了 arm64） | 直接 `docker pull`（proxy 通会取 amd64）；或本地 `save` 必须带 `--platform linux/amd64` 重灌 |
| `curl 000` / 8080 不可达 | 容器没起或在崩溃循环 | `docker ps -a` + `docker logs jijiebei-nginx` 看真因 |
| ssh `Permission denied` | Kerberos ticket 过期 / 用错默认 user | 用 alias `devbox-tianlang`（User=baitianlang），`kinit` 续票 |

## 👤 边界 / 不要动
- **不动 8765**（开发机既有 python3 doc 服务）；不开公网端口 / 不配 HTTPS（先用 IP 内网访问）。
- clone 用独立目录 `~/jijiebei-deploy`，**不碰本地 macOS 工作树**（避免撞正在跑的 round）。
- 只部署 origin 已 push 的稳定 commit，不部署未 push 的半成品。

## 附：本地灌镜像 fallback（proxy 失效 / 换无代理机器时）
开发机拉不到镜像时，从本地（能上外网的机器）灌：
```bash
# 本地强制取 amd64 后用 --platform 导出（关键：arm64 镜像灌 x86_64 会 exec format error）
docker pull --platform=linux/amd64 nginx:1.27-alpine
docker save --platform linux/amd64 nginx:1.27-alpine | ssh devbox-tianlang 'docker load'
ssh devbox-tianlang 'docker run --rm nginx:1.27-alpine nginx -v'   # 能跑起来即架构正确
```
> docker desktop 的 `image inspect {{.Architecture}}` 在 containerd store 下可能显示空——以能否跑起来为准。
