import { useEffect, useState } from 'react';
import { MatchRow, type MatchRowData } from '../components/MatchRow';
import { startRandomSession, startSession, getSessionMatches, setVerdict, getScore, getSelectState, exposeBattleDebug, randomFillAndStart, type SessionMode } from '../logic/jjbSession';
import { logoUrl } from '../lib/realAsset';

const MODES_SET = new Set<SessionMode>(['std8', 'std10', 'std12', 'rescue', 'one-a', 'hard1', 'hard2', 'feiqiu', 'suiji']);

// React 版 Battle 屏（段1 PoC + 段2 Phase 1 真实局接缝）：优先读 jjbLive() 当前 select 局（不重开 startRandomSession），
// 仅在 jjbLive=false 时兜底开一局 std8（PoC 直访 ?screen=battle 不需先走 home 选模式）。
// 整屏布局承接 design/v4-r2/components/battle-screen.jsx。
export function BattleScreen({ style, mode }: { style: string; mode: string }) {
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0); // 判定后强制重渲

  useEffect(() => {
    try {
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
          randomFillAndStart();
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

  const matches = getSessionMatches();
  const score = getScore();
  const s = getSelectState();
  const playerName = s.playerName || '集结杯选手';
  const logo = logoUrl(style, mode);
  const rows: MatchRowData[] = matches.map((m, i) => ({
    idx: i,
    slot: m.slot,
    mapName: m.map,
    cmds: m.cmds,
    factors: m.factors,
    lock: m.lock,
    verdict: m.result,
    boss: i === 2,
  }));

  return (
    <div
      className={`jjb style-${style} mode-${mode}`}
      style={{ width: 1280, height: 720 }}
      data-screen-label={`battle-${style}-${mode}-${s.mode}`}
      data-tick={tick}
    >
      <div className="jjb-bg">
        <div className="bg-grad"></div>
        <div className="bg-tex"></div>
        <div className="bg-vignette"></div>
      </div>
      <div className="jjb-inner battle">
        <div className="topbar">
          <div className="lockup lockup-sm">
            <img className="lockup-mark" src={logo} alt="CM" />
            <span className="lockup-div"></span>
            <div className="lockup-word">
              <span className="lockup-cn">集结杯</span>
            </div>
          </div>
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
                setVerdict(r.idx, v);
                setTick((x) => x + 1);
              }}
            />
          ))}
        </div>

        <div className="foot">
          <span className="foot-org">CM × 集结杯 · React PoC（真实 JijieData · sessionMatches）</span>
          <span className="foot-links">
            <span className="foot-link">
              <b>数据源</b>真实 csv → ConfigData → JijieData
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
