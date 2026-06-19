import { useEffect, useState } from 'react';
import { ObsBar, type ObsRow } from '../components/ObsBar';
import { startRandomSession, exposeObsbarDebug, jjbLive } from '../logic/jjbSession';
import { currentDifficultyTotal, currentLockedFactors, currentLockTag, currentMatches, currentScore, ensureDoublesSessionFromUrl, setCurrentVerdict } from '../logic/jjbView';

// ObsScreen — 直播采集 OBS 横条（段3 真实化 + 横条判定）。
// 布局策略（用户愿景②）：单窗口，上方横条进 OBS 采集区、下方判定控制条放采集线外
//   （OBS 浏览器源固定分辨率裁切只采上方横条，下方顶出不入画面；同窗口 JijieData 共享，判定实时反映）。
//   对齐 Cocos 版「bartop 控制 UI 下移采集线外」。?bare=1 时只渲横条（纯采集产物/截图）。
// 数据真实化：status/verdict 从真实 winLoseList（经 sessionMatches.result）推导，去掉早期硬编码演示态。
//   推导镜像 JJBOverlay.statusOf：已判定→done+verdict、首个未判定→live(进行中)、其余→wait(待战)。
export function ObsScreen({ style, mode, onBack }: { style: string; mode: string; onBack: () => void }) {
  const bare = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('bare') === '1';
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0); // 判定后强制重渲

  useEffect(() => {
    try {
      // 有当前局（home→select→battle 流来的）则读真实局；直访 ?screen=obs 无局时兜底开一局展示。
      if (ensureDoublesSessionFromUrl()) { setReady(true); return; }
      if (!jjbLive()) startRandomSession(2);
      setReady(true);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[ObsScreen] init failed:', e);
      setReady(true);
    }
  }, []);

  if (!ready) return null;
  void tick;

  const matches = currentMatches();
  // 真实 status/verdict 推导：已判定(result 有值)→done；首个未判定→live；其余→wait。
  let liveAssigned = false;
  const rows: ObsRow[] = matches.map((m, i) => {
    let status: 'done' | 'live' | 'wait';
    let verdict: string | undefined;
    if (m.result) {
      status = 'done';
      verdict = m.result;
    } else if (!liveAssigned) {
      status = 'live';
      liveAssigned = true;
    } else {
      status = 'wait';
    }
    return { idx: i, no: m.slot, mapName: m.map, cmds: m.cmds, factors: m.factors, lock: m.lock, lockedFactors: currentLockedFactors(m), lockTag: currentLockTag(), status, verdict };
  });
  const wins = currentScore();
  const total = matches.length;
  exposeObsbarDebug(rows, wins, total);

  const judge = (i: number, v: 'win' | 'bonus' | 'lose') => {
    setCurrentVerdict(i, v);
    setTick((x) => x + 1);
  };

  return (
    <div
      className="obs-host"
      data-bare={bare ? '1' : undefined}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0', gap: 14 }}
    >
      {/* 采集区：横条（OBS 浏览器源裁切到这块） */}
      <ObsBar style={style} mode={mode} rows={rows} wins={wins} total={total} difficulty={currentDifficultyTotal()} />

      {/* 采集线外：返回入口（!bare 主播操作态可点；bare 纯采集隐藏，不干扰 OBS 固定采集） */}
      {!bare && (
        <button
          type="button"
          className="ctrl-btn"
          data-back-select
          onClick={onBack}
          style={{ alignSelf: 'center', marginTop: 2, padding: '8px 22px', fontSize: 14 }}
        >
          ← 返回
        </button>
      )}

      {/* 采集线外：判定控制条（主播点胜负，横条实时更新；?bare=1 纯采集时隐藏） */}
      {!bare && (
        <div
          className={`jjb style-${style} mode-${mode}`}
          data-obs-control
          style={{
            display: 'flex', gap: 18, alignItems: 'flex-end', padding: '10px 16px',
            background: 'var(--panel-bg)', border: '1px solid var(--panel-edge)',
          }}
        >
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 1 }}>{r.no}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className={'v-btn' + (r.verdict === 'win' ? ' on v-win' : '')} onClick={() => judge(i, 'win')}>胜</button>
                <button className={'v-btn' + (r.verdict === 'bonus' ? ' on v-bonus' : '')} onClick={() => judge(i, 'bonus')}>奖</button>
                <button className={'v-btn' + (r.verdict === 'lose' ? ' on v-lose' : '')} onClick={() => judge(i, 'lose')}>负</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
