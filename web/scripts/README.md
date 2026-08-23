# web/scripts — 工程脚本层

这些脚本服务于配置生成、漂移守护和视觉回归。默认从 `web/` 目录运行；涉及仓库根路径的脚本会自行向上解析。

## 脚本职责

| 脚本 | 入口 | 职责 |
|---|---|---|
| `gen-config.mjs` | `node scripts/gen-config.mjs` | 从 `docs/*.csv` 生成 `web/src/config/*.ts`。这是配置产物的生成器，不直接参与测试断言。 |
| `drift-check.mjs` | `node scripts/drift-check.mjs` | 配置漂移守护：临时重跑 `gen-config.mjs`，确认生成结果与已提交产物一致。`gen-config.mjs` 是本脚本的子调用。 |
| `docs-drift-check.mjs` | `node scripts/docs-drift-check.mjs` | 文档漂移守护：检查关键文档声明与当前工程事实是否一致。 |
| `snap-verify.mjs` | `node scripts/snap-verify.mjs` | 视觉回归入口：自起 Vite preview，固定随机源，采集 home/select/battle/result/obs，与 `e2e/snapshots/baseline/` 做 pixelmatch。更新基线用 `--update`。 |
| `visual-diff.mjs` | 被 `snap-verify.mjs` 和 vitest 调用 | PNG 对比库函数，封装 `pixelmatch` + `pngjs`，不单独作为人工入口。 |
| `wiki-governance.mjs` | `node scripts/wiki-governance.mjs` | JJB Alioth v2 账本 registrar：register/bootstrap/transition/check/query/build-context（`docs/wiki/{log,lifecycle}.jsonl` 双账；lock+journal+顺序 rename 保证可恢复）。测试：`node --test scripts/wiki-governance.test.mjs`。 |

## 调用链

```
drift-check.mjs ──► gen-config.mjs ──► src/config/*.ts

snap-verify.mjs ──► visual-diff.mjs ──► e2e/snapshots/{actual,diff,baseline}
```

## 常用命令

```bash
cd web
node scripts/drift-check.mjs
node scripts/docs-drift-check.mjs
node scripts/wiki-governance.mjs transition --manifest <transition-manifest.json> --json
npm run snap:visual
npm run snap:visual -- --update
```

## 约束

- `src/config/*.ts` 是生成产物，配置变更应先改 `docs/*.csv` 再跑 `gen-config.mjs`。
- `snap-verify.mjs` 的基线视口固定为 `1280×720`；动态分辨率多视口探针在 `web/tmp/` 下，属于临时证据，不进 git。
- `visual-diff.mjs` 保持库函数形态，新增视觉门禁逻辑优先落在 `snap-verify.mjs` 或调用方测试中。
