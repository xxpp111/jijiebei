# 集结杯码方案 · 编码 Schema（v1）

> 对局码编解码契约。前端分享（URL #hash）+ 后端落库（`matches.payload_code`）+ 主播贴码开局 三态同源。
> 真相源：`web/src/logic/codec.ts`（encodePayload/decodePayload/capturePayload）。
> 本文件 = P5 后端 `matches.payload_code` 复用契约，schema v1 冻结于本 round。
> 设计调研：`docs/research-frontend-p2p3.md` §B（索引化 / 版本 / 池纪律 / URL 上限）。

## 1. 码格式

```
code = base64url( JSON.stringify(snapshot) )
```

- 自包含：decode 无需后端、无需查表，自还原整盘（开盘随机结果 + 玩家手选 + 模式 + 点金/ban + 敌方 + 战绩）。
- base64url：`+/=` → `-_`、去 padding。UTF-8 安全（TextEncoder/TextDecoder）。
- 进 URL `#hash`（不进 query：①不进服务器日志；②不触发 SPA 路由刷新；③CF Pages 静态托管零成本）。URL 上限 2000，实际码 ~200-400 字符，远低于上限。
- 设计稿短码「JJB-8F-3K9Q-2M7X」是「人工速记引用码」视觉，需后端存 payload + 查表（依赖 P5），本 round 不做；码区展示自包含码（可分段/截断展示，完整码在复制内容 + URL hash）。

## 2. 版本 + 校验（三道闸）

snapshot 顶层：

| 字段 | 类型 | 含义 |
|---|---|---|
| `v` | `1` | payload_ver（schema 版本）。`v !== PAYLOAD_VER` → reason `version`（「码版本不符」）。 |
| `p` | `number` | poolFingerprint = FNV-1a 32bit over `FACTORS` 全名串 + MODE_CODES 拼接。`p !== poolFingerprint()` → reason `pool`（「池已更新」）。**基于内容，非纯 length**——抓同长重排（A 池换两条目顺序、length 不变 → length 指纹漏检 → 内容哈希能抓）。 |
| `kind` | `'s' \| 'd'` | 单打 / 双打。 |

decode 三道闸（`decodeResult(code)`）：

1. **版本闸**：`snap.v !== 1` → `{ ok:false, reason:'version' }`
2. **指纹闸**：`snap.p !== poolFingerprint()` → `{ ok:false, reason:'pool' }`
3. **越界闸**：因子 idx ≥ `FACTORS.length` 或字段缺失/类型错 → `{ ok:false, reason:'invalid' }`

三闸按序，前一闸命中即返回，不继续。旧码遇池重排 → 指纹闸拦（不错位还原）；旧码遇 schema 升级 → 版本闸拦。

## 3. 索引化基准（稳定排序源）

| 维度 | 编码方式 | 索引源 / 稳定名源 | 重排风险与兜底 |
|---|---|---|---|
| 因子（池/手选/点金/ban） | **FACTORS 下标** | `web/src/config/factors.ts` FACTORS（71 条 frozen） | gen-config.mjs 按 CSV 行序输出（脚本稳定）；CSV 人工编辑若重排 → poolFingerprint 内容哈希兜底拦旧码。 |
| 官突（双打每场锁定） | **存稳定名** | `MUTATOR_POOL[tier]` 的 factors 名 | 含「混乱工作室」等限定因子（未必全在 FACTORS）；存名免疫 frozen 重排。 |
| 锁定因子（单打） | **存稳定名** | `lockFactorList` | 同上，含「混乱工作室」「礼尚往来」等限定因子。 |
| 指挥官 | **存稳定名** | 运行期 `ConfigData.commanderList`（jjdata CSV）/ 双打 `COMMANDER_A/B` 常量 | 无 frozen 母表（P3 调研 §C.1 真缺口）；过渡期存名最稳，长度代价小（名 2-4 字）。 |
| 地图 | **存稳定名** | `ConfigData.mapGrid`（jjdata CSV） | 同指挥官，无 frozen 源。 |
| 模式 | **字面量** | `SessionMode` union（11 个） | 手钉 MODE_CODES 校验合法值；不靠 union 顺序（union 改序不错位）。 |
| 随机敌方 | **{race, ai:nameZh}** | `AI_ENEMY_POOL` | 存 race 码 + AI 中文名；开关 OFF → `enemy: null`。 |
| winLoseList | **number[]**（-1=未判定） | `winLoseList`（0/1/2） | 单打长度可变（贴码开局通常空 []）；双打固定 3 位。 |

池追加纪律（§B5）：FACTORS / MUTATOR_POOL **追加不重排**（新项 append 到尾）。gen-config.mjs 已按 CSV 行序输出（不按 points 排序——points 改了不重排，除非人工重排 CSV）。指挥官/地图无 frozen 源，存名免疫。

## 4. snapshot 字段（schema v1）

### 4.1 单打 `kind: 's'`

| # | 字段 | 类型 | 说明 |
|---|---|---|---|
| 1 | `v` | `1` | payload_ver |
| 2 | `p` | `number` | poolFingerprint |
| 3 | `kind` | `'s'` | 单打标记 |
| 4 | `mode` | `SessionMode` | 模式字面量（std8/std10/std12/rescue/one-a/hard1/hard2/feiqiu/suiji） |
| 5 | `mfc` | `number` | modelFactorCount (0-4) |
| 6 | `flags` | `{vh,vh2,zj,op,fq,sj,rand}` | 7 模式布尔（极难/极难②/拯救/单指/非酋/随机/随机填充） |
| 7 | `rm` | `'practice'\|'match'` | 规则态 |
| 8 | `maps` | `string[3]` | 3 张地图（存名） |
| 9 | `locks` | `string[3]` | 3 锁定因子（存名） |
| 10 | `pool` | `number[]` | randomFactorPoor → FACTORS idx |
| 11 | `cmdA` | `string[]` | A 池指挥官（存名，含「自选」） |
| 12 | `cmdB` | `string[]` | B 池指挥官（存名） |
| 13 | `selCmd` | `(string\|null)[3]` | 手选指挥官（存名，null=未选） |
| 14 | `selFac` | `number[9]` | 手选因子 → FACTORS idx（-1=未选） |
| 15 | `gold` | `number[]` | 本局点金因子 → FACTORS idx |
| 16 | `ban` | `number[]` | BP ban 因子 → FACTORS idx |
| 17 | `wl` | `number[]` | winLoseList（0/1/2，长度可变） |
| 18 | `enemy` | `(EnemySnap\|null)[3]\|null` | 随机敌方（开关 ON：3 元素；OFF：null） |

### 4.2 双打 `kind: 'd'`

| # | 字段 | 类型 | 说明 |
|---|---|---|---|
| 1 | `v` | `1` | payload_ver |
| 2 | `p` | `number` | poolFingerprint |
| 3 | `kind` | `'d'` | 双打标记 |
| 4 | `variant` | `'guantu'\|'feiqiu'` | 官突 / 非酋之轮 |
| 5 | `mutEntries` | `{name,map,factors[]}[3]` | 每场官突（factors 存名，非酋=「混乱工作室」） |
| 6 | `facPool` | `number[]` | factorPool → FACTORS idx（guantu=9 / feiqiu=3） |
| 7 | `cmdPool` | `string[6]` | 指挥官池（存名） |
| 8 | `slots` | `{cmds:(string\|null)[2], facs:number[3]}[3]` | 手选（cmds 存名，facs → idx，-1=未选） |
| 9 | `wl` | `number[3]` | winLoseList（-1=未判定） |
| 10 | `enemy` | `(EnemySnap\|null)[3]\|null` | 随机敌方 |

双打点金不编入（纯视觉态，恒空，编不编往返等价；省字段）。单打点金编 `gold[]`。

`EnemySnap = { race: 'P'|'T'|'Z', ai: string }`（ai = AI 敌军组合中文名）。

## 5. P5 后端复用

P5 `matches.payload_code` 存 `encodePayload(snapshot)` 的同一字符串：

- 主播开盘后 `capturePayload() → encodePayload()` → 存库 `payload_code`。
- 选手贴码 `decodePayload(code)` → 还原 snapshot → applySnapshot（后续 round）。
- 导出/分享/落库三态同源，零重复编码逻辑。

P5 后端只需存取字符串，decode 逻辑前端复用 `codec.ts`（或后端 TS/JS 移植同一纯函数）。

## 6. 边界（本 round scope）

- **编解码往返等价**：`encodePayload(capturePayload()) ↔ decodePayload` 全字段等价（9 模式 + 双打）= 本 round 硬 gate（`e2e/codec.mjs`）。
- **applySnapshot 还原进 select/battle**：留后续 round。单打可直写 `JijieData` + 已有 setter（不改引擎），双打需新增 `applyDoublesSnapshot`（直写 jjbDoubles `_*` 私有闭包，超本 round scope）。屏 D「按此码开局」本 round 做到 decode 成功 + 写 URL #hash + 导航 select 接通，真正还原留后续。
- **引用式短码**（`JJB-8F-3K9Q-2M7X`）：需后端存 payload + 查表，依赖 P5，本 round 留占位。
