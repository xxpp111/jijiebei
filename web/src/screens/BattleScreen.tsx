import { useEffect, useState } from 'react';
import { MatchRow, type MatchRowData } from '../components/MatchRow';
import { startRandomSession, getSessionMatches, setVerdict, getScore } from '../logic/jjbSession';
import { logoUrl } from '../lib/realAsset';

// React 版 Battle 屏（段1 PoC）：读真实 JijieData（经 JJBData.sessionMatches）渲染 3 场，
// 点判定写 winLoseList + 重算记分。整屏布局承接 design/v4-r2/components/battle-screen.jsx。
export function BattleScreen({ style, mode }: { style: string; mode: string }) {
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0); // 判定后强制重渲

  useEffect(() => {
    try {
      startRandomSession(2); // 8 因子随机一局
      setReady(true);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[BattleScreen] startRandomSession failed:', e);
      setReady(true);
    }
  }, []);

  if (!ready) return <div style={{ color: '#fff', padding: 40 }}>开局中…</div>;

  const matches = getSessionMatches();
  const score = getScore();
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
      data-screen-label={`battle-${style}-${mode}`}
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
              <span className="meta-v">PoC 选手</span>
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
