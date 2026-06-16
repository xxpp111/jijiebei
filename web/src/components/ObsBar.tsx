import { CommanderCard } from './CommanderCard';
import { FactorFrame } from './FactorFrame';
import { mapUrl, cmdUrl, facUrl, logoUrl } from '../lib/realAsset';

// ObsBar — 承接 design/v4-r2/components/obs-bar.jsx 的 OBSBar/OBSMatch/OBSBadge。
// 直播采集横条（1280×232）：左品牌+比分+pips，右 3 场列（live 场 hero 加宽）。
// 饱满优化（用户反馈）：缩侧边距 + 地图/指挥官/因子放大 + 金色 logo + 指挥官全挂名（明确）。
export interface ObsRow {
  idx: number;
  no: string;
  mapName: string;
  cmds: string[];
  factors: string[];
  lock?: string;
  status: 'done' | 'live' | 'wait';
  verdict?: string;
}

function ObsBadge({ status, verdict }: { status: string; verdict?: string }) {
  let kind = 'wait';
  let label = '待战';
  let dot = false;
  if (status === 'live') { kind = 'live'; label = '进行中'; dot = true; }
  else if (status === 'wait') { kind = 'wait'; label = '待战'; }
  else if (verdict === 'win') { kind = 'win'; label = '胜利'; }
  else if (verdict === 'bonus') { kind = 'bonus'; label = '带奖励'; }
  else if (verdict === 'lose') { kind = 'lose'; label = '失败'; }
  return (
    <span className={'obs-badge b-' + kind}>
      {dot && <span className="dot"></span>}
      {label}
    </span>
  );
}

function ObsMatch({ row }: { row: ObsRow }) {
  const live = row.status === 'live';
  // 饱满放大（design 原 live 56×67/FX44、非 live 46×55/FX34 → 放大一档，地图/指挥官/因子更明确）
  const ccW = live ? 64 : 56;
  const ccH = live ? 76 : 66;
  const fxz = live ? 54 : 48;
  const cls = ['obs-match', live && 'live', row.status === 'done' && 'done'].filter(Boolean).join(' ');
  return (
    <div className={cls} data-screen-label={'obs-match-' + row.no}>
      <div className="obs-match-head">
        <span className="obs-match-no">
          <b>{row.no}</b>
        </span>
        <ObsBadge status={row.status} verdict={row.verdict} />
      </div>
      <div className="obs-map">
        <span className="mapthumb">
          {/* 地图图本身已烧录大字标题（净网行动/升格之链/克哈裂痕…），不再叠加小字标签；名留 alt 供采集/调试 */}
          <img src={mapUrl(row.mapName)} alt={row.mapName} />
        </span>
      </div>
      <div className="obs-line">
        <div className="obs-cmds">
          {row.cmds.map((c, i) => (
            <CommanderCard key={i} src={cmdUrl(c)} name={c} w={ccW} h={ccH} />
          ))}
        </div>
        <div className="obs-facs">
          {row.factors.map((f, i) => (
            <FactorFrame key={i} src={facUrl(f)} size={fxz} tag={f === row.lock ? '锁定' : null} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ObsBar({ style, mode, rows, wins, total }: { style: string; mode: string; rows: ObsRow[]; wins: number; total: number }) {
  const logo = logoUrl(style, mode);
  const pips = rows.map((r) =>
    r.status === 'live' ? 'live' : r.status === 'wait' ? 'wait' : r.verdict === 'win' || r.verdict === 'bonus' ? 'win' : r.verdict === 'lose' ? 'lose' : 'wait',
  );
  return (
    <div className={`obsbar style-${style} mode-${mode}`} data-screen-label={`obs-bar-${style}-${mode}`}>
      <div className="bg-tex"></div>
      <div className="obsbar-edge"></div>
      <div className="obsbar-inner">
        <div className="obs-score">
          <div className="obs-score-brand">
            <img className="obs-score-mark" src={logo} alt="CM" />
            <span className="obs-score-div"></span>
            <span className="obs-score-cn">集结杯</span>
          </div>
          <div>
            <div className="obs-score-main">
              <span className="obs-score-win">{wins}</span>
              <span className="obs-score-of">/<b>{total}</b></span>
            </div>
            <span className="obs-score-lbl">当前局分 · 已胜场</span>
          </div>
          <div className="obs-pips">
            {pips.map((p, i) => (
              <span key={i} className={'obs-pip ' + p}></span>
            ))}
          </div>
        </div>
        <div className="obs-matches">
          {rows.map((r, i) => (
            <ObsMatch key={i} row={r} />
          ))}
        </div>
      </div>
    </div>
  );
}
