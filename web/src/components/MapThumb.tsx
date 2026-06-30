import type { ReactNode } from 'react';
import { mapUrl } from '../lib/realAsset';

// <MapThumb> — 地图缩略图：有图渲 <img>，缺图兜底居中大字地图名。抽自 Result/Select/MatchRow 重复块。
// children 用于叠加 EnemyBadge（随机敌方时）；不传则纯地图（Result 结算卡）。零行为变化（DOM/兜底 style 原样）。
export function MapThumb({ map, children }: { map: string; children?: ReactNode }) {
  const src = mapUrl(map);
  return (
    <span className="mapthumb">
      {src ? (
        <img src={src} alt={map} />
      ) : (
        <span style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>
          {map}
        </span>
      )}
      {children}
    </span>
  );
}
