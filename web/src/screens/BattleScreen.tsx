import { useEffect, useState } from 'react';
import { MatchRow, type MatchRowData } from '../components/MatchRow';
import { startRandomSession, startSession, getSessionMatches, setVerdict, getScore, getSelectState, exposeBattleDebug, randomFillAndStart, matchDifficulty, type SessionMode } from '../logic/jjbSession';
import { doublesLive, doublesMatches, doublesScore, setDoublesVerdict } from '../logic/jjbDoubles';
import { BrandLockup } from '../components/BrandLockup';

const MODES_SET = new Set<SessionMode>(['std8', 'std10', 'std12', 'rescue', 'one-a', 'hard1', 'hard2', 'feiqiu', 'suiji', 'doubles']);

// React 版 Battle 屏（段1 PoC + 段2 Phase 1 真实局接缝）：优先读 jjbLive() 当前 select 局（不重开 startRandomSession），
// 仅在 jjbLive=false 时兜底开一局 std8（PoC 直访 ?screen=battle 不需先走 home 选模式）。
// 整屏布局承接 design/v4-r2/components/battle-screen.jsx。
export function BattleScreen({ style, mode }: { style: string; mode: string }) {
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0); // 判定后强制重渲

  useEffect(() => {
    try {
      if (doublesLive()) { setReady(true); return; } // 双打局已由 select 配置；battle 直读 doublesMatches，无单打兜底/随机填充
      const s = getSelectState();
      if (s.jjbLive) {
        // 真实 select 局已开局（home→startSession→select→点开始→randomFillAndStart 后 jjbLive 仍 true，status=3）
        // 但 URL 直跳 ?screen=battle 路径：select 屏 useEffect 调了 startSession（status=2，selected* 全 null）；
        // 此时若 selected* 全 null，兜底 randomFillAndStart 让 battle 屏收到填好的 9 格（不破坏真实开局语义）。
        const allNullFac = (s.selectedFactorList || []).every((f) => f == null);
        const allNullCmd = (s.selectedCommanderList || []).every((c) => c == null);
        if (allNullFac && allNullCmd) {
          randomFillAndStart();
        } else {
          exposeBattleDebug();
        }
      } else {
        // 兜底：直接 ?screen=battle 访问，无 select 局可读——
        // 若 URL ?mode= 指定模式（与 home→select 模式同源），走 startSession(mode) → randomFillAndStart 真实开局；
        // 否则保留段1 PoC 行为开一局 std8 随机（startRandomSession 一次走完）。
        const urlMode = (typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('mode')
          : null) as SessionMode | null;
        if (urlMode && MODES_SET.has(urlMode)) {
          startSession(urlMode);
          if (urlMode !== 'doubles') randomFillAndStart(); // doubles 自管引擎，不走单打随机填充（双打 battle 完整渲染见段3 phase3）
        } else {
          startRandomSession(2); // 8 因子随机一局
        }
      }
      setReady(true);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[BattleScreen] 初始化失败:', e);
      setReady(true);
    }
  }, []);

  if (!ready) return <div style={{ color: '#fff', padding: 40 }}>开局中…</div>;

  const dbl = doublesLive();
  const matches = dbl ? doublesMatches() : getSessionMatches();
  const score = dbl ? doublesScore() : getScore();
  const s = getSelectState();
  const playerName = dbl ? '双打战队' : (s.playerName || '集结杯选手');
  const rows: MatchRowData[] = matches.map((m, i) => ({
    idx: i,
    slot: m.slot,
    mapName: m.map,
    cmds: m.cmds,
    factors: m.factors,
    lock: m.lock,
    verdict: m.result,
    boss: i === matches.length - 1,
    difficulty: dbl ? 0 : matchDifficulty(i as 0 | 1 | 2), // 双打无因子难度分（引擎自管 per-match 胜负计分）；单打 difficultyTotal/matchDifficulty 不受影响
  }));

  return (
    <div
      className={`jjb style-${style} mode-${mode}`}
      style={{ width: 1280, height: 720 }}
      data-screen-label={`battle-${style}-${mode}-${dbl ? 'doubles' : s.mode}`}
      data-tick={tick}
      {...(dbl ? { 'data-doubles-battle': matches.length } : {})}
    >
      <div className="jjb-bg">
        <div className="bg-grad"></div>
        <div className="bg-tex"></div>
        <div className="bg-vignette"></div>
      </div>
      <div className="jjb-inner battle">
        <div className="topbar">
          <BrandLockup styleName={style} modeName={mode} size="sm" />
          <div className="topbar-meta">
            <div className="meta-row">
              <span className="meta-k">当前选手</span>
              <span className="meta-v">{playerName}</span>
            </div>
            <div className="meta-row">
              <span className="meta-k">获胜场数</span>
              <span className="meta-v">{score} 场</span>
            </div>
          </div>
        </div>

        <div className="matches">
          {rows.map((r) => (
            <MatchRow
              key={r.idx}
              data={r}
              onVerdict={(v) => {
                if (dbl) setDoublesVerdict(r.idx, v);
                else setVerdict(r.idx, v);
                setTick((x) => x + 1);
              }}
            />
          ))}
        </div>

        <div className="foot">
          <span className="foot-org">CM × 集结杯</span>
          <span className="foot-links">
            <span className="foot-link">
              <b>直播判定</b>胜利 / 带奖励 / 失败
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
