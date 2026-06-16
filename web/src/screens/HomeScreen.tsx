import { useState } from 'react';
import { startSession, type SessionMode } from '../logic/jjbSession';
import JijieData from '@logic/JijieData';

// 集结杯 × CM — 首页（9 模式入口 + 选手名）。承接 design/v4-r2/home 段（className 全部沿用 theme.css/home css）。
// 9 模式：1)8因子手选 2)10因子手选 3)12因子手选 4)拯救模式 5)单指指挥 6)极难① 7)极难② 8)非酋 9)随机
// 流程：输入选手名 → 点模式按钮 → startSession(mode) → 覆盖 JijieData.playerName → onStart 回调让 App 跳 select。
const MODES: { no: string; key: SessionMode; name: string; tag: string }[] = [
  { no: '01', key: 'std8', name: '8 因子', tag: '手选' },
  { no: '02', key: 'std10', name: '10 因子', tag: '手选' },
  { no: '03', key: 'std12', name: '12 因子', tag: '手选' },
  { no: '04', key: 'rescue', name: '拯救模式', tag: '硬核' },
  { no: '05', key: 'one-a', name: '单指指挥', tag: '8 vs 8' },
  { no: '06', key: 'hard1', name: '极难 ①', tag: '2 因子' },
  { no: '07', key: 'hard2', name: '极难 ②', tag: '2 因子' },
  { no: '08', key: 'feiqiu', name: '非酋', tag: '1 因子' },
  { no: '09', key: 'suiji', name: '随机', tag: '0 因子' },
];

export interface HomeScreenProps {
  style: string;
  mode: string;
  onStart: (m: SessionMode, playerName: string) => void;
}

export function HomeScreen({ style, mode, onStart }: HomeScreenProps) {
  const [playerName, setPlayerName] = useState('集结杯选手');

  const start = (m: SessionMode) => {
    const name = (playerName || '').trim() || '集结杯选手';
    // 0 改 startSession 内部：startSession 末尾 exposeSelectDebug 把 mode 写到 __jjbDebug.select.mode，
    // 这里 startSession 后再覆盖 JijieData.playerName（不破坏 9 模式 status/map/lock/pool 任何契约）。
    startSession(m);
    try { (JijieData as any).playerName = name; } catch { /* noop */ }
    onStart(m, name);
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
          <div className="lockup lockup-lg">
            <img className="lockup-mark" src="assets/logo-cm-gold.png" alt="CM" />
            <span className="lockup-div"></span>
            <div className="lockup-word">
              <span className="lockup-cn">集结杯</span>
              <span className="lockup-en">CM × JJB · v4</span>
            </div>
          </div>
          <p className="home-sub">选模式 · 选因子/指挥官 · 开打</p>
          <p className="home-host">CM × 集结杯 · 9 模式 · 真身数据驱动</p>
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
                className="mode-btn"
                data-mode-btn={m.key}
                type="button"
                onClick={() => start(m.key)}
              >
                <span className="mode-no">{m.no}</span>
                <span className="mode-name">{m.name}</span>
                <span className="mode-tag">{m.tag}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="foot">
          <span className="foot-org">CM × 集结杯 · 真实 JijieData 驱动</span>
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
