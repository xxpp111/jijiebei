# /tmp/jjb-test 回归套件恢复审计（2026-06-17）

## 结论

`/tmp/jjb-test` 当前不可用，不能宣称四套 Playwright 回归已恢复或已全绿。  
Claude Code 用户级 transcript 里能证明这四套历史上存在并曾跑出全绿结果，但当前只能完整恢复 `helpers.js`；`obsbar.js` 只能恢复到若干历史版本/片段，不能证明等同最终 42/42 版。

## 当前状态

- 当前 `/tmp` 下未找到可运行的 `/tmp/jjb-test` 套件。
- 仓内也没有 `phaseG.js` / `obsbar.js` / `all.js` / `v4-existing.js` / `helpers.js` 的可运行副本。
- 当前替代验证为：
  - `web/e2e/ui-smoke.mjs`：React 真实浏览器 smoke。
  - `web/e2e/run.mjs`：React 逻辑 e2e。
  - `node hp-verify.mjs 3`：本机 Harness deterministic verify，含 Cocos build / React build / React UI smoke / React e2e。

这些不能替代 jjb-verify 手册定义的 Cocos 四套全量回归。

## 历史证据

用户级 Claude transcript 路径：

`/Users/bytedance/.claude/projects/-Users-bytedance----jijiebei/`

可定位到的历史全绿证据：

- `3c639e6e-171c-4393-b350-c73ffec80bda.jsonl:1672`
  - `phaseG.js`: total 48 / pass 48 / fail 0
  - `obsbar.js`: total 42 / pass 42 / fail 0
  - `all.js`: total 36 / pass 36 / fail 0
  - `v4-existing.js`: total 20 / pass 20 / fail 0
- `3c639e6e-171c-4393-b350-c73ffec80bda.jsonl:2516`
  - 四套均 `exit=0`，并再次出现 48/42/36/20 全绿摘要。

可定位到的历史目录清单：

- `3c639e6e-171c-4393-b350-c73ffec80bda/subagents/workflows/wf_2066fac7-83b/agent-a30279f3886714ec4.jsonl:20`
  - 当时 `/tmp/jjb-test` 包含 `all.js`、`helpers.js`、`obsbar.js`、`phaseG.js`、`v4-existing.js` 等文件。

## 源码可恢复度

完整可恢复：

- `helpers.js`
  - transcript file content 结果 3517 chars / 76 行。
  - 代表来源：`3c639e6e-171c-4393-b350-c73ffec80bda.jsonl:2092`、`b2e40530-8ca5-4313-9254-256d6d800265.jsonl:238`、`db4ce0d4-f5cb-4091-93b6-e3282548d293.jsonl:140`。

未完整恢复：

- `obsbar.js`
  - 找到最大 transcript file content 为 9222 chars / 136 行（`b2e40530-8ca5-4313-9254-256d6d800265.jsonl:103`），另有 7209 chars / 97 行旧版本和多段片段。
  - 这些内容来自 Phase E/F 演进中的不同版本，不能证明就是最终 `42/42 PASS` 的完整脚本。
- `phaseG.js`
  - 找到历史运行结果和失败/修复片段，但未找到完整 Read/cat 输出。
- `all.js`
  - 找到历史运行结果、行数和若干断言片段，但未找到完整源码输出。
- `v4-existing.js`
  - 找到历史运行结果、行数和断言片段，但未找到完整源码输出。

补充检索（2026-06-17 夜续查）：结构化扫描用户级 Claude JSONL 的 `toolUseResult.file` / `filePath+content` / Bash command heredoc，未发现 `phaseG.js` / `all.js` / `v4-existing.js` 的完整源码，也未发现可用于完整重建四套的 `cat > /tmp/jjb-test/*.js <<EOF` 写入命令。因此不应把 transcript 里的片段拼成“恢复版四套回归”，否则会制造新的验证剧场风险。

## 建议恢复路径

1. **短期**：保持当前 `hp-verify` + React UI smoke 作为可复跑防线，同时继续在报告里明确“不等于四套 Cocos 回归”。
2. **中期**：从备份或历史机器恢复 `/tmp/jjb-test` 原目录；恢复后先跑原始四套并记录 hash，再决定是否入库。
3. **长期**：将四套迁入仓内，例如 `tests/cocos-playwright/`，并把 jjb-verify skill 的入口从 `/tmp/jjb-test/*.js` 改成仓内路径；`/tmp` 只作为输出目录。
4. **重建时的 done-when**：
   - `phaseG.js`: 48 条，覆盖 DEMO fallback / live 全模式 / doubles 自洽 / Label 可见性。
   - `obsbar.js`: 42 条，覆盖横条结构 / 五态 / 单源同步 / bare / bartop / doubles。
   - `all.js`: 36 条，覆盖 8/10/12 / 拯救 / 随机 / 抽签 / 二选层 / 选手名。
   - `v4-existing.js`: 20 条，覆盖 v4 边框 / 控制条 / 行级态。
   - 四套均要求 console errors = 0。
