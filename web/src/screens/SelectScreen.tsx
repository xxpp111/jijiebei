import { useEffect, useMemo, useRef, useState } from 'react';
import { CommanderCard } from '../components/CommanderCard';
import { FactorFrame } from '../components/FactorFrame';
import { DropCell } from '../components/DropCell';
import { mapUrl, cmdUrl, facUrl, logoUrl, titleUrl } from '../lib/realAsset';
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
  type SessionMode,
} from '../logic/jjbSession';
import { facFlatIdx } from '@jjb/JJBData';
import { startDrag, registerTarget, shouldSuppressClickClear } from '../lib/dragdrop';

// 集结杯 × CM — 选择面板整屏（段2 Phase 2：拖拽手选 + 校验 + 手选进 battle）。
// 严格承接 design/v4-r2/components/select-screen.jsx 的 SelectScreenV4 DOM/className：
//   topbar / .slots (3×.slot) / .pool (pool-factors + pool-cmd) / .startbtn
// 数据走 getSelectState() 读真身 JijieData（0 改 jijie2；status=2 时渲染开局后的池/槽/地图/锁定）。
// Phase 2 新增：HTML5 pointer 自写拖拽吸附（lib/dragdrop.ts）+ 校验三规则（jjbSession.validate）+ 手选进 battle。
// 手动校验三规则镜像真身 JJBSelect.validate（JJBData.manualSlots + ConfigData.commadnerGroupList['B'] 查表）。

const SLOT_TITLES = ['第 1 场', '第 2 场', 'BOSS 战'];

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

export function SelectScreen({ style, mode, onStart }: SelectScreenProps) {
  // 兜底：?screen=select 直跳时若 jjbLive=false 在本屏内开一局 std8 后 setState 强制重渲。
  // URL ?mode=std8|std10|... 覆盖默认 std8（home→select 跳转时也用相同 URL 模式同源）。
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const s = getSelectState();
    if (!s.jjbLive) {
      const m = (typeof window !== 'undefined'
        ? (new URLSearchParams(window.location.search).get('mode') as SessionMode | null)
        : null) || 'std8';
      try { startSession(m); setTick((x) => x + 1); } catch (e) { console.error('[Select] 兜底开局失败:', e); }
    }
  }, []);
  // 校验失败 toast：开始按钮按下时塞
  const [toast, setToast] = useState<{ msg: string; count: number } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const s = getSelectState();
  const live = s.jjbLive;
  void tick;

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
      setToast({ msg: r.firstError, count: r.errors.length });
      return;
    }
    onStart();
  };

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
    >
      <div className="jjb-bg">
        <div className="bg-grad"></div>
        <div className="bg-tex"></div>
        <div className="bg-vignette"></div>
      </div>

      <div className="jjb-inner sel">
        {/* topbar */}
        <div className="topbar">
          <div className="lockup lockup-sm">
            <img className="lockup-mark" src={logoUrl(style, mode)} alt="CM" />
            <span className="lockup-div"></span>
            <img className="lockup-title" src={titleUrl(style, mode)} alt="集结杯" style={{ height: 30, display: 'block' }} />
          </div>
          <div className="topbar-meta">
            <div className="meta-row">
              <span className="meta-k">当前选手</span>
              <span className="meta-v" data-meta-player>{s.playerName || '选手'}</span>
            </div>
            <div className="meta-row">
              <span className="meta-k">比赛模式</span>
              <span className="meta-v" data-meta-mode>{modeLabel}</span>
            </div>
          </div>
        </div>

        {/* 3 场 slots（真实地图 + 锁定因子 + 空槽数=manualSlots(i)） */}
        <div className="slots">
          {s.manualSlots.map((slots, i) => {
            const mapName = s.mapList[i] || '—';
            const lock = s.lockFactorList[i];
            const selCmd = s.selectedCommanderList[i];
            const isBoss = i === 2;
            return (
              <div
                key={i}
                className={'slot' + (i === 0 ? ' slot-active' : '')}
                data-slot-idx={i}
              >
                <div className="slot-head">
                  <span className="slot-no">{SLOT_TITLES[i]}</span>
                  <span className="slot-map-name">{mapName}</span>
                  {isBoss && <span className="slot-flag">双倍</span>}
                </div>
                <span className="mapthumb">
                  <img src={mapUrl(mapName)} alt={mapName} />
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
                        <CommanderCard src={cmdUrl(selCmd)} name={selCmd} w={56} h={67} fill />
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
        <div className="pool">
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
                  style={{ cursor: 'grab', touchAction: 'none', position: 'relative', display: 'inline-block' }}
                >
                  <FactorFrame src={facUrl(f)} size={66} gold={getGoldFor(f)} />
                  <GoldBadge name={f} on={getGoldFor(f)} onToggle={() => { toggleGold(f); setTick((x) => x + 1); }} />
                </span>
              ))}
            </div>
          </div>

          <div className="pool-cmd">
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
            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16 }}>
              {toast && (
                <div className="toastv" data-toast-err>
                  <span className="toastv-ico">!</span>
                  <span className="toastv-tx">{toast.msg}</span>
                  {toast.count > 1 && <span className="toastv-n">+{toast.count - 1}</span>}
                </div>
              )}
              <button
                className="startbtn"
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
  const factorLabel = s.modelFactorCount === 0 ? '随机'
    : s.modelFactorCount === 2 ? '8 因子'
    : s.modelFactorCount === 3 ? '10 因子'
    : s.modelFactorCount === 4 ? '12 因子'
    : `${s.modelFactorCount} 因子`;
  const modeLabel = s.modeIsZhengjiu ? '拯救'
    : s.modeIsOnePick ? '单指'
    : s.modeIsVeryHard2 ? '极难②'
    : s.modeIsVeryHard ? '极难①'
    : s.modeFeiqiu ? '非酋'
    : s.modeSuiji ? '随机'
    : '手选';
  return `${factorLabel} · ${modeLabel}`;
}

export type _SelectMode = SessionMode;
