# ⚠️ 本目录 = Cocos XP 原工程（只读化石）

这是集结杯前身——Cocos Creator 2.4 项目「XP 版」的原工程资产，**保留可复活状态，内容一律不改**（红线总清单见根目录 [AGENTS.md](../AGENTS.md) 第 1 条）。

- `Script/jijie2/`：XP 抽签引擎**原件**。新平台的运行期真身是它的 verbatim 复刻副本 `web/src/logic/legacy/`（对照表见那边的 README）——改引擎行为去改副本，绝不回改这里。
- `resources/jjdata/*.txt`：赛制配置（ban指挥官/因子/指挥官/地图/规则参数）的**原件真相源**。web 运行期读的是逐字节同步副本 `web/src/data/jjdata/`——改配置必须两处同改，缺一处就是行为漂移。
- 其余（Scene/、resources/images/ 等）：Cocos 场景与美术资源，纯历史。

根目录的 `creator.d.ts` / `project.json` / `template*` / `settings/` / `jsconfig.json` / 根 `tsconfig.json` 同属本工程的脚手架，一并只读。`library/ build/ temp/ local/` 是 Cocos 构建缓存（已 gitignore，可随时删、可再生）。
