import { useEffect, useState } from 'react';
import { FactorFrame } from './components/FactorFrame';
import { CommanderCard } from './components/CommanderCard';
import { BattleScreen } from './screens/BattleScreen';
import { ObsScreen } from './screens/ObsScreen';
import { HomeScreen } from './screens/HomeScreen';
import { SelectScreen } from './screens/SelectScreen';
import { ResultScreen } from './screens/ResultScreen';
import { BpConfigScreen } from './screens/BpConfigScreen';
import { CodeScreen } from './screens/CodeScreen';
import { LadderScreen } from './screens/LadderScreen';
import { LoginScreen } from './screens/LoginScreen';
import { startSession, exposeStartSession, getSelectState, querySessionMode, type SessionMode } from './logic/jjbSession';
import { doublesLive } from './logic/jjbDoubles';
import { currentSessionMode, currentTotal } from './logic/jjbView';
import { applySnapshot } from './logic/codec';
import JijieData from './logic/legacy/JijieData';
import { pbAuth, getAccount } from './logic/backend';

// 路由（query）：?screen=home|select|battle|obs|phase0|foundation；
// ?style=metal|sc2|minimal & ?mode=dark|light 控视觉主题；?sessionMode=std8|std10|... 控赛事模式。
// 段2 Phase 1：home/select/battle 三屏路由串通；Phase 0 屏保留向后兼容；foundation 屏保留组件地基。
// 状态机：screen 默认 home；URL ?screen= 决定初屏；startSession 模式可由 startSession(mode) 重新开局。
const STYLES = ['metal', 'sc2', 'minimal'] as const;
const MODES = ['dark', 'light'] as const;
const SCREENS = ['home', 'select', 'battle', 'obs', 'result', 'bpconfig', 'code', 'ladder', 'login', 'phase0', 'foundation'] as const;
const SCREEN_LABELS: Record<string, string> = {
  home: '主界面',
  select: '选择',
  battle: '对战',
  obs: '直播条',
  result: '结算',
  bpconfig: 'BP设置',
  code: '码方案',
  ladder: '天梯',
};
const STYLE_LABELS: Record<(typeof STYLES)[number], string> = {
  metal: '金属',
  sc2: '星际',
  minimal: '极简',
};
const MODE_LABELS: Record<(typeof MODES)[number], string> = {
  dark: '深色',
  light: '浅色',
};
type Screen = 'home' | 'select' | 'battle' | 'obs' | 'result' | 'bpconfig' | 'code' | 'ladder' | 'login' | 'phase0' | 'foundation';

function q(k: string, d = ''): string {
  if (typeof window === 'undefined') return d;
  return new URLSearchParams(window.location.search).get(k) || d;
}

function validStyle(v: string): (typeof STYLES)[number] {
  return (STYLES as readonly string[]).includes(v) ? (v as (typeof STYLES)[number]) : 'sc2';
}

function validThemeMode(v: string): (typeof MODES)[number] {
  return (MODES as readonly string[]).includes(v) ? (v as (typeof MODES)[number]) : 'dark';
}

function validScreen(v: string): Screen {
  return (SCREENS as readonly string[]).includes(v) ? (v as Screen) : 'home';
}

export default function App() {
  const initialScreen = validScreen(q('screen', 'home'));
  const bare = q('bare') === '1';
  const [style, setStyle] = useState<(typeof STYLES)[number]>(validStyle(q('style', 'sc2')));
  const [mode, setMode] = useState<(typeof MODES)[number]>(validThemeMode(q('mode', 'dark')));
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [codeVariant, setCodeVariant] = useState<'gen' | 'paste'>(q('code', 'gen') === 'paste' ? 'paste' : 'gen');
  const [rerenderTick, setRerenderTick] = useState(0);

  const writeUrlParam = (key: string, value: string) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set(key, value);
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const navigate = (next: Screen) => {
    setScreen(next);
    writeUrlParam('screen', next);
    // 会话级模式持久：当前局模式（含 doubles/feiqiu-doubles）写入 URL，防刷新丢状态
    const currentMode = currentSessionMode();
    if (currentMode) writeUrlParam('sessionMode', currentMode);
  };

  // 码方案入口：?screen=code + ?code=gen|paste（刷新可保持 variant）
  const goCode = (variant: 'gen' | 'paste') => {
    setCodeVariant(variant);
    setScreen('code');
    writeUrlParam('screen', 'code');
    writeUrlParam('code', variant);
    const currentMode = currentSessionMode();
    if (currentMode) writeUrlParam('sessionMode', currentMode);
  };

  const chooseStyle = (next: (typeof STYLES)[number]) => {
    setStyle(next);
    writeUrlParam('style', next);
  };

  const chooseMode = (next: (typeof MODES)[number]) => {
    setMode(next);
    writeUrlParam('mode', next);
  };

  // select 屏兜底（?screen=select 直跳）：JijieData 还没开局就开一局 std8（按 stop_when 第 5 条）。
  useEffect(() => {
    if (screen === 'select') {
      try {
        if (doublesLive()) return; // 双打局已开（JJBDoubles 自管，JijieData.mapList 恒空）：不被单打 startSession 兜底覆盖
        const d: any = JijieData;
        if (!d || !Array.isArray(d.mapList) || d.mapList.length < 3) {
          startSession(querySessionMode());
        }
      } catch (e) {
        console.error('[App] select 屏兜底开局失败:', e);
      }
    }
  }, [screen]);

  const restartCurrentMode = () => {
    const currentMode = currentSessionMode();
    startSession(currentMode);
    setRerenderTick((x) => x + 1);
  };

  const switcher = (
    <div
      className={`jjb style-${style} mode-${mode}`}
      style={{
        position: 'fixed', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 100,
        width: 'auto', height: 'auto', display: 'flex', gap: 6, alignItems: 'center',
        padding: '5px 8px', background: 'var(--panel-bg)', border: '1px solid var(--panel-edge)',
      }}
    >
      <button
        className={'ctrl-btn' + (screen === 'home' ? ' on' : '')}
        onClick={() => navigate('home')}
        data-nav-home
      >{SCREEN_LABELS.home}</button>
      <button
        className={'ctrl-btn' + (screen === 'select' ? ' on' : '')}
        onClick={() => navigate('select')}
        data-nav-select
      >{SCREEN_LABELS.select}</button>
      <button
        className={'ctrl-btn' + (screen === 'battle' ? ' on' : '')}
        onClick={() => navigate('battle')}
        data-nav-battle
      >{SCREEN_LABELS.battle}</button>
      <button
        className={'ctrl-btn' + (screen === 'obs' ? ' on' : '')}
        onClick={() => navigate('obs')}
        data-nav-obs
      >{SCREEN_LABELS.obs}</button>
      <button
        className={'ctrl-btn' + (screen === 'result' ? ' on' : '')}
        onClick={() => { if (currentTotal() >= 3) navigate('result'); }}
        title="查看结算（需三场判定完）"
        data-nav-result
      >{SCREEN_LABELS.result}</button>
      <span style={{ width: 1, height: 18, background: 'var(--panel-edge)' }} />
      {STYLES.map((s) => (
        <button key={s} className={'ctrl-btn' + (s === style ? ' on' : '')} onClick={() => chooseStyle(s)} data-style-btn={s}>{STYLE_LABELS[s]}</button>
      ))}
      <span style={{ width: 1, height: 18, background: 'var(--panel-edge)' }} />
      {MODES.map((m) => (
        <button key={m} className={'ctrl-btn' + (m === mode ? ' on' : '')} onClick={() => chooseMode(m)} data-mode-btn={m}>{MODE_LABELS[m]}</button>
      ))}
      <span style={{ width: 1, height: 18, background: 'var(--panel-edge)' }} />
      <span style={{ width: 1, height: 18, background: 'var(--panel-edge)' }} />
      <button className={'ctrl-btn' + (screen === 'bpconfig' ? ' on' : '')} type="button" onClick={() => navigate('bpconfig')} data-nav-bpconfig>BP设置</button>
      <button className={'ctrl-btn' + (screen === 'code' && codeVariant === 'gen' ? ' on' : '')} type="button" onClick={() => goCode('gen')} data-nav-code-gen>生成码</button>
      <button className={'ctrl-btn' + (screen === 'code' && codeVariant === 'paste' ? ' on' : '')} type="button" onClick={() => goCode('paste')} data-nav-code-paste>贴码开局</button>
      <button className="ctrl-btn" type="button" onClick={restartCurrentMode} data-rerandom-btn>重新随机</button>
      {q('dev') === '1' && (
        <button className="ctrl-btn" type="button" data-dev-login onClick={async () => {
          const id = prompt('dev 登录 · 账号（P5 联调用，正式登录走 F 登录界面）', 'host@jjb.test'); if (!id) return;
          const pw = prompt('密码'); if (!pw) return;
          try { const a = await pbAuth(id, pw); setRerenderTick((x) => x + 1); alert('登录成功: ' + a.role); } catch (e) { alert('登录失败: ' + (e as Error).message); }
        }}>{getAccount() ? `dev:${getAccount()?.role}` : 'dev登录'}</button>
      )}
      <button className="ctrl-btn" type="button" onClick={() => navigate('home')} data-back-home-btn>回主界面</button>
    </div>
  );

  if (screen === 'home') {
    return (
      <>
        <HomeScreen
          key={`home-${rerenderTick}`}
          style={style}
          mode={mode}
          onStart={(_m: SessionMode, _name: string) => navigate('select')}
          onLadder={() => navigate('ladder')}
          onPasteCode={() => goCode('paste')}
          onLogin={() => navigate('login')}
        />
        {!bare && switcher}
      </>
    );
  }

  if (screen === 'select') {
    return (
      <>
        <SelectScreen
          key={`select-${rerenderTick}`}
          style={style}
          mode={mode}
          onStart={() => navigate('battle')}
          onGenCode={() => goCode('gen')}
        />
        {!bare && switcher}
      </>
    );
  }

  if (screen === 'battle') {
    return (
      <>
        <BattleScreen key={`battle-${rerenderTick}`} style={style} mode={mode} onGenCode={() => goCode('gen')} />
        {!bare && switcher}
      </>
    );
  }

  if (screen === 'obs') {
    return (
      <ObsScreen
        key={`obs-${rerenderTick}`}
        style={style}
        mode={mode}
        onBack={() => {
          if (doublesLive()) {
            navigate('battle');
            return;
          }
          // OBS 返回两级（yb 06-18 确认）：先回 battle（对战），仅当 battle 无分配因子（因子+官全空 或 未开局）才回 select。
          // 判定口径镜像 BattleScreen:22-23 兜底（allNullFac && allNullCmd），保证返回 battle 后不会被兜底再次随机覆盖。
          const s = getSelectState();
          const fac = s.selectedFactorList || [];
          const cmd = s.selectedCommanderList || [];
          const allNullFac = fac.length === 0 || fac.every((f) => f == null);
          const allNullCmd = cmd.length === 0 || cmd.every((c) => c == null);
          const battleEmpty = !s.jjbLive || (allNullFac && allNullCmd);
          navigate(battleEmpty ? 'select' : 'battle');
        }}
      />
    );
  }

  if (screen === 'result') {
    return (
      <>
        <ResultScreen key={`result-${rerenderTick}`} style={style} mode={mode} onGenCode={() => goCode('gen')} />
        {!bare && switcher}
      </>
    );
  }

  if (screen === 'ladder') {
    return (
      <>
        <LadderScreen key={`ladder-${rerenderTick}`} style={style} mode={mode} />
        {!bare && switcher}
      </>
    );
  }

  if (screen === 'login') {
    return (
      <>
        <LoginScreen
          key={`login-${rerenderTick}`}
          style={style}
          mode={mode}
          onBack={() => navigate('home')}
          onSuccess={() => navigate('home')}
        />
        {!bare && switcher}
      </>
    );
  }

  if (screen === 'bpconfig') {
    return (
      <>
        <BpConfigScreen key={`bpconfig-${rerenderTick}`} style={style} mode={mode} />
        {!bare && switcher}
      </>
    );
  }

  if (screen === 'code') {
    return (
      <>
        <CodeScreen
          key={`code-${rerenderTick}-${codeVariant}`}
          style={style}
          mode={mode}
          variant={codeVariant}
          onBack={() => navigate('home')}
          onStart={(snap) => {
            applySnapshot(snap);
            navigate('select');
          }}
        />
        {!bare && switcher}
      </>
    );
  }

  if (screen === 'phase0') {
    return <Phase0Screen />;
  }

  // foundation: 6-theme switch + FactorFrame / CommanderCard
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
            <button key={s} className={'ctrl-btn' + (s === style ? ' on' : '')} onClick={() => chooseStyle(s)}>{s}</button>
          ))}
          <span style={{ width: 1, height: 20, background: 'var(--panel-edge)', margin: '0 4px' }} />
          {MODES.map((m) => (
            <button key={m} className={'ctrl-btn' + (m === mode ? ' on' : '')} onClick={() => chooseMode(m)}>{m}</button>
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
