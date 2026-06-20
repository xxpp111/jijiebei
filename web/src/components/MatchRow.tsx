import { CommanderCard } from './CommanderCard';
import { FactorFrame } from './FactorFrame';
import { mapUrl, cmdUrl, facUrl } from '../lib/realAsset';
import { EnemyBadge } from './EnemyBadge';
import type { RaceCode } from '../data/aiEnemyPool';

// VBtn / MatchRow — 承接 design/v4-r2/components/battle-screen.jsx，接 onClick 写真实 winLoseList。
function VBtn({ label, kind, on, onClick }: { label: string; kind: string; on: boolean; onClick: () => void }) {
  return (
    <button className={'v-btn' + (on ? ' on v-' + kind : '')} onClick={onClick}>
      {label}
    </button>
  );
}

export interface MatchRowData {
  idx: number;
  slot: string;
  mapName: string;
  cmds: string[];
  factors: string[];
  lock?: string;
  lockedFactors?: string[]; // 双打官突完整 mutators 数组（比对用；单打走 lock 单值）
  lockTag?: string; // 锁定因子角标：非酋之轮=「非酋」/ 官突双打=「官突」（默认官突）
  verdict?: string; // "win" | "bonus" | "lose"
  boss?: boolean;
  difficulty?: number;
  enemyRace?: RaceCode; // 随机敌方：种族（开关 ON 有值）
  enemyAi?: string; // 随机敌方：AI 敌军组合中文名
}

export function MatchRow({ data, onVerdict }: { data: MatchRowData; onVerdict: (v: 'win' | 'bonus' | 'lose') => void }) {
  const { idx, slot, mapName, cmds, factors, lock, lockedFactors, lockTag, verdict, boss, difficulty, enemyRace, enemyAi } = data;
  const mapSrc = mapUrl(mapName);
  const cls = ['match', boss && 'match-boss', verdict && 'match-done'].filter(Boolean).join(' ');
  const difficultyAttrs = difficulty === undefined ? {} : { 'data-match-difficulty': difficulty, [`data-match-difficulty-${idx}`]: difficulty };
  return (
    <div className={cls} {...difficultyAttrs}>
      <div className="match-no">
        <span className="match-no-t">{slot}</span>
        {difficulty !== undefined && (
          <span
            className="match-difficulty"
            style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent, #e8b84b)', whiteSpace: 'nowrap' }}
          >
            难度 {difficulty}
          </span>
        )}
      </div>
      <div className="match-map">
        <span className="mapthumb">
          {/* 地图图本身已烧录大字标题，不再叠加小字标签；名留 alt 供采集/调试 */}
          {mapSrc ? (
            <img src={mapSrc} alt={mapName} />
          ) : (
            <span style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>
              {mapName}
            </span>
          )}
          <EnemyBadge race={enemyRace} ai={enemyAi} size="md" />
        </span>
      </div>
      <div className="match-cmds">
        {cmds.map((c, i) => (
          <CommanderCard key={i} src={cmdUrl(c)} name={c} w={54} h={64} />
        ))}
      </div>
      <div className="match-factors">
        {factors.map((f, i) => (
          <FactorFrame
            key={i}
            src={facUrl(f)}
            size={64}
            tag={lockedFactors ? (lockedFactors.includes(f) ? (lockTag || '官突') : null) : (f === lock ? '锁定' : null)}
          />
        ))}
      </div>
      <div className="verdict">
        <VBtn label="胜利" kind="win" on={verdict === 'win'} onClick={() => onVerdict('win')} />
        <VBtn label="带奖励" kind="bonus" on={verdict === 'bonus'} onClick={() => onVerdict('bonus')} />
        <VBtn label="失败" kind="lose" on={verdict === 'lose'} onClick={() => onVerdict('lose')} />
      </div>
    </div>
  );
}
