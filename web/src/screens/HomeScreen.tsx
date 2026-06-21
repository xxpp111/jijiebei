import { useState } from 'react';
import { startSession, setRuleMode, type SessionMode } from '../logic/jjbSession';
import { BrandLockup } from '../components/BrandLockup';
import { PromoBar } from '../components/PromoBar';
import JijieData from '../logic/legacy/JijieData';

// 集结杯 × CM — 首页（练习/比赛双模式入口 + 选手名）。承接 design/v4-r2/home + Claude Design 项目
// 「集结杯练习比赛切换」(19b54387) 的 JJBHomeFrame：品牌字标下加「练习/比赛」tab（纯前端切换、不丢选手名）。
//   练习态 = 现状（参赛选手 + 6 模式格 + 三入口宣传条）+「随意练习不计分」提示；
//   比赛态 = 主播登录占位 + 突出选手 ID（直播展示）+ 6 模式格 + 积分天梯占位卡。登录/积分均 UI 占位（后端 P5 才接）。
// 模式集合以当前直播入口为准：8/10/极难 + 拯救 + 两个双打（5 号位非酋之轮=非酋双打 / 6 号位官突双打）。
// 5、6 号位皆双打：非酋之轮(feiqiu-doubles=混乱工作室锁定+3固定可分配因子+随机真地图) 与 官突双打(doubles=抽CSV真表) 各占一格。
const MODES: { no: string; key: SessionMode | 'doubles'; name: string; tag: string; soon?: boolean }[] = [
  { no: '01', key: 'std8', name: '8 因子', tag: '标准赛' },
  { no: '02', key: 'std10', name: '10 因子', tag: '进阶' },
  { no: '03', key: 'std12', name: '极难模式', tag: '极难' },
  { no: '04', key: 'rescue', name: '拯救模式', tag: '固定7人' },
  { no: '05', key: 'feiqiu-doubles', name: '非酋之轮', tag: '非酋双打' },
  { no: '06', key: 'doubles', name: '官突双打', tag: '双打' },
];

export interface HomeScreenProps {
  style: string;
  mode: string;
  onStart: (m: SessionMode, playerName: string) => void;
}

export function HomeScreen({ style, mode, onStart }: HomeScreenProps) {
  const [playerName, setPlayerName] = useState('集结杯选手');
  // 练习/比赛双模式（纯前端首页态；比赛侧登录/积分为占位，后端 P5 才接）。切 tab 不丢选手名（同一 state）。
  const [homeMode, setHomeMode] = useState<'practice' | 'match'>('practice');
  const isMatch = homeMode === 'match';

  const start = (m: SessionMode | 'doubles', soon?: boolean) => {
    if (soon) return; // soon 占位项不启动（当前无 soon 项；doubles 已接通）
    const name = (playerName || '').trim() || '集结杯选手';
    // P1b 规则态下沉：home 练习/比赛 tab → setRuleMode（hub 拍板方案A；startSession 不重置规则态，由此处决定）。
    setRuleMode(isMatch ? 'match' : 'practice');
    // startSession 末尾 exposeSelectDebug 把 mode 写到 __jjbDebug.select.mode，
    // 这里 startSession 后再覆盖 JijieData.playerName（不破坏 9 模式 status/map/lock/pool 任何契约）。
    startSession(m as SessionMode);
    try { (JijieData as any).playerName = name; } catch { /* noop */ }
    onStart(m as SessionMode, name);
  };

  return (
    <div
      className={`jjb style-${style} mode-${mode}`}
      style={{ width: 1280, height: 720 }}
      data-screen-label={`home-${style}-${mode}`}
    >
      <div className="jjb-bg">
        <div className="bg-grad"></div>
        <div className="bg-tex"></div>
        <div className="bg-vignette"></div>
      </div>
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
          {isMatch && (
            <div className="login-entry">
              <button className="loginbtn" type="button" data-login-placeholder>
                <span className="lb-ico">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3 L19 6 V11 C19 16 16 19.5 12 21 C8 19.5 5 16 5 11 V6 Z"></path><circle cx="12" cy="11" r="2.4"></circle><path d="M12 13.4 V16"></path>
                  </svg>
                </span>
                <span className="lb-tx"><span className="lb-t">主播登录</span><span className="lb-s">ADMIN · <b>即将上线</b></span></span>
              </button>
            </div>
          )}
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

        <div className="mode-block">
          <div className="block-head">
            <span className="block-kicker">SELECT MODE</span>
            <span className="block-title">比赛模式</span>
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
          </div>
        </div>

        {/* 入口区随态切换：练习=三入口宣传条 / 比赛=积分天梯占位卡 */}
        {isMatch ? (
          <a className="pcard ladder soon" data-ladder-placeholder>
            <span className="pic">
              <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5 H23 V11 A7 7 0 0 1 9 11 Z"></path><path d="M9 6 H5 V8 A4 4 0 0 0 9 12"></path><path d="M23 6 H27 V8 A4 4 0 0 1 23 12"></path><path d="M16 18 V22"></path><path d="M11 27 H21"></path><path d="M13 22 H19 V27 H13 Z"></path>
              </svg>
            </span>
            <span className="ptx"><span className="pm">积分天梯</span><span className="ps"><i className="dot"></i>赛季积分 · 全国排名 · 段位结算</span></span>
            <span className="soon-chip">即将上线</span>
          </a>
        ) : (
          <div className="foot foot-promo">
            <PromoBar />
          </div>
        )}
      </div>
    </div>
  );
}
