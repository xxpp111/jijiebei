import { useEffect, useState } from 'react';
import { FactorFrame } from './components/FactorFrame';
import { CommanderCard } from './components/CommanderCard';
import { BattleScreen } from './screens/BattleScreen';
import { ObsScreen } from './screens/ObsScreen';
import { startSession, exposeStartSession, type SessionMode } from './logic/jjbSession';

// 路由（query）：?screen=battle 真实数据 Battle 屏（Phase 3 接缝）；默认 foundation 组件地基（Phase 2）。
// ?style=metal|sc2|minimal & ?mode=dark|light 初始主题；?bare=1 隐藏切换条（纯净截图）。
const STYLES = ['metal', 'sc2', 'minimal'] as const;
const MODES = ['dark', 'light'] as const;

function q(k: string, d = ''): string {
  if (typeof window === 'undefined') return d;
  return new URLSearchParams(window.location.search).get(k) || d;
}

export default function App() {
  const screen = q('screen', 'foundation');
  const bare = q('bare') === '1';
  const [style, setStyle] = useState<(typeof STYLES)[number]>((q('style', 'sc2') as any));
  const [mode, setMode] = useState<(typeof MODES)[number]>((q('mode', 'dark') as any));

  const switcher = bare ? null : (
    <div
      className={`jjb style-${style} mode-${mode}`}
      style={{
        position: 'fixed', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 100,
        width: 'auto', height: 'auto', display: 'flex', gap: 6, alignItems: 'center',
        padding: '5px 8px', background: 'var(--panel-bg)', border: '1px solid var(--panel-edge)',
      }}
    >
      {STYLES.map((s) => (
        <button key={s} className={'ctrl-btn' + (s === style ? ' on' : '')} onClick={() => setStyle(s)}>{s}</button>
      ))}
      <span style={{ width: 1, height: 18, background: 'var(--panel-edge)' }} />
      {MODES.map((m) => (
        <button key={m} className={'ctrl-btn' + (m === mode ? ' on' : '')} onClick={() => setMode(m)}>{m}</button>
      ))}
    </div>
  );

  if (screen === 'obs') {
    // OBS 直播横条：默认不挂主题切换条（对外采集产物）；主题由 URL ?style=&mode= 控制。
    return <ObsScreen style={style} mode={mode} />;
  }

  if (screen === 'phase0') {
    // 段2 Phase 0 全模式开局屏：默认开局 std8 一次（9 模式可由浏览器 ?mode=std8|std10|... 或
    // window.__jjb.startSession(mode) 切换）；裸屏无切换条。
    return <Phase0Screen />;
  }

  if (screen === 'battle') {
    return (
      <>
        <BattleScreen style={style} mode={mode} />
        {switcher}
      </>
    );
  }

  // Phase 2 foundation: 6-theme switch + FactorFrame / CommanderCard
  return (
    <div className={`jjb style-${style} mode-${mode}`} style={{ width: 1280, height: 720 }} data-screen-label={`foundation-${style}-${mode}`}>
      <div className="jjb-bg">
        <div className="bg-grad"></div>
        <div className="bg-tex"></div>
        <div className="bg-vignette"></div>
      </div>
      <div className="jjb-inner" style={{ gap: 22 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {STYLES.map((s) => (
            <button key={s} className={'ctrl-btn' + (s === style ? ' on' : '')} onClick={() => setStyle(s)}>{s}</button>
          ))}
          <span style={{ width: 1, height: 20, background: 'var(--panel-edge)', margin: '0 4px' }} />
          {MODES.map((m) => (
            <button key={m} className={'ctrl-btn' + (m === mode ? ' on' : '')} onClick={() => setMode(m)}>{m}</button>
          ))}
        </div>

        <div className="block-head">
          <span className="block-kicker">FACTOR</span>
          <span className="block-title">FactorFrame · 因子边框（PNG 整图）</span>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <FactorFrame src="assets/factor-blizzard.png" size={72} />
          <FactorFrame src="assets/factor-void.png" gold sel check size={72} />
          <FactorFrame src="assets/factor-money.png" gold tag="官突" size={72} />
          <FactorFrame src="assets/factor-nuke.png" tag="锁定" size={72} />
          <FactorFrame src="assets/factor-lava.png" dim size={72} />
        </div>

        <div className="block-head">
          <span className="block-kicker">COMMANDER</span>
          <span className="block-title">CommanderCard · 指挥官卡</span>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <CommanderCard src="assets/cmd-raynor.png" name="雷诺" w={60} h={72} />
          <CommanderCard src="assets/cmd-kerrigan.png" name="凯瑞甘" sel check w={60} h={72} />
          <CommanderCard src="assets/cmd-artanis.png" name="阿塔尼斯" w={60} h={72} />
          <CommanderCard src="assets/cmd-nova.png" name="诺娃" w={60} h={72} />
          <CommanderCard src="assets/cmd-tychus.png" name="泰凯斯" w={60} h={72} drag />
        </div>
      </div>
    </div>
  );
}

/** 段2 Phase 0 全模式开局屏：默认开局一次（9 模式入口经 URL ?mode= 或 window.__jjb.startSession）。
 *  唯一作用=让 build 引用 startSession/exposeStartSession 防止 tree-shake + 浏览器侧 e2e 入口。 */
function Phase0Screen() {
  useEffect(() => {
    exposeStartSession();
    const m = (q('mode', 'std8') as SessionMode);
    try { startSession(m); } catch (e) { console.error('[Phase0] startSession failed:', e); }
  }, []);
  return (
    <div className={`jjb style-${q('style', 'sc2')} mode-${q('mode', 'dark')}`} style={{ width: 1280, height: 720, color: '#fff', padding: 40 }}>
      <div style={{ fontSize: 22, fontWeight: 700 }}>段2 Phase 0 · 全模式开局屏</div>
      <div style={{ marginTop: 12, fontSize: 14, opacity: 0.8 }}>
        9 模式入口：<code>window.__jjb.startSession('std8' | 'std10' | 'std12' | 'rescue' | 'one-a' | 'hard1' | 'hard2' | 'feiqiu' | 'suiji')</code>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.6 }}>
        当前模式：<code>{q('mode', 'std8')}</code>，读 <code>window.__jjbDebug.select</code> 看恒等式与 9 格契约。
      </div>
    </div>
  );
}
