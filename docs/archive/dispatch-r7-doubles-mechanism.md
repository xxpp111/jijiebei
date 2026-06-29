<!-- dispatch_contract:v1 target=claude-session entry=goal | marker: jjb-r7-doubles-mechanism -->
<!-- 创建会话：cd /Users/bytedance/项目/jijiebei && claude -n jjb-r7-doubles -->
<!-- 第一条输入：/goal + 下面 <objective>…</persistence> 整段；之后接续粘贴 EXECUTE PROMPT 段 -->

<objective>
双打机制大轮：把双打从「占位脚手架」推向「真赛制」，并统一点金/BP 机制。一个 session 分 5 phase 串行推进。
基线 = jjb-live-dock，HEAD=2186144，**工作树含 r6 未提交改动**（jjbView.ts 门面 + 品牌金字 + 双打下游渲染，本体改对要保留）。
背景：主播实测出 4 类深层问题（官突误用点金金框 / 双打因子不能点金 / 官突写死非真表 / BP 配置面是孤岛不生效），
hub 已全方位调研定位（见 context 的 file:line）。按 phase 从「止血明确项」到「真引擎大块」推进，大块遇开放项即停报。
</objective>

<scope>
【Phase 1 · r6 收口 + 官突改额外边框（小·先做）】
- 回退红线越界：git checkout HEAD -- design/poster-r1/gen_bg.py（Codex r6 蔓延改了海报任务文件，design/ 红线）。
- 官突撤金框 → 改「额外边框」标识官方突变：FactorFrame.tsx 现有 gold(金框 border-factor-gold.png)/tag(角标) 两通道；
  新增第三种「官突专属边框」视觉（区别 BORDER_NORMAL 绿框与 BORDER_GOLD 金框——如特殊色描边/外环 + 官突角标），
  用 tag==='官突' 或新 prop 触发，**不再传 gold**。
  改这 4 处官突渲染去 gold、改官突框：SelectScreen.tsx:582、MatchRow.tsx:64-73、ObsBar.tsx:71-80、ResultScreen.tsx:96
  （gold={lockedFactors.includes(f)} 是 r6 新增，撤掉）。
- e2e 断言翻转：web/e2e/r6-doubles-downstream.mjs:136/165/185 的 expectedGold「官突=金框」断言，翻转为「官突=额外边框、非金框」。
- 验证：真机截 battle/select/obs/result 双打，官突显示额外边框（非金框），与玩家点金金框可区分。

【Phase 2 · 双打因子支持玩家点金（中）】
- DoublesSelect 随机因子池(SelectScreen.tsx:606)+已填随机槽(:588)+官突槽 各加 GoldBadge（复用单刷模板 :306/341），gold={getGoldFor(f)}。
- 复用 jjbSession.toggleGold/getGoldFor（jjbSession.ts:691/698，goldRuntime 全局 Set 按因子名，跨单双打共用）；
  纯 React 视觉态，**不动引擎**；双打点金不×2入分（对齐双打 per-match 现状，不强接引擎计分）。
- 顺带修过时注释 jjbSession.ts:687「不入计分」（单打现已×2入分）。
- 验证：双打随机因子+官突都能玩家点金（点金后金框，与官突额外边框可叠加/区分）。

【Phase 3 · BP 模式门控接通（小-中）】
- getBpModeEnabled(mode)(bpConfig.ts) 接进 SelectScreen：BpBadge 渲染(:342)加模式门控——⑥配置面开关 off 的模式不渲 ban 角标、不参与校验；
  让配置面开关真正决定 select 是否显示 BP。统一 bpConfig mode key(std8/.../doubles) 与 s.mode 口径。
- 修配置面对 std12/rescue/feiqiu「默认关」虚假声明（现实恒开，与门控同步修正）。
- **stop 边界**：「自选指挥官半边 + 二选一互斥」「双打 BP」需先与用户对齐赛制真相（二选一每场/整局、自选是否消耗手选因子额度）→ 停报，不自行假设。
  本 phase 只做「模式门控接通 + 修虚假声明」。
- 验证：⑥配置面 toggle 真影响对应模式 select 是否显示 BP。

【Phase 4 · 官突接 CSV 真表 = 双打真引擎核心（大·遇开放项停报）】
- web 侧双打引擎读 docs/官突ABC配置_官突池.csv（153条，列：突变名/地图/因子(点数)/点数和/初筛档 A|B|C），
  按 ABC 档**每场抽 1 官突**（含其地图 + 1~4 个锁定因子带点数），替代写死 DOUBLES_CONFIG.mutators/maps。
- 架构（projectplan ③双打 Phase2 定稿）：在 **web/src/logic/jjbDoubles.ts 真引擎化**（镜像现 API 形状 start/matches/setVerdict/debugSnapshot 兼容回归），
  **不改 assets/Script/jjbDesign/JJBDoubles.ts（Cocos 占位引擎，红线只读）**。
- 缺图过滤：官突池 57 唯一因子仅 2 缺图、15 地图仅熔火危机缺图——抽取时过滤缺图项（assets/resources 红线只读不补图）。
- 定稿对照（projectplan.md:1944-1967）：官突双打=抽 ABC 官突；飞球双打=混乱工作室+{礼尚/风暴/虚空}随机1。
- **stop 边界（命中即停报，不自行拍）**：①指挥官分不分 A/B 档（飞书16扁平 vs yb定稿AB档冲突未拍死）②额外因子 n 预算/点数贪心 ③飞球双打是否本轮一并做。
  遇这些→停报，先做官突双打主干、列开放项。
- 验证：双打三场官突从 CSV 真表按档抽（不再恒定风暴+虚空），__jjbDebug.doubles 透出真实抽签。

【Phase 5 · 验证收口】
- cd web && npx tsc --noEmit && npm run build && node e2e/run.mjs（全绿）。
- 真机 Playwright 全验：官突额外边框非金框 / 双打因子可点金 / BP 配置门控生效 / 官突真表抽签（若 Phase4 完成）。
- 全回归零回退：单打 9 模式恒等式 / feiqiu / 单刷BP / ⑥ / R5 已修 select 双打 / r6 门面(jjbView)+品牌金字 / 难度分。

红线只读（碰即停）：assets/Script/jijie2/** · Scene/** · design/**（回退 poster 越界，不碰 design CSS，官突框改 web 侧）·
assets/resources/**（缺图过滤不补）· assets/Script/jjbDesign/JJBDoubles.ts（Cocos 占位；Phase4 真引擎在 web/src/logic/jjbDoubles.ts 做）。
禁破坏不变量：五项根治 / difficultyTotal / matchDifficulty / feiqiu / 单刷因子BP / ⑥BP配置 / R5 已修 select 双打 / r6 门面+品牌 / 9 模式恒等式。
</scope>

<validation>
done-when：每 phase 真机/e2e 证（见各 phase 验证行）。proof 真跑贴回：
<pre lang="bash">
cd web && npx tsc --noEmit && npm run build && node e2e/run.mjs 2>&1 | tail -8
</pre>
真机：Playwright 截 双打 battle/select/obs/result + 单打回归，逐屏断言（禁「看起来对」）。
</validation>

<stop_when>
- Phase 3 自选半边/双打BP 需赛制对齐 → 停报。
- Phase 4 指挥官 AB 档 / n 预算 / 飞球归属 开放项需拍板 → 停报（先做官突主干）。
- 要改 design/** 红线 CSS 或 Cocos JJBDoubles.ts 才跑通 → 停（web 侧做）。
- 不变量回退且非本改动引入 → 停报基线异常。
- 某 phase tsc/build/e2e 持续失败且 scope 内修不了 → 停。
</stop_when>

<context>
hub 全方位调研结论（file:line，照做不必重查）：
- 点金状态机 jjbSession.ts:691/698（toggleGold/getGoldFor）、×2 计分 :767-769、过时注释 :687；GOLD_FACTORS 空 JJBData.ts:51。
- FactorFrame 双通道：gold(金框) FactorFrame.tsx:24/29；tag 角标 :32（锁定/官突 .lock 暗底 design/v4-r2/v4.css:78-81）；accent 金 #D8B15A theme.css:12。
- 官突写死 mutators=['风暴英雄','虚空裂隙'] JJBDoubles.ts:8；matches() :143-154；start() :63-79 不读 CSV。
- 官突误 gold 四处：SelectScreen.tsx:582(已提交)、MatchRow.tsx:64-73(r6)、ObsBar.tsx:71-80(r6)、ResultScreen.tsx:96(r6)；jjbView.currentLockedFactors :51-52。
- 双打池零 GoldBadge：DoublesSelect SelectScreen.tsx:588/606；单刷模板 :306/341。
- BP 孤岛：bpConfig.ts:14-21 定义但 getBpModeEnabled 全仓零消费者(仅 BpConfigScreen 自读)；单刷 ban jjbSession.ts:707-727 真生效但不分模式恒开、与⑥脱钩；自选半边/双打BP 未做。
- r6 门面 jjbView.ts(改对保留)；红线 JJBDoubles/jjbDoubles/jijie2 字节零改（除 design/poster 越界）。
- 官突真表 docs/官突ABC配置_官突池.csv（153条）；细则 docs/规则一-官突加n-细则v1.md；定稿 projectplan.md:1944-1967。
必读：SelectScreen.tsx / FactorFrame.tsx / jjbDoubles.ts / jjbSession.ts(gold/ban) / bpConfig.ts / jjbView.ts / JJBDoubles.ts(只读) / projectplan.md:1812-1967。
</context>

<harness>
写代码 round，按 harness-pro 尽力跑（planned_phases=5；reviewer-config=config/harness-pro-reviewers-r3-react.json；runtime-dir=.harness-pro-r7 每条 CLI 显式 --runtime-dir）。
已知：guard 拦 runtime 路径写，verify-report 生成可能卡——若 review pipeline 跑不完，照常交付代码 + 完整自验(tsc/build/e2e/Playwright)，hub 补对抗复核，不为绕 guard 改 runtime artifact。
起跑 live probe /v1/models 确认 reviewer alias（用暴露 alias，禁 internal key）。
</harness>

<motivation>
把双打从占位变真赛制的核心轮，直接决定主播能否真用双打直播。逐 phase 推进、每 phase 截图自验、大块遇开放项停报对齐，比一次硬冲更稳。
</motivation>

<persistence>
scope 内可逆动作直接做，不中途交还；stop_when 优先于 persistence。make reasonable assumptions and document them。
proof 真跑贴回。红线/Cocos占位引擎/缺图不补 三条绝对守。不自行 commit/push（hub 拍）。phase 间发 ≤10 行小结。
</persistence>

============================================================
EXECUTE PROMPT（/goal 之后接续粘贴，与契约同等效力、就严从严）：

1.【自主长跑】你在自主长跑修双打机制，用户不实时盯屏：可逆且 scope 内动作直接做，不"要不要我…"收尾。每回合末自检——是计划就用工具做掉；只有 stop_when 命中或只有用户能解锁时才收手。
2.【phase 串行】严格按 Phase 1→5 顺序；每 phase done 后 proof 真跑贴回 + ≤10 行小结再进下一 phase。Phase 1（官突额外边框）先单独做完截图，那是主播看到的核心修复。
3.【证据先于断言】每条"完成/PASS"对应本 session 真实工具结果；proof 命令真跑贴回原文，未验证明说。真机截图逐屏 expect，禁"看起来对"。
4.【红线绝对】design/** 与 Cocos JJBDoubles.ts 只读；官突额外边框/点金/真引擎全在 web/src 做；缺图过滤不补 assets/resources。触红线即停。
5.【stop_when 绝对优先】Phase3 自选半边/Phase4 AB档等开放项触发即停-报，禁自行拍板赛制；不确定=停。
6.【harness】init 后每条 CLI 显式 --runtime-dir .harness-pro-r7；review 显式 --reviewer-config + --model-config；guard 拦 verify-report 则交付代码 hub 补复核，不绕 guard 改 runtime。
7.【交付】产物路径 / proof 输出原文 / 新文件清单(待 hub 拍 commit) / 各 phase 完成度 / 开放项停报清单 / 遗留 caveat 如实列。不自行 commit/push。
