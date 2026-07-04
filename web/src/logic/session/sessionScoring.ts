import JijieData from '../legacy/JijieData';
import { facFlatIdx, manualSlots } from '../legacy/JJBData';
import { FACTORS } from '../../config/factors';
import type { SingleSnapshot } from '../codec';
import { getGoldFor, setRuleMode } from './sessionRuntime';
import { exposeSelectDebug } from './sessionDebug';

// ===== 段3④：难度总分（锁定因子 + 手选因子求和；点金因子分值×2） =====
// 分值真相 = config/factors.ts points（docs/因子点数配置.csv 经 gen-config 生成，71 条全表）。Batch5 cutover：
//   从 legacy ConfigData.factorList_back(因子配置.txt 41 条不全 + 6 个填 0 + 虚空重生者 2 列缺值) + FACTOR_SCORE_FALLBACKS
//   切到 config 单一真相源，消数值分叉 + 补 13 个漏算因子(因子配置.txt 缺行 → 现算 0)。
//   yb 2026-06-30 拍板：虚空重生者按官方 5；混乱工作室 / 礼尚往来(非酋模式恒锁/可分配)CSV「限定」→ 7。
const FACTOR_POINTS: Record<string, number> = Object.fromEntries(FACTORS.map((f) => [f.name, f.points]));

/** 单因子分值 = config/factors.ts points（单一真相源，Batch5 cutover）。
 *  name 为空 → 0；config 未登记 → 0 + warning（避免 typo 被静默记成高分）。 */
export function factorScore(name: string): number {
  if (!name) return 0;
  if (Object.prototype.hasOwnProperty.call(FACTOR_POINTS, name)) return FACTOR_POINTS[name];
  // eslint-disable-next-line no-console
  console.warn('[difficultyTotal] 未找到合法因子分值:', name, 'missing in config/factors.ts');
  return 0;
}

function weightedFactorScore(name: string | null | undefined): number {
  if (!name) return 0;
  return factorScore(name) * (getGoldFor(name) ? 2 : 1);
}

/** 单场难度分：该场锁定因子 + 该场实际手选槽位因子；点金因子分值 ×2 计入。 */
export function matchDifficulty(slot: 0 | 1 | 2): number {
  const d: any = JijieData;
  let sum = 0;
  const lock = ((d.lockFactorList || []) as (string | null)[])[slot];
  sum += weightedFactorScore(lock);

  const selected = (d.selectedFactorList || []) as (string | null)[];
  const slots = manualSlots(slot);
  for (let k = 0; k < slots; k++) {
    sum += weightedFactorScore(selected[facFlatIdx(slot, k)]);
  }
  return sum;
}

/** 难度总分：三场 matchDifficulty 之和，即锁定因子 + 实际手选槽位因子分值之和；
 *  点金因子(getGoldFor 判定：GOLD_FACTORS ∪ 运行时点金)该因子分值 ×2 计入。
 *  锁定与手选互不重叠（锁定单独渲染，不在 9 格手选槽内），故直接相加。 */
export function difficultyTotal(): number {
  return matchDifficulty(0) + matchDifficulty(1) + matchDifficulty(2);
}

// ===== 段3 结算/浮窗记分透出（镜像 JJBResult 的 winCount/winbCount/totalCount 语义） =====
/** 已判定场数（winLoseList 含 0/1/2）；结算门控 total>=3 用。 */
export function getTotalCount(): number {
  const d: any = JijieData;
  return (d.winLoseList || []).filter((v: number) => v === 0 || v === 1 || v === 2).length;
}
/** winLoseList 快照（Overlay/结算屏读）。 */
export function getWinLoseList(): number[] {
  const d: any = JijieData;
  return (d.winLoseList || []).slice();
}

/** 从 SingleSnapshot 还原 JijieData select 态（按此码开局），直写数据字段，不改引擎逻辑（Cocos 红线）。 */
export function applySelectState(snap: SingleSnapshot): void {
  const d: any = JijieData;
  d.status = 2;
  d.mapList = snap.maps.slice();
  d.lockFactorList = snap.locks.slice();
  d.randomFactorPoor = snap.pool
    .map((idx) => (idx >= 0 && idx < FACTORS.length ? FACTORS[idx].name : null))
    .filter((n): n is string => n !== null);
  d.randomCommanderPoorA = snap.cmdA.slice();
  d.randomCommanderPoorB = snap.cmdB.slice();
  d.selectedCommanderList = snap.selCmd.slice();
  d.selectedFactorList = snap.selFac.map((idx) => (idx < 0 || idx >= FACTORS.length ? null : FACTORS[idx].name));
  d.winLoseList = snap.wl.slice();
  d.modeIsRandom = snap.flags.rand;
  d.modeIsVeryHard = snap.flags.vh;
  d.modeIsVeryHard2 = snap.flags.vh2;
  d.modeIsZhengjiu = snap.flags.zj;
  d.modeIsOnePick = snap.flags.op;
  d.modeFeiqiu = snap.flags.fq;
  d.modeSuiji = snap.flags.sj;
  d.modeStd15 = snap.flags.s15;
  d.modeCm = snap.flags.cm;
  d.modelFactorCount = snap.mfc;
  setRuleMode(snap.rm);
  exposeSelectDebug(snap.mode);
}
