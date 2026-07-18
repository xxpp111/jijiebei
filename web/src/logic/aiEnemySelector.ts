// 「随机敌方」引擎：开关 ON 时，每场对局直接从 19 池等概率抽 1 个 AI，种族随之而定（yb 确认
// "直接随 AI 其实种族就定了"）。per-match 状态层，单打/双打统一——不侵入各自引擎状态，
// 在 jjbSession.toStartCore / jjbDoubles.doublesStart 末尾触发一次。

import { AI_ENEMY_POOL, type RaceCode } from '../data/aiEnemyPool';
import { getRandomEnemyEnabled } from './randomConfig';

export interface EnemyRoll {
  id: string;
  race: RaceCode;
  nameZh: string;
  potatoFriend?: boolean;
}

const POTATO_AI_ID = 'T_MechClassic';
const POTATO_DIRECT_RATE = 0.75;
const potatoAi = AI_ENEMY_POOL.find((ai) => ai.id === POTATO_AI_ID);
if (!potatoAi) throw new Error('[aiEnemySelector] missing T_MechClassic');

let _rolls: EnemyRoll[] = [];

export function shouldUsePotatoBias(accountFlag: unknown, playerNames: readonly string[]): boolean {
  return accountFlag === true || playerNames.some((name) => (name || '').includes('土豆'));
}

function toRoll(ai: (typeof AI_ENEMY_POOL)[number], potatoBiasActive: boolean): EnemyRoll {
  return {
    id: ai.id,
    race: ai.race,
    nameZh: ai.nameZh,
    potatoFriend: potatoBiasActive && ai.id === POTATO_AI_ID || undefined,
  };
}

function rollOne(rng: () => number, potatoBiasActive: boolean): EnemyRoll {
  if (potatoBiasActive && rng() < POTATO_DIRECT_RATE) return toRoll(potatoAi, true);
  const ai = AI_ENEMY_POOL[Math.floor(rng() * AI_ENEMY_POOL.length)];
  return toRoll(ai, potatoBiasActive);
}

/** 一局开始时生成每场敌方（开关关则清空）。单打 3 场 / 双打 3 场都调，每场独立 roll。 */
export function rollEnemiesForSession(matchCount: number, rng = Math.random, potatoBiasActive = false): void {
  _rolls = getRandomEnemyEnabled() ? Array.from({ length: matchCount }, () => rollOne(rng, potatoBiasActive)) : [];
}

/** 读第 i 场敌方；undefined = 不显示。gate 开关 _enabled：关则一律 undefined（即使 _rolls 残留），
 *  防 bpconfig 等路径未清 _rolls 导致「开关关了印花还在」。门面 currentEnemyRace/Ai 走这里。 */
export function getEnemyRoll(i: number): EnemyRoll | undefined {
  return getRandomEnemyEnabled() ? _rolls[i] : undefined;
}

/** 清空（双打 reset 时调，避免残留旧 roll）。 */
export function clearEnemyRolls(): void {
  _rolls = [];
}
