---
name: jjb-run-broadcast
description: 集结杯运行/构建/直播采集：build 命令、本地服务、横条三形态 URL 与旗标语义、主播停靠 SOP、公网隧道、cutover 注意事项。要跑起来看效果、给主播配采集、对外测试、部署时使用。
---

# 集结杯运行与直播采集

## 构建与本地服务

```bash
# Cocos 构建（约 10-25s，exit 0 为准）
'/Applications/Cocos/Creator/2.4.13/CocosCreator.app/Contents/MacOS/CocosCreator' \
  --path . --build 'platform=web-mobile;debug=true'
# 本地服务：python http.server 跑在 7777，根 = build/web-mobile
# 设计参照服务（对照设计稿用）：python3 -m http.server 7799 --directory design/v4-r2
```

改完代码必须重 build 才能在 7777 看到；浏览器验证一律带 `?cb=<随机>` 防缓存。

## URL 旗标语义（jjbDesign 层，会话级持久）

| 旗标 | 含义 |
|---|---|
| 无旗标 | 上线形态：新 UI 默认接管（`?design=off` 才回老版 jjUI） |
| `?design=<home\|select\|battle\|result\|overlay\|obsbar>` | 直达某屏；无 live 数据时回落演示态（红色「演示数据」角标） |
| `?bartop=1` | 主播开播书签：任意入口生效整局持久，切横条=置顶停靠形态，控制 pill/导航在 232 采集线下 |
| `?design=obsbar&bare=1` | 裸横条：designResolution 切 1280×232，页面即横条（OBS 浏览器源/扁窗采集用） |
| `?auto=N&path=manual\|random` | 自动化：进模式 N + 二选层走向 |
| `?doubles=1` | 双打官突模式 |

## 主播 SOP（直播姬窗口捕获，零裁剪）

1. 开播书签：`http://<服务器>/index.html?bartop=1`，一个 Chrome 窗口玩整局；
2. 直播姬窗口捕获整个 Chrome；选人阶段把源放大给观众看；
3. 对局中切「横条」（置顶形态）→ 把源缩小、**贴画布底边停靠**：横条以下的背景自然坠出画布外，画面只剩横条；误拖最坏多露一条主题色边；
4. 判定：点采集线下方「⋯ 控制」→「对战」→ 判定 → 控制条「横条」回来（观众短暂看到停靠区里的对战页，可接受）；
5. 横条 33% 缩放可读性已验证（427px 宽基准）。

## 公网测试

**方式 A — 本机 Mac（带热重载，开发自看）**
```bash
brew install cloudflared   # 一次性
cd web && npm run dev       # Vite dev :7788，改代码热更新（vite.config 已放行 *.trycloudflare.com）
cloudflared tunnel --url http://localhost:7788   # 另开终端，日志取 https://*.trycloudflare.com
```
Mac 休眠/合盖隧道断；URL 随进程重启更换。

**方式 B — 开发机 devbox（服务器不休眠，最稳；2026-06-19 实测通）**
开发机出网走公司 HTTP 代理，cloudflared 默认 QUIC/UDP 穿不过，**必须 `--protocol http2` + 代理 env**：
```bash
ssh devbox-tianlang   # cloudflared 装在 ~（curl github release 走 proxy）
export https_proxy=http://sys-proxy-rd-relay.byted.org:8118 http_proxy=$https_proxy no_proxy=.byted.org,localhost,127.0.0.1
nohup ./cloudflared tunnel --protocol http2 --url http://localhost:8080 > ~/cf-tunnel.log 2>&1 &   # 指向 nginx 8080
grep trycloudflare.com ~/cf-tunnel.log   # 取公网 URL
# 拆除：pkill -f "cloudflared tunnel"
```
开发机版指向 nginx 静态服务（无 Vite allowedHosts 坑）；**改代码 → push → 重部署 devbox（git pull+build+nginx restart），公网 URL 自动服务新版本，隧道不用动**。
⚠️ 政策：内网穿透在公司网络属《网络代理与内网穿透》文档明令禁止项；开发机是共享基础设施，Claude Code auto 分类器会拦，需用户开完全访问权限并明确授权才跑。见 [[jjb-public-deploy-policy]]。

纯前端静态站，访问者会话各自独立可并发测。trycloudflare 大陆可达性看运营商（参照系：线上老版在 workers.dev 即 Cloudflare 系，受众历史可达）；URL 随进程重启/devbox 重启更换；**固定地址 + 零机器依赖方案 = Cloudflare Pages（连 GitHub 仓库 xxpp111/jijiebei：根目录 web / `npm run build` / 输出 dist / Production branch jjb-live-dock，与现有线上同通道）**。

## cutover / 发版注意

- 部署即 cutover：新 UI 默认接管，需在部署窗口做全模式真机 + OBS 16:9 动态回归（projectplan 有记录）；
- `GOLD_FACTORS`（JJBData）默认空数组，赛事启用金色强化因子时填名单重 build；
- 推送 origin（github.com/xxpp111/jijiebei）权限已验证；`fix/jjdata-factor-score-backfill` 数据分支同样待推；
- XP 侧需重 build + 重部署，判定语义对齐记录见 projectplan P5 节。
