// eventBan.ts — 赛事 ban 共享状态机。
//
// 主播每周线上配赛事 ban（地图/候选因子/双打官突），下一局生效，对单打+双打三引擎统一生效。
// loadEventBan 在开局时调用（从 /api/event-rules 拉到 ruleset 后），不进 per-game snapshot。
//
// 豁免（硬要求）：非酋固定因子（混乱工作室/礼尚往来/风暴英雄/虚空裂隙）+ 拯救固定7人
//   不受 event ban 影响；ban 只作用随机抽取部分，不动 XP 锁定项。
//   具体豁免由调用方（jjbSession.ts / jjbDoubles.ts）负责；本模块只提供 getter。
import { MUTATOR_POOL } from '../data/mutatorPool';
import { getEventRules } from './backend';

// ---------- 内部状态 ----------
let _banMaps: Set<string> = new Set();
let _banFactors: Set<string> = new Set();
let _banMutators: Set<string> = new Set();

// ---------- 公开 API ----------

/**
 * 加载赛事 ban 规则（开局前调用，从 /api/event-rules 快照读取）。
 * 空 ruleset 或不传 → 清空（无 ban 状态）。
 */
export function loadEventBan(ruleset?: {
  ban_maps: string[];
  ban_factors: string[];
  ban_mutators: string[];
}): void {
  _banMaps = new Set(ruleset?.ban_maps ?? []);
  _banFactors = new Set(ruleset?.ban_factors ?? []);
  _banMutators = new Set(ruleset?.ban_mutators ?? []);
}

export function getBanMaps(): Set<string> {
  return _banMaps;
}

export function getBanFactors(): Set<string> {
  return _banFactors;
}

export function getBanMutators(): Set<string> {
  return _banMutators;
}

/**
 * 返回官突池中包含 factorName 的官突数量。
 * 用于 UI chip 下方「双打命中 N」显示（N=0 灰提示，说明 ban 该因子对双打联动空转）。
 * 此计数静态，与当前 ban 状态无关。
 */
export function getMutatorHitCount(factorName: string): number {
  let count = 0;
  for (const tier of ['A', 'B', 'C'] as const) {
    for (const entry of MUTATOR_POOL[tier]) {
      if (entry.factors.includes(factorName)) {
        count++;
      }
    }
  }
  return count;
}

/**
 * App 启动调用：从 /api/event-rules 拉当前赛事 ruleset → loadEventBan，让三引擎开局时拿到 ban。
 * 后端不可达 / 无 active 行 → 无 ban、不阻断开局（静默）。生效下一局：开局读已 load 的 Set 快照。
 */
export async function fetchAndLoadEventBan(): Promise<void> {
  const d = await getEventRules(); // 与 EventRulesScreen 共用 backend.getEventRules（去重 GET /api/event-rules + 不可达兜底）
  if (!d) return; // 后端不可达 / 无 active 行 → 无 ban，不阻断开局
  loadEventBan({ ban_maps: d.ban_maps ?? [], ban_factors: d.ban_factors ?? [], ban_mutators: d.ban_mutators ?? [] });
}
