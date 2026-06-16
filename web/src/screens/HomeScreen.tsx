import { useState } from 'react';
import { startSession, type SessionMode } from '../logic/jjbSession';
import { logoUrl, titleUrl } from '../lib/realAsset';
import JijieData from '@logic/JijieData';

// 集结杯 × CM — 首页（9 模式入口 + 选手名）。承接 design/v4-r2/home 段（className 全部沿用 theme.css/home css）。
// 9 模式：1)8因子手选 2)10因子手选 3)12因子手选 4)拯救模式 5)单指指挥 6)极难① 7)极难② 8)非酋 9)随机
// 流程：输入选手名 → 点模式按钮 → startSession(mode) → 覆盖 JijieData.playerName → onStart 回调让 App 跳 select。
// 模式集合以赛制文档「比赛模式与规则」为准（7 种）：8/10/12因子 + 拯救 + 随机 + 双打 + 极难②（待定上home）。
// 文档无单指/极难①/非酋（飞球）——旧 TS InitPanel 的 9 handler 含它们，但赛制已收敛为 7 种。
// 双打=独立引擎（段3④待实现），先占位 soon。
const MODES: { no: string; key: SessionMode | 'doubles'; name: string; tag: string; soon?: boolean }[] = [
  { no: '01', key: 'std8', name: '8 因子', tag: '标准赛' },
  { no: '02', key: 'std10', name: '10 因子', tag: '进阶' },
  { no: '03', key: 'std12', name: '12 因子', tag: '最高难' },
  { no: '04', key: 'rescue', name: '拯救模式', tag: '固定7人' },
  { no: '05', key: 'suiji', name: '随机', tag: '纯随机' },
  { no: '06', key: 'doubles', name: '双打', tag: '官突', soon: true },
  { no: '07', key: 'hard2', name: '极难 ②', tag: '待定' },
];

export interface HomeScreenProps {
  style: string;
  mode: string;
  onStart: (m: SessionMode, playerName: string) => void;
}

export function HomeScreen({ style, mode, onStart }: HomeScreenProps) {
  const [playerName, setPlayerName] = useState('集结杯选手');

  const start = (m: SessionMode | 'doubles', soon?: boolean) => {
    if (soon || m === 'doubles') return; // 双打待实现（段3④）
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
          <div className="lockup lockup-lg">
            <img className="lockup-mark" src={logoUrl(style, mode)} alt="CM" />
            <span className="lockup-div"></span>
            <img className="lockup-title" src={titleUrl(style, mode)} alt="集结杯" style={{ height: 56, display: 'block' }} />
          </div>
          <p className="home-sub">选模式 · 选因子/指挥官 · 开打</p>
          <p className="home-host">CM × 集结杯 · 7 模式 · 真身数据驱动</p>
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
