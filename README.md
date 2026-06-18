# 集结杯（JJB）

星际争霸 2 合作任务电竞赛事工具——按比赛规则随机「突变因子 × 指挥官」组合，用于单刷 / 双打挑战赛。B 站主播「土豆」主办 × 社区 MOD「CM」联名。

## 真相锚点

- **当前计划 / 迭代记录**：[`projectplan.md`](projectplan.md)
- **前端 React 迁移规划**：[`react-migration-plan.md`](react-migration-plan.md)
- **设计源**：`design/v4-r2/`（live 设计轮，6 主题 metal / sc2 / minimal × dark / light）；`v1`–`v4-input` 为历史轮
- **规则 / 知识库**：`knowledge-base/`、`mode-rules-truth-table.md`
- **后端逻辑引擎**（红线，XP 维护）：`assets/Script/jijie2/`（`JijieData` 状态 / `JJConfigData` 随机抽取，纯 TS 零 Cocos 依赖）
- **当前前端**（Cocos 渲染层，迁移中）：`assets/Script/jjbDesign/`

## 运行

React + Vite 工程（源码在 `web/`）。

```bash
cd web
npm install              # 首次安装依赖
npm run dev              # 本地开发服务器（Vite）
npm run build            # 构建到 web/dist
npm run preview          # 预览构建产物（端口 7788）
node e2e/run.mjs         # 逻辑回归：9 模式池=槽恒等式 + 双打全路径
npm run e2e:ui           # UI 冒烟（构建 + ui-smoke）
```

URL 走 query 参数切换屏幕/模式/主题（`?screen=`/`?mode=`/`?style=`/`?theme=`）。
直播采集与横条形态见 `jjb-run-broadcast` skill；部署到开发机（DevBox docker nginx 8080）见 `jjb-deploy` skill。

## 架构方向

前端正从 Cocos `cc.Graphics` 程序化渲染迁移到 React / HTML（逻辑引擎 `jijie2` 保留为纯 TS 库、零改）。动机：根治设计精度损耗 + canvas 文字 blur、包体 2.5MB→~200KB、与 Claude Design 稿 1:1 直连。详见 [`react-migration-plan.md`](react-migration-plan.md)。
