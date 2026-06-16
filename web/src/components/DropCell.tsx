// <DropCell> — 承接 design/v4-r2/components/select-screen.jsx 的 DropCell（空槽 + 拖放 hover）。
// Phase 2：空槽加 ref 注入供 dragdrop 找距离；已填槽支持点击清除（清 select*），350ms 防 drop-click 双事件。
// 样式来自 design/v4-r2/theme.css §3（.drop / .dropv-over / .drop-hint）。
import { forwardRef } from 'react';
import { shouldSuppressClickClear } from '../lib/dragdrop';

export interface DropCellProps {
  w: number; // 宽（与 .t-cmd=56/.t-fac=52 对位）
  h: number; // 高
  hint?: string; // "指挥官" / "因子" / "" 空
  over?: boolean; // 拖放 hover 演示态（Phase 2 真拖时点亮）
  filled?: boolean; // 已填态：true 时不渲染 hint（视觉一致 design fill 槽）
  onClear?: () => void; // 点击已填槽时触发（与 dragdrop 350ms 窗口配合）
}

export const DropCell = forwardRef<HTMLSpanElement, DropCellProps>(function DropCell(
  { w, h, hint = '', over = false, filled = false, onClear },
  ref,
) {
  const cls = 'drop' + (over ? ' dropv-over' : '') + (filled ? ' dropv-filled' : '');
  return (
    <span
      ref={ref}
      className={cls}
      style={{ width: w, height: h, display: 'flex' }}
      data-drop-cell
      onClick={(e) => {
        // 350ms 窗口内的 click 是 drop 触发的，不算清槽（防 touch/mouse 双事件流）
        if (shouldSuppressClickClear()) { e.stopPropagation(); return; }
        if (filled && onClear) { e.stopPropagation(); onClear(); }
      }}
    >
      {!filled && <span className="drop-hint">{hint}</span>}
    </span>
  );
});
