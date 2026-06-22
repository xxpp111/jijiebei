import { CommanderCard } from './CommanderCard';
import { FactorFrame } from './FactorFrame';
import { mapUrl, cmdUrl, facUrl } from '../lib/realAsset';
import { EnemyBadge } from './EnemyBadge';
import type { RaceCode } from '../data/aiEnemyPool';
import { BrandLockup } from './BrandLockup';

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
  lockedFactors?: string[];
  lockTag?: string; // 非酋之轮=「非酋」/ 官突双打=「官突」
  status: 'done' | 'live' | 'wait';
  verdict?: string;
  enemyRace?: RaceCode; // 随机敌方：种族
  enemyAi?: string; // 随机敌方：AI 敌军组合中文名
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
  const mapSrc = mapUrl(row.mapName);
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
          {mapSrc ? (
            <img src={mapSrc} alt={row.mapName} />
          ) : (
            <span style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>
              {row.mapName}
            </span>
          )}
          <EnemyBadge race={row.enemyRace} ai={row.enemyAi} size="sm" />
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
            <FactorFrame
              key={i}
              src={facUrl(f)}
              size={fxz}
              tag={row.lockedFactors ? (row.lockedFactors.includes(f) ? (row.lockTag || '官突') : null) : (f === row.lock ? '锁定' : null)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ObsBar({ style, mode, rows, wins, total, difficulty, playerId }: { style: string; mode: string; rows: ObsRow[]; wins: number; total: number; difficulty?: number; playerId?: string }) {
  const pips = rows.map((r) =>
    r.status === 'live' ? 'live' : r.status === 'wait' ? 'wait' : r.verdict === 'win' || r.verdict === 'bonus' ? 'win' : r.verdict === 'lose' ? 'lose' : 'wait',
  );
  return (
    <div className={`obsbar style-${style} mode-${mode}` + (playerId ? ' with-name' : '')} data-screen-label={`obs-bar-${style}-${mode}`} data-capture="obs">
      <div className="bg-tex"></div>
      <div className="obsbar-edge"></div>
      <div className="obsbar-inner">
        <div className="obs-score">
          <div className="obs-score-brand">
            <BrandLockup styleName={style} modeName={mode} size="obs" />
          </div>
          {playerId && (() => {
            // Brief E：选手 ID 名牌（截断 maxLength 24 + 长 ID 降档 long/xlong，对齐设计稿 DCLogic）
            const id = playerId.length > 24 ? playerId.slice(0, 24) + '…' : playerId;
            const idCls = 'obs-name-id' + (id.length >= 16 ? ' xlong' : id.length >= 10 ? ' long' : '');
            return (
              <div className="obs-name">
                <div className="obs-name-body">
                  <div className="obs-name-kicker">
                    <span className="obs-live"><span className="lv-dot"></span>LIVE</span>
                    <span className="obs-name-tag">当前选手</span>
                  </div>
                  <div className={idCls} title={playerId} data-obs-player>{id}</div>
                </div>
              </div>
            );
          })()}
          <div>
            <div className="obs-score-main">
              <span className="obs-score-win">{wins}</span>
              <span className="obs-score-of">/<b>{total}</b></span>
            </div>
            <span className="obs-score-lbl">当前局分 · 已胜场</span>
            {difficulty !== undefined && (
              <div className="obs-difficulty" data-difficulty-total>
                <span className="obs-difficulty-val">{difficulty}</span>
                <span className="obs-difficulty-lbl">难度总分</span>
              </div>
            )}
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
