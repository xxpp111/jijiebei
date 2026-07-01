import { useState } from 'react';
import { ScreenShell } from '../components/ScreenShell';
import { TopBar, MetaRow } from '../components/TopBar';
import { getBpModeState, toggleBpMode, type BpModeState } from '../logic/bpConfig';
import { getRandomEnemyEnabled, toggleRandomEnemy } from '../logic/randomConfig';
import { rollEnemiesForSession } from '../logic/aiEnemySelector';
import { MODE_DEFS } from '../config/modes';

// 承接 Claude Design 设计稿（项目 3a9216be / bp-config.jsx）。每模式一行 + BP 开关，
// 渲染用 repo 真实 BrandLockup + 真实模式 key；开关态由 logic/bpConfig 驱动（on/offable/locked）。
// R3 口径展示数据从 config/modes.ts 的 MODE_DEFS 派生（BP 面板差异名走 bpName/bpTag，缺省回落 name/tag）；state 运行时取 bpConfig。
const BP_MODE_KEYS = ['std8', 'std10', 'std12', 'rescue', 'feiqiu', 'doubles', 'std15', 'cm'];
const BP_MODES = BP_MODE_KEYS.map((key) => {
  const d = MODE_DEFS[key];
  return { no: d.no!, key, name: d.bpName ?? d.name!, tag: d.bpTag ?? d.tag!, def: d.def!, defcls: d.defcls!, fac: d.fac!, form: d.form!, note: d.note! };
});

function BpToggle({ state }: { state: BpModeState }) {
  const on = state === 'on';
  const cls = 'bpc-tg ' + (on ? 'on' : state === 'locked' ? 'locked' : 'offable');
  return (
    <div className={cls} role="switch" aria-checked={on} aria-disabled={state === 'locked'}>
      {state === 'locked' ? (
        <span className="bpc-tg-state"><span className="lockico"></span></span>
      ) : (
        <span className="bpc-tg-state">{on ? 'ON' : 'OFF'}</span>
      )}
      <span className="bpc-track"><span className="bpc-knob"></span></span>
    </div>
  );
}

function BpRow({ m, state, onToggle }: { m: (typeof BP_MODES)[number]; state: BpModeState; onToggle: () => void }) {
  const rowState = state === 'on' ? 'is-on' : 'is-off';
  return (
    <div
      className={['bpc-row', rowState, state === 'locked' ? 'is-locked' : ''].filter(Boolean).join(' ')}
      data-bp-mode={m.key}
      data-bp-state={state}
      onClick={state === 'locked' ? undefined : onToggle}
      style={{ cursor: state === 'locked' ? 'not-allowed' : 'pointer' }}
    >
      <span className="bpc-edge"></span>
      <span className="bpc-no">{m.no}</span>
      <div className="bpc-main">
        <div className="bpc-namerow">
          <span className="bpc-name">{m.name}</span>
          <span className="bpc-tag">{m.tag}</span>
        </div>
        <span className="bpc-form">{m.form}</span>
      </div>
      <span className="bpc-spacer"></span>
      <span className={'bpc-def ' + m.defcls}>{m.def}</span>
      <BpToggle state={state} />
    </div>
  );
}

export interface BpConfigScreenProps {
  style: string;
  mode: string;
}

export function BpConfigScreen({ style, mode }: BpConfigScreenProps) {
  const [, setTick] = useState(0);
  return (
    <ScreenShell className={`jjb bpc style-${style} mode-${mode}`} data-screen-label={`bpconfig-${style}-${mode}`}>
      <div className="jjb-inner">
        <TopBar styleName={style} modeName={mode}>
          <MetaRow k="赛前配置" v="BP · 二选一" />
        </TopBar>
        <div className="bpc-head">
          <span className="bpc-kicker">BP SWITCH</span>
          <span className="bpc-title">每模式 BP 开关</span>
          <span className="bpc-headnote">BP 开 = 进选择面板前插入「Ban 1 因子 / 自选 1 指挥官」二选一关</span>
        </div>
        <div className="bpc-list">
          {BP_MODES.map((m) => (
            <BpRow key={m.no} m={m} state={getBpModeState(m.key)} onToggle={() => { toggleBpMode(m.key); setTick((x) => x + 1); }} />
          ))}
        </div>
        {/* 随机敌方全局开关（设计稿 01 方案 A：独立金棕分区，与每模式 BP 列表视觉分隔——它是全局开关，不混进模式列表）。 */}
        <div
          className="bp-enemy"
          data-random-enemy={getRandomEnemyEnabled() ? '1' : '0'}
          role="switch"
          aria-checked={getRandomEnemyEnabled()}
          onClick={() => { toggleRandomEnemy(); rollEnemiesForSession(3); setTick((x) => x + 1); }}
          style={{ cursor: 'pointer' }}
        >
          <div className="bp-enemy-i">
            <span className="bp-enemy-k">RANDOM ENEMY</span>
            <span className="bp-enemy-nm">每场随机敌方</span>
            <span className="bp-enemy-sub">每场对局自动随机种族与 AI 敌军组合</span>
          </div>
          <BpToggle state={getRandomEnemyEnabled() ? 'on' : 'offable'} />
        </div>
        <div className="bpc-foot">
          <span className="bpc-legend"><span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }}></span><b>极难</b> 默认关但可手动开 · 开关亮色可点</span>
          <span className="bpc-legend"><span className="lockico" style={{ color: 'var(--lose)' }}></span><b>双打</b> 暂不可用 · 开关灰掉锁死不可点</span>
        </div>
      </div>
    </ScreenShell>
  );
}
