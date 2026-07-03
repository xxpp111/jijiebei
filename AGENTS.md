# AGENTS.md — 集结杯红线与硬约定（人与 AI 共读）

> 本文件是全仓红线的**唯一集中声明**。此前这些约束散在 CSS 注释、legacy README、部署文档 caveat 和维护者个人记忆里——新维护者（人或 AI agent）改任何代码前先通读本文件。各条目的展开解释在括号所指的就近文档/注释里。

## 一、代码分层红线（哪层能动）

1. **XP 化石层只读**：`assets/`（含 `Script/jijie2/` 抽签引擎原件）+ 根目录 Cocos 脚手架（`creator.d.ts` / `project.json` / `template*` / `settings/` / `jsconfig.json` / 根 `tsconfig.json`）一律不改内容。它们是 Cocos Creator 2.4 原工程，保持「可复活」状态（物理搬迁会破坏 Cocos 路径耦合，同样禁止）。（层次说明：README §1.5；路标：assets/README.md）
2. **legacy 复刻引擎只调用不改内部**：`web/src/logic/legacy/`（JJConfigData / JijieData / JJBData）是从 XP verbatim 逐字复刻的运行期真身。确需修正走「只改副本、绝不回改原件」规则，且每次偏离要在文件头登记。（对照表与分叉规则：web/src/logic/legacy/README.md）
3. **jjdata 双副本必须同步**：赛制配置真相源 = `assets/resources/jjdata/*.txt`（原件），运行期读 `web/src/data/jjdata/*.txt`（副本，jjbSession 经 import.meta.glob 捆绑）。改任何一处必须两处同改（单源化 cutover 是独立高风险轮，完成前双份并存）。
4. **design/v4-r2/ 只读**：theme.css / v4.css / styles.css 是设计基座，web 层需要改视觉时在 `web/src/styles/` 用**双类 specificity 覆盖**，绝不改基座源文件。已知坑：`theme.css` 的 `.jjb button{background:none;color:inherit}` reset 会吃掉低特异性按钮样式——新按钮样式必须带 `.jjb ` 前缀提特异性（先例：badges.css 头注释）。

## 二、行为契约红线（哪些不变量不可破）

5. **池=槽恒等式 + 9 格契约**：单打 9 模式下「随机池可用因子数 == 待手选槽位数」、`selectedFactorList` 长度恒 9。任何抽签/选择逻辑改动后必须过 `web/e2e/run.mjs` 恒等式门。
6. **双打 4 variant 契约**：doubles / feiqiu-doubles / std15 / cm 的 per-variant 配置（锁定因子/待选数/候选池/指挥官 A·B 构成）见 `jjbDoubles.ts` VARIANT_SPECS 与 `mode-rules-truth-table.md`，改动过 doubles 三套 e2e。
7. **codec schema v1 冻结**：`web/src/logic/codec.ts` 的对局码 schema 已有现网历史码，字段只增不删不改语义（包括看似恒 false 的 `modeStd15`/`modeCm` flags——它们是 schema 兼容字段不是死代码）。改动过 `e2e/codec.mjs` 往返门。
8. **legacy 单例的池母本恢复**：任何绕过 jjbSession 直调 legacy 抽签的新代码，必须先 `restoreConfig()`（ConfigData 是可变单例，抽签消耗母池，漏调会跨局枯竭）。

## 三、数据与部署红线

9. **`backend/pb_data/` 现网数据绝不直接操作**：本地测试一律起隔离 PB 临时目录（先例：`web/e2e/auth-perm.mjs` 自起隔离实例）。PB 语义陷阱：集合匿名读被 listRule 挡时返回 `200 + 空列表` 而非 403——curl 看到空数组不代表集合真空，用 superuser token 复核。
10. **devbox 部署方式不变**：nginx 容器挂 `~/jijiebei-deploy/web/dist` + `jjb-backend` systemd + git fetch/build 流程（详见 docs/deployment.md）。**只更新 web 前必跑 `node backend/scripts/check-migrations.mjs`**（迁移债核对，2026-07-02 事故教训）；devbox 上 git fetch 必须带 shell proxy env 且 fetch 后强校验 HEAD。
11. **三方 key 字面量不落盘**：Dubhe / 对象存储 / tunnel 凭据走 env 临时注入，不进 git、不进文档示例。
12. **cloudflared tunnel 进程不重启**：quick tunnel 重启换 URL，公网链接作废。

## 四、工程约定

13. **commit 时机**：由维护者（hub）终验后拍板；多 agent round 中执行侧（spoke）不自行 commit，交清单回来。
14. **失活孤儿清理**：本次改动导致失活的 import/变量/函数要清掉；**原本就存在的 dead code 不顺手删**（标注即可，删除走专门批次并留证据）。
15. **e2e 断言纪律**：`__jjbDebug` 是 e2e 的唯一读数契约，改 expose 层字段名 = 破坏所有下游断言；大改后做「护栏自检」——故意破坏一个字段确认对应 e2e 真的会红。
16. **e2e 截图坑**：页面整高截图在超高页面会 400，量几何用 `getBoundingClientRect` 断言、不要截图比对；本机 shell 有 ANSI 色码坑，spawn 子进程跑 e2e 时带 `NO_COLOR=1`。
