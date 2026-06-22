import { useEffect, useState } from 'react';
import { BrandLockup } from '../components/BrandLockup';
import { getRankings } from '../logic/backend';
import { currentPlayerName } from '../logic/jjbView';

// LadderScreen — 积分天梯页（承接 Claude Design 19b54387 集结杯积分天梯.dc.html · Brief G）。
// 接 P5 /api/rankings（SUM(delta) GROUP BY player）：nickname/total_delta(积分)/match_count(赛季对局)。
// 段位由 total_delta 映射（设计稿图例阈值，系数表定稿前为示例）。3 态：loading 骨架 / ranked 榜单 / empty 即将上线（含后端不可达兜底）。
interface RankRow { player_id: string; nickname: string; player_code: string; total_delta: number; match_count: number }

// 段位映射（设计稿图例：王者1200+/钻石900+/铂金750+/黄金600+，<600 新锐占位）。积分系数表定稿后再校阈值。
function tierOf(pts: number): { name: string; size: '' | 'd2' | 'd3'; muted: boolean } {
  if (pts >= 1200) return { name: '王者', size: '', muted: false };
  if (pts >= 900) return { name: '钻石', size: 'd2', muted: false };
  if (pts >= 750) return { name: '铂金', size: 'd3', muted: true };
  if (pts >= 600) return { name: '黄金', size: 'd3', muted: true };
  return { name: '新锐', size: 'd3', muted: true };
}

const fmtPts = (p: number) => (Number.isInteger(p) ? String(p) : p.toFixed(1));

type LadState = 'loading' | 'ranked' | 'empty';

export function LadderScreen({ style, mode }: { style: string; mode: string }) {
  const [state, setState] = useState<LadState>('loading');
  const [rows, setRows] = useState<RankRow[]>([]);
  const [season, setSeason] = useState('');

  useEffect(() => {
    getRankings()
      .then((d) => {
        const rk = (d.rankings || []) as unknown as RankRow[];
        setSeason(d.season || '');
        setRows(rk);
        setState(rk.length > 0 ? 'ranked' : 'empty');
      })
      .catch(() => setState('empty')); // 后端不可达/未启动 → 空态（即将上线占位）
  }, []);

  const me = currentPlayerName();
  const myIdx = rows.findIndex((r) => r.nickname === me);

  return (
    <div className={`jjb style-${style} mode-${mode}`} style={{ width: 1280, height: 720 }} data-screen-label={`ladder-${style}-${mode}`}>
      <div className="jjb-bg"><div className="bg-grad"></div><div className="bg-tex"></div><div className="bg-vignette"></div></div>
      <div className="jjb-inner lad">
        {/* topbar */}
        <div className="topbar">
          <BrandLockup styleName={style} modeName={mode} size="sm" />
          <div className="topbar-meta">
            <div className="meta-row"><span className="meta-k">积分天梯</span><span className="meta-v">展示层</span></div>
            <div className="meta-row"><span className="meta-k">数据源</span><span className="meta-v">/api/rankings</span></div>
          </div>
        </div>

        {/* 赛季头 */}
        <div className="lad-season">
          <div className="lad-season-l">
            <div className="block-head"><span className="block-kicker">SEASON LADDER</span><span className="block-title">积分天梯</span></div>
            <span className="lad-sub">赛季积分 · 全国排名 · 段位结算</span>
            <span className="lad-season-tag"><span className="lad-season-id">{season || '—'}</span><span className="lad-cycle">PocketBase · SUM(delta) GROUP BY player</span></span>
          </div>
          {myIdx >= 0 && (
            <div className="lad-mine">
              <span className="lad-mine-k">我的排名</span>
              <span className="lad-mine-v"><span className="lad-mine-rank">#{String(myIdx + 1).padStart(2, '0')}</span><span className="lad-mine-id">{me}</span></span>
            </div>
          )}
        </div>

        {/* 加载态：骨架 */}
        {state === 'loading' && (
          <>
            <div className="lad-list">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="lad-skel"></div>)}</div>
            <div className="lad-legend"><span className="lad-legend-k">载入中</span><span className="lad-leg">正在从 /api/rankings 拉取赛季排名…</span><span className="lad-legend-src">POCKETBASE</span></div>
          </>
        )}

        {/* 榜单态 */}
        {state === 'ranked' && (
          <>
            <div className="lad-list">
              {rows.map((r, i) => {
                const t = tierOf(r.total_delta);
                const isMe = i === myIdx;
                const rowCls = 'lad-row' + (i === 0 ? ' t1' : i === 1 ? ' t2' : i === 2 ? ' t3' : '') + (isMe ? ' me' : '');
                return (
                  <div key={r.player_id} className={rowCls} data-lad-row={i}>
                    <div className="lad-rank"><span className="lad-rank-hash">#</span><span className="lad-rank-no">{String(i + 1).padStart(2, '0')}</span></div>
                    <div className="lad-id"><span className="lad-id-name">{r.nickname}</span>{isMe && <span className="lad-me-chip">我</span>}</div>
                    <div className="lad-tier"><span className={'lad-tier-mark' + (t.size ? ' ' + t.size : '')}></span><span className={'lad-tier-name' + (t.muted ? ' muted' : '')}>{t.name}</span></div>
                    <div className="lad-wl"><b>{r.match_count}</b><span className="lad-wl-k">赛季对局</span></div>
                    <div className="lad-pts"><b>{fmtPts(r.total_delta)}</b><span className="lad-pts-k">分</span></div>
                  </div>
                );
              })}
            </div>
            <div className="lad-legend">
              <span className="lad-legend-k">段位</span>
              <span className="lad-leg"><span className="lg-mark king"></span>王者 1200+</span>
              <span className="lad-leg"><span className="lg-mark dia"></span>钻石 900+</span>
              <span className="lad-leg"><span className="lg-mark plat"></span>铂金 750+</span>
              <span className="lad-leg"><span className="lg-mark gold"></span>黄金 600+</span>
              <span className="lad-legend-src">DATA · <b>/api/rankings</b> · POCKETBASE</span>
            </div>
          </>
        )}

        {/* 空态 / 后端不可达 */}
        {state === 'empty' && (
          <div className="lad-empty">
            <span className="lad-empty-mark">
              <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5 H23 V11 A7 7 0 0 1 9 11 Z"></path><path d="M9 6 H5 V8 A4 4 0 0 0 9 12"></path><path d="M23 6 H27 V8 A4 4 0 0 1 23 12"></path>
                <path d="M16 18 V22"></path><path d="M11 27 H21"></path><path d="M13 22 H19 V27 H13 Z"></path>
              </svg>
            </span>
            <span className="lad-empty-t">赛季积分天梯</span>
            <span className="lad-empty-s">{season || '本'}赛季尚未产生排名 · 完成比赛后上榜（或后端未启动）</span>
            <span className="soon-chip">即将上线</span>
          </div>
        )}
      </div>
    </div>
  );
}
