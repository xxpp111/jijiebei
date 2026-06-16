# 集结杯 React 迁移 — Phase 1 审计报告（段2 go/no-go）

> 2026-06-16 · harness-pro session `harness-2026-06-16T04-38-31` · runtime `.harness-pro-react`
> 审计对象：`assets/Script/jijie2/JijieContro.ts` / `JJUI.ts`（契约点名「19 处 cc.*」）+ `view/InitPanel.ts`（模式 handler 补充）
> 方法：`grep -nE "cc\."` 逐行实测 + 全文人工逐处分类「纯逻辑(段2 搬)」vs「UI 副作用(段2 React 重写)」。

## 0. 结论：**GO**（段2 可行，无 no-go 信号）

19 处 cc.* **全部落在 UI 副作用层**（Cocos 装饰器 / 组件基类 / `@property` 绑定 / 类型注解 / 事件监听），**没有一处沾核心游戏逻辑**。随机抽取（地图 / 指挥官 / 因子）、状态机（`status` 1/2/3）、ban 计算全部是纯 TS（`Math.random` + 数组 / Map 操作 + `ConfigData` / `JijieData` 静态调用）。

stop_when 关注的「随机 / 状态机逻辑深度耦合 Cocos、UI 副作用难剥离」**未出现**：核心逻辑与 cc.* 物理隔离，剥离 = 把末尾 `this.jjUI.xxx()` 调用抽成回调、把「写入 UI 对象」改成「写入 JijieData/VM」。段2 重写量 = UI 外壳，核心逻辑「搬」。

## 1. cc.* 精确统计（grep 实测）

| 文件 | grep `cc.` 行数 | 有效(非注释) | 核心逻辑沾染 |
|---|---|---|---|
| `JijieContro.ts` | 3 | 2（L11, L70） | **0** |
| `JJUI.ts` | 19 | 16（去 L31/32/49 注释） | **0** |

> 契约「19 处」= `JJUI.ts` 的 19 个 grep 命中行。

## 2. JijieContro.ts 逐处（3 行 cc.*）

| 行 | 代码 | 分类 | 段2 处理 |
|---|---|---|---|
| L11 | `show(root:cc.Node)` | 类型注解（UI 入口参数） | 删——React 无 `root` 概念，`show()` 整个退役 |
| L21 | `// ...cc.Node.EventType.MOUSE_UP...` | 注释失效 | 无 |
| L70 | `cc.log("抛弃地图: "+map)` | 日志副作用 | 换 `console.log` 或删 |

**核心逻辑（`toStart`/`toSelect`/`toBattle`）零 cc.***：
- `toStart()`：随机 3 张地图（`Math.random` + `ConfigData.popMap`）、按 `modelFactorCount` 删因子、随机锁定因子 → 纯 TS。
- `toSelect()`：随机指挥官 A/B 组、随机因子（按 8 种模式 flag 分支）、初始化 `null` 槽（`selectedFactorList`/`selectedCommanderList`）→ 纯 TS。
- 末尾 `this.jjUI.updateToStart()/updateToSelect()/toBattle()` = **UI 副作用调用** → 段2 抽成回调 / 事件，纯逻辑部分原样保留。

## 3. JJUI.ts 逐处（19 行 cc.*）— 全部 UI 副作用，分 4 类

| 类 | 行 | 内容 | 段2 等价 |
|---|---|---|---|
| 装饰器 / 基类 | L10, L13 | `cc._decorator`、`extends cc.Component` | React 函数组件——**消失** |
| `@property` 绑定 | L14, L16, L18, L33, L36, L38 | Label×4 + Node×2 编辑器绑定 | React props / ref——**消失** |
| 类型注解 | L15, L17, L19, L34, L37, L39 | `cc.Label`/`cc.Node = null` | 删类型 |
| 事件监听 | L78, L79 | `btnSelect/btnRandom.on(EventType.MOUSE_UP)` | React `onClick` |
| 注释 | L31, L32, L49 | 失效 | 无 |

**JJUI 内混入的纯逻辑（段2 要抽出，注意这些行本身不含 cc.*）**：
- `onRandomClick`(L106-137)：随机因子 / 指挥官填充 = 纯数组操作，但**写入目标是 UI item**（`map.spCommander.cname` / `factor.factorName`）。段2 改成写 `JijieData`/VM。
- `updateBCount`(L310-337)：B 级指挥官 ban 计算，读写 `jjUI.map.factor.node.active`。段2 ban 状态进 VM。
- → 这是「纯逻辑混在 UI handler」，剥离 = **换写入目标**，不是逻辑耦合死，**不构成 no-go**。

## 4. InitPanel.ts（模式 handler 补充审计）

- cc.*：`@property(cc.Node)` 按钮×9 + `extends cc.Component` + `cc.EditBox` + `onLoad` 事件绑定 → **全 UI 副作用**。
- `onClickX` handler 内部 = **纯逻辑赋值**：设 `JijieData.modeIsVeryHard/modeIsOnePick/modeFeiqiu/modeSuiji/...`、`modelFactorCount`、`playerName`（读 `txtName.string`）→ 调 `JijieControl.toStart()`/`toSelect()`。
- → 印证规划「模式 handler = 纯逻辑赋值」。React 段直接调等价纯逻辑（设 flag → `toStart`），绕过 cc 按钮 / EditBox（玩家名改 React input state）。

## 5. 段2 剥离策略

| 层 | 现状 | 段2 动作 |
|---|---|---|
| 随机 / 状态机 | `JijieContro` 纯 TS（cc.* 仅 1 处日志） | 原样搬：`import JijieControl`，调 `toStart/toSelect/toBattle` |
| 模式选择 | `InitPanel` handler 纯赋值 | React 调等价纯逻辑（设 flag → `toStart`） |
| UI 渲染 / 事件 | `JJUI`/`InitPanel` `cc.Component` | React 组件重写（19 处 cc.* 全消失） |
| 纯逻辑混 UI | `onRandomClick`/`updateBCount` 写 UI 对象 | 抽出逻辑，写入目标改 `JijieData`/VM |

## 6. 风险 caveat（段2 接线工作，非阻塞）

1. `onRandomClick`(JJUI) 与 `toSelect`(JijieContro) 有**两条独立随机路径**（随机入口 vs 手选入口）。段2 统一渲染时须保持两者行为一致，否则随机模式与手选模式数据分叉。
2. `updateBCount`/ban 逻辑读写 `jjUI.map.factor.node.active`（UI 状态即业务状态）。段2 ban 状态必须进 VM，否则 React 重渲丢 ban。
3. `showResultLose/showResultEnd`(JijieContro L289-308) 含 `new Date()` + `JJLog.writeLog`（纯逻辑）+ `jjUI.txtResult.string`（UI）。段2 拆数据 / 展示。

**这些是「搬运时的接线工作」，非「逻辑耦合死」——go 判定不变。**

## 7. 与 stop_when 对照

| stop_when 条件 | 实测 | 触发? |
|---|---|---|
| 随机 / 状态机深度耦合 Cocos（非纯逻辑） | 随机 / 状态机零 cc.*，纯 TS | ❌ 不触发 |
| UI 副作用难剥离 | 副作用 = 末尾调用 + 写 UI 对象，可换目标 | ❌ 不触发 |

→ **Phase 1 审计放行，进 Phase 2。**
