# web/src/config — 配置层（单一真相源，自动生成）

三层管道：

```
docs/*.csv (人工母表, UTF-8 BOM)  ──►  web/scripts/gen-config.mjs  ──►  web/src/config/*.ts (强类型, 运行期 import)
```

- **母表** `docs/*.csv`：非工程同学维护的权威源（因子点数 / 官突池 / 挑战池…）。
- **生成脚本** `web/scripts/gen-config.mjs`：去 BOM + CRLF 兼容 + 引号感知分列 + 逐表产出强类型常量。重跑：`node web/scripts/gen-config.mjs`。
- **产物** `web/src/config/*.ts`：唯一被代码 import 的运行期配置。**勿手改**——改母表后重跑脚本。

## P0 现状（骨架）

- ✅ `factors.ts` ← `docs/因子点数配置.csv`（71 因子：点数 / 可自定义 / 单刷ban / 双打ban / 备注）样板已通。
- ⏳ 运行期**尚未切换**到 config：`jjbSession` 仍读 `web/src/data/jjdata/*.txt`（import.meta.glob 同步捆绑）。
- 后续 phase cutover：逐表实现 commanders / mutators（落实 `mutatorPool.ts` 的 "AUTO-GENERATED" 真生成器）/ maps / rules / bans → 把 `jjbSession`/`jjbDoubles` 的 import 切到 `config/*.ts` → 删 jjdata glob + `getStrArrFromFile` 的 CRLF 脆弱解析链（见 `projectplan.md`「集结杯→比赛平台」§4）。

> 为何 P0 不直接 cutover：切换会把同步 glob 改成 config import，触动 9 模式恒等式 e2e（行为变更），留到独立 phase 做、单独回归。**P0 只立骨架不改行为。**

## 后端数据化预留

`config/*.ts` 导出做成与未来后端 JSON **同形**纯数据结构（`FactorDef` 等）。届时「读本地 TS 常量」→「fetch 后端 JSON」消费方签名不变（见 §5.6 配置 schema）。
