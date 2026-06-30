import type { ReactNode } from 'react';
import { BrandLockup } from './BrandLockup';

// <TopBar> — 屏顶栏：BrandLockup(size=sm) + topbar-meta 容器。抽自 8 屏重复的
//   `<div className="topbar"><BrandLockup … sm/><div className="topbar-meta">…meta-row…</div></div>`。
// meta-row 内容各屏不同 → 作 children 由调用方塞（MetaRow 提供单行复用）。零行为变化。
export interface TopBarProps {
  styleName: string;
  modeName: string;
  children: ReactNode; // topbar-meta 内的 meta-row(s)
}

export function TopBar({ styleName, modeName, children }: TopBarProps) {
  return (
    <div className="topbar">
      <BrandLockup styleName={styleName} modeName={modeName} size="sm" />
      <div className="topbar-meta">{children}</div>
    </div>
  );
}

// <MetaRow> — topbar-meta 内单行（meta-k 标签 + meta-v 值）。值上的 data-*/style 经 vProps 透传
// （data-meta-player / data-meta-mode / data-difficulty-total + 难度色 style 等保持原样）。
export function MetaRow({
  k, v, vProps,
}: {
  k: string;
  v: ReactNode;
  vProps?: React.HTMLAttributes<HTMLSpanElement> & Record<`data-${string}`, unknown>;
}) {
  return (
    <div className="meta-row">
      <span className="meta-k">{k}</span>
      <span className="meta-v" {...vProps}>{v}</span>
    </div>
  );
}
