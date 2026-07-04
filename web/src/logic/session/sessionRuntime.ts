import JijieData from '../legacy/JijieData';
import ConfigData from '../legacy/JJConfigData';
import { facFlatIdx, sessionMatches, RESULT_VAL, GOLD_FACTORS, type MatchVM } from '../legacy/JJBData';
import { jjbLive, restoreConfig } from './sessionConfig';
import { clearSelectWarn, exposeBattleDebug, exposeSelectWarn } from './sessionDebug';
import { sessionEngineCore } from './sessionEngine';

// ===== 旧版 Battle 屏接缝（startRandomSession）—— 段1 PoC 兼容 =====
/** 一局随机开局（复刻 onClick{2,3,13} + toStart + startRandom 9 格填充）。modelFactorCount: 2=8因子/3=10/4=12。 */
export function startRandomSession(modelFactorCount = 2): void {
  restoreConfig();
  const d: any = JijieData;
  d.initStart();
  d.reset();
  d.modeIsVeryHard = false;
  d.modeIsOnePick = false;
  d.modeIsLanzi = false;
  d.modeSuiji = false;
  d.modeFeiqiu = false;
  d.modeIsZhengjiu = false;
  d.modelFactorCount = modelFactorCount;
  d.playerName = 'PoC 选手';
  d.modeIsRandom = false;
  sessionEngineCore.toStartCore();
  d.modeIsRandom = true;
  if ((JijieData as any).status < 2) sessionEngineCore.toSelectCore();
  // startRandom 9 格契约填充（JJBDesignBoot.startRandom）
  sessionEngineCore.fillSelectionSlots(d);
  d.winLoseList = [];
  d.status = 3;
  exposeBattleDebug();
}

export function getSessionMatches(): MatchVM[] {
  return sessionMatches();
}

/** 写判定 + 重算记分（winLoseList[i]=0失败/1胜利/2带奖励；win+bonus 计获胜场，对齐 jjbDesign 语义）。 */
export function setVerdict(matchIdx: number, verdict: 'win' | 'bonus' | 'lose'): void {
  const d: any = JijieData;
  if (!Array.isArray(d.winLoseList)) d.winLoseList = [];
  d.winLoseList[matchIdx] = RESULT_VAL[verdict];
  exposeBattleDebug();
}

export function getScore(): number {
  const d: any = JijieData;
  let win = 0;
  for (const v of d.winLoseList || []) if (v === 1 || v === 2) win++;
  return win;
}

// ===== 段3 点金（select 屏运行时 toggle 因子金/非金）=====
// 单打：金因子分值 ×2 计入难度分（weightedFactorScore）；双打：纯视觉态，不接计分引擎。
const goldRuntime = new Set<string>();

/** toggle 某因子的运行时点金态（点金 / 取消金）。 */
export function toggleGold(name: string): void {
  if (!name) return;
  if (goldRuntime.has(name)) goldRuntime.delete(name);
  else goldRuntime.add(name);
}

/** 因子最终金态 = 后端 GOLD_FACTORS 名单 ∪ 运行时点金（拖进槽/池内渲染金框依据）。 */
export function getGoldFor(name: string): boolean {
  return !!name && (GOLD_FACTORS.includes(name) || goldRuntime.has(name));
}

/** 清运行时点金（开新局时调，避免跨局残留）。 */
export function clearGoldRuntime(): void { goldRuntime.clear(); }

// ===== 规则态（practice/match）：P1b 比赛/练习分流地基（hub 拍板「方案A·模块级」，镜像 bpBanRuntime/goldRuntime） =====
// practice(默认)=permissive-silent：禁因子/自选指挥官随意，不限制不提示；
// match=enforce-with-toast：违规弹提示但不强拦（禁因子上限1、2A1B、二选一互斥仅在此态生效）。
// 由 HomeScreen.start() 经 setRuleMode 写入；getSelectState/getBpState 透出；BP 规则逻辑读它分流。
// 不随 startSession 重置：规则态由 home 入口决定、跨开局保留。
// sessionStorage 持久化：刷新 / 直接访问 result|select 不丢 match 态（否则 canRecord/BP enforce 被重置成 practice，
// 比赛结束按钮消失、规则提示失效）。同标签会话内保留，关标签 / 新会话回默认 practice；
// node(window undefined) 与 Playwright 新 page 取默认 practice，e2e 不被污染。
function loadRuleMode(): 'practice' | 'match' {
  try { return window.sessionStorage?.getItem('jjb_rule_mode') === 'match' ? 'match' : 'practice'; } catch { return 'practice'; }
}
let ruleMode: 'practice' | 'match' = typeof window !== 'undefined' ? loadRuleMode() : 'practice';
export function setRuleMode(m: 'practice' | 'match'): void {
  ruleMode = m === 'match' ? 'match' : 'practice';
  try { window.sessionStorage?.setItem('jjb_rule_mode', ruleMode); } catch { /* noop */ }
}
export function getRuleMode(): 'practice' | 'match' { return ruleMode; }

// ===== 因子 BP（ban：select 屏运行时标记因子禁用；不改 9 格槽/池结构，validate 旁路叠加） =====
// 双打真引擎硬前置：guantu/feiqiu 双打的「ban 拿钱类因子」复用同一 BP 状态机。镜像点金 goldRuntime 模式。
// 规则态分流（P1b）：practice 无上限累加、不提示；match 上限 BP_BAN_LIMIT，超出写软违规「超出比赛规则」(不强拦、不替换、第1个仍有效)。
const bpBanRuntime = new Set<string>();
const BP_BAN_LIMIT = 1; // 比赛态「禁因子」每局上限（二选一之「ban 1 因子」）；练习态不设上限。

/** 是否使用了「自选指挥官」：selectedCommanderList 含不在本局 A/B 抽中池（randomCommanderPoorA/B 去 '自选'）的指挥官，
 *  即玩家从自选区全量池挑了非抽中指挥官。二选一互斥（ban 因子 ⊕ 自选指挥官）据此判定。 */
export function usedSelfPick(d: any): boolean {
  const pool = new Set<string>();
  (d.randomCommanderPoorA || []).forEach((c: string) => { if (c && c !== '自选') pool.add(c); });
  (d.randomCommanderPoorB || []).forEach((c: string) => { if (c) pool.add(c); });
  return ((d.selectedCommanderList || []) as (string | null)[]).some((c) => !!c && !pool.has(c));
}

export function hasBpBan(): boolean { return bpBanRuntime.size > 0; }

/** 二选一互斥当前启用哪支（match 态语义；done-when 4：__jjbDebug 可读当前启用哪支）。
 *  'ban'=已禁因子 / 'self'=已用自选指挥官 / 'conflict'=两者都用(违规) / null=都未用。 */
export function getBpExclusive(): 'ban' | 'self' | 'conflict' | null {
  const d: any = JijieData;
  const banned = bpBanRuntime.size > 0;
  const selfUsed = jjbLive() ? usedSelfPick(d) : false;
  if (banned && selfUsed) return 'conflict';
  if (banned) return 'ban';
  if (selfUsed) return 'self';
  return null;
}

/** toggle 某因子 ban 态。
 *  practice：无上限自由累加/解除，不提示；
 *  match：已 ban 则解除；未 ban 且达上限 → 不落、写「超出比赛规则」软提示（不强拦、不替换、第1个仍有效）。 */
export function toggleBanFactor(name: string): void {
  if (!name) return;
  if (bpBanRuntime.has(name)) { bpBanRuntime.delete(name); clearSelectWarn(); return; }
  if (ruleMode === 'match' && bpBanRuntime.size >= BP_BAN_LIMIT) {
    exposeSelectWarn('超出比赛规则：禁用因子每局限 ' + BP_BAN_LIMIT + ' 个');
    return; // 不替换、不落第 2 个；第 1 个 ban 仍有效（违规不强拦）
  }
  bpBanRuntime.add(name);
  // match 态二选一即时反馈：ban 后若已用自选指挥官 → 提示二选一冲突（done-when 4，不强拦）。
  if (ruleMode === 'match' && jjbLive() && usedSelfPick(JijieData as any)) {
    exposeSelectWarn('禁因子与自选指挥官二选一：已用自选指挥官，禁因子不可用（超出比赛规则）');
  }
}

/** 该因子是否被 BP ban。 */
export function getBanFor(name: string): boolean { return !!name && bpBanRuntime.has(name); }

/** BP 当前态快照（给 UI / __jjbDebug / e2e）。ruleMode 透出供 UI 分流 enforce/permissive。 */
export function getBpState(): { banned: string[]; banLimit: number; ruleMode: 'practice' | 'match' } {
  return { banned: [...bpBanRuntime], banLimit: BP_BAN_LIMIT, ruleMode };
}

/** 清运行时 BP（开新局时调，避免跨局残留）。 */
export function clearBpRuntime(): void { bpBanRuntime.clear(); }

// ===== 段3⑤：因子「重新揉」（reroll：把单个非锁定因子换成当前 3 场没出现过的一个）=====
// 复用 legacy 抽签机（getJijieFactor 只从「活池」抽——活池已由 toStartCore/toSelectCore 排除所有在场因子，
// 天然只剩「当前没出现过的」）。锁定因子(lockFactorList)不换（UI 不挂角标 + 逻辑侧再挡一道）。
// 限次照抄 BP_BAN_LIMIT 范式：practice 无限、不提示；match 每局上限 REROLL_LIMIT，超限写软违规「超出比赛规则」(不强拦、不执行、已揉的仍有效)。
let rerollCount = 0;
const REROLL_LIMIT = 3; // 比赛态「重揉」每局上限；练习态不设上限。

/** 重揉单个非锁定因子。
 *  kind='pool'  普通模式池候选：randomFactorPoor[i]
 *  kind='slot'  已落槽手选：  selectedFactorList[facFlatIdx(i,k)]
 *  返回 true=已揉 / false=旧因子空 or 锁定 or match 超限。 */
export function rerollFactor(kind: 'pool' | 'slot', i: number, k?: number): boolean {
  const d: any = JijieData;
  const poor = (d.randomFactorPoor || []) as (string | null)[];
  const sel = (d.selectedFactorList || []) as (string | null)[];
  let arr: (string | null)[];
  let flat: number;
  if (kind === 'slot') { arr = sel; flat = facFlatIdx(i, k as number); }
  else { arr = poor; flat = i; }
  const oldName = arr[flat];
  if (!oldName) return false;
  // 锁定因子不可换（UI 不挂角标；逻辑侧再挡一道，防误调）
  if (((d.lockFactorList || []) as (string | null)[]).includes(oldName)) return false;
  // 限次（照抄 BP toggleBanFactor 范式）：match 超限 → 软违规提示、不执行、已揉的仍有效
  if (ruleMode === 'match' && rerollCount >= REROLL_LIMIT) {
    exposeSelectWarn('超出比赛规则：重揉每局限 ' + REROLL_LIMIT + ' 次');
    return false;
  }
  // 抽新：先抽后放——getJijieFactor 只从活池抽（活池已排除所有在场因子），保证新因子 ≠ 旧且 ∉ 当前 3 场在场集；
  //       popFactor(新) 固化在场；旧因子仅当已不在任何展示位(池 + 手选槽)时归还母池（防母池双份 → 后续抽签重复）。
  const newName = ConfigData.getJijieFactor(!!d.modeIsVeryHard);
  ConfigData.popFactor(newName);
  arr[flat] = newName;
  const stillShown = poor.includes(oldName) || sel.includes(oldName);
  if (!stillShown) ConfigData.releaseFactor(oldName);
  rerollCount++;
  return true;
}

/** 重揉态快照（给 UI 显「重揉 N/3」剩余 / e2e）。 */
export function getRerollState(): { count: number; limit: number; remaining: number } {
  return { count: rerollCount, limit: REROLL_LIMIT, remaining: Math.max(0, REROLL_LIMIT - rerollCount) };
}

/** 清运行时重揉次数（开新局时调，避免跨局残留）。 */
export function clearRerollRuntime(): void { rerollCount = 0; }
