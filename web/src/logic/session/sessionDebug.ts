import JijieData from '../legacy/JijieData';
import { manualSlots, sessionMatches } from '../legacy/JJBData';
import type { SessionMode } from './sessionConfig';

/** 暴露 __jjbDebug.select 给 e2e 读恒等式断言。 */
export function exposeSelectDebug(mode: SessionMode): void {
  try {
    const d: any = JijieData;
    const slots = [manualSlots(0), manualSlots(1), manualSlots(2)];
    const sumSlots = slots[0] + slots[1] + slots[2];
    const poolLen = (d.randomFactorPoor || []).length;
    const selFacLen = (d.selectedFactorList || []).length;
    const selCmd = (d.selectedCommanderList || []).slice();
    const identityPass = poolLen === sumSlots; // 池=槽恒等式（std15/cm 已改双打不走本管线，无需豁免）
    const w: any = window;
    w.__jjbDebug = w.__jjbDebug || {};
    w.__jjbDebug.screen = 'select';
    w.__jjbDebug.select = {
      mode,
      modeIsRandom: !!d.modeIsRandom,
      modeIsVeryHard: !!d.modeIsVeryHard,
      modeIsVeryHard2: !!d.modeIsVeryHard2,
      modeIsZhengjiu: !!d.modeIsZhengjiu,
      modeIsOnePick: !!d.modeIsOnePick,
      modeFeiqiu: !!d.modeFeiqiu,
      modeSuiji: !!d.modeSuiji,
      modeStd15: !!d.modeStd15,
      modeCm: !!d.modeCm,
      modelFactorCount: d.modelFactorCount,
      status: d.status,
      mapCount: (d.mapList || []).length,
      lockCount: (d.lockFactorList || []).length,
      mapList: (d.mapList || []).slice(),
      lockFactorList: (d.lockFactorList || []).slice(),
      randomFactorPoorLen: poolLen,
      randomCommanderPoorALen: (d.randomCommanderPoorA || []).length,
      randomCommanderPoorBLen: (d.randomCommanderPoorB || []).length,
      manualSlots: slots,
      sumSlots,
      selectedFactorListLen: selFacLen,
      selectedFactorList: (d.selectedFactorList || []).slice(),
      selectedCommanderList: selCmd,
      identityPass,
    };
  } catch (e) {
    /* noop */
  }
}

/** __jjbDebug 同形透出（4 套 Playwright 回归读它；battle 子对象含 matches+score）。 */
export function exposeBattleDebug(): void {
  try {
    const d: any = JijieData;
    let score = 0;
    for (const v of d.winLoseList || []) if (v === 1 || v === 2) score++;
    const w: any = window;
    w.__jjbDebug = w.__jjbDebug || {};
    w.__jjbDebug.screen = 'battle';
    w.__jjbDebug.player = d.playerName;
    w.__jjbDebug.factorCount = d.modelFactorCount;
    w.__jjbDebug.status = d.status;
    w.__jjbDebug.modeIsRandom = d.modeIsRandom;
    w.__jjbDebug.maps = (d.mapList || []).slice();
    w.__jjbDebug.lockFactors = (d.lockFactorList || []).slice();
    w.__jjbDebug.selectedCommanderList = (d.selectedCommanderList || []).slice();
    w.__jjbDebug.selectedFactorList = (d.selectedFactorList || []).slice();
    w.__jjbDebug.winLoseList = (d.winLoseList || []).slice();
    w.__jjbDebug.battle = { matches: sessionMatches(), score };
  } catch (e) {
    /* noop */
  }
}

/** OBS 横条 debug 同形透出（e2e 回归读 __jjbDebug.obsbar；screen 覆盖为 obsbar）。
 *  须在 startRandomSession（内部写 screen=battle）之后调用，以覆盖 screen 为 obsbar。 */
export function exposeObsbarDebug(rows: unknown[], wins: number, total: number): void {
  try {
    const w: any = window;
    w.__jjbDebug = w.__jjbDebug || {};
    w.__jjbDebug.screen = 'obsbar';
    w.__jjbDebug.obsbar = { matches: sessionMatches(), wins, total, rows };
  } catch (e) {
    /* noop */
  }
}

/** 校验失败时把错误写到 __jjbDebug.select.error（真身 updateDebug 同样字段语义），并保留错误条数。 */
export function exposeSelectError(msg: string, count: number): void {
  try {
    const w: any = window;
    w.__jjbDebug = w.__jjbDebug || {};
    w.__jjbDebug.select = w.__jjbDebug.select || {};
    w.__jjbDebug.select.error = msg;
    w.__jjbDebug.select.errorCount = count;
  } catch { /* noop */ }
}

/** 软违规提示（P1b match 态 BP 规则违规：超 ban 上限 / 2A1B 超额 / 二选一冲突）写 __jjbDebug.select.warn，非阻断。 */
export function exposeSelectWarn(msg: string): void {
  try {
    const w: any = window;
    w.__jjbDebug = w.__jjbDebug || {};
    w.__jjbDebug.select = w.__jjbDebug.select || {};
    w.__jjbDebug.select.warn = msg;
  } catch { /* noop */ }
}

/** 清软违规提示（解除 ban / 重新校验通过时调）。 */
export function clearSelectWarn(): void {
  try {
    const w: any = window;
    if (w.__jjbDebug && w.__jjbDebug.select) w.__jjbDebug.select.warn = '';
  } catch { /* noop */ }
}

/** 读当前软违规提示（SelectScreen toggleBan 后取来 setToast）。 */
export function getSelectWarn(): string {
  try {
    const w: any = window;
    return (w.__jjbDebug && w.__jjbDebug.select && w.__jjbDebug.select.warn) || '';
  } catch { return ''; }
}
