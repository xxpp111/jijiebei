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

Cocos Creator 2.4.13 web 工程。

```bash
# 构建
'/Applications/Cocos/Creator/2.4.13/CocosCreator.app/Contents/MacOS/CocosCreator' --path . --build 'platform=web-mobile;debug=true'
# 本地预览
python3 -m http.server 7777 --directory build/web-mobile
```

预览 URL：`localhost:7777/?design=<home|select|battle|result|overlay|obsbar|dock>&style=<metal|sc2|minimal>&mode=<dark|light>`

## 架构方向

前端正从 Cocos `cc.Graphics` 程序化渲染迁移到 React / HTML（逻辑引擎 `jijie2` 保留为纯 TS 库、零改）。动机：根治设计精度损耗 + canvas 文字 blur、包体 2.5MB→~200KB、与 Claude Design 稿 1:1 直连。详见 [`react-migration-plan.md`](react-migration-plan.md)。
