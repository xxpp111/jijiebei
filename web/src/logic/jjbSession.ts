// jjbSession — React↔XP 接缝 barrel。
// 红线：jijie2 / data 零改，仅 import 调用。实现按职责拆到 web/src/logic/session/*。
export { jjbLive, querySessionMode } from './session/sessionConfig';
export type { SessionMode } from './session/sessionConfig';
export { clearSelectWarn, exposeBattleDebug, exposeObsbarDebug, exposeSelectDebug, exposeSelectError, exposeSelectWarn, getSelectWarn } from './session/sessionDebug';
export { startSession } from './session/sessionEngine';
export {
  clearBpRuntime,
  clearGoldRuntime,
  clearRerollRuntime,
  getBanFor,
  getBpExclusive,
  getBpState,
  getGoldFor,
  getRerollState,
  getRuleMode,
  getScore,
  getSessionMatches,
  rerollFactor,
  setRuleMode,
  setVerdict,
  startRandomSession,
  toggleBanFactor,
  toggleGold,
} from './session/sessionRuntime';
export {
  clearCmdSlot,
  clearFacSlot,
  getSelectState,
  randomFillAndStart,
  randomFillSelection,
  setSelectedCmd,
  setSelectedFac,
  startFromSelection,
  validate,
} from './session/sessionSelection';
export type { SelectState, ValidationResult } from './session/sessionSelection';
export { applySelectState, difficultyTotal, factorScore, getTotalCount, getWinLoseList, matchDifficulty } from './session/sessionScoring';
