import JijieData from '../legacy/JijieData';
import ConfigData from '../legacy/JJConfigData';
import { facFlatIdx, manualSlots } from '../legacy/JJBData';
import { jjbLive, type SessionMode } from './sessionConfig';
import { clearSelectWarn, exposeBattleDebug, exposeSelectDebug, exposeSelectError, exposeSelectWarn } from './sessionDebug';
import { sessionEngineCore } from './sessionEngine';
import {
  clearBpRuntime,
  clearGoldRuntime,
  getBanFor,
  getBpExclusive,
  getRuleMode,
  hasBpBan,
  usedSelfPick,
} from './sessionRuntime';

// ===== 段2 Phase 1：select 屏透出 + 随机填满进 battle（不动 startSession/9 模式逻辑） =====

/** select 屏给 React 屏绑真身数据用的视图模型（0 改 JijieData 内部）。
 *  mode 从 __jjbDebug.select.mode 读（exposeSelectDebug 已写；startSession 不动）。 */
export interface SelectState {
  mode: SessionMode;
  playerName: string;
  status: number;
  modeIsRandom: boolean;
  modeIsVeryHard: boolean;
  modeIsVeryHard2: boolean;
  modeIsZhengjiu: boolean;
  modeIsOnePick: boolean;
  modeFeiqiu: boolean;
  modeSuiji: boolean;
  modeStd15: boolean;
  modeCm: boolean;
  modelFactorCount: number;
  mapList: string[];
  lockFactorList: string[];
  randomFactorPoor: string[];
  randomCommanderPoorA: string[];
  randomCommanderPoorB: string[];
  selectedFactorList: (string | null)[];
  selectedCommanderList: (string | null)[];
  manualSlots: [number, number, number];
  sumSlots: number;
  identityPass: boolean;
  jjbLive: boolean;
  selfPool: string[]; // 自选区真实全量池（ConfigData 全量 ban 后减已入 A/B 池；mode 门控）
  selfShow: boolean; // 是否显示自选区（拯救/随机/极难①/非酋 = false）
  ruleMode: 'practice' | 'match'; // 规则态（P1b）：practice 随意不限制 / match 违规提示不强拦
  bpExclusive: 'ban' | 'self' | 'conflict' | null; // 二选一互斥当前启用支（P2 done-when 4）
}

/** select 屏纯只读透出。React SelectScreen/HomeScreen 直接用本函数绑数据 + e2e 跑断言。
 *  startSession 内部零改：mode 字段从上次 exposeSelectDebug 残留读，无残留则回落 'std8'。 */
export function getSelectState(): SelectState {
  const d: any = JijieData;
  const slots: [number, number, number] = [manualSlots(0), manualSlots(1), manualSlots(2)];
  const sumSlots = slots[0] + slots[1] + slots[2];
  const poolLen = (d.randomFactorPoor || []).length;
  const w: any = (typeof window !== 'undefined' ? window : null);
  const lastMode = (w && w.__jjbDebug && w.__jjbDebug.select && w.__jjbDebug.select.mode) || 'std8';
  // 自选区真实全量池（镜像 JJBSelect.ts:373-394）：ConfigData.commanderList 全量(ban后) 减已入 A/B 池；
  // 拯救/随机/极难①/非酋 无自选区（selfShow=false）。
  const cmdInPool: Record<string, boolean> = {};
  (d.randomCommanderPoorA || []).forEach((c: string) => { if (c && c !== '自选') cmdInPool[c] = true; });
  (d.randomCommanderPoorB || []).forEach((c: string) => { if (c) cmdInPool[c] = true; });
  const selfShow = !d.modeSuiji && !d.modeCm && !d.modeIsZhengjiu && (!d.modeIsVeryHard || d.modeIsVeryHard2) && !d.modeFeiqiu;
  let selfPool: string[] = [];
  if (selfShow) {
    try {
      selfPool = ((ConfigData.commanderList as any[]) || [])
        .map((arr: any[]) => arr[0] as string)
        .filter((c: string) => c && !cmdInPool[c]);
    } catch (e) { selfPool = []; }
  }
  return {
    mode: lastMode,
    playerName: d.playerName || '',
    status: d.status || 0,
    modeIsRandom: !!d.modeIsRandom,
    modeIsVeryHard: !!d.modeIsVeryHard,
    modeIsVeryHard2: !!d.modeIsVeryHard2,
    modeIsZhengjiu: !!d.modeIsZhengjiu,
    modeIsOnePick: !!d.modeIsOnePick,
    modeFeiqiu: !!d.modeFeiqiu,
    modeSuiji: !!d.modeSuiji,
    modeStd15: !!d.modeStd15,
    modeCm: !!d.modeCm,
    modelFactorCount: d.modelFactorCount || 0,
    mapList: (d.mapList || []).slice(),
    lockFactorList: (d.lockFactorList || []).slice(),
    randomFactorPoor: (d.randomFactorPoor || []).slice(),
    randomCommanderPoorA: (d.randomCommanderPoorA || []).slice(),
    randomCommanderPoorB: (d.randomCommanderPoorB || []).slice(),
    selectedFactorList: ((d.selectedFactorList || []) as any[]).slice(),
    selectedCommanderList: ((d.selectedCommanderList || []) as any[]).slice(),
    manualSlots: slots,
    sumSlots,
    identityPass: poolLen === sumSlots, // 池=槽恒等式（std15/cm 已改双打不走本管线，无需豁免）
    jjbLive: jjbLive(),
    selfPool,
    selfShow,
    ruleMode: getRuleMode(),
    bpExclusive: getBpExclusive(),
  };
}

/** Phase 1 开始按钮入口：把当前 select 局的 selectedCommanderList/selectedFactorList
 *  随机填满（pool+cmdPool → 9 格）后切 status=3、调 exposeBattleDebug()，让 BattleScreen 直接渲染本局。
 *  不重开 toStart/toSelect；不破坏 9 模式开局；与 startRandomSession 的 9 格契约填充同语义，
 *  但只在「当前 select 局已开局（jjbLive）」时执行；非 jjbLive 时 noop。 */
export function randomFillAndStart(): void {
  const d: any = JijieData;
  if (!jjbLive()) return;
  clearBpRuntime(); // 随机填充=放弃 BP 手选 ban（防 ban+随机 死角；完整 ban×随机集成需「多揉因子」保池=槽，留完整 BP 轮）
  clearGoldRuntime(); // 同步重置点金（修跨局泄漏）
  sessionEngineCore.fillSelectionSlots(d);
  d.winLoseList = [];
  d.status = 3;
  exposeBattleDebug();
}

export function randomFillSelection(): void {
  const d: any = JijieData;
  if (!jjbLive()) return;
  clearBpRuntime(); // 随机填充=放弃 BP 手选 ban（同 randomFillAndStart；完整 ban×随机集成留完整 BP 轮）
  clearGoldRuntime(); // 同步重置点金（修跨局泄漏）
  sessionEngineCore.fillSelectionSlots(d);
  exposeSelectDebug(getSelectState().mode);
}

// ===== 段2 Phase 2：手选写回 + 校验三规则 + 手选进 battle =====
// 严格镜像真身 JJBSelect.fillTarget/clearTarget/validate（assets/Script/jjbDesign/JJBSelect.ts），
// 0 改 jijie2 / 0 改 9 模式开局逻辑；只新增对 JijieData.selectedCommanderList/selectedFactorList 的读写 + 校验。
// （ConfigData 已在文件顶部 import，此处不重复）

/** name → group（commadnerGroupList['B'].includes(name) 直查；A 池混入的 B 组也命中——commadnerGroupList
 *  按 commanderList 全量分组，与真身 groupMap 查表语义一致）。 */
function isGroupB(name: string): boolean {
  try {
    const g = (ConfigData.commadnerGroupList as any) || {};
    const arrB: string[] = g['B'] || [];
    return arrB.includes(name);
  } catch { return false; }
}

/** name → 是否 A 组（弱势组；对称 isGroupB，commadnerGroupList['A'] 查表，源指挥官配置.txt 第2列）。 */
function isGroupA(name: string): boolean {
  try {
    const g = (ConfigData.commadnerGroupList as any) || {};
    const arrA: string[] = g['A'] || [];
    return arrA.includes(name);
  } catch { return false; }
}

/** 标准单刷三模式（std8/std10/std12）：2A1B 自选指挥官约束仅在此三模式生效（定稿/done-when 3）。
 *  排除极难(modeIsVeryHard)/拯救(modeIsZhengjiu)/单指(modeIsOnePick)/非酋(modeFeiqiu)/随机(modeSuiji)——
 *  这些模式要么无自选区(selfShow=false)要么非标准单刷；双打不走本 validate（jjbDoubles 自管），无需在此排。 */
function isStdSolo(d: any): boolean {
  return !d.modeIsVeryHard && !d.modeIsZhengjiu && !d.modeIsOnePick && !d.modeFeiqiu && !d.modeSuiji
    && (d.modelFactorCount === 2 || d.modelFactorCount === 3 || d.modelFactorCount === 4);
}

/** 写第 slot 场指挥官（idx=0 唯一；后续若接双打可扩 2）。jjbLive=false 时静默 noop（不破坏数据接缝）。 */
export function setSelectedCmd(slot: number, name: string | null): void {
  const d: any = JijieData;
  if (!jjbLive()) return;
  if (!Array.isArray(d.selectedCommanderList)) d.selectedCommanderList = [null, null, null];
  if (slot < 0 || slot > 2) return;
  d.selectedCommanderList[slot] = name;
  // match 态二选一即时反馈：选了自选指挥官且已 ban 因子 → 提示二选一冲突（done-when 4，不强拦）。
  if (getRuleMode() === 'match' && name && hasBpBan() && usedSelfPick(d)) {
    exposeSelectWarn('禁因子与自选指挥官二选一：已启用禁因子，自选指挥官不可用（超出比赛规则）');
  }
}

/** 写第 slot 场第 k 槽因子（按 facFlatIdx(slot,k) 写扁平 9 格）。 */
export function setSelectedFac(slot: number, k: number, name: string | null): void {
  const d: any = JijieData;
  if (!jjbLive()) return;
  if (!Array.isArray(d.selectedFactorList)) d.selectedFactorList = new Array(9).fill(null);
  if (slot < 0 || slot > 2 || k < 0 || k > 2) return;
  if (name && getBanFor(name)) return; // BP: 被 ban 的因子不可落槽（手选拖入直接挡）
  d.selectedFactorList[facFlatIdx(slot, k)] = name;
}

/** 清第 slot 场指挥官（回填 null）。 */
export function clearCmdSlot(slot: number): void { setSelectedCmd(slot, null); }

/** 清第 slot 场第 k 槽因子。 */
export function clearFacSlot(slot: number, k: number): void { setSelectedFac(slot, k, null); }

/** 校验三规则（镜像真身 JJBSelect.validate）。
 *  ① 每场指挥官未选→err
 *  ② 按 manualSlots(i) 槽数逐格判因子未选→err（禁按 length/null 计数）
 *  ③ B 组指挥官 ≤1：仅 !modeIsOnePick && modelFactorCount > 2 生效；A 池混入的 B 组也计（commadnerGroupList['B'] 查表）
 *  返回 { ok, errors, firstError }：ok=true 校验通过；firstError 给 toast 用第一条。 */
export interface ValidationResult { ok: boolean; errors: string[]; firstError: string; warnings: string[]; firstWarning: string; }
export function validate(): ValidationResult {
  const d: any = JijieData;
  const errs: string[] = [];   // 硬错误：决定能否开局（两态 enforce）
  const warns: string[] = [];  // 软违规：仅 match 态计，违规但不强拦（startFromSelection 仍放行）
  const ruleMode = getRuleMode();
  if (!jjbLive()) {
    const m = '本局未开局（请先 home 选模式）';
    return { ok: false, errors: [m], firstError: m, warnings: [], firstWarning: '' };
  }
  const selCmd = (d.selectedCommanderList || []) as (string | null)[];
  const selFac = (d.selectedFactorList || []) as (string | null)[];
  // 硬错误①：每场指挥官必选
  for (let i = 0; i < 3; i++) {
    if (!selCmd[i]) errs.push('第' + (i + 1) + '场指挥官未选择');
  }
  // 硬错误②：每场因子槽必满（按 manualSlots 槽数逐格）。banned 落槽=软违规（match 态 warn，不阻断；practice 忽略）。
  for (let i = 0; i < 3; i++) {
    const cap = manualSlots(i);
    for (let k = 0; k < cap; k++) {
      const v = selFac[facFlatIdx(i, k)];
      if (!v) errs.push('第' + (i + 1) + '场因子' + (k + 1) + '未选择');
      else if (getBanFor(v) && ruleMode === 'match') warns.push('第' + (i + 1) + '场因子' + (k + 1) + '已被禁用（超出比赛规则）');
    }
  }
  // 软违规（仅 match 态）：自选指挥官 2A1B（单刷三模式 A≤2/B≤1）+ 二选一互斥（ban 因子 ⊕ 自选指挥官）。
  if (ruleMode === 'match') {
    // 2A1B：单刷三模式（std8/std10/std12）锁 A 弱势组累计≤2、B 强力组≤1（done-when 3；A 池混入的 B 组也按 B 计）。
    if (isStdSolo(d)) {
      let a = 0, b = 0;
      for (let i = 0; i < 3; i++) {
        const c = selCmd[i];
        if (!c) continue;
        if (isGroupB(c)) b++;
        else if (isGroupA(c)) a++;
      }
      if (a > 2) warns.push('A组指挥官最多 2 个（超出比赛规则）');
      if (b > 1) warns.push('B组指挥官最多 1 个（超出比赛规则）');
    }
    // 二选一互斥：同一局 ban 因子与自选指挥官择一启用（done-when 4，违规不强拦）。
    if (hasBpBan() && usedSelfPick(d)) {
      warns.push('禁因子与自选指挥官二选一（超出比赛规则）');
    }
  }
  return { ok: errs.length === 0, errors: errs, firstError: errs[0] || '', warnings: warns, firstWarning: warns[0] || '' };
}

/** 手选进 battle：校验通过→保留 selected*、status=3、exposeBattleDebug。
 *  校验失败→no-op（让 UI 走 toast 路径）。
 *  替换 Phase 1 的 randomFillAndStart（用户手选而非随机）。 */
export function startFromSelection(): ValidationResult {
  const r = validate();
  if (!r.ok) {
    exposeSelectError(r.firstError, r.errors.length);
    return r;
  }
  // 硬错误通过即放行：match 态软违规(warnings)只提示不强拦（练习态 warnings 恒空）。
  if (r.warnings.length > 0) exposeSelectWarn(r.firstWarning); else clearSelectWarn();
  const d: any = JijieData;
  d.winLoseList = [];
  d.status = 3;
  exposeBattleDebug();
  return r;
}
