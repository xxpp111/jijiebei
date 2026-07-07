import { useEffect, useMemo, useRef } from 'react';
import { CommanderCard } from '../components/CommanderCard';
import { FactorFrame } from '../components/FactorFrame';
import { DropCell } from '../components/DropCell';
import { ScreenShell } from '../components/ScreenShell';
import { TopBar, MetaRow } from '../components/TopBar';
import { MapThumb } from '../components/MapThumb';
import { useToast, ToastV } from '../components/Toast';
import { EnemyBadge } from '../components/EnemyBadge';
import { CaptureButtons } from '../components/CaptureButtons';
import { cmdUrl, facUrl } from '../lib/realAsset';
import { DoublesSelect, EnemyStatusPill, GoldBadge } from './DoublesSelect';
import { useForceRerender } from '../lib/useForceRerender';
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
  rerollFactor,
  getRerollState,
  facFlatIdx,
} from '../logic/jjbSession';
import { startDrag, registerTarget, shouldSuppressClickClear } from '../lib/dragdrop';
import { doublesLive } from '../logic/jjbDoubles';
import { getBpModeEnabled } from '../logic/bpConfig';
import { currentEnemyRace, currentEnemyAi, currentModeLabel } from '../logic/jjbView';

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
  onGenCode: () => void; // 生成对局码：固化当前局 → CodeScreen gen
}

/** BP ban 角标按钮（因子池每个因子左上角，toggle ban）。皮=实心红圆章（Claude Design v1 稿 1b，见 styles/badges.css .bp-ban）。
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

/** 重揉角标按钮（每个非锁定因子右下角，reroll 换一个未出现的因子）。皮=骰子蓝圆章（Claude Design v1 稿 1b，见 styles/badges.css .reroll-toggle）。
 *  与点金(右上·金) / BP(左上·红) 分置右下不重叠；stopPropagation 不触发拖拽/清槽。 */
function RerollBadge({ name, onReroll }: { name: string; onReroll: () => void }) {
  return (
    <button
      className="reroll-toggle"
      data-reroll-at={name}
      title="重新揉（换一个未出现过的因子）"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); onReroll(); }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1">
        <rect x="4.5" y="4.5" width="15" height="15" rx="3.6"></rect>
        <circle cx="9" cy="9" r="1.5" fill="currentColor" stroke="none"></circle>
        <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"></circle>
        <circle cx="15" cy="15" r="1.5" fill="currentColor" stroke="none"></circle>
      </svg>
    </button>
  );
}

export function SelectScreen({ style, mode, onStart, onGenCode }: SelectScreenProps) {
  // 兜底：?screen=select 直跳时若 jjbLive=false 在本屏内开一局 std8 后 setState 强制重渲。
  // URL ?sessionMode=std8|std10|... 覆盖默认 std8；旧 ?mode=std10 仍兼容。
  const forceRerender = useForceRerender();
  useEffect(() => {
    if (doublesLive()) return; // 双打局已开（JJBDoubles 自管，JijieData.jjbLive 恒 false）：不被单打 std8 兜底覆盖
    const s = getSelectState();
    if (!s.jjbLive) {
      const m = querySessionMode();
      try { startSession(m); forceRerender(); } catch (e) { console.error('[Select] 兜底开局失败:', e); }
    }
  }, []);
  // 校验失败 toast：开始按钮按下时塞（state + 4s 自动消失 → useToast）
  const [toast, setToast] = useToast();

  const s = getSelectState();
  const live = s.jjbLive;

  useEffect(() => {
    try {
      const w = window as unknown as { __jjbE2E?: Record<string, unknown> };
      w.__jjbE2E = { ...(w.__jjbE2E || {}), setSelectedFac, clearFacSlot, getSelectState };
    } catch { /* noop */ }
  }, []);

  // 因子池/指挥官池（真实完整池，不截断；对齐 Cocos 真身整池渲染；6 主题渲染由 design 排版约束）
  const factorRow = useMemo(() => s.randomFactorPoor.slice(), [s.randomFactorPoor]);
  const cmdA = useMemo(() => s.randomCommanderPoorA.filter((c) => c !== '自选'), [s.randomCommanderPoorA]);
  const cmdB = useMemo(() => s.randomCommanderPoorB.filter((c) => c !== '自选'), [s.randomCommanderPoorB]);
  // 自选池：用 getSelectState 透出的真实 selfPool/selfShow（正确读 JijieData，ConfigData 全量减已入 A/B 池 + mode 门控）。
  // 替换 spoke 本地 computeSelfPool（修两 bug：showSelfPool 误传 window 致门控恒真 + randomCommanderPoorC 读错 ConfigData）。
  const selfPool = s.selfPool;

  const modeLabel = currentModeLabel();

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
        forceRerender();
      },
    }, ev.nativeEvent);
  };

  const onSlotFactorPointerDown = (ev: React.PointerEvent, slot: number, idx: number, name: string, el: HTMLElement) => {
    ev.preventDefault();
    startDrag({
      kind: 'factor',
      name,
      el,
      onDrop: (targetSlot, targetIdx) => {
        // 源槽 slot/idx 由闭包捕获，移动=清源+写目标；dragdrop 不需感知来源
        if (targetSlot === slot && targetIdx === idx) return;
        // banned 因子 setSelectedFac 会拒写（落槽防御）；先清源再写会凭空丢失，前置拦下并提示
        if (getBanFor(name)) { setToast({ msg: '因子已被禁用，无法移动', count: 1, kind: 'soft' }); return; }
        clearFacSlot(slot, idx);
        setSelectedFac(targetSlot, targetIdx, name);
        forceRerender();
      },
    }, ev.nativeEvent);
  };

  // ===== 点击已填槽清除 =====
  const onClearCmd = (slot: number) => { clearCmdSlot(slot); forceRerender(); };
  const onClearFac = (slot: number, k: number) => { clearFacSlot(slot, k); forceRerender(); };

  // ===== 重揉：换一个未出现的因子（match 超限走软违规 toast，照抄 BpBadge 回显范式） =====
  const doReroll = (kind: 'pool' | 'slot', i: number, k?: number) => {
    rerollFactor(kind, i, k);
    const w = getSelectWarn();
    if (w) setToast({ msg: w, count: 1, kind: 'soft' });
    forceRerender();
  };

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
    forceRerender();
  };

  // 双打：JJBDoubles 自管局已开 → 渲双打选择面板（2 指挥官/场 + 官突锁定 + 3 随机因子槽），与单打 9 模式 UI 分流。
  if (doublesLive()) {
    return <DoublesSelect style={style} mode={mode} onStart={onStart} onGenCode={onGenCode} />;
  }

  if (!live) {
    return (
      <div className={`jjb style-${style} mode-${mode}`} style={{ width: 1280, height: 720, color: '#fff', padding: 40 }}>
        选择面板开局中…
      </div>
    );
  }

  return (
    <ScreenShell
      className={`jjb style-${style} mode-${mode}`}
      data-screen-label={`select-${style}-${mode}-${s.mode}`}
      data-capture="select"
    >
      <div className="jjb-inner sel">
        {/* topbar */}
        <TopBar styleName={style} modeName={mode}>
          <MetaRow k="当前选手" v={s.playerName || '选手'} vProps={{ 'data-meta-player': true }} />
          <MetaRow k="比赛模式" v={modeLabel} vProps={{ 'data-meta-mode': true }} />
          <MetaRow k="难度总分" v={difficultyTotal()} vProps={{ 'data-difficulty-total': true, style: { fontWeight: 700, color: 'var(--accent, #e8b84b)' } }} />
        </TopBar>

        {/* 3 场 slots（真实地图 + 锁定因子 + 空槽数=manualSlots(i)） */}
        <div className="slots">
          {s.manualSlots.map((slots, i) => {
            const mapName = s.mapList[i] || '—';
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
                <MapThumb map={mapName}>
                  <EnemyBadge race={currentEnemyRace(i)} ai={currentEnemyAi(i)} size="lg" />
                </MapThumb>
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
                          onPointerDown={(ev) => onSlotFactorPointerDown(ev, i, k, v, ev.currentTarget as HTMLElement)}
                          onClick={() => { if (shouldSuppressClickClear()) return; onClearFac(i, k); }}
                          style={{ cursor: 'grab', position: 'relative', display: 'inline-block', touchAction: 'none' }}
                        >
                          <FactorFrame src={facUrl(v)} size={52} gold={getGoldFor(v)} />
                          <GoldBadge name={v} on={getGoldFor(v)} onToggle={() => { toggleGold(v); forceRerender(); }} />
                          <RerollBadge name={v} onReroll={() => doReroll('slot', i, k)} />
                        </span>
                      ) : (
                        <DropCell key={k} ref={setTarget(`factor:${i}:${k}`)} w={52} h={52} hint="因子" data-slot-fac-target={`${i}:${k}`} />
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
                  <GoldBadge name={f} on={getGoldFor(f)} onToggle={() => { toggleGold(f); forceRerender(); }} />
                  {getBpModeEnabled(s.mode) && <BpBadge name={f} on={getBanFor(f)} onToggle={() => { toggleBanFactor(f); const w = getSelectWarn(); if (w) setToast({ msg: w, count: 1, kind: 'soft' }); forceRerender(); }} />}
                  <RerollBadge name={f} onReroll={() => doReroll('pool', i)} />
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
              <ToastV toast={toast} />
              {s.ruleMode === 'match' && (() => { const rr = getRerollState(); return (
                <span data-reroll-remaining={rr.remaining} style={{ fontSize: 12, fontWeight: 700, color: '#8fd6ff', whiteSpace: 'nowrap' }}>
                  ↻ 重揉 {rr.remaining}/{rr.limit}
                </span>
              ); })()}
              <EnemyStatusPill />
              <button type="button" className="btn-ghost" data-nav-gencode onClick={onGenCode}>生成对局码 →</button>
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
    </ScreenShell>
  );
}
