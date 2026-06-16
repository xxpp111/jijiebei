import { dz } from '../lib/designAssets';

// <CommanderCard> — 承接 design select-screen.jsx 的 CC.
// 指挥官卡：微圆角 + 内外亮光描边 + gloss + 名牌。样式来自 design/v4-r2/v4.css §2.
export interface CommanderCardProps {
  src?: string; // design-relative, e.g. "assets/cmd-raynor.png"
  name?: string;
  w?: number;
  h?: number;
  sel?: boolean;
  drag?: boolean;
  ghost?: boolean;
  fill?: boolean;
  check?: boolean;
  noName?: boolean;
}

export function CommanderCard({
  src, name, w = 70, h = 84, sel = false, drag = false, ghost = false, fill = false, check = false, noName = false,
}: CommanderCardProps) {
  const cls = ['cc', sel && 'cc-sel', drag && 'cc-drag', ghost && 'cc-ghost', fill && 'cc-fill']
    .filter(Boolean).join(' ');
  return (
    <div className={cls} style={{ '--ccw': w + 'px', '--cch': h + 'px' } as React.CSSProperties}>
      <div className="cc-art">{src && <img src={dz(src)} alt="" />}</div>
      <span className="cc-gloss"></span>
      {!noName && name && <span className="cc-name">{name}</span>}
      {check && <span className="cc-check">✓</span>}
    </div>
  );
}
