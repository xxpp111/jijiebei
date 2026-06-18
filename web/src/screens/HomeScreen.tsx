import { useState } from 'react';
import { startSession, type SessionMode } from '../logic/jjbSession';
import { BrandLockup } from '../components/BrandLockup';
import JijieData from '@logic/JijieData';

// 集结杯 × CM — 首页（公开模式入口 + 选手名）。承接 design/v4-r2/home 段（className 全部沿用 theme.css/home css）。
// 流程：输入选手名 → 点模式按钮 → startSession(mode) → 覆盖 JijieData.playerName → onStart 回调让 App 跳 select。
// 模式集合以当前直播入口为准：8/10/极难模式 + 拯救 + 非酋（飞球）+ 双打（官突）。
// 第五格已由「随机(suiji)」改为「非酋·飞球(feiqiu)」；suiji 退出首页/URL 入口，
//   引擎(modeSuiji 标志链)保留供 e2e 9 模式恒等式回归。随机能力仍走 Select「随机填充」叠加层。
// 双打=独立引擎 JJBDoubles 接通（startSession('doubles') 早分支启动）；第六格入口已解 soon。
const MODES: { no: string; key: SessionMode | 'doubles'; name: string; tag: string; soon?: boolean }[] = [
  { no: '01', key: 'std8', name: '8 因子', tag: '标准赛' },
  { no: '02', key: 'std10', name: '10 因子', tag: '进阶' },
  { no: '03', key: 'std12', name: '极难模式', tag: '极难' },
  { no: '04', key: 'rescue', name: '拯救模式', tag: '固定7人' },
  { no: '05', key: 'feiqiu', name: '非酋', tag: '飞球' },
  { no: '06', key: 'doubles', name: '双打', tag: '官突' },
];

export interface HomeScreenProps {
  style: string;
  mode: string;
  onStart: (m: SessionMode, playerName: string) => void;
}

export function HomeScreen({ style, mode, onStart }: HomeScreenProps) {
  const [playerName, setPlayerName] = useState('集结杯选手');

  const start = (m: SessionMode | 'doubles', soon?: boolean) => {
    if (soon) return; // soon 占位项不启动（当前无 soon 项；doubles 已接通）
    const name = (playerName || '').trim() || '集结杯选手';
    // 0 改 startSession 内部：startSession 末尾 exposeSelectDebug 把 mode 写到 __jjbDebug.select.mode，
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

        <div className="player-row">
          <label className="player-label">参赛选手</label>
          <span className="player-field" style={{ display: 'flex', alignItems: 'center' }}>
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

        <div className="foot">
          <span className="foot-org">CM × 集结杯</span>
          <span className="foot-links">
            <a className="foot-link" href="https://space.bilibili.com/347915855" target="_blank" rel="noreferrer" style={{ cursor: 'pointer', textDecoration: 'none' }}>
              <b>B站主播</b>儒雅随和の土豆
            </a>
            <a className="foot-link" href="https://space.bilibili.com/277263402" target="_blank" rel="noreferrer" style={{ cursor: 'pointer', textDecoration: 'none' }}>
              <b>CM 合作任务</b>B站主页
            </a>
            <a className="foot-link" href="https://mcn1taa2k785.feishu.cn/wiki/WF0ZwD2QciFDqGkmHSMcRrdvnyd" target="_blank" rel="noreferrer" style={{ cursor: 'pointer', textDecoration: 'none' }}>
              <b>集结杯文档</b>飞书知识库
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}
