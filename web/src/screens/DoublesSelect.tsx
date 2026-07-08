import { useEffect, useRef } from 'react';
import { CommanderCard } from '../components/CommanderCard';
import { FactorFrame } from '../components/FactorFrame';
import { DropCell } from '../components/DropCell';
import { ScreenShell } from '../components/ScreenShell';
import { TopBar, MetaRow } from '../components/TopBar';
import { MapThumb } from '../components/MapThumb';
import { useToast, ToastV } from '../components/Toast';
import { EnemyBadge } from '../components/EnemyBadge';
import { CaptureButtons } from '../components/CaptureButtons';
import { cmdUrl, facUrl, raceUrl } from '../lib/realAsset';
import { startDrag, registerTarget, shouldSuppressClickClear } from '../lib/dragdrop';
import { useForceRerender } from '../lib/useForceRerender';
import { clearSelectWarn, getGoldFor, getRuleMode, getSelectWarn, toggleGold } from '../logic/jjbSession';
import {
  doublesMatches, doublesModeLabel, getDoublesState, getDoublesPlayers,
  setDoublesCmd, clearDoublesCmd, setDoublesFac, clearDoublesFac,
  validateDoubles, randomFillDoubles, getDoublesRerollState,
  rerollDoublesCommander, rerollDoublesFactor,
} from '../logic/jjbDoubles';
import { COMMANDERS } from '../config/commanders';
import { lockTagFor, slotTagFor } from '../config/modes';
import { currentEnemyRace, currentEnemyAi } from '../logic/jjbView';
import { getRandomEnemyEnabled } from '../logic/randomConfig';

export interface DoublesSelectProps {
  style: string;
  mode: string;
  onStart: () => void;
  onGenCode: () => void;
}

// 操作区只读敌方状态条（设计稿 03 方案A）：select 不放开关，仅随机敌方开启时提示「功能已开·三族每场随机」；
// 切换在 BP 设置面，这里纯只读（三族徽 + ON 点）。关闭时不渲染、不占位。
export function EnemyStatusPill() {
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

/** 点金角标按钮（每个因子右上角，toggle 金/非金；stopPropagation 不触发拖拽/清槽）。 */
export function GoldBadge({ name, on, onToggle }: { name: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      className={'gold-toggle' + (on ? ' on' : '')}
      data-gold-toggle={name}
      title="点金 / 取消金"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
    >
      金
    </button>
  );
}

function RerollBadge({ name, onReroll }: { name: string; onReroll: () => void }) {
  return (
    <button
      className="reroll-toggle"
      data-doubles-reroll={name}
      title="重新揉"
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

// ===== 双打选择面板（JJBDoubles 自管引擎接通；复用单打 CSS 类 + 组件，数据走 jjbDoubles 适配层） =====
// 与单打 9 模式 UI 分流：2 指挥官/场 + 官突锁定打底 + extraFactors 随机因子槽；拖拽复用 dragdrop（cmd/factor × slot/idx）。
function isPickedDoubles(slots: Array<{ cmds: (string | null)[]; factors: (string | null)[] }>, kind: 'cmd' | 'fac', name: string): boolean {
  return slots.some((s) => (kind === 'cmd' ? s.cmds : s.factors).some((x) => x === name));
}

// CM 自制指挥官识别章（cm 双打自选全量 22 官方/CM 混排，D11）：标识非按钮，皮见 styles/doubles-select.css .cm-chip。
const CM_NAMES = new Set(COMMANDERS.filter((c) => c.source === 'cm').map((c) => c.name));
function CmChip({ name }: { name: string }) {
  return CM_NAMES.has(name) ? <span className="cm-chip" aria-hidden>CM</span> : null;
}

export function DoublesSelect({ style, mode, onStart, onGenCode }: DoublesSelectProps) {
  const forceRerender = useForceRerender();
  const [toast, setToast] = useToast();

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
      // 候选区占位格注册为 slot=-1 的拖放目标(供场次槽因子拖回清除)；未选池因子若误吸附到占位格，
      // slot=-1 会让 setDoublesFac(-1) 走 ensureSlot(-1)→_slots[-1] undefined→TypeError 并卡死拖拽机。
      // 池因子拖到占位格无意义(dead-drop)，直接忽略。
      if (slot < 0) return;
      if (kind === 'cmd') setDoublesCmd(slot, idx, name);
      else {
        setDoublesFac(slot, idx, name);
        const w = getSelectWarn();
        if (w) setToast({ msg: w, count: 1, kind: 'soft' });
      }
      forceRerender();
    } }, ev.nativeEvent);
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
        // Phase3: 命中候选区(targetSlot<0)=清除该因子所在场次槽，不写目标
        if (targetSlot < 0) {
          clearDoublesFac(slot, idx);
          forceRerender();
          return;
        }
        clearDoublesFac(slot, idx);
        setDoublesFac(targetSlot, targetIdx, name);
        forceRerender();
      },
    }, ev.nativeEvent);
  };
  const onClearCmd = (slot: number, idx: number) => { clearDoublesCmd(slot, idx); forceRerender(); };
  const onClearFac = (slot: number, idx: number) => { clearDoublesFac(slot, idx); forceRerender(); };

  const handleStart = () => {
    const r = validateDoubles();
    if (!r.ok) { setToast({ msg: r.firstError, count: r.errors.length, kind: 'hard' }); return; }
    onStart();
  };
  const handleRandomFill = () => { randomFillDoubles(); forceRerender(); };

  // 各场锁定因子展示：topbar 汇总用。官突=每场官突名；非酋之轮=三场共享锁定因子（混乱工作室）；
  // std15=无锁定（显待选口径）；cm=每场恒锁 风暴英雄+虚空裂隙。
  const isCm = cfg.variant === 'cm';
  const isStd15 = cfg.variant === 'std15';
  const canReroll = cfg.variant !== 'feiqiu';
  const lockLabel = lockTagFor(cfg.variant);
  const mutNames = cfg.matchMutatorNames || [];
  const allMatchMuts = cfg.variant === 'feiqiu'
    ? '混乱工作室'
    : cfg.variant === 'std15'
      ? `每场 ${cfg.extraFactors} · 无锁定`
      : cfg.variant === 'cm'
        ? '风暴英雄 + 虚空裂隙 · 每场'
        : (mutNames.length
          ? mutNames.join(' | ')
          : (cfg.matchMutators || []).map((ms) => ms.join('·')).join(' | '));
  // 每场 slot 头部角标文案（per-variant）
  const slotTag = (i: number) => slotTagFor(cfg.variant, {
    extraFactors: cfg.extraFactors,
    mutatorName: mutNames[i] || ((cfg.matchMutators || [])[i] || []).join('·'),
  });
  const selfPool = st.selfPool || [];
  const doDoublesReroll = (fn: (idx: number) => boolean, idx: number) => {
    fn(idx);
    // warn 回显（match 超限/候选不足/落槽联动清空），照单打 doReroll 与上方池拖拽 handler 范式
    const w = getSelectWarn();
    if (w) setToast({ msg: w, count: 1, kind: 'soft' });
    forceRerender();
  };

  return (
    <ScreenShell
      className={`jjb style-${style} mode-${mode}`}
      data-screen-label={`select-${style}-${mode}-doubles`}
      data-capture="select"
      data-doubles-select
    >
      <div className="jjb-inner sel">
        <TopBar styleName={style} modeName={mode}>
          <MetaRow k="参赛战队" v={getDoublesPlayers().join(' & ')} vProps={{ 'data-meta-player': true }} />
          <MetaRow k="比赛模式" v={doublesModeLabel()} vProps={{ 'data-meta-mode': true, 'data-doubles-mode': true }} />
          <MetaRow k={lockLabel} v={allMatchMuts} vProps={{ 'data-doubles-mutators': true, style: { fontWeight: 700, color: 'var(--accent, #e8b84b)' } }} />
        </TopBar>

        <div className="slots" data-doubles-slots={slots.length}>
          {matchVMs.map((m, i) => {
            const sel = slots[i] || { cmds: [], factors: [] };
            const mapName = m.map || '—';
            const isBoss = i === matchVMs.length - 1;
            return (
              <div key={i} className={'slot' + (i === 0 ? ' slot-active' : '')} data-slot-idx={i} data-doubles-slot={i} data-doubles-lock={(m.mutators || []).join(',')}>
                <div className="slot-head">
                  <span className="slot-no">{m.slot}</span>
                  <span className="slot-map-name">{mapName}</span>
                  <span className={'slot-difficulty' + (isStd15 || isCm ? ' slot-tag' : '')} style={{ marginLeft: isBoss ? 0 : 'auto', fontSize: 12, fontWeight: 700, color: 'var(--accent, #e8b84b)', whiteSpace: 'nowrap' }}>{slotTag(i)}</span>
                  {isBoss && <span className="slot-flag">BOSS</span>}
                </div>
                <MapThumb map={mapName}>
                  <EnemyBadge race={currentEnemyRace(i)} ai={currentEnemyAi(i)} size="lg" />
                </MapThumb>
                <div className="slot-targets">
                  <div className="t-cmds">
                    {Array.from({ length: cfg.cmdsPerMatch }).map((_, k) => {
                      const c = sel.cmds[k];
                      return c ? (
                        <span key={k} ref={setTarget(`cmd:${i}:${k}`)} className="cmdwrap" data-doubles-cmd={`${i}:${k}`} onClick={() => { if (shouldSuppressClickClear()) return; onClearCmd(i, k); }} style={{ cursor: 'pointer' }}>
                          <CommanderCard src={cmdUrl(c)} name={c} w={56} h={67} fill check />
                          <CmChip name={c} />
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
                        <GoldBadge name={mu} on={getGoldFor(mu)} onToggle={() => { toggleGold(mu); forceRerender(); }} />
                      </span>
                    ))}
                    {Array.from({ length: cfg.extraFactors }).map((_, k) => {
                      const v = sel.factors[k];
                      return v ? (
                        <span
                          key={k}
                          ref={setTarget(`factor:${i}:${k}`)}
                          data-doubles-fac={`${i}:${k}`}
                          onPointerDown={(ev) => onSlotFactorPointerDown(ev, i, k, v, ev.currentTarget as HTMLElement)}
                          onClick={() => { if (shouldSuppressClickClear()) return; onClearFac(i, k); }}
                          style={{ cursor: 'grab', position: 'relative', display: 'inline-block', touchAction: 'none' }}
                        >
                          <FactorFrame src={facUrl(v)} size={52} gold={getGoldFor(v)} />
                          <GoldBadge name={v} on={getGoldFor(v)} onToggle={() => { toggleGold(v); forceRerender(); }} />
                          {canReroll && <RerollBadge name={v} onReroll={() => {
                            // 场次槽 reroll = 原地换(对齐单打场次槽 reroll：那格因子直接变新的，不清空)。
                            // rerollDoublesFactor 换池 poolIdx 的因子并清掉落槽同名(引擎既有语义)，
                            // 成功后把新因子写回本槽 → 净效果=原地替换；引擎的「已同步清空」提示在此不适用，clearSelectWarn 抹掉。
                            const poolIdx = facPool.indexOf(v); // 池内无重复(guantu/std15/cm)保证唯一
                            if (poolIdx < 0) { setToast({ msg: '自选因子不在随机池，不可重揉', count: 1, kind: 'soft' }); return; }
                            const ok = rerollDoublesFactor(poolIdx);
                            if (ok) {
                              const fresh = getDoublesState().factorPool[poolIdx];
                              if (fresh) setDoublesFac(i, k, fresh);
                              clearSelectWarn();
                            } else {
                              const w = getSelectWarn(); // 超限/候选不足
                              if (w) setToast({ msg: w, count: 1, kind: 'soft' });
                            }
                            forceRerender();
                          }} />}
                        </span>
                      ) : (
                        <DropCell key={k} ref={setTarget(`factor:${i}:${k}`)} w={52} h={52} hint="因子" data-doubles-fac-target={`${i}:${k}`} />
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
              {facPool.map((f, i) => {
                const picked = isPickedDoubles(slots, 'fac', f);
                return picked ? (
                  <span key={i} ref={setTarget(`factor:-1:${i}`)} data-doubles-pool-fac={f} data-doubles-pool-fac-placeholder="" style={{ display: 'inline-block' }}>
                    <DropCell w={66} h={66} hint="" />
                  </span>
                ) : (
                  <span key={i} data-doubles-pool-fac={f} onPointerDown={(ev) => onPoolPointerDown(ev, 'factor', f, ev.currentTarget as HTMLElement)} style={{ cursor: 'grab', touchAction: 'none', position: 'relative', display: 'inline-block' }}>
                    <FactorFrame src={facUrl(f)} size={66} gold={getGoldFor(f)} />
                    <GoldBadge name={f} on={getGoldFor(f)} onToggle={() => { toggleGold(f); forceRerender(); }} />
                    {canReroll && <RerollBadge name={f} onReroll={() => doDoublesReroll(rerollDoublesFactor, i)} />}
                  </span>
                );
              })}
            </div>
          </div>
          <div className="pool-cmd" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <div className="grp">
              <div className="block-head sm"><span className="block-title">指挥官池（双打 {cfg.cmdPoolSize} 选）</span></div>
              <div className="avatar-row" style={{ gap: 13, flexWrap: 'wrap' }} data-doubles-pool-cmds>
                {cmdPool.map((c, i) => (
                  <span key={i} className="cmdwrap" data-doubles-pool-cmd={c} onPointerDown={(ev) => onPoolPointerDown(ev, 'cmd', c, ev.currentTarget as HTMLElement)} style={{ cursor: 'grab', touchAction: 'none', position: 'relative', display: 'inline-block' }}>
                    <CommanderCard src={cmdUrl(c)} name={c} />
                    <CmChip name={c} />
                    {canReroll && <RerollBadge name={c} onReroll={() => doDoublesReroll(rerollDoublesCommander, i)} />}
                  </span>
                ))}
              </div>
            </div>
            {/* 双打自选区（D4/D11 net-new）：std15=官方全量 / cm=官方+CM 全量，减已入池；拖入场次槽复用同一 dragdrop。
                guantu/feiqiu selfPool 恒空不渲染（行为不变）。 */}
            {selfPool.length > 0 && (
              <div className="grp self-grp">
                <div className="block-head sm">
                  <span className="block-title">自选指挥官</span>
                  <span className="block-note">{isCm ? '全量可选（官方 + CM）· 拖入场次槽位' : '官方全量可选 · 拖入场次槽位'}</span>
                </div>
                <div className="avatar-grid" style={{ gap: 11 }} data-doubles-pool-self>
                  {selfPool.map((c, i) => (
                    <span key={i} className="cmdwrap" data-doubles-pool-cmd={c} onPointerDown={(ev) => onPoolPointerDown(ev, 'cmd', c, ev.currentTarget as HTMLElement)} style={{ cursor: 'grab', touchAction: 'none' }}>
                      <CommanderCard src={cmdUrl(c)} name={c} w={60} h={72} />
                      <CmChip name={c} />
                    </span>
                  ))}
                </div>
              </div>
            )}
            </div>
            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16, flexShrink: 0, paddingTop: 8 }}>
              <ToastV toast={toast} />
              {/* 剩余计数仅比赛态显示(对齐单打 :435;practice 无限,计数会涨但不拦,常显会误导) */}
              {st.config.variant !== 'feiqiu' && getRuleMode() === 'match' && (() => { const rr = getDoublesRerollState(); return (
                <span data-doubles-reroll-remaining={rr.remaining} style={{ fontSize: 12, fontWeight: 700, color: '#8fd6ff', whiteSpace: 'nowrap' }}>
                  ↻ 重揉 {rr.remaining}/{rr.limit}
                </span>
              ); })()}
              <EnemyStatusPill />
              <button type="button" className="btn-ghost" data-nav-gencode onClick={onGenCode}>生成对局码 →</button>
              <CaptureButtons targetSelector='[data-capture="select"]' filename="jjb-select-doubles.png" />
              <button className="startbtn" data-doubles-random-fill-btn style={{ margin: 0, padding: '14px 26px' }} onClick={handleRandomFill}>随机填充</button>
              <button className="startbtn" data-doubles-start-btn style={{ margin: 0 }} onClick={handleStart}>比赛开始 <span className="startbtn-arrow">▶</span></button>
            </div>
          </div>
        </div>
      </div>
    </ScreenShell>
  );
}
