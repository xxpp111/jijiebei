// jjbDoubles — React 薄适配层：桥接 jjbDesign/JJBDoubles 独立双打引擎到 React 屏。
// 接通非重写：引擎本体（@jjb/JJBDoubles，213 行）零改；本层只做「只读快照 + 槽位写入转发 + verdict 映射」。
// 隔离红线天然满足：引擎自管池/槽/洗牌/计分，不读写 JijieData / XP；调试镜像走引擎自身 window.__jjbDebug.doubles。
import JJBDoubles, { doublesLive, doublesMatches, doublesModeLabel } from '@jjb/JJBDoubles';
import { RESULT_VAL, type MatchVM } from '@jjb/JJBData';

export { doublesLive, doublesMatches, doublesModeLabel };
export type { MatchVM };

export interface DoublesConfig {
  matches: number;
  cmdsPerMatch: number;
  extraFactors: number;
  mutators: string[];
  maps: string[];
  factorPoolSize: number;
  cmdPoolSize: number;
}
export interface DoublesSlotSel { cmds: (string | null)[]; factors: (string | null)[] }
export interface DoublesState {
  live: boolean;
  config: DoublesConfig;
  factorPool: string[];
  commanderPool: string[];
  selection: { slots: DoublesSlotSel[] };
  winLoseList: number[];
  winCount: number;
  winbCount: number;
  totalCount: number;
}

/** 只读快照（screens 渲染用，直接取引擎 debugSnapshot：config/池/selection/winLose/计数）。 */
export function getDoublesState(): DoublesState {
  return JJBDoubles.debugSnapshot() as DoublesState;
}

// ===== 槽位写入转发（引擎自校验 slot/idx 边界） =====
export function setDoublesCmd(slot: number, idx: number, name: string): void { JJBDoubles.setCommander(slot, idx, name); }
export function clearDoublesCmd(slot: number, idx: number): void { JJBDoubles.clearCommander(slot, idx); }
export function setDoublesFac(slot: number, idx: number, name: string): void { JJBDoubles.setFactor(slot, idx, name); }
export function clearDoublesFac(slot: number, idx: number): void { JJBDoubles.clearFactor(slot, idx); }

/** verdict 写入：win/bonus/lose → 0/1/2（RESULT_VAL，对齐单打 setVerdict 语义）。 */
export function setDoublesVerdict(slot: number, verdict: 'win' | 'bonus' | 'lose'): void {
  JJBDoubles.setVerdict(slot, RESULT_VAL[verdict]);
}

/** 获胜场数（win+bonus，镜像单打 getScore）。 */
export function doublesScore(): number { return JJBDoubles.winCount(); }

/** 校验：每场需满 cmdsPerMatch 指挥官 + extraFactors 随机因子。返回首错与全部错误。 */
export function validateDoubles(): { ok: boolean; firstError: string; errors: string[] } {
  const st = getDoublesState();
  const errors: string[] = [];
  (st.selection.slots || []).forEach((s, i) => {
    const cmdFilled = (s.cmds || []).filter(Boolean).length;
    const facFilled = (s.factors || []).filter(Boolean).length;
    if (cmdFilled < st.config.cmdsPerMatch) errors.push(`第 ${i + 1} 场指挥官未满（${cmdFilled}/${st.config.cmdsPerMatch}）`);
    if (facFilled < st.config.extraFactors) errors.push(`第 ${i + 1} 场随机因子未满（${facFilled}/${st.config.extraFactors}）`);
  });
  return { ok: errors.length === 0, firstError: errors[0] || '', errors };
}

/** 随机填充：commanderPool/factorPool 按序铺满每场（池=槽恒等式：cmdPool=matches×cmdsPerMatch，facPool=matches×extraFactors）。 */
export function randomFillDoubles(): void {
  const st = getDoublesState();
  const { matches, cmdsPerMatch, extraFactors } = st.config;
  let ci = 0;
  let fi = 0;
  for (let slot = 0; slot < matches; slot++) {
    for (let k = 0; k < cmdsPerMatch; k++) {
      const name = st.commanderPool[ci++];
      if (name) setDoublesCmd(slot, k, name);
    }
    for (let k = 0; k < extraFactors; k++) {
      const name = st.factorPool[fi++];
      if (name) setDoublesFac(slot, k, name);
    }
  }
}
