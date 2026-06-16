import { CommanderCard } from './CommanderCard';
import { FactorFrame } from './FactorFrame';
import { dz } from '../lib/designAssets';
import { cmdRel, facRel, mapRelByIdx } from '../lib/nameAsset';

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
  verdict?: string; // "win" | "bonus" | "lose"
  boss?: boolean;
}

export function MatchRow({ data, onVerdict }: { data: MatchRowData; onVerdict: (v: 'win' | 'bonus' | 'lose') => void }) {
  const { idx, slot, mapName, cmds, factors, lock, verdict, boss } = data;
  const cls = ['match', boss && 'match-boss', verdict && 'match-done'].filter(Boolean).join(' ');
  return (
    <div className={cls}>
      <div className="match-no">
        <span className="match-no-t">{slot}</span>
      </div>
      <div className="match-map">
        <span className="mapthumb">
          <img src={dz(mapRelByIdx(idx))} alt="" />
        </span>
        <span className="match-map-name">{mapName}</span>
      </div>
      <div className="match-cmds">
        {cmds.map((c, i) => (
          <CommanderCard key={i} src={cmdRel(c)} name={c} w={54} h={64} />
        ))}
      </div>
      <div className="match-factors">
        {factors.map((f, i) => (
          <FactorFrame key={i} src={facRel(f)} size={64} tag={f === lock ? '锁定' : null} />
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
