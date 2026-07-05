import { useState } from 'react';
import { startSession, setRuleMode, type SessionMode } from '../logic/jjbSession';
import { doublesLive, setDoublesPlayers } from '../logic/jjbDoubles';
import { getAccount } from '../logic/backend';
import { ScreenShell } from '../components/ScreenShell';
import { BrandLockup } from '../components/BrandLockup';
import { PromoBar } from '../components/PromoBar';
import { useToast, ToastV } from '../components/Toast';
import JijieData from '../logic/legacy/JijieData';
import { MODE_DEFS } from '../config/modes';

// 集结杯 × CM — 首页（练习/比赛双模式入口 + 选手名）。承接 design/v4-r2/home + Claude Design 项目
// 「集结杯练习比赛切换」(19b54387) 的 JJBHomeFrame：品牌字标下加「练习/比赛」tab（纯前端切换、不丢选手名）。
//   练习态 = 现状（参赛选手 + 6 模式格 + 三入口宣传条）+「随意练习不计分」提示；
//   比赛态 = 主播登录占位 + 突出选手 ID（直播展示）+ 6 模式格 + 积分天梯占位卡。登录/积分均 UI 占位（后端 P5 才接）。
// 模式集合以当前直播入口为准：8/10/极难 + 拯救 + 两个双打（5 号位非酋之轮=非酋双打 / 6 号位官突双打）。
// 5、6 号位皆双打：非酋之轮(feiqiu-doubles=混乱工作室锁定+3固定可分配因子+随机真地图) 与 官突双打(doubles=抽CSV真表) 各占一格。
// 首页 8 格从 MODE_DEFS 派生（单一真相源，no/key/name/tag/soon 结构不变；当前无 soon 项）。
const HOME_MODE_KEYS: (SessionMode | 'doubles')[] = ['std8', 'std10', 'std12', 'rescue', 'feiqiu-doubles', 'doubles', 'std15', 'cm'];
const MODES: { no: string; key: SessionMode | 'doubles'; name: string; tag: string; soon?: boolean }[] =
  HOME_MODE_KEYS.map((key) => {
    const d = MODE_DEFS[key];
    return { no: d.no!, key, name: d.name!, tag: d.tag! };
  });

export interface HomeScreenProps {
  style: string;
  mode: string;
  onStart: (m: SessionMode, playerName: string) => void;
  onLadder: () => void;
  onPasteCode: () => void; // 贴码开局：CodeScreen paste
  onLogin: () => void; // 主播登录：LoginScreen
  onLogout: () => void; // 退出登录（清 auth 并触发上层重渲染，见 App.tsx rerenderTick）
}

export function HomeScreen({ style, mode, onStart, onLadder, onPasteCode, onLogin, onLogout }: HomeScreenProps) {
  const [playerName, setPlayerName] = useState('集结杯选手');
  // 双打第二名选手（#84）：双打模式落库 players=[A,B] 两真实 player 的 B 名来源；单打忽略此值。
  const [playerNameB, setPlayerNameB] = useState('');
  // 练习/比赛双模式（纯前端首页态；比赛侧登录/积分为占位，后端 P5 才接）。切 tab 不丢选手名（同一 state）。
  const [homeMode, setHomeMode] = useState<'practice' | 'match'>('practice');
  // QQ 群二维码浮层（第 9 格入口；加群不设登录门）。大图浮层保证直播/远距离可扫。
  const [qrOpen, setQrOpen] = useState(false);
  const isMatch = homeMode === 'match';
  // 登录入口的登录/已登录两态（修复"循环登录"反馈：老王登录成功后右上角仍显示登录按钮，
  // 因为此按钮此前无条件渲染、从不读 getAccount()，看起来像没登上）。
  const account = getAccount();
  // 比赛前自检 toast（#94）：非主播账号开比赛局的软提示，复用 SelectScreen 同款 useToast+ToastV。
  const [toast, setToast] = useToast();

  const start = (m: SessionMode | 'doubles', soon?: boolean) => {
    if (soon) return; // soon 占位项不启动（当前无 soon 项；doubles 已接通）
    // 登录门（需求1·全模式）：未登录点开局 → 引导登录、不开局、不污染 XP 状态。
    // 公开读（天梯/OBS横条/观众）不经此路径，零影响。
    if (!getAccount()) { onLogin(); return; }
    // 直播前自检（#94）：比赛 tab 开局但账号非主播 → 软提示战绩不会录入天梯，不阻断开局。
    if (isMatch && account?.kind !== 'host') {
      setToast({ msg: '比赛模式：当前账号非主播，本局战绩不会录入天梯', count: 1, kind: 'soft' });
    }
    const name = (playerName || '').trim() || '集结杯选手';
    // P1b 规则态下沉：home 练习/比赛 tab → setRuleMode（hub 拍板方案A；startSession 不重置规则态，由此处决定）。
    setRuleMode(isMatch ? 'match' : 'practice');
    // startSession 末尾 exposeSelectDebug 把 mode 写到 __jjbDebug.select.mode，
    // 这里 startSession 后再覆盖 JijieData.playerName（不破坏 9 模式 status/map/lock/pool 任何契约）。
    startSession(m as SessionMode);
    try { (JijieData as any).playerName = name; } catch { /* noop */ }
    // 双打（#84）：startSession→doublesStart 已把 _players 重置为默认，这里覆盖两名真选手（B 空则 jjbDoubles 回落默认名）。
    // 落库 currentPlayers()→players=[A,B]，后端 scoreMatch 为两人各记分。单打 doublesLive()=false 不进此分支、players 仍单元素。
    // （review 修：doublesLive() 即单一真相源——startSession 刚按 m 分流完引擎；不另维护双打模式键集合，防新增 variant 漏更漂移。）
    if (doublesLive()) {
      setDoublesPlayers(name, (playerNameB || '').trim());
    }
    onStart(m as SessionMode, name);
  };

  return (
    <ScreenShell
      className={`jjb style-${style} mode-${mode}`}
      data-screen-label={`home-${style}-${mode}`}
    >
      <div className="jjb-inner home">
        <div className="home-head">
          <BrandLockup styleName={style} modeName={mode} size="lg" />
        </div>

        {/* 练习 / 比赛 双模式 tab（+ 比赛态右侧主播登录占位） */}
        <div className="tabrow">
          <div className="hmode" role="tablist" data-home-mode={homeMode}>
            <button
              className={'hmode-tab practice' + (isMatch ? '' : ' on')}
              type="button" role="tab" aria-selected={!isMatch}
              data-home-tab="practice"
              onClick={() => setHomeMode('practice')}
            >
              <svg className="ht-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="4.5"></circle><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"></circle>
              </svg>
              <span className="ht-tx"><span className="ht-t">练习</span><span className="ht-s">PRACTICE</span></span>
            </button>
            <button
              className={'hmode-tab match' + (isMatch ? ' on' : '')}
              type="button" role="tab" aria-selected={isMatch}
              data-home-tab="match"
              onClick={() => setHomeMode('match')}
            >
              <svg className="ht-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 4 H17 V9 A5 5 0 0 1 7 9 Z"></path><path d="M7 5 H4 V6 A3 3 0 0 0 7 9"></path><path d="M17 5 H20 V6 A3 3 0 0 1 17 9"></path><path d="M12 14 V17"></path><path d="M8.5 20 H15.5"></path><path d="M10 17 H14 V20 H10 Z"></path>
              </svg>
              <span className="ht-tx"><span className="ht-t">比赛</span><span className="ht-s">TOURNAMENT</span></span>
            </button>
          </div>
          {/* 登录入口：未登录=练习态选手登录/比赛态主播登录；已登录=账号名+退出（读 getAccount，不再无条件显示登录按钮） */}
          <div className="login-entry">
            {account ? (
              <div className="loginbtn logged" data-account-badge>
                <span className="lb-ico">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3 L19 6 V11 C19 16 16 19.5 12 21 C8 19.5 5 16 5 11 V6 Z"></path><path d="M8.5 12.5 L11 15 L16 9"></path>
                  </svg>
                </span>
                <span className="lb-tx">
                  <span className="lb-t">{account.kind === 'host' ? (account.display_name || '主播') : (account.nickname || '选手')}</span>
                  <span className="lb-s">{account.kind === 'host' ? 'ADMIN · 已登录' : 'PLAYER · 已登录'}</span>
                </span>
                <button className="logoutbtn" type="button" data-nav-logout onClick={onLogout}>退出</button>
              </div>
            ) : (
              <button className="loginbtn" type="button" data-login-placeholder data-nav-login onClick={onLogin}>
                <span className="lb-ico">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3 L19 6 V11 C19 16 16 19.5 12 21 C8 19.5 5 16 5 11 V6 Z"></path><circle cx="12" cy="11" r="2.4"></circle><path d="M12 13.4 V16"></path>
                  </svg>
                </span>
                <span className="lb-tx">{isMatch
                  ? <><span className="lb-t">主播登录</span><span className="lb-s">ADMIN · <b>比赛后台</b></span></>
                  : <><span className="lb-t">选手登录</span><span className="lb-s">PLAYER · <b>参赛选手</b></span></>}</span>
              </button>
            )}
          </div>
        </div>

        {/* 模式提示行 */}
        {isMatch ? (
          <p className="match-hint"><span className="mh-dot"></span>比赛模式 · 成绩计入<b>积分天梯</b> · 选手名将在直播间展示</p>
        ) : (
          <p className="practice-hint"><span className="ph-dot"></span>练习模式 · 随意练习不计分</p>
        )}

        <div className={'player-row' + (isMatch ? ' match' : '')}>
          <label className="player-label">{isMatch ? '选手 ID' : '参赛选手'}</label>
          <span className={'player-field' + (isMatch ? ' big' : '')} style={{ display: 'flex', alignItems: 'center' }}>
            <input
              className="player-ph"
              data-player-input
              style={{
                background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--ink)', fontSize: 17, flex: 1, padding: 0,
              }}
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={24}
              placeholder="请输入选手 ID"
            />
            <span className="caret"></span>
          </span>
          {isMatch && <span className="player-live"><span className="pl-dot"></span>LIVE</span>}
        </div>

        {/* 选手 B（#84 双打第二名）：功能性最简采集——始终渲染，双打模式落库 players=[A,B] 取此值，单打忽略。视觉打磨归 #75。 */}
        <div className="player-row player-row-b">
          <label className="player-label">选手 B</label>
          <span className="player-field" style={{ display: 'flex', alignItems: 'center' }}>
            <input
              className="player-ph"
              data-player-input-b
              style={{
                background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--ink)', fontSize: 17, flex: 1, padding: 0,
              }}
              value={playerNameB}
              onChange={(e) => setPlayerNameB(e.target.value)}
              maxLength={24}
              placeholder="双打第二名选手（单打可留空）"
            />
            <span className="caret"></span>
          </span>
        </div>

        <div className="mode-block">
          <div className="block-head">
            <span className="block-kicker">SELECT MODE</span>
            <span className="block-title">比赛模式</span>
            <button type="button" className="btn-ghost" data-nav-pastecode onClick={onPasteCode} style={{ marginLeft: 'auto', alignSelf: 'center' }}>贴码开局 →</button>
          </div>
          <div className="mode-grid">
            {MODES.map((m) => (
              <button
                key={m.key}
                className={'mode-btn' + (m.soon ? ' off' : '')}
                data-mode-btn={m.key}
                type="button"
                onClick={() => start(m.key, m.soon)}
              >
                <span className="mode-no">{m.no}</span>
                <span className="mode-name">{m.name}</span>
                <span className="mode-tag">{m.soon ? '开发中' : m.tag}</span>
              </button>
            ))}
            {/* 第 9 格：QQ 群入口（补齐 3×3；点击弹大码浮层） */}
            <button className="mode-btn qr-btn" data-qr-open type="button" onClick={() => setQrOpen(true)}>
              <span className="mode-no">09</span>
              <span className="mode-name">扫码加群</span>
              <span className="qr-mini">
                <img src="/qr/qq-saishi.png" alt="集结杯赛事群" />
                <img src="/qr/qq-oncall.png" alt="CM 合作练习 OnCall 群" />
              </span>
            </button>
          </div>
        </div>

        {/* 入口区随态切换：练习=三入口宣传条 / 比赛=积分天梯占位卡 */}
        {isMatch ? (
          <a className="pcard ladder" data-ladder-placeholder data-nav-ladder onClick={onLadder} style={{ cursor: 'pointer' }}>
            <span className="pic">
              <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5 H23 V11 A7 7 0 0 1 9 11 Z"></path><path d="M9 6 H5 V8 A4 4 0 0 0 9 12"></path><path d="M23 6 H27 V8 A4 4 0 0 1 23 12"></path><path d="M16 18 V22"></path><path d="M11 27 H21"></path><path d="M13 22 H19 V27 H13 Z"></path>
              </svg>
            </span>
            <span className="ptx"><span className="pm">积分天梯</span><span className="ps"><i className="dot"></i>赛季积分 · 全国排名 · 段位结算</span></span>
            <span className="soon-chip">查看榜单 →</span>
          </a>
        ) : (
          <div className="foot foot-promo">
            <PromoBar />
          </div>
        )}

        <ToastV toast={toast} />
      </div>

      {/* QQ 群大码浮层：直播画面/远距离扫码用，点任意处关闭 */}
      {qrOpen && (
        <div className="qr-overlay" data-qr-overlay onClick={() => setQrOpen(false)}>
          <div className="qr-pop">
            <div className="qr-card">
              <img src="/qr/qq-saishi.png" alt="合作模式集结杯赛事群" />
              <span>集结杯赛事群 · 965786418</span>
            </div>
            <div className="qr-card">
              <img src="/qr/qq-oncall.png" alt="CM 合作练习图 OnCall 群" />
              <span>CM 合作练习 OnCall 群 · 517072</span>
            </div>
            <span className="qr-hint">QQ 扫一扫加入群聊 · 点击任意处关闭</span>
          </div>
        </div>
      )}
    </ScreenShell>
  );
}
