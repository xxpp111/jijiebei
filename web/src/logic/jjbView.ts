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
  if (doublesLive()) return getDoublesState().config.variant === 'feiqiu' ? 'feiqiu-doubles' : 'doubles';
  return getSelectState().mode;
}

/** 双打锁定因子角标文案：非酋之轮=「非酋」/ 官突双打=「官突」（select/battle/obs/result 四屏统一）。 */
export function currentLockTag(): string {
  return doublesLive() && getDoublesState().config.variant === 'feiqiu' ? '非酋' : '官突';
}

export function currentModeLabel(): string {
  if (doublesLive()) return doublesModeLabel();
  const s = getSelectState();
  if (s.modelFactorCount === 4) return '极难模式';
  const fc = s.modelFactorCount === 0 ? '随机'
    : s.modelFactorCount === 2 ? '8 因子'
    : s.modelFactorCount === 3 ? '10 因子'
    : `${s.modelFactorCount} 因子`;
  const ml = s.modeIsZhengjiu ? '拯救'
    : s.modeIsOnePick ? '单指'
    : s.modeIsVeryHard2 || s.modeIsVeryHard ? '极难'
    : s.modeFeiqiu ? '非酋'
    : s.modeSuiji ? '随机'
    : '手选';
  return `${fc} · ${ml}`;
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
  if (sm !== 'doubles' && sm !== 'feiqiu-doubles') return false;
  startSession(sm);
  return true;
}
