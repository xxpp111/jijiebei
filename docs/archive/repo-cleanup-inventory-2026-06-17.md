# 仓库清理盘点（2026-06-17）

## 已落地清理

- 删除根目录临时截图：`claude-login.png`、`fix1-*.png`、`review-*.png`、`jjb-react-home.png`、`std10-after-drag.png`。
- 删除 `.playwright-mcp/` 本地缓存：516 个文件，约 35MB。
- `.gitignore` 已覆盖：
  - 根目录临时截图和登录截图。
  - `.playwright-mcp/`。
  - `diagrams/2026-*` 下的 `diagram.png` / `diagram.json` / `preview.png`。
- 新增 React 可复跑浏览器 smoke：`web/e2e/ui-smoke.mjs`，替代原先散落的 MCP 截图作为 React DOM 行为证据。
- 新增 `/tmp/jjb-test` 恢复审计：`docs/jjb-test-recovery-audit-2026-06-17.md`。

## 当前不应删除

- `diagrams/phase1-*` / `diagrams/phase2-*`
  - `projectplan.md` 中有阶段证据引用。
  - `phase2-end2end/01-battle-renders-handpicked.png` 和 `03-select-with-bgroup-toast.png` 是撤回前真机路径证据，短期不可删。
- `diagrams/2026-*/*.svg`
  - 画板源文件。PNG/JSON 中间件已忽略，SVG 是否入库需 yb 拍板。
- `.agents/skills/jjb-*`
  - Codex 可用的项目技能镜像/改写版；`.agents/skills/harness-pro-repo-adapter/SKILL.md` 已跟踪，说明 `.agents/skills` 本身不是纯本机噪音。
  - `.claude/skills/jjb-dev-loop` / `jjb-run-broadcast` / `jjb-verify` 已跟踪；`jjb-knowledge-base` 在 `.claude/skills` 和 `.agents/skills` 中都存在但未跟踪。
- `diagrams/arch-board.png` / `collab-board.png` / `overview-board.png` / `rules-board.png`
  - 知识库画板相关 PNG，待 wiki/KB 入库策略确认。
- `template-banner.png`
  - 被 `template.json` 的 `banner` 字段引用；它不是本轮 AI coding 垃圾。

## 本地已忽略但可清理候选

- `jjb-guide-home.png`
  - 当前 `.gitignore` 已忽略，尺寸约 1459x752，大小约 276KB。
  - 当前只在 `.gitignore` 规则中命中，未发现文档或模板引用；可在确认无飞书/wiki 手工引用后删除。
- `kb-guide/`
  - 当前 `.gitignore` 已忽略，大小约 2.8MB。
  - `react-migration-plan.md` 已把它定义为 wiki 配图导出物，可从飞书或本地流程重导；删除前需确认不再作为人工上传源。
- `kb-whiteboards/`
  - 当前 `.gitignore` 已忽略，大小约 2.5MB。
  - `projectplan.md` 曾记录 `kb-whiteboards/whiteboard_S7CywyuINhCXinbHlilcLHvMnsg.png` 为导出产物；删除前需确认对应 SVG 源和飞书端图片已留存。
- `.harness-pro-*`
  - 当前所有 runtime 合计不到 3MB，主要是审计证据，不是容量问题。
  - 建议短期保留到本轮 Harness 审查收口；收口后可只保留 `.harness-pro-react` 和必要历史 runtime，其他迁入压缩归档或删除。
- `web/dist/`
  - 当前约 9MB，可由 `npm run build` 生成，已被 git ignore。
  - 可清理，但会让后续 `npm run e2e:ui` 先要求重新 build。
- `web/node_modules/`
  - 当前约 84MB，属于本地依赖缓存，非仓库垃圾。
  - 不建议作为项目清理动作删除，除非明确需要回收本机空间。

## 建议拍板项

1. `.agents/skills/jjb-*`：作为 Codex 项目技能入库，还是只保留 `.claude/skills`？
2. `.claude/skills/jjb-knowledge-base/SKILL.md`：是否与其它 jjb skill 一起入库？
3. `diagrams/2026-*/*.svg`：保留哪些最终画板源？
4. `diagrams/phase*`：作为阶段证据图入库，还是迁到 `docs/evidence/react-phase*/` 后更新引用？
5. `diagrams/*-board.png`：是否作为知识库预览图入库？

## 当前验证口径

- `node hp-verify.mjs 3` 当前覆盖 Cocos build / React build / React UI smoke / React e2e。
- `/tmp/jjb-test` 四套 Cocos Playwright 回归仍未完整恢复，不能宣称全量回归全绿。
