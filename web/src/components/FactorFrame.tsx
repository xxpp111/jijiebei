import { dz } from '../lib/designAssets';

// <FactorFrame> — 承接 design select-screen.jsx 的 FX.
// 因子边框走真实 PNG 整图（fx-frame, design/v4-r2/input/border-factor-{normal|gold}.png），
// 避开 JJBBorder 那 10 处描边堆叠。样式来自 design/v4-r2/v4.css §1。
const BORDER_NORMAL = dz('input/border-factor-normal.png');
const BORDER_GOLD = dz('input/border-factor-gold.png');

export interface FactorFrameProps {
  src: string; // 图 URL（screen 层用 realAsset 算好；边框仍走 design dz）
  size?: number;
  gold?: boolean;
  sel?: boolean;
  dim?: boolean;
  drag?: boolean;
  ghost?: boolean;
  tag?: string | null;
  check?: boolean;
}

export function FactorFrame({
  src, size = 66, gold = false, sel = false, dim = false, drag = false, ghost = false, tag = null, check = false,
}: FactorFrameProps) {
  const isMut = tag === '官突' || tag === '非酋'; // 官突/非酋之轮锁定因子：同一区别边框（紫环），区分玩家点金金框
  const cls = ['fx', gold && 'gold', isMut && 'mutator', sel && 'fx-sel', dim && 'fx-dim', drag && 'fx-drag', ghost && 'fx-ghost']
    .filter(Boolean).join(' ');
  return (
    <div className={cls} style={{ '--fxz': size + 'px' } as React.CSSProperties}>
      {src && <img className="fx-art" src={src} alt="" />}
      <img className="fx-frame" src={gold ? BORDER_GOLD : BORDER_NORMAL} alt="" />
      <span className="fx-ring"></span>
      {check && <span className="fx-check">✓</span>}
      {tag && <span className={'fx-tag' + (tag === '锁定' || isMut ? ' lock' : '')}>{tag}</span>}
    </div>
  );
}
