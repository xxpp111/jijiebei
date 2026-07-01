// 每模式 BP 开关配置（R3 ⑥「每模式 BP 开关配置面」逻辑层）。
// 三态：on(默认开·可配) / offable(默认关·可手动开) / locked(锁死不可点)。
// R3 口径：8/10 因子默认开；极难(12)/拯救/非酋 默认关但可手动开；双打(官突plus) BP 暂未启用→锁死。
// 仅管「哪些模式启用 BP 阶段」；BP 内的 ban 因子操作见 jjbSession.bpBanRuntime。

import { MODE_DEFS } from '../config/modes';

export type BpModeState = 'on' | 'offable' | 'locked';

// BP 默认态/锁死态收敛进 config/modes.ts 的 MODE_DEFS（bpDefault=旧 enabledDefault / bpLocked=旧 locked）；
// 语义完全等价：未声明的 key（one-a/hard1/hard2/suiji）仍走 ?? false 兜底。

// 运行时覆盖（配置面 toggle 的结果；未覆盖则取默认）
const bpModeOverride = new Map<string, boolean>();

/** 该模式当前是否启用 BP 阶段。 */
export function getBpModeEnabled(mode: string): boolean {
  if (bpModeOverride.has(mode)) return bpModeOverride.get(mode)!;
  return MODE_DEFS[mode]?.bpDefault ?? false;
}

/** 该模式 BP 开关是否锁死（不可配）。 */
export function isBpModeLocked(mode: string): boolean {
  return MODE_DEFS[mode]?.bpLocked ?? false;
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
