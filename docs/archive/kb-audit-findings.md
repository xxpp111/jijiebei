# 集结杯 KB 审计结论（spoke rewrite 依据，2026-06-19 workflow wkav3va0o）

## 跨篇统一改动
- 【双打真引擎 R7】同一过时事实('16人扁平洗牌取前6'/'2官突+3随机=5'/'官突底因子=风暴英雄+虚空裂隙赛前手改三场相同'/引Cocos JJBDoubles.ts为真相)散落在: 总览·比赛模式与规则·软件架构与渲染·协作与开发流程·当期赛事配置·开放问题(Q10)·架构与协作样板 共7篇全部命中。当前真相统一改: 官突双打读CSV真表(web/src/data/mutatorPool.ts←docs/官突ABC配置_官突池.csv,A51/B57/C32三档每场A→B→C各抽1官突含真地图+1~3锁定因子)+玩家手填3随机因子; 指挥官COMMANDER_A(11)抽4+COMMANDER_B(7)抽2=6(源指挥官配置.txt第2列); 真引擎=web/src/logic/jjbDoubles.ts, Cocos assets/Script/jjbDesign/JJBDoubles.ts已降级只读占位。
- 【非酋之轮正名+新机制】'飞球'文案需全改'非酋'(同音fēiqiú·非洲酋长梗,首现加白话括注); 旧机制描述('混乱工作室+随机1两锁'或单打feiqiu老规则'固定抽风暴英雄/虚空裂隙/礼尚往来3因子')需纠正为R7真规则: 每场只锁混乱工作室(1个,FEIQIU_FIXED)+可分配池固定3个{礼尚往来/风暴英雄/虚空裂隙}(FEIQIU_ASSIGN_POOL玩家自由分配·非随机抽1)+每场随机一张真地图(取官突池去重地图集)+指挥官同双打池A4B2=6。涉及: 总览·比赛模式与规则·当期赛事配置·开放问题 至少4篇(home 05号位是该玩法,多篇home清单也要带它)。
- 【降权0.25是文档幻觉,代码从未实现】'德哈卡/泰凯斯权重0.25/加权抽样/pickWeightedIndex/指挥官配置.txt第4列权重'在 比赛模式与规则·当期赛事配置·开放问题(BP④/⑩) 三篇被当作'已定/现状',但web/src/logic/jjbSession.ts toSelectCore是等概率无放回rand+splice(140-215行),全仓零weight字段,指挥官配置.txt实测仅3列(名字/分组/阵营)。唯一'降权0.25'出处=web/src/screens/BpConfigScreen.tsx:9的note展示串'A弱/B强·降权0.25'(纯UI标签)。统一改法: 三篇删除降权现状表述,若保留为'计划未落地'须移入开放问题并标not-implemented,严禁写成现状。
- 【端迁移 Cocos→React/Vite】'Cocos 2.4 H5/danshua.fire 4层节点/build web-mobile/在Cocos重实现handoff/JJBDesignBoot路由'作为唯一现状,在 总览·软件架构与渲染·协作与开发流程·架构与协作样板 四篇全错。统一改: 主线=React18+Vite5+TS(web/),入口main.tsx→App.tsx query路由6屏(home/select/battle/obs/result/bpconfig),Vite alias原地import jijie2(@logic)/jjbDesign(@jjb)单一真相源非拷贝+cc-shim.ts置cc.*=0替代2.5MB引擎; jjbView.ts门面统一select/battle/obs/result四屏读真局并用doublesLive()在单/双打间分流; Cocos仅占位/回归只读。
- 【ban文件状态 文档↔文件不一致】'ban名单已清空,有效池A11/B7'在 比赛模式与规则·当期赛事配置 两篇出现,但assets/resources/jjdata/ban指挥官.txt当前仍写凯拉克斯+凯瑞甘(非空)。需二选一对齐(真清空文件 或 文档改'当期ban=凯拉克斯/凯瑞甘'),并统一点明: ban仅影响单刷(走ConfigData读ban文件,有效池实为A10/B6,拯救固定7人不吃ban); 双打jjbDoubles硬编码COMMANDER_A/B全11/7人不读ban文件→双打池=A11/B7不受ban(ban旁路)。
- 【BP已从'决策'走到'落地'】'BP=ban1因子或自选1指挥官二选一''双打暂不同步ban''每模式BP开关'在 开放问题(⑥/⑨)·当期赛事配置 仍记为待落地决策,实际已实现: jjbSession.ts toggleBanFactor/BP_BAN_LIMIT=1/getBanFor(落槽+validate旁路拦截被ban因子)+bpConfig.ts getBpModeEnabled按模式门控(std8/10默认开·std12/rescue/feiqiu默认关可开·doubles locked锁死)。但'BP规则.txt驱动'(当期赛事配置)/'BP⑦额外难度末场+n'/'BP⑩全局all不分模式'均未落地(无BP规则.txt文件,extra-difficulty仅startSession opts.banN占位stub,BP现按模式门控≠全局all)——需标UI-only或移开放问题。

## 每篇判定 + top 改动

### 总览 (CBvGdEAEko3BFdxhzVgc9ccMnYf) → **rewrite**
- 技术栈段'Cocos2.4 H5'→改为React/Vite单页(web/),无后端逻辑仍在前端成立,Cocos历史注;'4层渲染架构+Cocos组装'→React组件+CSS主题
- home/使用指南①模式清单从泛化'8/10/12/拯救/随机/双打'改实际6格:8因子/10因子/极难模式/拯救/非酋之轮(非酋双打)/官突双打,明确两双打格并列+随机和单打非酋已下线(仅e2e回归)
- 导航表补两行:①直播停靠/OBS横条(浮层+横条形态)②部署与公网(Cloudflare Pages固定+devbox临时隧道+内网穿透公司禁止政策);并补BP机制(⑥开关配置面+单刷ban)主题
- '双打模式'拆成命名两模式各给一句白话定位;删/补'架构与协作(样板)'裸文本无链接占位行(与软件架构重复则合并)

### 比赛模式与规则 (QsbMdhiPsoEgmYx2qOdcxfgenCe) → **tweak**
- 快速对照表'双打'单行拆两行改值:官突双打=CSV真表A→B→C各1官突(真地图+锁定因子)+玩家手填3随机因子·指挥官A抽4/B抽2=6(分组抽非扁平);备注改'真引擎(CSV池),双打不同步BP ban'
- 删除'德哈卡/泰凯斯降权权重0.25'两处(B组callout+ban机制段);当前B组7人等概率抽2,降权代码不存在,若计划项移开放问题
- 新增'非酋之轮(非酋双打)'行+正文新节:混乱工作室锁1+3可分配{礼尚往来/风暴英雄/虚空裂隙}+每场随机真地图,指挥官A4/B2=6;并把'飞球'正名'非酋'加白话括注
- '随机'行标'已下线仅引擎回归保留玩家不可选'或移出主表;ban机制段'已清空A11/B7'与ban指挥官.txt(仍含凯拉克斯/凯瑞甘)矛盾→对齐并点明ban仅影响单刷/双打旁路;胜负判定'bonus双打专属'软化为编码层三档全模式通用、bonus主要用于双打

### 软件架构与渲染 (C31Ad2lWMo9V6qxgyoDcsRTgnye) → **rewrite**
- 整篇去Cocos化:引言改'主线=React/Vite单页(web/),Cocos降级占位/只读回归';新增React/Vite架构章(main.tsx→App.tsx query路由6屏/Vite alias复用jijie2+jjbDesign单一真相源非拷贝/cc-shim桥接)
- 删/重构'4层Cocos节点叠加'表→React DOM+CSS分层(底层.jjb-bg三层grad/tex/vignette→组件层FactorFrame/CommanderCard/ObsBar→DOM文本flex自适应,103×50溢出问题已不存在)
- 补最核心抽象层jjbView.ts门面(select/battle/obs/result四屏经current*()读真局,doublesLive()分流单/双打引擎)——当前完全缺失;'两套代码边界'grid改为web/src(React真相)+jijie2(@logic零改原地引用)+jjbDesign(@jjb桥,JJBDoubles.ts已占位只读)
- 数据流重写为两分支:单打(startSession→jjbSession抽取→jjbView.current*读→setCurrentVerdict)+双打(startSession('doubles'|'feiqiu-doubles')→jjbDoubles.doublesStart读mutatorPool CSV→setDoubles*写槽→setDoublesVerdict);代码索引表改以web/src为主,旧Cocos符号降级历史;复核内嵌画板token(MGoDwFbbDhQgO7b0y7ScgdOcnzh vs 已重画的LKsTwSOnFhq1rWbetd2c87rDnie归属,进开放问题确认)

### 协作与开发流程 (ScLNdtFsOoA5nPxXMCjc9EQUneh) → **rewrite**
- AI工具链表/迭代循环/验证体系去Cocos:产物落点改web/ React组件,构建验证改'web目录npm run build exit0+tsc0error,dist可加载',视觉/功能验证改Playwright真机+Vite SSR e2e(9模式池=槽恒等式)
- 新增'部署与公网'节:devbox docker nginx:8080持久化(重启自愈)+cloudflared http2临时隧道(内网穿透公司禁止须授权)+Cloudflare Pages连GitHub固定地址;点真相源.claude/skills/jjb-deploy+jjb-run-broadcast+jjb-public-deploy-policy
- 派发段升级两层:①harness-pro多phase round(本仓phases≥3+6 reviewer+确定性verify先于LLM review+gate/audit)②agent-dispatch四段+marker契约(红线零改/不自行commit交hub收口/proof带时间戳/截图防缓存逐张目检);点真相源harness-pro skill+repo-adapter+agent-dispatch skill
- 补design-sync(Claude Design DesignSync组件级增量同步,pin在.design-sync/config.json);XP卡措辞精确化'维护jijie2后端逻辑层(assets/Script/jijie2)'去掉'仓库'歧义(无独立jijie2仓,单仓内目录),补当前抽取逻辑落web/src/logic+data与jijie2红线解耦

### 当期赛事配置 (MvZididNPogrPMxPKCucaN5inoe) → **rewrite**
- 定位锚点缺失(accuracyAnchorOk=false)必补:'集结杯=《星际2》合作任务单刷/双打挑战赛;本软件=按比赛规则随机生成突变因子(Mutator)组合的工具,记分/展示只是外壳';开头别只当纯赛事配置记录页
- 整段'指挥官降权表(德哈卡/泰凯斯0.25/pickWeightedIndex/第4列权重)'删除或彻底改写:当前A/B等概率无放回,双打A抽4/B抽2;指挥官配置.txt实测仅3列;降权若计划项移开放问题标not-implemented
- 官突配置章'赛前手改常量·写死风暴英雄+虚空裂隙'整段重写为CSV真表(docs/官突ABC配置_官突池.csv,A51/B57/C32三档每场A→B→C各抽1官突含真地图+锁定因子,已剔'含限定不可用'+熔火危机缺图);双打指挥官池来源(jjbDoubles硬编码COMMANDER_A/B源指挥官配置.txt第2列,独立单刷ban/降权管线)
- 金框×2拆两句(单打进难度总分weightedFactorScore/双打纯视觉);虚空重生者分值7改5(代码fallback=5),补混乱工作室=7/礼尚往来=7;'BP规则.txt驱动'改'见bpConfig.ts门控(8/10开·12/拯救/非酋可开·双打锁死)',互斥/揉因子未落地标UI-only;补非酋之轮机制+官突池三档硬数据+随机因子数(7模式→5/10→7/13→9/极难→7)等当期数值;ban'已清空'与文件(凯拉克斯/凯瑞甘)矛盾→对齐+点明双打ban旁路

### 开放问题与决策 (NXOEdbtP7oamDExgq6acxM7SnPe) → **tweak**
- Q10(双打)整体结案(标✅已结案R7):双打已从占位骨架升级真引擎jjbDoubles.ts(官突读CSV真表A/B/C三档每场1官突含真地图+锁定因子;指挥官A11抽4+B7抽2=6;带奖励胜判定已实现);纠正开发者备注'官突mutators=常量风暴英雄/虚空裂隙赛前手改三场相同'→改per-match从mutatorPool.ts抽每场不同
- Q7(随机)标'随机单打已下线(仅e2e 9模式回归保留),对线上产品已消项';并澄清Q7旧'随机模式'≠现5号位'非酋之轮(双打feiqiu-doubles)'勿混淆
- 新增'非酋之轮机制已定'条+'双打指挥官A4/B2=6已结论'条(替代旧16人扁平洗牌),消解旧'非酋固定抽风暴英雄/虚空裂隙/礼尚往来3因子'(那是单打feiqiu老规则);记home从单打为主→5/6号位双打并列的结构变更
- ⑥/⑨旁补'状态:已实现'并点web文件(bpConfig.ts+jjbSession bpBanRuntime);⑩补注BP已细化按模式门控(双打锁死)与'全局all'区分;BP④降权0.25标'决策已定,web单刷尚未实现加权抽样(当前等概率)';开发者备注补web真相源指针(双打=jjbDoubles.ts/CSV=mutatorPool.ts/BP门控=bpConfig.ts),Cocos符号标历史只读

### 架构与协作(样板) (ATFadgFpkobbHdxBac9c7uFbnyg) → **merge-or-remove**
- 本篇两大主题(danshua.fire 4层渲染架构/谁来做+迭代loop)与库内'软件架构与渲染'+'协作与开发流程'1:1重叠,且内容被Cocos→React超越,属早期合并样板stub——建议删除,或降级为指向那两篇的导航占位(不含实质内容),避免三处维护同一真相
- 若保留:'每屏=danshua.fire 4层节点'整段替换React/Vite组件现状,画板左栏重画React屏/组件层级;协作/迭代内容归'协作与开发流程'篇改写(React+Claude Design入库+spoke派发+Vite构建+Playwright回归),本篇不再单独维护
- 定位锚点缺失(accuracyAnchorOk=false):若merge则锚点落在被合并去的两篇;若降级导航则指向当前真相源代码路径(web/src/logic/jjbSession·jjbDoubles·jjbView·bpConfig/data/mutatorPool/screens/HomeScreen/components/ObsBar)而非再画会过时的架构图

## 真相表状态
必须先更新——mode-rules-truth-table.md自述是'校对确认规则真相后据此翻译后端代码改动'的回写单一真相源,但它2026-06-15停更、已落后R7且含多处与当前代码冲突的实锤错误,若照它rewrite KB会把同样错误复制进文档。需先修正的要点:①主表'双打'行整段过时(写'COMMANDER_SOURCE 16人扁平洗牌取前6''官突底2风暴英雄/虚空裂隙赛前手改三场相同''旁路XP'/源码索引引Cocos assets/Script/jjbDesign/JJBDoubles.ts:5-26)→改web真引擎jjbDoubles.ts(A11抽4+B7抽2=6/官突读mutatorPool CSV A51-B57-C32每场1官突/非酋之轮混乱工作室+3可分配)②C1/Q1已划✅+BP④标'✅已定⏳待落地'的降权0.25——代码根本未实现且无落地计划,应改标not-implemented(仅BpConfigScreen note展示串),否则误导'待落地'=很快会做③BP⑧'虚空重生者补分值=7'与代码FACTOR_SCORE_FALLBACKS=5冲突(代码注释明确docs/因子点数配置.csv标5分),改5并补混乱工作室=7/礼尚往来=7④主表'随机模式(home第6钮)'已过时:suiji移出URL白名单+home,改'仅e2e 9模式恒等式回归保留'⑤缺'非酋之轮'整行(home 05号位主力玩法)⑥ban指挥官.txt:88'已定清空'与文件实况(凯拉克斯/凯瑞甘仍在)矛盾,且'BP框架配置(待落地)'整段索引(指挥官配置.txt加权重列/ban清空/BP规则.txt new/因子排除.txt new/金框因子.txt new)多数R7未做需重核⑦全表源码索引指向Cocos jijie2/jjbDesign,需补web/src真相源指针并标Cocos为历史/回归只读⑧⑥/⑨BP已落地(bpConfig.ts+jjbSession bpBanRuntime)应从'待落地'更新为'已实现',但BP⑦末场+n/BP⑩全局all/BP规则.txt驱动未落地需标UI-only或保留待落地。更新真相表本身工作量小但卡所有KB rewrite,应作为第0批。

## 待拍板(已由yb 2026-06-19拍定,见下)
- 架构与协作(样板)篇删不删?——内容与'软件架构与渲染'+'协作与开发流程'1:1重叠且被Cocos→React超越,建议merge-or-remove(删或降级为纯导航占位);但删文档是不可逆动作,需yb/用户确认是删除还是保留为导航壳。
- 降权0.25整套机制(德哈卡/泰凯斯权重·pickWeightedIndex·指挥官配置.txt权重列)是否还要做?——代码至今未实现且无落地迹象,真相表却标'✅已定⏳待落地'。需拍板:(a)确认要做→文档统一标'计划未实现'并保留为待办;(b)放弃→从所有文档彻底删除,改写为'A/B等概率'。这直接决定3篇(比赛模式/当期配置/开放问题)怎么写。
- ban指挥官.txt要不要真清空?——文档多处写'已清空A11/B7'但文件仍含凯拉克斯/凯瑞甘(单刷运行态实为A10/B6)。需二选一:(a)清空文件让文档成真;(b)文档改'当期ban=凯拉克斯/凯瑞甘'。涉及代码/数据文件改动(非纯文档),需用户授权。
- 非酋之轮/官突双打的机制要写多细?——是写到'每场锁混乱工作室+3可分配因子+随机地图+指挥官A4B2'的玩法层(选手能照着玩),还是只写一句定位?当期赛事配置/比赛模式两篇若写细会重复,需定哪篇是机制权威页、哪篇只引用。
- 虚空重生者分值真相到底是5还是7?——代码fallback=5(注释引docs/因子点数配置.csv标5分),真相表BP⑧拍的是7(参照同组类型5补齐,逻辑自相矛盾)。需yb确认规则意图,以免文档与计分引擎不一致(影响难度总分)。
- BP⑦额外难度(末场+n)/BP⑩全局all 这两条已拍决策但代码未落地(仅opts.banN占位),文档按'已拍待落地'写还是'暂缓'?——且BP现实是按模式门控(与⑩全局all冲突),需澄清'额外难度全局 vs BP分模式'是否就是当前定稿。
- 画板token归属待确认:'软件架构与渲染'篇内嵌MGoDwFbbDhQgO7b0y7ScgdOcnzh,而TaskList #10'按新配色重画4层渲染架构画板'记的是LKsTwSOnFhq1rWbetd2c87rDnie,两者不一致;若要表达React渲染分层,需确认改指哪张或新画'React DOM+CSS分层+单/双打引擎数据流+jjbView门面'图。