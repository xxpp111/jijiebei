# diagrams 资产索引

本目录保存两类东西：可入库源文件，以及阶段证据截图。不要把整个目录当作临时垃圾清空。

## 画板源

`diagrams/2026-*/diagram.svg`

- 飞书 / wiki 画板的 SVG 源文件。
- `diagram.png` / `diagram.json` / `preview.png` 是导出中间件，已由 `.gitignore` 忽略。
- 当前待拍板项：哪些 SVG 是最终源，哪些只是过程稿。

已知引用：

- `projectplan.md` 记录 `diagrams/2026-06-15T000000/diagram.svg` 为知识库画板新配色源。

## React Phase 证据图

- `diagrams/phase1-select-screens/`
- `diagrams/phase1-jump/`
- `diagrams/phase2-select-screens/`
- `diagrams/phase2-end2end/`

这些截图在 `projectplan.md` 中被作为 Phase 1 / Phase 2 验收证据引用。尤其：

- `diagrams/phase2-end2end/01-battle-renders-handpicked.png`
- `diagrams/phase2-end2end/03-select-with-bgroup-toast.png`

这两张来自撤回前真机路径，路径已无法原样再生，应保留到 yb 明确决定归档或删除。

## 知识库板图

- `diagrams/arch-board.png`
- `diagrams/collab-board.png`
- `diagrams/overview-board.png`
- `diagrams/rules-board.png`

这些是知识库 / 画板相关 PNG，已在 git 中跟踪（共 ~1.3MB）。等 wiki 结构拍板后决定保留还是迁到 `docs/evidence/`。

## 已归档

- `SYSTEM-MAPS.md`（三张 Mermaid 体系图，2026-06-24 快照）→ `docs/archive/system-maps-2026-06.md`；现行架构图在 `docs/architecture.md` §0/§3。其渲染产物 `jjb-map-1/2/3.png` 已删（可从归档源再生）。

## 清理原则

1. 已被 `projectplan.md` 引用的证据图，不直接删除。
2. 可重生成中间件放 `.gitignore`，源文件和不可再生证据才考虑入库。
3. 若要移动文件，先同步更新 `projectplan.md` 的引用路径。

