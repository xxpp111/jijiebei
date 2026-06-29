<!-- dispatch_contract:v1 target=claude-session entry=goal | marker: jjb-kb-rewrite -->
<!-- 执行位：官方 Claude Code session（无三方 env；copy-paste 模式，改 live 公司 KB）。原 GLM-5.2/Dubhe 版因平台限流改官方。 -->
<!-- 创建会话（官方 Claude，无三方 env 前缀，可直接粘贴）：
cd /Users/bytedance/项目/jijiebei && claude -n jjb-kb-rewrite-official
第一条输入：/goal + 下面 <objective>…</motivation> 整段；之后接续粘贴 EXECUTE PROMPT 段 -->

<objective>
把集结杯飞书知识库 7 篇文档**直接在 live 文档上 rewrite**，对齐当前代码真相（R7 真引擎 + Phase A 已落地），并让整体结构**清爽美观**——是重组、不是在旧内容上追加纠错。

背景：代码已推进到 R7（双打真引擎/非酋之轮/降权·ban·虚空7 已落地 web 代码），KB 7 篇整体落后约一个大版本。hub 已做完审计 + 更新本地真相表。yb（2026-06-19）拍板：①降权已做②样板篇删③ban清空④虚空重生者7⑤直接改 live 不沙盒（有编辑权限，反正会迭代）⑥**尽量别无脑堆叠，结构清爽美观**。
</objective>

<scope>
可以动（lark-cli docs +update 改这些 live 文档；新租户 mcn1taa2k785，身份 --as user=白天朗，编辑现有文档实测通）：
- 总览              obj=CBvGdEAEko3BFdxhzVgc9ccMnYf  → rewrite（技术栈/模式清单/导航三大件）
- 比赛模式与规则    obj=QsbMdhiPsoEgmYx2qOdcxfgenCe  → tweak（双打行/删降权幻觉→改已实现/加非酋之轮）
- 软件架构与渲染    obj=C31Ad2lWMo9V6qxgyoDcsRTgnye  → rewrite（去 Cocos 化+补 React/Vite+jjbView门面）
- 协作与开发流程    obj=ScLNdtFsOoA5nPxXMCjc9EQUneh  → rewrite（补部署链路+harness-pro/agent-dispatch+design-sync）
- 当期赛事配置      obj=MvZididNPogrPMxPKCucaN5inoe  → rewrite（补定位锚点+CSV官突池真值+非酋之轮+当期数值）★错最多先改★
- 开放问题与决策    obj=NXOEdbtP7oamDExgq6acxM7SnPe  → tweak（Q10双打结案+随机消项+BP标已实现）
- 架构与协作(样板)  obj=ATFadgFpkobbHdxBac9c7uFbnyg  → 删（删不动则清空内容改成一句话导航占位指向软件架构+协作两篇）

不要动：
- 任何代码 / repo 文件（真相已由 hub 在代码侧落地，本任务只改文档）
- 文档里的 `<whiteboard token="...">` 块——**绝不能丢**（丢了画板就没了）；rewrite 时保留原画板块，改完回读自检画板块还在
- 不建新 wiki 节点（白天朗权限建新页被拒 131006）；新增内容并进已有文档，不开新页
- 配色/边框/字号视觉语言（沿用 v4-r2，本轮是文字内容时效，不重设计画板视觉）

真相优先级（拿不准查这个顺序，不编）：
1. 本地真相表 `mode-rules-truth-table.md`（hub 已更新到 R7，**0) 节 = 当前现状权威**，与下方旧表冲突以 0) 节为准）
2. `tmp/kb-audit-findings.md`（hub 审计的逐篇 top 改动 + 跨篇统一改动 + 已拍板项）
3. 当前代码 `web/src/logic/{jjbSession,jjbDoubles,jjbView,bpConfig,commanderWeight}` + `web/src/data/mutatorPool` + `web/src/screens/HomeScreen` + `docs/官突ABC配置_官突池.csv` + `assets/resources/jjdata/{指挥官配置,规则参数配置,ban指挥官}.txt`
</scope>

<validation>
done-when：
- 7 篇逐篇 update 完，正文反映当前真相（双打真引擎/非酋之轮/Phase A/去 Cocos/部署链路），跨篇统一事实一致（非酋正名、双打 A4+B2 CSV、降权已实现、ban 清空、虚空7）
- 每篇**定位锚点在位**：「集结杯=《星际2》合作任务『单刷/双打挑战赛』；本软件=按比赛规则随机生成『突变因子(Mutator)组合』的工具，记分/展示只是外壳」
- **结构清爽**：rewrite 重组（删冗余、合并重复、层级清晰），不是旧文上叠加纠错段；样板篇已删或降级为导航占位
- 所有原 `<whiteboard>` 块保留未丢

proof（必须真跑贴回原文）：
<pre lang="bash">
# 改后逐篇回读自检（正文长度 + 画板块还在）
for obj in CBvGdEAEko3BFdxhzVgc9ccMnYf QsbMdhiPsoEgmYx2qOdcxfgenCe C31Ad2lWMo9V6qxgyoDcsRTgnye ScLNdtFsOoA5nPxXMCjc9EQUneh MvZididNPogrPMxPKCucaN5inoe NXOEdbtP7oamDExgq6acxM7SnPe; do
  lark-cli docs +fetch --api-version v2 --doc $obj --as user | jq -r '.data.document.content | length'
done
</pre>
改前先存档每篇正文（lark-cli +fetch 存本地 JSON）作回滚底。
</validation>

<stop_when>
- lark-cli 报权限拒（131006 / permission）→ 停报（可能权限不足，需 hub/yb 处理）
- 某篇 rewrite 会丢 `<whiteboard>` 块且绕不开 → 停报
- 真相模糊（真相表 0) 节 + 代码都查不到定论）→ 停报，列开放项，不自行编
- 样板篇删不动（权限） → 改走"清空内容改导航占位"，仍不行则停报
- 改 live 前未存档 → 先存档再改
</stop_when>

<context>
lark-cli 编辑配方（来自 jjb-knowledge-base skill，照做）：
- 读：`lark-cli docs +fetch --api-version v2 --doc <obj> --as user`，正文取 `.data.document.content`。⚠️ 别用 wc -c 量整输出（飞书并发读偶发串数据），用 jq 取 .data.document.content 长度。
- 改：`lark-cli docs +update --api-version v2 --doc <obj> --command <str_replace|block_replace|block_insert_after|append> ... --as user`；**改前先 `lark-cli skills read lark-doc references/lark-doc-xml.md`**（必要时 lark-doc-update.md）了解 XML/block 语法；**绝不丢 `<whiteboard token="...">` 块**，改完回读自检画板块还在。
- 画板查存活：`lark-cli whiteboard +query --whiteboard-token <tok> --output_as raw --as user` 查 node_count>0。
准确性/笔法标准：真相源=真相表+代码，不编；术语首现加白话括注；纯代码符号收进「开发者备注」小节；拿不准的进「开放问题」篇。
配色（若动画板，本轮原则上不动）：主深#1F2D3D/中#3E5871/浅#DCE4ED；accent金棕#B8893A（只标题分隔线+唯一最高优先）；三色封顶/层级靠明度/金色只强调/留白优先。
已拍板（直接落，不再问）：降权要做=已实现(commanderWeight.ts)/样板删/ban清空/虚空重生者7/直接改live不沙盒/清爽美观别堆叠。
建议批次（错最多最值先改）：当期赛事配置 → 软件架构+协作流程 → 总览 → 比赛模式+开放问题 → 样板删。每篇改完回读自检 + ≤10 行小结。
</context>

<motivation>
这是观众/选手/协作者看的公司 KB，落后一个大版本会持续误导（尤其「降权幻觉」「双打16人洗牌」「Cocos当现状」这类实锤错误）。yb 要的是清爽美观的 rewrite，不是在旧文上摞补丁——结构清晰比信息全更重要。
</motivation>

============================================================
EXECUTE PROMPT（/goal 之后接续粘贴，与契约同等效力、就严从严）：

1.【自主长跑】你在 GLM-5.2 底座上自主 rewrite 公司 KB，用户去做别的开发、不盯屏：可逆且 scope 内动作直接做，不"要不要我…"收尾。每回合末自检——是计划就用工具做掉；只有 stop_when 命中或权限被拒才收手。
2.【起跑自检】`lark-cli docs +fetch --doc CBvGdEAEko3BFdxhzVgc9ccMnYf --as user | jq -r '.data.document.content|length'` 确认 lark-cli 白天朗读写权限通（token 过期 / 权限拒则起跑就停报）。官方 Claude 无需三方 alias probe。
3.【改前必存档】每篇 rewrite 前先 `lark-cli docs +fetch` 把当前正文存到本地 JSON（如 tmp/kb-archive/<obj>.json）作回滚底，再改 live。
4.【清爽美观是硬指标】不是把旧段落留着加纠错；是删冗余、合重复、理层级，让人扫一眼就懂。样板篇与软件架构/协作两篇 1:1 重复→删或降级导航占位。每篇控制信息密度，术语首现加白话括注。
5.【whiteboard 绝不丢】改任何含 `<whiteboard>` 的文档，改后必回读确认画板块还在 + node_count>0。
6.【证据先于断言】每条"改完/PASS"对应真实 lark-cli 结果；proof 回读命令真跑贴回原文。未验证明说。
7.【stop_when 绝对优先】权限拒/画板会丢/真相模糊/样板删不动→停报，不自行编内容、不绕权限。
8.【批次+上报】按建议批次（当期配置→架构+协作→总览→比赛模式+开放问题→样板），每篇改完回读自检 + ≤10 行小结（哪篇、改了什么、画板在否）。
9.【交付】每篇 obj_token + 改动摘要 + 回读 proof 原文 + 存档路径 + 遗留/停报项。不动代码、不建新节点、不自行 commit（本任务是飞书侧，无 repo commit）。
