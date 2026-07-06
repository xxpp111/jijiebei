import { useEffect, useState, type ReactNode } from 'react';
import { BattleScreen } from './screens/BattleScreen';
import { ObsScreen } from './screens/ObsScreen';
import { HomeScreen } from './screens/HomeScreen';
import { SelectScreen } from './screens/SelectScreen';
import { ResultScreen } from './screens/ResultScreen';
import { BpConfigScreen } from './screens/BpConfigScreen';
import { EventRulesScreen } from './screens/EventRulesScreen';
import { CodeScreen } from './screens/CodeScreen';
import { LadderScreen } from './screens/LadderScreen';
import { LoginScreen } from './screens/LoginScreen';
import { RegisterScreen } from './screens/RegisterScreen';
import { startSession, getSelectState, querySessionMode, type SessionMode } from './logic/jjbSession';
import { doublesLive } from './logic/jjbDoubles';
import { fetchAndLoadEventBan } from './logic/eventBan';
import { currentSessionMode, currentTotal } from './logic/jjbView';
import { applySnapshot } from './logic/codec';
import JijieData from './logic/legacy/JijieData';
import { pbAuth, pbRefresh, getAccount, clearAuth } from './logic/backend';
import { AdaptiveViewport, type StageHeightMode } from './lib/dynres';

// 路由（query）：?screen=home|select|battle|obs|result|bpconfig|eventrules|code|ladder|login|register；
// ?style=metal|sc2|minimal & ?mode=dark|light 控视觉主题；?sessionMode=std8|std10|... 控赛事模式。
// 状态机：screen 默认 home；URL ?screen= 决定初屏（validScreen 夹紧非法值，含已删的 phase0/foundation 旧链接）；
// startSession 模式可由 startSession(mode) 重新开局。
const STYLES = ['metal', 'sc2', 'minimal'] as const;
const MODES = ['dark', 'light'] as const;
const SCREENS = ['home', 'select', 'battle', 'obs', 'result', 'bpconfig', 'eventrules', 'code', 'ladder', 'login', 'register'] as const;
const SCREEN_LABELS: Record<string, string> = {
  home: '主界面',
  select: '选择',
  battle: '对战',
  obs: '直播条',
  result: '结算',
  bpconfig: 'BP设置',
  code: '码方案',
  ladder: '天梯',
  eventrules: '赛事规则',
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
type Screen = 'home' | 'select' | 'battle' | 'obs' | 'result' | 'bpconfig' | 'eventrules' | 'code' | 'ladder' | 'login' | 'register';

function stageHeightMode(screen: Screen): StageHeightMode {
  return screen === 'home' ? 'content' : 'fixed';
}

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

  // 赛事 ban：App 启动拉一次 /api/event-rules → loadEventBan，让三引擎开局时拿到本周 ban（生效下一局）。后端不可达=无 ban、不阻断。
  useEffect(() => { void fetchAndLoadEventBan(); }, []);

  // 需求1 自动登录：App 启动静默 refresh。loadAuth 已从 storage（localStorage 记住我 / sessionStorage 会话）恢复内存态，
  // 此处用恢复的 token 调 pbRefresh 续期：成功更新 token（account 基本不变，无需重渲染）；401/失效 → clearAuth 并触发重渲染退登录。
  // 未登录（无 account）直接跳过，不 refresh。refresh 异步，期间组件首渲染已显示 storage 恢复的登录态 → 不闪未登录。
  useEffect(() => {
    if (!getAccount()) return; // 未登录不 refresh（pbRefresh 无 account 也返 false，提前 short-circuit 省一次请求）
    void pbRefresh().then((ok) => { if (!ok) setRerenderTick((x) => x + 1); }); // 401 已 clearAuth → 重渲染退登录
  }, []);

  // 登录门兜底（需求1）：防 ?screen=select/battle 直接 URL 绕过 HomeScreen.start() 门。未登录踢回 home。
  // 仅这两屏挡；公开读屏（home/obs/ladder/result/eventrules/code/...）不在此列，匿名读零影响（守住最大产品风险）。
  useEffect(() => {
    if ((screen === 'select' || screen === 'battle') && !getAccount()) navigate('home');
  }, [screen]);

  // select 屏兜底（?screen=select 直跳）：JijieData 还没开局就开一局 std8（按 stop_when 第 5 条）。
  // 加 getAccount 门：未登录不兜底开局（上面登录门 useEffect 同周期踢回 home，此处防同周期误开局污染 XP 状态）。
  useEffect(() => {
    if (screen === 'select' && getAccount()) {
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
      className={`jjb jjb-stage-switcher style-${style} mode-${mode}`}
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
      <span className="ctrl-sep" />
      {STYLES.map((s) => (
        <button key={s} className={'ctrl-btn' + (s === style ? ' on' : '')} onClick={() => chooseStyle(s)} data-style-btn={s}>{STYLE_LABELS[s]}</button>
      ))}
      <span className="ctrl-sep" />
      {MODES.map((m) => (
        <button key={m} className={'ctrl-btn' + (m === mode ? ' on' : '')} onClick={() => chooseMode(m)} data-mode-btn={m}>{MODE_LABELS[m]}</button>
      ))}
      <span className="ctrl-sep" />
      <span className="ctrl-sep" />
      <button className={'ctrl-btn' + (screen === 'bpconfig' ? ' on' : '')} type="button" onClick={() => navigate('bpconfig')} data-nav-bpconfig>BP设置</button>
      <button className={'ctrl-btn' + (screen === 'eventrules' ? ' on' : '')} type="button" onClick={() => navigate('eventrules')} data-nav-eventrules>赛事规则</button>
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

  const renderStage = (node: ReactNode) => (
    <AdaptiveViewport screen={screen} heightMode={stageHeightMode(screen)}>
      {node}
    </AdaptiveViewport>
  );

  if (screen === 'home') {
    return (
      <>
        {renderStage(
          <HomeScreen
            key={`home-${rerenderTick}`}
            style={style}
            mode={mode}
            onStart={(_m: SessionMode, _name: string) => navigate('select')}
            onLadder={() => navigate('ladder')}
            onPasteCode={() => goCode('paste')}
            onLogin={() => navigate('login')}
            onLogout={() => { clearAuth(); setRerenderTick((x) => x + 1); }}
          />,
        )}
        {!bare && switcher}
      </>
    );
  }

  if (screen === 'select') {
    return (
      <>
        {renderStage(
          <SelectScreen
            key={`select-${rerenderTick}`}
            style={style}
            mode={mode}
            onStart={() => navigate('battle')}
            onGenCode={() => goCode('gen')}
          />,
        )}
        {!bare && switcher}
      </>
    );
  }

  if (screen === 'battle') {
    return (
      <>
        {renderStage(<BattleScreen key={`battle-${rerenderTick}`} style={style} mode={mode} onGenCode={() => goCode('gen')} />)}
        {!bare && switcher}
      </>
    );
  }

  if (screen === 'obs') {
    return (
      <div className="jjb-obs-viewport" data-adaptive-stage="obs" data-stage-scale="1">
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
      </div>
    );
  }

  if (screen === 'result') {
    return (
      <>
        {renderStage(<ResultScreen key={`result-${rerenderTick}`} style={style} mode={mode} onGenCode={() => goCode('gen')} />)}
        {!bare && switcher}
      </>
    );
  }

  if (screen === 'ladder') {
    return (
      <>
        {renderStage(<LadderScreen key={`ladder-${rerenderTick}`} style={style} mode={mode} />)}
        {!bare && switcher}
      </>
    );
  }

  if (screen === 'login') {
    return (
      <>
        {renderStage(
          <LoginScreen
            key={`login-${rerenderTick}`}
            style={style}
            mode={mode}
            onBack={() => navigate('home')}
            onSuccess={() => navigate('home')}
            onRegister={() => navigate('register')}
          />,
        )}
        {!bare && switcher}
      </>
    );
  }

  if (screen === 'register') {
    return (
      <>
        {renderStage(
          <RegisterScreen
            key={`register-${rerenderTick}`}
            style={style}
            mode={mode}
            onBack={() => navigate('login')}
            onSuccess={() => navigate('home')}
          />,
        )}
        {!bare && switcher}
      </>
    );
  }

  if (screen === 'bpconfig') {
    return (
      <>
        {renderStage(<BpConfigScreen key={`bpconfig-${rerenderTick}`} style={style} mode={mode} />)}
        {!bare && switcher}
      </>
    );
  }

  if (screen === 'eventrules') {
    return (
      <>
        {renderStage(<EventRulesScreen key={`eventrules-${rerenderTick}`} style={style} mode={mode} />)}
        {!bare && switcher}
      </>
    );
  }

  if (screen === 'code') {
    return (
      <>
        {renderStage(
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
          />,
        )}
        {!bare && switcher}
      </>
    );
  }

  // 不可达：validScreen 已把非法值（含已删的 phase0/foundation 旧链接）夹到 home，上方 11 分支穷尽 Screen。
  return null;
}
