// <DropCell> — 承接 design/v4-r2/components/select-screen.jsx 的 DropCell（空槽 + 拖放 hover）。
// 纯静态空槽（无拖拽，Phase 2 才接 makeDraggable/校验三规则）。样式来自 design/v4-r2/theme.css §3。
export interface DropCellProps {
  w: number; // 宽（与 .t-cmd=56/.t-fac=52 对位）
  h: number; // 高
  hint?: string; // "指挥官" / "因子" / "" 空
  over?: boolean; // 拖放 hover 演示态（Phase 2 真拖时点亮）
}

export function DropCell({ w, h, hint = '', over = false }: DropCellProps) {
  return (
    <span
      className={'drop' + (over ? ' dropv-over' : '')}
      style={{ width: w, height: h, display: 'flex' }}
      data-drop-cell
    >
      <span className="drop-hint">{hint}</span>
    </span>
  );
}
