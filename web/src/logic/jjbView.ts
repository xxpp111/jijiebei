import {
  difficultyTotal,
  getScore,
  getSelectState,
  getSessionMatches,
  getTotalCount,
  matchDifficulty,
  querySessionMode,
  setVerdict,
  startSession,
  type SessionMode,
} from './jjbSession';
import {
  doublesLive,
  doublesMatches,
  doublesModeLabel,
  doublesScore,
  getDoublesState,
  setDoublesVerdict,
  type MatchVM,
} from './jjbDoubles';
import { getEnemyRoll } from './aiEnemySelector';
import type { RaceCode } from '../data/aiEnemyPool';
import { MODE_DEFS } from '../config/modes';

export type Verdict = 'win' | 'bonus' | 'lose';
export type CurrentMatch = MatchVM & { mutators?: string[] };

export function currentIsDoubles(): boolean {
  return doublesLive();
}

export function currentMatches(): CurrentMatch[] {
  return (doublesLive() ? doublesMatches() : getSessionMatches()) as CurrentMatch[];
}

export function currentScore(): number {
  return doublesLive() ? doublesScore() : getScore();
}

/** 判定完成场数；结算门控用，不等同于 matches.length。 */
export function currentTotal(): number {
  return doublesLive() ? getDoublesState().totalCount : getTotalCount();
}

export function currentDifficulty(matchIdx: number): number | undefined {
  return doublesLive() ? undefined : matchDifficulty(matchIdx as 0 | 1 | 2);
}

export function currentDifficultyTotal(): number | undefined {
  return doublesLive() ? undefined : difficultyTotal();
}

export function currentLockedFactors(match: CurrentMatch): string[] | undefined {
  return doublesLive() ? match.mutators : undefined;
}

export function currentPlayerName(): string {
  return doublesLive() ? '双打战队' : (getSelectState().playerName || '集结杯选手');
}

export function currentSessionMode(): SessionMode {
  if (doublesLive()) {
    const v = getDoublesState().config.variant;
    if (v === 'feiqiu') return 'feiqiu-doubles';
    if (v === 'guantu') return 'doubles';
    return v; // std15/cm：variant 与 SessionMode 同名字面量（Batch C 双打化）
  }
  return getSelectState().mode;
}

/** 双打锁定因子角标文案：非酋之轮=「非酋」/ 官突双打=「官突」/ cm=「锁定」（与单打锁定角标同文案）
 *  （select/battle/obs/result 四屏统一）。std15 无锁定因子，角标不渲染，返回值不生效。 */
export function currentLockTag(): string {
  if (!doublesLive()) return '官突';
  const v = getDoublesState().config.variant;
  if (v === 'feiqiu') return '非酋';
  if (v === 'cm') return '锁定';
  return '官突';
}

export function currentModeLabel(): string {
  if (doublesLive()) return doublesModeLabel();
  // 逐模式 label 收敛进 config/modes.ts 的 MODE_DEFS（文案与旧 flag 派生逐字节等价）。
  // 非双打分支的 mode 只会是 11 个单打 key（doubles/feiqiu-doubles 走上面 doublesLive 早返），均有 label。
  return MODE_DEFS[currentSessionMode()]?.label ?? '';
}

export function setCurrentVerdict(matchIdx: number, verdict: Verdict): void {
  if (doublesLive()) setDoublesVerdict(matchIdx, verdict);
  else setVerdict(matchIdx, verdict);
}

/** 随机敌方：当前第 i 场敌方种族（开关 ON 时有值，单打/双打统一，不分流）；OFF→undefined 不显示。 */
export function currentEnemyRace(matchIdx: number): RaceCode | undefined {
  return getEnemyRoll(matchIdx)?.race;
}

/** 随机敌方：当前第 i 场敌方 AI 敌军组合中文名；OFF→undefined。 */
export function currentEnemyAi(matchIdx: number): string | undefined {
  return getEnemyRoll(matchIdx)?.nameZh;
}

/** Reload/deep-link guard: preserve doubles when the URL says this is a doubles session. */
export function ensureDoublesSessionFromUrl(): boolean {
  if (doublesLive()) return true;
  const sm = querySessionMode();
  if (sm !== 'doubles' && sm !== 'feiqiu-doubles' && sm !== 'std15' && sm !== 'cm') return false;
  startSession(sm);
  return true;
}
