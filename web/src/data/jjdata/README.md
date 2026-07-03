# jjdata 运行期副本 — 原件在 assets/resources/jjdata/

本目录 5 个 `*.txt` 是赛制配置的**运行期副本**（`jjbSession.ts` 经 `import.meta.glob` 捆绑进 bundle）。**原件真相源 = `assets/resources/jjdata/` 下的同名文件**，两处必须逐字节一致：

```bash
# 一致性自查（应零输出）
for f in web/src/data/jjdata/*.txt; do diff "$f" "assets/resources/jjdata/$(basename "$f")"; done
```

改配置流程：改原件 → 同步副本 → 跑 `web/e2e/run.mjs`（池=槽恒等式门）。单源化 cutover 是独立高风险轮（见瘦身路线图 Batch5），完成前双份并存。红线总清单见根目录 [AGENTS.md](../../../../AGENTS.md) 第 3 条。
