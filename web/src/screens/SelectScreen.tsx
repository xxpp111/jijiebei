import { useEffect, useMemo, useRef, useState } from 'react';
import { CommanderCard } from '../components/CommanderCard';
import { FactorFrame } from '../components/FactorFrame';
import { DropCell } from '../components/DropCell';
import { BrandLockup } from '../components/BrandLockup';
import { EnemyBadge } from '../components/EnemyBadge';
import { CaptureButtons } from '../components/CaptureButtons';
import { mapUrl, cmdUrl, facUrl } from '../lib/realAsset';
import {
  getSelectState,
  startSession,
  startFromSelection,
  setSelectedCmd,
  setSelectedFac,
  clearCmdSlot,
  clearFacSlot,
  getGoldFor,
  toggleGold,
  toggleBanFactor,
  getBanFor,
  getSelectWarn,
  randomFillSelection,
  difficultyTotal,
  matchDifficulty,
  querySessionMode,
} from '../logic/jjbSession';
import { facFlatIdx } from '../logic/legacy/JJBData';
import { startDrag, registerTarget, shouldSuppressClickClear } from '../lib/dragdrop';
import {
  doublesLive, doublesMatches, doublesModeLabel, getDoublesState,
  setDoublesCmd, clearDoublesCmd, setDoublesFac, clearDoublesFac,
  validateDoubles, randomFillDoubles,
} from '../logic/jjbDoubles';
import { getBpModeEnabled } from '../logic/bpConfig';
import { currentEnemyRace, currentEnemyAi } from '../logic/jjbView';
import { getRandomEnemyEnabled } from '../logic/randomConfig';
import { raceUrl } from '../lib/realAsset';

// 操作区只读敌方状态条（设计稿 03 方案A）：select 不放开关，仅随机敌方开启时提示「功能已开·三族每场随机」；
// 切换在 BP 设置面，这里纯只读（三族徽 + ON 点）。关闭时不渲染、不占位。
function EnemyStatusPill() {
  if (!getRandomEnemyEnabled()) return null;
  return (
    <div className="estat" data-screen-label="enemy-status">
      <span className="ems">
        <img src={raceUrl('P')} alt="" />
        <img src={raceUrl('T')} alt="" />
        <img src={raceUrl('Z')} alt="" />
      </span>
      <span className="et"><span className="estat-k">敌方</span><span className="estat-v">每场随机</span></span>
      <span className="estat-on"><span className="estat-d"></span>ON</span>
    </div>
  );
}

// 集结杯 × CM — 选择面板整屏（段2 Phase 2：拖拽手选 + 校验 + 手选进 battle）。
// 严格承接 design/v4-r2/components/select-screen.jsx 的 SelectScreenV4 DOM/className：
//   topbar / .slots (3×.slot) / .pool (pool-factors + pool-cmd) / .startbtn
// 数据走 getSelectState() 读真身 JijieData（0 改 jijie2；status=2 时渲染开局后的池/槽/地图/锁定）。
// Phase 2 新增：HTML5 pointer 自写拖拽吸附（lib/dragdrop.ts）+ 校验三规则（jjbSession.validate）+ 手选进 battle。
// 手动校验三规则镜像真身 JJBSelect.validate（JJBData.manualSlots + ConfigData.commadnerGroupList['B'] 查表）。

const SLOT_TITLES = ['第 1 场', '第 2 场', 'BOSS 战'];
// URL 赛事模式解析（?sessionMode= 优先 + 旧 ?mode= 兼容 + std8 回落）抽到 jjbSession.querySessionMode，本文件 import 复用（LOW2 去重）。

export interface SelectScreenProps {
  style: string;
  mode: string;
  onStart: () => void; // 校验通过 → 手选进 battle → 切屏
}

/** 点金角标按钮（每个因子右上角，toggle 金/非金；stopPropagation 不触发拖拽/清槽）。 */
function GoldBadge({ name, on, onToggle }: { name: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      className="gold-toggle"
      data-gold-toggle={name}
      title="点金 / 取消金"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      style={{
        position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10,
        border: '1px solid rgba(0,0,0,0.35)', cursor: 'pointer', fontSize: 11, lineHeight: '18px',
        padding: 0, fontWeight: 700, zIndex: 3,
        background: on ? '#e8b84b' : 'rgba(20,20,20,0.7)', color: on ? '#3a2400' : '#ddd',
      }}
    >
      金
    </button>
  );
}

/** BP ban 角标按钮（因子池每个因子左上角，toggle ban；占位形态，待 Claude Design 设计稿美化）。
 *  红色 lose 语义，与点金 GoldBadge（右上·金）左右分置不重叠；stopPropagation 不触发拖拽。 */
function BpBadge({ name, on, onToggle }: { name: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      className={'bp-ban' + (on ? ' on' : '')}
      data-bp-ban-toggle={name}
      data-bp-banned={on ? '1' : '0'}
      title="BP 禁用 / 取消禁用"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <circle cx="12" cy="12" r="8.5"></circle><line x1="6.2" y1="6.2" x2="17.8" y2="17.8"></line>
      </svg>
    </button>
  );
}

export function SelectScreen({ style, mode, onStart }: SelectScreenProps) {
  // 兜底：?screen=select 直跳时若 jjbLive=false 在本屏内开一局 std8 后 setState 强制重渲。
  // URL ?sessionMode=std8|std10|... 覆盖默认 std8；旧 ?mode=std10 仍兼容。
  const [, setTick] = useState(0);
  useEffect(() => {
    if (doublesLive()) return; // 双打局已开（JJBDoubles 自管，JijieData.jjbLive 恒 false）：不被单打 std8 兜底覆盖
    const s = getSelectState();
    if (!s.jjbLive) {
      const m = querySessionMode();
      try { startSession(m); setTick((x) => x + 1); } catch (e) { console.error('[Select] 兜底开局失败:', e); }
    }
  }, []);
  // 校验失败 toast：开始按钮按下时塞
  const [toast, setToast] = useState<{ msg: string; count: number; kind: 'hard' | 'soft' } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const s = getSelectState();
  const live = s.jjbLive;

  // 因子池/指挥官池（真实完整池，不截断；对齐 Cocos 真身整池渲染；6 主题渲染由 design 排版约束）
  const factorRow = useMemo(() => s.randomFactorPoor.slice(), [s.randomFactorPoor]);
  const cmdA = useMemo(() => s.randomCommanderPoorA.filter((c) => c !== '自选'), [s.randomCommanderPoorA]);
  const cmdB = useMemo(() => s.randomCommanderPoorB.filter((c) => c !== '自选'), [s.randomCommanderPoorB]);
  // 自选池：用 getSelectState 透出的真实 selfPool/selfShow（正确读 JijieData，ConfigData 全量减已入 A/B 池 + mode 门控）。
  // 替换 spoke 本地 computeSelfPool（修两 bug：showSelfPool 误传 window 致门控恒真 + randomCommanderPoorC 读错 ConfigData）。
  const selfPool = s.selfPool;

  const modeLabel = modeMeta(s);

  // ===== Drop target refs（用 ref 注册到 dragdrop 模块） =====
  // 槽位总表：3 场 × 1 cmd + manualSlots(i) factor = 3 + Σ manualSlots 个 target
  const targetRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const setTarget = (k: string) => (el: HTMLSpanElement | null) => {
    if (el && targetRefs.current[k] !== el) {
      targetRefs.current[k] = el;
    } else if (!el && targetRefs.current[k]) {
      delete targetRefs.current[k];
    }
  };

  useEffect(() => {
    const unregisters: Array<() => void> = [];
    const regAll = () => {
      for (const k in targetRefs.current) {
        const el = targetRefs.current[k];
        if (!el) continue;
        const [kind, slotStr, idxStr] = k.split(':');
        unregisters.push(registerTarget({
          kind: kind as 'cmd' | 'factor',
          slot: Number(slotStr),
          idx: Number(idxStr),
          el,
        }));
      }
    };
    regAll();
    return () => { unregisters.forEach((u) => u()); };
  });

  // ===== 拖拽源 onPointerDown =====
  const onPoolPointerDown = (ev: React.PointerEvent, kind: 'cmd' | 'factor', name: string, el: HTMLElement) => {
    ev.preventDefault();
    startDrag({
      kind, name, el,
      onDrop: (slot, idx) => {
        if (kind === 'cmd') {
          setSelectedCmd(slot, name);
          const w = getSelectWarn(); // P2 二选一即时提示（match 态选自选指挥官且已 ban）
          if (w) setToast({ msg: w, count: 1, kind: 'soft' });
        } else {
          setSelectedFac(slot, idx, name);
        }
        // 强制重渲（setSelected* 是 module-level 写 JijieData，React 不知）
        setTick((x) => x + 1);
      },
    }, ev.nativeEvent);
  };

  // ===== 点击已填槽清除 =====
  const onClearCmd = (slot: number) => { clearCmdSlot(slot); setTick((x) => x + 1); };
  const onClearFac = (slot: number, k: number) => { clearFacSlot(slot, k); setTick((x) => x + 1); };

  // ===== 开始按钮：校验 + 手选进 battle =====
  const handleStart = () => {
    const r = startFromSelection();
    if (!r.ok) {
      setToast({ msg: r.firstError, count: r.errors.length, kind: 'hard' });
      return;
    }
    onStart();
  };

  const handleRandomFill = () => {
    randomFillSelection();
    setTick((x) => x + 1);
  };

  // 双打：JJBDoubles 自管局已开 → 渲双打选择面板（2 指挥官/场 + 官突锁定 + 3 随机因子槽），与单打 9 模式 UI 分流。
  if (doublesLive()) {
    return <DoublesSelect style={style} mode={mode} onStart={onStart} />;
  }

  if (!live) {
    return (
      <div className={`jjb style-${style} mode-${mode}`} style={{ width: 1280, height: 720, color: '#fff', padding: 40 }}>
        选择面板开局中…
      </div>
    );
  }

  return (
    <div
      className={`jjb style-${style} mode-${mode}`}
      style={{ width: 1280, height: 720 }}
      data-screen-label={`select-${style}-${mode}-${s.mode}`}
      data-capture="select"
    >
      <div className="jjb-bg">
        <div className="bg-grad"></div>
        <div className="bg-tex"></div>
        <div className="bg-vignette"></div>
      </div>

      <div className="jjb-inner sel">
        {/* topbar */}
        <div className="topbar">
          <BrandLockup styleName={style} modeName={mode} size="sm" />
          <div className="topbar-meta">
            <div className="meta-row">
              <span className="meta-k">当前选手</span>
              <span className="meta-v" data-meta-player>{s.playerName || '选手'}</span>
            </div>
            <div className="meta-row">
              <span className="meta-k">比赛模式</span>
              <span className="meta-v" data-meta-mode>{modeLabel}</span>
            </div>
            <div className="meta-row">
              <span className="meta-k">难度总分</span>
              <span className="meta-v" data-difficulty-total style={{ fontWeight: 700, color: 'var(--accent, #e8b84b)' }}>{difficultyTotal()}</span>
            </div>
          </div>
        </div>

        {/* 3 场 slots（真实地图 + 锁定因子 + 空槽数=manualSlots(i)） */}
        <div className="slots">
          {s.manualSlots.map((slots, i) => {
            const mapName = s.mapList[i] || '—';
            const mapSrc = mapUrl(mapName);
            const lock = s.lockFactorList[i];
            const selCmd = s.selectedCommanderList[i];
            const isBoss = i === 2;
            const difficulty = matchDifficulty(i as 0 | 1 | 2);
            return (
              <div
                key={i}
                className={'slot' + (i === 0 ? ' slot-active' : '')}
                data-slot-idx={i}
              >
                <div className="slot-head" {...{ [`data-match-difficulty-${i}`]: difficulty }}>
                  <span className="slot-no">{SLOT_TITLES[i]}</span>
                  <span className="slot-map-name">{mapName}</span>
                  <span
                    className="slot-difficulty"
                    data-match-difficulty={difficulty}
                    style={{ marginLeft: isBoss ? 0 : 'auto', fontSize: 12, fontWeight: 700, color: 'var(--accent, #e8b84b)', whiteSpace: 'nowrap' }}
                  >
                    难度 {difficulty}
                  </span>
                  {isBoss && <span className="slot-flag">双倍</span>}
                </div>
                <span className="mapthumb">
                  {mapSrc ? (
                    <img src={mapSrc} alt={mapName} />
                  ) : (
                    <span style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>
                      {mapName}
                    </span>
                  )}
                  <EnemyBadge race={currentEnemyRace(i)} ai={currentEnemyAi(i)} size="lg" />
                </span>
                <div className="slot-targets">
                  <div className="t-cmds">
                    {selCmd ? (
                      <span
                        ref={setTarget(`cmd:${i}:0`)}
                        data-slot-cmd={i}
                        onClick={() => { if (shouldSuppressClickClear()) return; onClearCmd(i); }}
                        style={{ cursor: 'pointer' }}
                      >
                        <CommanderCard src={cmdUrl(selCmd)} name={selCmd} w={56} h={67} fill check />
                      </span>
                    ) : (
                      <DropCell ref={setTarget(`cmd:${i}:0`)} w={56} h={67} hint="指挥官" />
                    )}
                  </div>
                  <div className="t-facs">
                    {/* 锁定因子（自动）打头 — 不可拖不可清 */}
                    {lock ? (
                      <FactorFrame src={facUrl(lock)} size={52} tag="锁定" />
                    ) : (
                      <DropCell w={52} h={52} hint="锁定" />
                    )}
                    {/* 手选因子（已选 gold + 未选 DropCell），共 manualSlots(i) 槽 */}
                    {Array.from({ length: slots }).map((_, k) => {
                      const v = s.selectedFactorList[facFlatIdx(i, k)];
                      return v ? (
                        <span
                          key={k}
                          ref={setTarget(`factor:${i}:${k}`)}
                          data-slot-fac={`${i}:${k}`}
                          onClick={() => { if (shouldSuppressClickClear()) return; onClearFac(i, k); }}
                          style={{ cursor: 'pointer', position: 'relative', display: 'inline-block' }}
                        >
                          <FactorFrame src={facUrl(v)} size={52} gold={getGoldFor(v)} />
                          <GoldBadge name={v} on={getGoldFor(v)} onToggle={() => { toggleGold(v); setTick((x) => x + 1); }} />
                        </span>
                      ) : (
                        <DropCell key={k} ref={setTarget(`factor:${i}:${k}`)} w={52} h={52} hint="因子" />
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* pool 双栏：因子池 + 指挥官池（A/B + 自选） */}
        <div className="pool" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div className="pool-factors">
            <div className="block-head sm">
              <span className="block-kicker">FACTORS</span>
              <span className="block-title">选择因子</span>
            </div>
            <div className="factor-row" style={{ gap: 14, flexWrap: 'wrap' }} data-pool-factors>
              {factorRow.length === 0 && (
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>本局无随机因子（随机模式）</span>
              )}
              {factorRow.map((f, i) => (
                <span
                  key={i}
                  data-pool-fac={f}
                  onPointerDown={(ev) => {
                    const el = (ev.currentTarget as HTMLElement);
                    onPoolPointerDown(ev, 'factor', f, el);
                  }}
                  style={{ cursor: 'grab', touchAction: 'none', position: 'relative', display: 'inline-block', opacity: getBanFor(f) ? 0.45 : 1 }}
                >
                  <FactorFrame src={facUrl(f)} size={66} gold={getGoldFor(f)} check={s.selectedFactorList.includes(f)} banned={getBpModeEnabled(s.mode) && getBanFor(f)} />
                  <GoldBadge name={f} on={getGoldFor(f)} onToggle={() => { toggleGold(f); setTick((x) => x + 1); }} />
                  {getBpModeEnabled(s.mode) && <BpBadge name={f} on={getBanFor(f)} onToggle={() => { toggleBanFactor(f); const w = getSelectWarn(); if (w) setToast({ msg: w, count: 1, kind: 'soft' }); setTick((x) => x + 1); }} />}
                </span>
              ))}
            </div>
          </div>

          <div className="pool-cmd" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <div className="grp-row">
              <div className="grp">
                <div className="block-head sm">
                  <span className="block-title">A 组指挥官</span>
                </div>
                <div className="avatar-row" style={{ gap: 13, flexWrap: 'wrap' }} data-pool-cmds-a>
                  {cmdA.length === 0 && (
                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>（本模式无 A 组）</span>
                  )}
                  {cmdA.map((c, i) => (
                    <span
                      key={i}
                      data-pool-cmd={c}
                      onPointerDown={(ev) => {
                        const el = (ev.currentTarget as HTMLElement);
                        onPoolPointerDown(ev, 'cmd', c, el);
                      }}
                      style={{ cursor: 'grab', touchAction: 'none' }}
                    >
                      <CommanderCard src={cmdUrl(c)} name={c} />
                    </span>
                  ))}
                </div>
              </div>
              <div className="grp">
                <div className="block-head sm">
                  <span className="block-title">B 组指挥官</span>
                </div>
                <div className="avatar-row" style={{ gap: 13, flexWrap: 'wrap' }} data-pool-cmds-b>
                  {cmdB.length === 0 && (
                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>（本模式无 B 组）</span>
                  )}
                  {cmdB.map((c, i) => (
                    <span
                      key={i}
                      data-pool-cmd={c}
                      onPointerDown={(ev) => {
                        const el = (ev.currentTarget as HTMLElement);
                        onPoolPointerDown(ev, 'cmd', c, el);
                      }}
                      style={{ cursor: 'grab', touchAction: 'none' }}
                    >
                      <CommanderCard src={cmdUrl(c)} name={c} />
                    </span>
                  ))}
                </div>
              </div>
            </div>
            {s.selfShow && selfPool.length > 0 && (
              <div className="grp">
                <div className="block-head sm">
                  <span className="block-title">自选指挥官</span>
                  <span className="block-note">全量可选 · 拖入场次槽位（B 组占用合并计数）</span>
                </div>
                <div className="avatar-grid" style={{ gap: 11 }} data-pool-cmds-self>
                  {selfPool.map((c, i) => (
                    <span
                      key={i}
                      data-pool-cmd={c}
                      onPointerDown={(ev) => {
                        const el = (ev.currentTarget as HTMLElement);
                        onPoolPointerDown(ev, 'cmd', c, el);
                      }}
                      style={{ cursor: 'grab', touchAction: 'none' }}
                    >
                      <CommanderCard src={cmdUrl(c)} name={c} w={60} h={72} />
                    </span>
                  ))}
                </div>
              </div>
            )}
            </div>
            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16, flexShrink: 0, paddingTop: 8 }}>
              {toast && (
                <div className={'toastv ' + toast.kind + (toast.count > 1 ? ' toastv-stack' : '')} data-toast-err data-toast-kind={toast.kind}>
                  <span className="toastv-ico">!</span>
                  <span className="toastv-tx">{toast.msg}</span>
                  {toast.count > 1 && <span className="toastv-n">+{toast.count - 1}</span>}
                  <span className={toast.kind === 'soft' ? 'toastv-rule' : 'toastv-block'}>{toast.kind === 'soft' ? '仍可开赛' : '阻断开赛'}</span>
                </div>
              )}
              <EnemyStatusPill />
              <CaptureButtons targetSelector='[data-capture="select"]' filename="jjb-select.png" />
              <button
                className="startbtn"
                data-random-fill-btn
                style={{ margin: 0, padding: '14px 26px' }}
                onClick={handleRandomFill}
              >
                随机填充
              </button>
              <button
                className={'startbtn' + (toast?.kind === 'soft' ? ' warned' : '')}
                data-start-btn
                style={{ margin: 0 }}
                onClick={handleStart}
              >
                比赛开始 <span className="startbtn-arrow">▶</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function modeMeta(s: ReturnType<typeof getSelectState>): string {
  if (s.modelFactorCount === 4) return '极难模式';
  const factorLabel = s.modelFactorCount === 0 ? '随机'
    : s.modelFactorCount === 2 ? '8 因子'
    : s.modelFactorCount === 3 ? '10 因子'
    : `${s.modelFactorCount} 因子`;
  const modeLabel = s.modeIsZhengjiu ? '拯救'
    : s.modeIsOnePick ? '单指'
    : s.modeIsVeryHard2 || s.modeIsVeryHard ? '极难'
    : s.modeFeiqiu ? '非酋'
    : s.modeSuiji ? '随机'
    : '手选';
  return `${factorLabel} · ${modeLabel}`;
}

// ===== 双打选择面板（JJBDoubles 自管引擎接通；复用单打 CSS 类 + 组件，数据走 jjbDoubles 适配层） =====
// 与单打 9 模式 UI 分流：2 指挥官/场 + 官突锁定打底 + extraFactors 随机因子槽；拖拽复用 dragdrop（cmd/factor × slot/idx）。
function isPickedDoubles(slots: Array<{ cmds: (string | null)[]; factors: (string | null)[] }>, kind: 'cmd' | 'fac', name: string): boolean {
  return slots.some((s) => (kind === 'cmd' ? s.cmds : s.factors).some((x) => x === name));
}

function DoublesSelect({ style, mode, onStart }: SelectScreenProps) {
  const [, setTick] = useState(0);
  const [toast, setToast] = useState<{ msg: string; count: number; kind: 'hard' | 'soft' } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const st = getDoublesState();
  const matchVMs = doublesMatches();
  const cfg = st.config;
  const cmdPool = st.commanderPool;
  const facPool = st.factorPool;
  const slots = st.selection.slots || [];

  // Drop target 注册（cmd:i:k / factor:i:k），复用 dragdrop 模块
  const targetRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const setTarget = (k: string) => (el: HTMLSpanElement | null) => {
    if (el && targetRefs.current[k] !== el) targetRefs.current[k] = el;
    else if (!el && targetRefs.current[k]) delete targetRefs.current[k];
  };
  useEffect(() => {
    const unregs: Array<() => void> = [];
    for (const k in targetRefs.current) {
      const el = targetRefs.current[k];
      if (!el) continue;
      const [kind, slotStr, idxStr] = k.split(':');
      unregs.push(registerTarget({ kind: kind as 'cmd' | 'factor', slot: Number(slotStr), idx: Number(idxStr), el }));
    }
    return () => unregs.forEach((u) => u());
  });

  const onPoolPointerDown = (ev: React.PointerEvent, kind: 'cmd' | 'factor', name: string, el: HTMLElement) => {
    ev.preventDefault();
    startDrag({ kind, name, el, onDrop: (slot, idx) => {
      if (kind === 'cmd') setDoublesCmd(slot, idx, name);
      else setDoublesFac(slot, idx, name);
      setTick((x) => x + 1);
    } }, ev.nativeEvent);
  };
  const onClearCmd = (slot: number, idx: number) => { clearDoublesCmd(slot, idx); setTick((x) => x + 1); };
  const onClearFac = (slot: number, idx: number) => { clearDoublesFac(slot, idx); setTick((x) => x + 1); };

  const handleStart = () => {
    const r = validateDoubles();
    if (!r.ok) { setToast({ msg: r.firstError, count: r.errors.length, kind: 'hard' }); return; }
    onStart();
  };
  const handleRandomFill = () => { randomFillDoubles(); setTick((x) => x + 1); };

  // 各场锁定因子展示：topbar 汇总用。官突=每场官突名；非酋之轮=三场共享锁定因子（混乱工作室）。
  const isFeiqiu = cfg.variant === 'feiqiu';
  const lockLabel = isFeiqiu ? '非酋' : '官突';
  const mutNames = cfg.matchMutatorNames || [];
  const allMatchMuts = isFeiqiu
    ? '混乱工作室'
    : (mutNames.length
      ? mutNames.join(' | ')
      : (cfg.matchMutators || []).map((ms) => ms.join('·')).join(' | '));

  return (
    <div
      className={`jjb style-${style} mode-${mode}`}
      style={{ width: 1280, height: 720 }}
      data-screen-label={`select-${style}-${mode}-doubles`}
      data-capture="select"
      data-doubles-select
    >
      <div className="jjb-bg"><div className="bg-grad"></div><div className="bg-tex"></div><div className="bg-vignette"></div></div>
      <div className="jjb-inner sel">
        <div className="topbar">
          <BrandLockup styleName={style} modeName={mode} size="sm" />
          <div className="topbar-meta">
            <div className="meta-row"><span className="meta-k">参赛战队</span><span className="meta-v" data-meta-player>双打战队</span></div>
            <div className="meta-row"><span className="meta-k">比赛模式</span><span className="meta-v" data-meta-mode data-doubles-mode>{doublesModeLabel()}</span></div>
            <div className="meta-row"><span className="meta-k">{lockLabel}</span><span className="meta-v" data-doubles-mutators style={{ fontWeight: 700, color: 'var(--accent, #e8b84b)' }}>{allMatchMuts}</span></div>
          </div>
        </div>

        <div className="slots" data-doubles-slots={slots.length}>
          {matchVMs.map((m, i) => {
            const sel = slots[i] || { cmds: [], factors: [] };
            const mapName = m.map || '—';
            const mapSrc = mapUrl(mapName);
            const isBoss = i === matchVMs.length - 1;
            return (
              <div key={i} className={'slot' + (i === 0 ? ' slot-active' : '')} data-slot-idx={i} data-doubles-slot={i} data-doubles-lock={(m.mutators || []).join(',')}>
                <div className="slot-head">
                  <span className="slot-no">{m.slot}</span>
                  <span className="slot-map-name">{mapName}</span>
                  <span className="slot-difficulty" style={{ marginLeft: isBoss ? 0 : 'auto', fontSize: 12, fontWeight: 700, color: 'var(--accent, #e8b84b)', whiteSpace: 'nowrap' }}>{isFeiqiu ? '非酋' : `官突 ${mutNames[i] || (m.mutators || []).join('·')}`}</span>
                  {isBoss && <span className="slot-flag">BOSS</span>}
                </div>
                <span className="mapthumb">
                  {mapSrc ? (
                    <img src={mapSrc} alt={mapName} />
                  ) : (
                    <span style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>{mapName}</span>
                  )}
                  <EnemyBadge race={currentEnemyRace(i)} ai={currentEnemyAi(i)} size="lg" />
                </span>
                <div className="slot-targets">
                  <div className="t-cmds">
                    {Array.from({ length: cfg.cmdsPerMatch }).map((_, k) => {
                      const c = sel.cmds[k];
                      return c ? (
                        <span key={k} ref={setTarget(`cmd:${i}:${k}`)} data-doubles-cmd={`${i}:${k}`} onClick={() => { if (shouldSuppressClickClear()) return; onClearCmd(i, k); }} style={{ cursor: 'pointer' }}>
                          <CommanderCard src={cmdUrl(c)} name={c} w={56} h={67} fill check />
                        </span>
                      ) : (
                        <DropCell key={k} ref={setTarget(`cmd:${i}:${k}`)} w={56} h={67} hint="指挥官" />
                      );
                    })}
                  </div>
                  <div className="t-facs">
                    {(m.mutators || []).map((mu, k) => (
                      <span key={`mut${k}`} style={{ position: 'relative', display: 'inline-block' }}>
                        <FactorFrame src={facUrl(mu)} size={52} tag={lockLabel} gold={getGoldFor(mu)} />
                        <GoldBadge name={mu} on={getGoldFor(mu)} onToggle={() => { toggleGold(mu); setTick((x) => x + 1); }} />
                      </span>
                    ))}
                    {Array.from({ length: cfg.extraFactors }).map((_, k) => {
                      const v = sel.factors[k];
                      return v ? (
                        <span key={k} ref={setTarget(`factor:${i}:${k}`)} data-doubles-fac={`${i}:${k}`} onClick={() => { if (shouldSuppressClickClear()) return; onClearFac(i, k); }} style={{ cursor: 'pointer', position: 'relative', display: 'inline-block' }}>
                          <FactorFrame src={facUrl(v)} size={52} gold={getGoldFor(v)} />
                          <GoldBadge name={v} on={getGoldFor(v)} onToggle={() => { toggleGold(v); setTick((x) => x + 1); }} />
                        </span>
                      ) : (
                        <DropCell key={k} ref={setTarget(`factor:${i}:${k}`)} w={52} h={52} hint="因子" />
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pool" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div className="pool-factors">
            <div className="block-head sm"><span className="block-kicker">FACTORS</span><span className="block-title">随机因子池</span></div>
            <div className="factor-row" style={{ gap: 14, flexWrap: 'wrap' }} data-doubles-pool-factors>
              {facPool.map((f, i) => (
                <span key={i} data-doubles-pool-fac={f} onPointerDown={(ev) => onPoolPointerDown(ev, 'factor', f, ev.currentTarget as HTMLElement)} style={{ cursor: 'grab', touchAction: 'none', position: 'relative', display: 'inline-block' }}>
                  <FactorFrame src={facUrl(f)} size={66} check={isPickedDoubles(slots, 'fac', f)} gold={getGoldFor(f)} />
                  <GoldBadge name={f} on={getGoldFor(f)} onToggle={() => { toggleGold(f); setTick((x) => x + 1); }} />
                </span>
              ))}
            </div>
          </div>
          <div className="pool-cmd" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <div className="grp">
              <div className="block-head sm"><span className="block-title">指挥官池（双打 {cfg.cmdPoolSize} 选）</span></div>
              <div className="avatar-row" style={{ gap: 13, flexWrap: 'wrap' }} data-doubles-pool-cmds>
                {cmdPool.map((c, i) => (
                  <span key={i} data-doubles-pool-cmd={c} onPointerDown={(ev) => onPoolPointerDown(ev, 'cmd', c, ev.currentTarget as HTMLElement)} style={{ cursor: 'grab', touchAction: 'none' }}>
                    <CommanderCard src={cmdUrl(c)} name={c} />
                  </span>
                ))}
              </div>
            </div>
            </div>
            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16, flexShrink: 0, paddingTop: 8 }}>
              {toast && (
                <div className={'toastv ' + toast.kind + (toast.count > 1 ? ' toastv-stack' : '')} data-toast-err data-toast-kind={toast.kind}>
                  <span className="toastv-ico">!</span>
                  <span className="toastv-tx">{toast.msg}</span>
                  {toast.count > 1 && <span className="toastv-n">+{toast.count - 1}</span>}
                  <span className={toast.kind === 'soft' ? 'toastv-rule' : 'toastv-block'}>{toast.kind === 'soft' ? '仍可开赛' : '阻断开赛'}</span>
                </div>
              )}
              <EnemyStatusPill />
              <CaptureButtons targetSelector='[data-capture="select"]' filename="jjb-select-doubles.png" />
              <button className="startbtn" data-doubles-random-fill-btn style={{ margin: 0, padding: '14px 26px' }} onClick={handleRandomFill}>随机填充</button>
              <button className="startbtn" data-doubles-start-btn style={{ margin: 0 }} onClick={handleStart}>比赛开始 <span className="startbtn-arrow">▶</span></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
