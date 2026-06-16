# 集结杯 BP 框架实施稿（合并定稿 · 给 yb 拍板据此开工）

> 来源：workflow `wjyrxzz6k` 三份 spec（schema / jijie2+jjbDesign 改动 / Claude Design brief）合并。
> 落地总原则：**赛制变只改配置 txt，不动抽取内核**。优先复用现有 jjdata txt（能加列就加列），仅在确无承载体时新建。
> 配套真相源：`rules-decisions.md` / `bp-framework-design.md` / `mode-rules-truth-table.md`。

## 0. 已定决策锚点

| # | 决策 | 软件作用 |
|---|---|---|
| ① | 因子**全量默认装配** | 自定义因子＝`因子配置.txt` 加一行，抽取链零改动自动纳入 |
| ② | 排除＝**只排单因子**（不做排除组合） | `JijieContro` 硬编码 `popFactor` → 配置化读排除名单 |
| ③ | 金框/点金＝**赛前固定名单 ＋ 选手每场点金**，软件作用＝该因子**分值×2（强化版）**，**抽取概率不变** | 视觉＋分值翻倍；金框分值喂哪条计分链＝开放问题 Q1 |
| ④ | 指挥官 **A 弱 / B 强**维持；**ban 清掉凯拉克斯/凯瑞甘**（有效池 **A11/B7**）；**德哈卡/泰凯斯 权重 0.25** 降权 | `指挥官配置.txt` 加权重列 ＋ `toSelect` 加权抽样 |
| ⑤ | **拯救固定 7 人含凯瑞甘，不吃 ban**（有意保留） | 拯救独立 hardcode 路径 |
| ⑥ | **BP 当前＝ban 1 因子 _或_ 自选 1 指挥官（二选一）**；框架可配（揉几个因子让选手 ban） | 复用 `modeIsOnePick` 自选链 ＋ `randomFactorPoor` ＋ `factorCount+=` 揉法 |
| ⑦ | **额外难度＝开关 ＋ n 可配，默认 n=2**，每场 base+n 因子 | `规则参数配置.txt` 加开关/n，`factorCount += n` |
| ⑧ | **一切尽量做成可配置** | 数值进 txt |

## 1. 配置 Schema

### 解析契约红线（所有 txt 必守，来自 `JJConfigData.getStrArrFromFile`）
1. 行分隔 CRLF（`\r\n`） 2. **第 1 行表头被跳过** 3. `,` 分隔 4. 空行忽略
5. **新列只能追加到行尾**（旧码按索引取列，插列会错位）
6. 键值表（`规则参数配置.txt`/`BP规则.txt`）只能存 `名→数字`，**不能存中文模式名**——「适用模式」须用单列小表承载。

### 1.1 复用改（4 份）
| 文件 | 操作 | 列 | 默认 |
|---|---|---|---|
| `因子配置.txt` | 加列+补行+加行 | `名字,类型,分值,金框分值倍率`（第4列新增） | 倍率留空＝继承全局；**第30行虚空重生者补分值**；自定义=加行 |
| `指挥官配置.txt` | 加列 | `名字,分组,阵营,权重`（第4列新增） | 权重默认1；德哈卡/泰凯斯填0.25；无第4列向后兼容 |
| `ban指挥官.txt` | 清空ban列表留表头 | `指挥官名` | 清掉凯拉克斯/凯瑞甘→A11/B7；每周改当周一A一B |
| `规则参数配置.txt` | 加参数行（进paramMap零解析改） | `参数名,数值` | 加 `额外难度开关=0`/`额外难度n=2`/`金框分值倍率=2` |

### 1.2 新建（2 必 + 2 可选）
| 文件 | 列 | 默认 | 用途 |
|---|---|---|---|
| `因子排除.txt` | `因子名` | 初始放 `进攻部署` | 全局排除单因子，加行即排除 |
| `金框因子.txt` | `因子名,赛前金框,允许点金` | 赛前金框=0/允许点金=1 | 赛前固定金框+点金门控；GOLD_FACTORS 改从此装载 |
| `BP规则.txt`（new） | `参数名,数值` | `BP启用=1`/`ban因子数=1`/`自选指挥官数=1`/`揉因子额外数=1`/`BP互斥=1` | BP参数；`BP互斥=0`即"都给" |
| `BP适用模式.txt`/`额外难度适用模式.txt`（可选单列） | `模式名` | 不建=全局all | 仅需按模式分时建 |

## 2. 落地清单（按归属）

### 2.1 【jijie2 红线 · 给 yb patch】
| # | 改动 | 文件:行 | 现状→改法 |
|---|---|---|---|
| J1 | ban 清空 | `ban指挥官.txt`（清2行） | 空名单→不ban；**纯配置零代码** |
| J2 | 指挥官降权 | `指挥官配置.txt` 加权重列 + `JJConfigData`(commanderWeight+pickWeightedIndex) + `JijieContro.ts:155/167` | 等概率splice→加权无放回；作用域=标准8/10/12/随机/极难②（极难①整组赋值、拯救/双打不吃） |
| J3 | 排除配置化 | `因子排除.txt`(new) + `danshua.fire` 挂excludeTxt + `JijieMain`@property + `JJConfigData.init`加参 + `JijieContro` 抽取前循环popFactor | 硬编码popFactor→读名单循环；**popFactor幂等，先做增量3a-c跳过删硬编码3d最稳** |
| J4 | 额外难度n | `规则参数配置.txt` 加2行 + `JijieContro.ts:245后` `factorCount+=n` | 开关开且非随机/飞球/蓝字→+n；**联动H2 manualSlots也+n** |
| J5 | BP揉因子 | `BP规则.txt`(new) + `JijieContro` `factorCount+=banN` | 抽 目标+ban数 个进randomFactorPoor |
| J6 | 虚空重生者补分值 | `因子配置.txt:30` | `虚空重生者,5`→`虚空重生者,5,<分值>`（待定，参照同组=7） |

**J2 关键代码**（pickWeightedIndex 加到 JJConfigData，`JijieContro.ts:155/167` 两处 `Math.floor(Math.random()*groupList.length)` → `ConfigData.pickWeightedIndex(groupList)`）：
```typescript
public static commanderWeight: { [name: string]: number };
// init 内 vec.push(arr[0]) 之后：
this.commanderWeight[arr[0]] = arr[3] !== undefined ? Number(arr[3]) : 1;
public static pickWeightedIndex(list: string[]): number {
    var total = 0;
    for (var i = 0; i < list.length; i++) {
        var w = this.commanderWeight ? this.commanderWeight[list[i]] : 1;
        total += (w === undefined ? 1 : w);
    }
    var r = Math.random() * total;
    for (var i = 0; i < list.length; i++) {
        var w = this.commanderWeight ? this.commanderWeight[list[i]] : 1;
        r -= (w === undefined ? 1 : w);
        if (r < 0) return i;
    }
    return list.length - 1;
}
```

### 2.2 【jjbDesign · hub 改】
| # | 改动 | 文件:行 | 改法 |
|---|---|---|---|
| H1 | GOLD_FACTORS 配置化+点金状态机 | `JJBData.ts:51` + `JJBBorder.ts:35` | `const`→`let`+setGoldFactors，Boot 读金框因子.txt注入；加 goldRuntime:Set，isGoldFactor 改 包含运行时；点金=toggleGold 重渲 framedFactorV4；透出__jjbDebug |
| H2 | 额外难度 manualSlots 分摊 | `JJBData.ts:96-112` | factorCount+n 后三场槽也+n（否则池=槽断言挂）；**分摊待yb定（末场+2 or 三场轮流）** |
| H3 | 排除名单 Boot 加载 | `JJBDesignBoot.ts:36/43-49` | _cfgTexts 加 exclude |
| H4 | BP ban 数据层 | randomFactorPoor 数组操作 | 选手ban→从池移除，剩下进手选 |

### 2.3 【UI · Claude Design】
5 个交互：①BP面板(二选一) ②Ban因子(揉横排选手点ban) ③自选指挥官 ④点金(赛前固定+每场点金3态+×2角标) ⑤额外难度开关(toggle+n步进默认2)。可粘brief见 §4。

## 3. 落地顺序（标依赖）
```
J1 ban清空 ──┐(纯配置零依赖先做)
J6 补分值 ───┤(纯配置独立)
             ↓
J2 降权 ─────┐(配置+码，独立于BP)
             ↓
J3 排除配置化 ┐(先增量3a-c跳过删硬编码，最稳)
             ↓
J4+H2 额外难度n ┐(factorCount+n 必须配 manualSlots 分摊，成对做)
             ↓
H1 金框+点金 ─┐(UI④先行；×2仅做显示，计分接入挂起=Q1)
             ↓
J5+H4 BP阶段 ─┘(依赖modeIsOnePick现成；UI①②③先行；先上二选一主形态)
```
关键依赖：**J4与H2必须成对**（池=槽恒等式）；J5揉因子复用 factorCount+= 但语义不同（用 BP规则.txt 区分）；H1 分值×2 与计分解耦（视觉现成可做，计分=Q1挂起）。**Q1 全程挂起不阻塞任何项**。

## 5. 开放问题（需 yb 拍 · 非阻塞 schema）
| Q | 问题 | 实证 | 建议 |
|---|---|---|---|
| **Q1** | 金框"分值×2"喂哪条计分链 | 全代码无活链路消费因子分值计分：getFactorByScore 只蓝字模式按分值**抽**；calcCurrentScore 死代码；主胜负=winLoseList 场次判定与分值无关 | **方案1(推荐·零风险)：金框只做视觉+×2显示不参与排名**（主计分=场数，分值本就不入排名）；方案2新建"难度分"作tiebreaker；方案3复活蓝字(量大不建议) |
| **Q2** | 额外难度 n=2 三场分摊 | factorCount+n 后 manualSlots 三场槽和须同步+n | **末场+2** 或 三场轮流（建议末场+2） |
| **Q3** | 额外难度/BP 适用哪些模式 | 键值表存不了中文模式名 | **本期全局 all 不分模式**；要分则建单列小表 |
| **Q4** | BP 是否只上二选一主形态先 | 框架可配 both/多ban | **二选一主形态先上**，其余变体留框架不实装 |
| **Q5** | 虚空重生者分值填多少 | 第30行缺第3列须补 | **参照同组(类型5)=7** |
| **Q6** | 双打是否同步 ban | JJBDoubles 含凯瑞甘绕ban（拯救保留有意，双打待定） | 若全模式ban需单独同步双打池 |

## 6. 回写飞书清单（开发完成后据 jjb-knowledge-base skill）
> 库已迁 mcn1taa2k785（白天朗：改已有文档可写、建新页被拒）→ **并进已有文档不建新页**。旧 token 全废，重新 search/list 取。**先改 `mode-rules-truth-table.md`（单一真相源）再回写。**

| 改哪篇 | 回写内容 |
|---|---|
| `mode-rules-truth-table.md`（先改） | ban→A11/B7、降权0.25、额外难度n、排除配置化、金框×2、BP二选一 全落真相表 |
| 比赛模式与规则 | 有效池A11/B7、降权、排除=只排单因子、额外难度开关+n、BP二选一、拯救保留凯瑞甘不吃ban；重导抽取流程图PNG |
| 当期赛事配置 | 当周ban、权重表、BP参数、额外难度n、金框固定名单、补全虚空重生者分值；补"配置→随机池影响图" |
| 开放问题与决策 | 消项已拍决策①–⑧；更新 Q1金框计分/Q2分摊/Q3适用模式/Q4 BP范围/Q6双打ban |

## §4 Claude Design Brief
> 完整可粘版见本仓 workflow 输出（素材包 `design/v4-input-r2/` 需先备齐 R1 设计稿+token+因子框金框资源）。要点：沿用 R1 选择面板设计语言（FX/CC/CtrlBar/ToastV/路径二选弹层）+6主题token，在选择面板**开局流程前**插 BP/点金/难度交互层，不重新发明视觉；5交互各出 metal-dark/sc2-dark/minimal-light 三屏+状态矩阵；1280×720 Cocos 程序化复刻标尺寸/圆角/描边/动效时长。
