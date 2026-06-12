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

```bash
brew install cloudflared   # 一次性
cloudflared tunnel --url http://localhost:7777   # 后台跑，日志里取 https://*.trycloudflare.com
```

纯前端静态站，访问者会话各自独立可并发测。trycloudflare 大陆可达性看运营商（参照系：线上老版在 workers.dev 即 Cloudflare 系，受众历史可达）；URL 随进程重启更换；固定地址方案 = wrangler 部署 Cloudflare Pages（与现有线上同通道）。

## cutover / 发版注意

- 部署即 cutover：新 UI 默认接管，需在部署窗口做全模式真机 + OBS 16:9 动态回归（projectplan 有记录）；
- `GOLD_FACTORS`（JJBData）默认空数组，赛事启用金色强化因子时填名单重 build；
- 推送 origin（github.com/xxpp111/jijiebei）权限已验证；`fix/jjdata-factor-score-backfill` 数据分支同样待推；
- XP 侧需重 build + 重部署，判定语义对齐记录见 projectplan P5 节。
