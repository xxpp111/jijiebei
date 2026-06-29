// 每模式 BP 开关配置（R3 ⑥「每模式 BP 开关配置面」逻辑层）。
// 三态：on(默认开·可配) / offable(默认关·可手动开) / locked(锁死不可点)。
// R3 口径：8/10 因子默认开；极难(12)/拯救/非酋 默认关但可手动开；双打(官突plus) BP 暂未启用→锁死。
// 仅管「哪些模式启用 BP 阶段」；BP 内的 ban 因子操作见 jjbSession.bpBanRuntime。

export type BpModeState = 'on' | 'offable' | 'locked';

interface BpModeDef {
  enabledDefault: boolean;
  locked: boolean; // true=不可 toggle（双打：BP 暂未启用）
}

// key 对齐 HomeScreen MODES / SessionMode
const BP_MODE_DEFS: Record<string, BpModeDef> = {
  std8: { enabledDefault: true, locked: false },
  std10: { enabledDefault: true, locked: false },
  std12: { enabledDefault: false, locked: false }, // 极难：默认关但可手动开
  rescue: { enabledDefault: false, locked: false },
  feiqiu: { enabledDefault: false, locked: false },
  doubles: { enabledDefault: false, locked: true }, // 官突双打：BP 暂未启用，锁死
  'feiqiu-doubles': { enabledDefault: false, locked: true }, // 非酋双打：BP 暂未启用，锁死（对齐 doubles；P0-1 遗留显式键，不再走 fallback）
};

// 运行时覆盖（配置面 toggle 的结果；未覆盖则取默认）
const bpModeOverride = new Map<string, boolean>();

/** 该模式当前是否启用 BP 阶段。 */
export function getBpModeEnabled(mode: string): boolean {
  if (bpModeOverride.has(mode)) return bpModeOverride.get(mode)!;
  return BP_MODE_DEFS[mode]?.enabledDefault ?? false;
}

/** 该模式 BP 开关是否锁死（不可配）。 */
export function isBpModeLocked(mode: string): boolean {
  return BP_MODE_DEFS[mode]?.locked ?? false;
}

/** 配置面展示态：on(开) / offable(关·可手动开) / locked(锁死)。 */
export function getBpModeState(mode: string): BpModeState {
  if (isBpModeLocked(mode)) return 'locked';
  return getBpModeEnabled(mode) ? 'on' : 'offable';
}

/** toggle 某模式 BP 启用（locked 模式 no-op）。 */
export function toggleBpMode(mode: string): void {
  if (isBpModeLocked(mode)) return;
  bpModeOverride.set(mode, !getBpModeEnabled(mode));
}
