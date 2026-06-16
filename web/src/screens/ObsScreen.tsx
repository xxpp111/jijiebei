import { useEffect, useState } from 'react';
import { ObsBar, type ObsRow } from '../components/ObsBar';
import { startRandomSession, getSessionMatches, exposeObsbarDebug } from '../logic/jjbSession';

// ObsScreen — 直播采集 OBS 横条（饱满版）。读真实 JijieData（sessionMatches），
// 模拟直播进行态：第 1 场已判定(胜利) / 第 2 场进行中(live hero) / BOSS 待战。
// 横条 1280×232 居中展示（OBS 浏览器源采渲染后画面）。
export function ObsScreen({ style, mode }: { style: string; mode: string }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      startRandomSession(2);
      setReady(true);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[ObsScreen] startRandomSession failed:', e);
      setReady(true);
    }
  }, []);

  if (!ready) return null;

  const matches = getSessionMatches();
  const rows: ObsRow[] = matches.map((m, i) => ({
    idx: i,
    no: m.slot,
    mapName: m.map,
    cmds: m.cmds,
    factors: m.factors,
    lock: m.lock,
    status: i === 0 ? 'done' : i === 1 ? 'live' : 'wait',
    verdict: i === 0 ? 'win' : undefined,
  }));
  const wins = rows.filter((r) => r.status === 'done' && (r.verdict === 'win' || r.verdict === 'bonus')).length;
  exposeObsbarDebug(rows, wins, 3);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
      <ObsBar style={style} mode={mode} rows={rows} wins={wins} total={3} />
    </div>
  );
}
