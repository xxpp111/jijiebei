import { useEffect, useMemo, useState } from 'react';
import { CommanderCard } from '../components/CommanderCard';
import { FactorFrame } from '../components/FactorFrame';
import { DropCell } from '../components/DropCell';
import { mapUrl, cmdUrl, facUrl } from '../lib/realAsset';
import { getSelectState, randomFillAndStart, startSession, type SessionMode } from '../logic/jjbSession';
import { facFlatIdx } from '@jjb/JJBData';

// 集结杯 × CM — 选择面板整屏（段2 Phase 1：静态布局 + 真实图，无拖拽）。
// 严格承接 design/v4-r2/components/select-screen.jsx 的 SelectScreenV4 DOM/className：
//   topbar / .slots (3×.slot) / .pool (pool-factors + pool-cmd) / .startbtn
// 数据走 getSelectState() 读真身 JijieData（0 改 jijie2；status=2 时渲染开局后的池/槽/地图/锁定）。
// Phase 1 行为：点开始 → randomFillAndStart()（按 pool+cmdPool 填 9 格后切 status=3）→ 跳 battle。
// 手动拖选（makeDraggable/校验三规则）留 Phase 2，本屏只展示静态空槽。

const SLOT_TITLES = ['第 1 场', '第 2 场', 'BOSS 战'];

export interface SelectScreenProps {
  style: string;
  mode: string;
  onStart: () => void; // 调 randomFillAndStart 后切 battle
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
  const s = getSelectState();
  const live = s.jjbLive;
  // 引用 tick 让 React 知道本屏依赖兜底后状态变化
  void tick;

  // 6 主题下因子池/指挥官池只取一段子集渲染（沿用 design 6+4+2+6 张图排版）。
  // 渲染真实完整池（不截断；对齐 Cocos 真身整池渲染，修 M3 把 design mock 上限当真实上限的偏差）。
  const factorRow = useMemo(() => s.randomFactorPoor, [s.randomFactorPoor]);
  const cmdA = useMemo(() => s.randomCommanderPoorA.filter((c) => c !== '自选'), [s.randomCommanderPoorA]);
  const cmdB = useMemo(() => s.randomCommanderPoorB.filter((c) => c !== '自选'), [s.randomCommanderPoorB]);
  const selfCmd = s.selfPool; // 真实全量自选池（ConfigData 全量 ban 后减已入池；按 mode 门控 selfShow）

  const modeLabel = modeMeta(s);

  const handleStart = () => {
    randomFillAndStart();
    onStart();
  };

  // 直跳 ?screen=select 首渲（兜底开局未完成）时不渲染地图/池，避免 mapName='—' 占位 + 缺图 warn。
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
            <img className="lockup-mark" src="assets/logo-cm-gold.png" alt="CM" />
            <span className="lockup-div"></span>
            <div className="lockup-word">
              <span className="lockup-cn">集结杯</span>
            </div>
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
                      <CommanderCard src={cmdUrl(selCmd)} name={selCmd} w={56} h={67} />
                    ) : (
                      <DropCell w={56} h={67} hint="指挥官" />
                    )}
                  </div>
                  <div className="t-facs">
                    {/* 锁定因子（自动）打头 */}
                    {lock ? (
                      <FactorFrame src={facUrl(lock)} size={52} tag="锁定" />
                    ) : (
                      <DropCell w={52} h={52} hint="锁定" />
                    )}
                    {/* 手选因子（已选 gold + 未选 DropCell），共 manualSlots(i) 槽 */}
                    {Array.from({ length: slots }).map((_, k) => {
                      const v = s.selectedFactorList[facFlatIdx(i, k)];
                      return v ? (
                        <FactorFrame key={k} src={facUrl(v)} size={52} gold />
                      ) : (
                        <DropCell key={k} w={52} h={52} hint="因子" />
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
                <FactorFrame key={i} src={facUrl(f)} size={66} />
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
                    <CommanderCard key={i} src={cmdUrl(c)} name={c} />
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
                    <CommanderCard key={i} src={cmdUrl(c)} name={c} />
                  ))}
                </div>
              </div>
            </div>
            {s.selfShow && (
              <div className="grp">
                <div className="block-head sm">
                  <span className="block-title">自选指挥官</span>
                  <span className="block-note">全量可选 · 拖入场次槽位（Phase 2 启用）</span>
                </div>
                <div className="avatar-grid" style={{ gap: 11, flexWrap: 'wrap' }} data-pool-cmds-self>
                  {selfCmd.map((c, i) => (
                    <CommanderCard key={i} src={cmdUrl(c)} name={c} w={60} h={72} />
                  ))}
                </div>
              </div>
            )}
            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16 }}>
              <button
                className="startbtn"
                data-start-btn
                style={{ margin: 0 }}
                onClick={handleStart}
                disabled={!live}
                title={live ? '随机填满 selected* 后进 battle' : '等待 home 选模式开局'}
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

// 留 Phase 2 备查：mode 字符串类型（不导出但 tsc 校验依赖）
export type _SelectMode = SessionMode;
