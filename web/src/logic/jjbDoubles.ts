// jjbDoubles — 双打真引擎（R7 Phase 4 · Batch C per-variant 配置化）。
// 从 web/src/data/mutatorPool.ts（源 docs/官突ABC配置_官突池.csv）读官突池，
// 按 A/B/C 档每场抽 1 官突（含地图 + 锁定因子），不再委托 Cocos 线 JJBDoubles（占位引擎保留只读）。
// 飞球（非酋）之轮：每场只锁「混乱工作室」(1个)；可分配因子池=固定3个{礼尚往来/风暴英雄/虚空裂隙}(玩家自由分配，非随机抽1)；地图每场随机真地图。
// std15 双打（yb 2026-07-02 拍板）：每场 5 待选无锁定；候选池 17；地图从官方地图池抽 3 去重；自选区=官方全量。
// CM 双打（yb 2026-07-02 拍板）：每场固定锁 风暴英雄+虚空裂隙；每场 4 待选；候选池 14；指挥官池 3A3B
//   （CM 全放 B 组与官方混抽 + 升权，web 层 concat 注入不改 legacy 指挥官配置.txt）；自选区=全部 22。
import { RESULT_VAL, VAL_RESULT, type MatchVM } from './legacy/JJBData';
import ConfigData from './legacy/JJConfigData';
import { MUTATOR_POOL, type MutatorEntry } from '../data/mutatorPool';
import { weightedSampleNoReplace } from './commanderWeight';
import { rollEnemiesForSession, clearEnemyRolls } from './aiEnemySelector';
import { FACTORS } from '../config/factors';
import { COMMANDERS } from '../config/commanders';
import type { DoublesSnapshot } from './codec';
import { getBanFactors, getBanMutators, getBanMaps } from './eventBan';

// 额外随机因子来源（官方24因子子集，按开局时过滤当场官突锁定因子后随机抽取）。
const FACTOR_SOURCE = [
  '暴风雪', '核弹打击', '丧尸大战', '岩浆爆发', '相互摧毁', '伤害散射',
  '黑死病', '强磁雷场', '力量蜕变', '光子过载', '扫雷专家', '异形寄生',
  '坚强意志', '震荡攻击', '无边恐惧', '激光钻机', '复仇战士', '自毁程序',
  '生命汲取', '速度狂魔', '给我死吧', '虚空重生者', '进攻部署', '减伤屏障',
];

// 指挥官 A 档（弱）/ B 档（强）— 源自 assets/resources/jjdata/指挥官配置.txt 第2列。
const COMMANDER_A = ['雷诺', '凯瑞甘', '阿塔尼斯', '斯旺', '扎加拉', '沃拉尊', '阿巴瑟', '阿纳拉克', '斯图科夫', '菲尼克斯', '米拉'];
const COMMANDER_B = ['凯拉克斯', '诺娃', '德哈卡', '泰凯斯', '泽拉图', '斯台特曼', '蒙斯克'];

// 飞球（非酋）之轮因子：混乱工作室恒锁；{礼尚往来/风暴英雄/虚空裂隙} 为可分配池（三者皆可分配，非随机抽1）。
const FEIQIU_FIXED = '混乱工作室';
const FEIQIU_ASSIGN_POOL = ['礼尚往来', '风暴英雄', '虚空裂隙'];

// CM 双打：每场固定锁 2 因子（D9 定稿：不随机、不分场）；CM 自制指挥官池 = commanders.ts 标 source:'cm'（单一真相源）。
const CM_LOCKS = ['风暴英雄', '虚空裂隙'];
const CM_POOL: string[] = COMMANDERS.filter((c) => c.source === 'cm').map((c) => c.name);

const MATCHES = 3;
const CMDS_PER_MATCH = 2;
const TIER_ORDER: Array<'A' | 'B' | 'C'> = ['A', 'B', 'C'];
const SLOT_LABELS = ['第 1 场', '第 2 场', 'BOSS 战'];

// ---- per-variant 规格（Batch C 配置化：guantu/feiqiu 取值与改造前逐项相同） ----
export type DoublesVariant = 'guantu' | 'feiqiu' | 'std15' | 'cm';

interface VariantSpec {
  extraFactors: number;   // 每场待选（可分配）因子槽数
  factorPoolSize: number; // 候选因子池大小
  cmdACount: number;      // 指挥官池 A 档人数
  cmdBCount: number;      // 指挥官池 B 档人数
}

const VARIANT_SPECS: Record<DoublesVariant, VariantSpec> = {
  guantu: { extraFactors: 3, factorPoolSize: 9, cmdACount: 4, cmdBCount: 2 },
  feiqiu: { extraFactors: 3, factorPoolSize: 3, cmdACount: 4, cmdBCount: 2 },
  // std15：每场 5 待选（3×5=15）；候选池 17 = 15 + 2 余量（D3 候选留余量，对齐 CM「待选12+2余量」范式）
  std15: { extraFactors: 5, factorPoolSize: 17, cmdACount: 4, cmdBCount: 2 },
  // cm：每场 4 待选（D8 可配 3-6 默认 4）；候选池 14 = 12(4×3) + 2 余量；指挥官池 3A3B
  cm: { extraFactors: 4, factorPoolSize: 14, cmdACount: 3, cmdBCount: 3 },
};

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---- 模块级状态 ----
let _live = false;
let _variant: DoublesVariant = 'guantu';
let _mutEntries: MutatorEntry[] = [];   // per-match [A, B, C]
let _factorPool: string[] = [];
let _commanderPool: string[] = [];
let _slots: { cmds: (string | null)[]; factors: (string | null)[] }[] = [];
let _winLoseList: (number | undefined)[] = [];

function spec(): VariantSpec { return VARIANT_SPECS[_variant]; }

function freshSlots() {
  return Array.from({ length: MATCHES }, () => ({
    cmds: new Array<string | null>(CMDS_PER_MATCH).fill(null),
    factors: new Array<string | null>(spec().extraFactors).fill(null),
  }));
}

function ensureSlot(slot: number): void {
  if (_slots.length !== MATCHES) _slots = freshSlots();
  const s = _slots[slot];
  if (!s) return;
  while (s.cmds.length < CMDS_PER_MATCH) s.cmds.push(null);
  while (s.factors.length < spec().extraFactors) s.factors.push(null);
}

function exposeDebug(): void {
  try {
    const w = window as unknown as Record<string, unknown>;
    w.__jjbDebug = (w.__jjbDebug as Record<string, unknown>) || {};
    (w.__jjbDebug as Record<string, unknown>).doubles = debugSnapshot();
  } catch { /* noop */ }
}

// ---- 开局 / 重置（由 jjbSession.ts 调用） ----

/** std15/cm 地图：官方地图池（ConfigData.mapGrid，调用方须先 init——jjbSession 早分支已 restoreConfig）随机抽 3 去重（D6 复用去重）。
 *  event-ban 地图过滤（不足 3 张回退不过滤）；mapGrid 不可用时回退官突池地图集（防未 init 直调崩溃）。 */
function drawOfficialMaps(): string[] {
  let pool: string[] = [];
  try {
    pool = [...new Set(((ConfigData.mapGrid as unknown as unknown[][]) || []).map((r) => r[0] as string).filter(Boolean))];
  } catch { pool = []; }
  if (pool.length === 0) pool = [...new Set(TIER_ORDER.flatMap((t) => MUTATOR_POOL[t].map((e) => e.map)))];
  const unbanned = pool.filter((m) => !getBanMaps().has(m));
  const maps = shuffle(unbanned.length >= MATCHES ? unbanned : pool);
  return Array.from({ length: MATCHES }, (_, i) => maps[i % maps.length] ?? '湮灭快车');
}

export function doublesStart(variant: DoublesVariant = 'guantu'): void {
  _variant = variant;
  if (variant === 'feiqiu') {
    // 飞球之轮：每场只锁「混乱工作室」(1个)；可分配池=固定3因子(玩家自由分配，非随机抽1)；
    // 地图每场随机一张真地图（取自官突池去重地图集，已剔缺图）。
    const maps = shuffle([...new Set(TIER_ORDER.flatMap((t) => MUTATOR_POOL[t].map((e) => e.map)))]);
    _mutEntries = TIER_ORDER.map((_, i) => ({ name: '非酋', map: maps[i % maps.length] ?? '湮灭快车', factors: [FEIQIU_FIXED] }));
    _factorPool = FEIQIU_ASSIGN_POOL.slice();
  } else if (variant === 'std15' || variant === 'cm') {
    // std15：无锁定因子，候选池 17；cm：每场固定锁 风暴英雄+虚空裂隙，候选池 14。
    // 候选池从官方 24 因子子集随机抽（FACTOR_SOURCE 不含风暴/裂隙，cm 锁定与池天然不撞；event-ban 过滤，ban 过多回退原池防抽不满）。
    const maps = drawOfficialMaps();
    const locks = variant === 'cm' ? CM_LOCKS : [];
    const entryName = variant === 'cm' ? 'CM' : '15因子';
    _mutEntries = TIER_ORDER.map((_, i) => ({ name: entryName, map: maps[i], factors: locks.slice() }));
    const src = FACTOR_SOURCE.filter((f) => !getBanFactors().has(f));
    const base = src.length >= spec().factorPoolSize ? src : FACTOR_SOURCE;
    _factorPool = shuffle(base).slice(0, spec().factorPoolSize);
  } else {
    // 3 档官突各自带地图，独立随机抽会撞图（bug：完美风暴/现世现报同配升格之链 → 3 场重复地图）。
    // 修：逐档抽取时对地图去重——优先抽地图未用过的官突；该档官突地图被前面用尽（撞档，罕见）时回退原池随机，避免抽不出。
    const usedMaps = new Set<string>();
    _mutEntries = TIER_ORDER.map((t) => {
      const pool = MUTATOR_POOL[t].filter(
        (e) => !getBanMutators().has(e.name) && !e.factors.some((f) => getBanFactors().has(f))
      );
      const base = pool.length > 0 ? pool : MUTATOR_POOL[t]; // 守卫：全 ban 时回退原池
      const fresh = base.filter((e) => !usedMaps.has(e.map));
      const cand = fresh.length > 0 ? fresh : base;
      const pick = cand[Math.floor(Math.random() * cand.length)];
      usedMaps.add(pick.map);
      return pick;
    });
    const lockedFacs = new Set(_mutEntries.flatMap((e) => e.factors));
    _factorPool = shuffle(FACTOR_SOURCE.filter((f) => !lockedFacs.has(f))).slice(0, spec().factorPoolSize);
  }
  // 指挥官池：A 档等概率抽 cmdACount 人，B 档加权无放回抽 cmdBCount 人（德哈卡/泰凯斯降权 0.25）。
  // cm：CM 全放 B 组与官方混抽（D7/D10：web 层 concat 注入 + commanderWeight 升权），3A3B 共 6。
  const bSource = variant === 'cm' ? [...COMMANDER_B, ...CM_POOL] : COMMANDER_B;
  _commanderPool = [
    ...shuffle(COMMANDER_A).slice(0, spec().cmdACount),
    ...weightedSampleNoReplace(bSource, spec().cmdBCount),
  ];
  _slots = freshSlots();
  _winLoseList = new Array(MATCHES);
  _live = true;
  rollEnemiesForSession(MATCHES); // 随机敌方：开关 ON 时每场 roll 种族+AI，OFF 则清空
  exposeDebug();
}

export function doublesReset(): void {
  _live = false;
  _variant = 'guantu';
  _mutEntries = [];
  _factorPool = [];
  _commanderPool = [];
  _slots = freshSlots();
  _winLoseList = [];
  clearEnemyRolls();
  exposeDebug();
}

// ---- 只读查询 ----

export function doublesLive(): boolean { return _live; }
export function doublesModeLabel(): string {
  if (_variant === 'feiqiu') return '双打模式 · 非酋';
  if (_variant === 'std15') return '双打模式 · 15因子';
  if (_variant === 'cm') return '双打模式 · CM';
  return '双打模式 · 官突';
}
export type { MatchVM };

// ---- 类型 ----

export interface DoublesConfig {
  matches: number;
  cmdsPerMatch: number;
  extraFactors: number;
  mutators: string[];        // legacy compat（真引擎恒空，请用 matchMutators）
  maps: string[];            // legacy compat（真引擎恒空，请用 matchMaps）
  matchMutators: string[][]; // 每场锁定因子（官突=CSV 条目因子 / 非酋=混乱工作室 / std15=空）
  matchMutatorNames: string[]; // 每场官突名（官突=CSV name字段 / 非酋='非酋' / std15='15因子'）
  matchMaps: string[];       // 每场地图
  variant: DoublesVariant;   // 双打变体
  factorPoolSize: number;
  cmdPoolSize: number;
}
export interface DoublesSlotSel { cmds: (string | null)[]; factors: (string | null)[] }
export interface DoublesState {
  live: boolean;
  config: DoublesConfig;
  factorPool: string[];
  commanderPool: string[];
  selfPool: string[]; // 自选区池（D4/D11 net-new）：std15=官方全量减已入池；guantu/feiqiu 无自选区（恒空）
  selection: { slots: DoublesSlotSel[] };
  winLoseList: (number | undefined)[];
  winCount: number;
  winbCount: number;
  totalCount: number;
}

export function doublesMatches(): Array<MatchVM & { mutators?: string[] }> {
  const out: Array<MatchVM & { mutators?: string[] }> = [];
  for (let i = 0; i < MATCHES; i++) {
    const entry = _mutEntries[i] ?? { name: '—', map: '湮灭快车', factors: [] };
    const slot = _slots[i] ?? { cmds: [], factors: [] };
    const extraFacs = (slot.factors ?? []).filter(Boolean) as string[];
    const wlVal = _winLoseList[i];
    out.push({
      slot: SLOT_LABELS[i],
      map: entry.map,
      cmds: (slot.cmds ?? []).filter(Boolean) as string[],
      factors: [...entry.factors, ...extraFacs],
      result: typeof wlVal === 'number' ? (VAL_RESULT[wlVal] as string) : undefined,
      doubles: true,
      lock: entry.factors[0] ?? '—',
      mutators: entry.factors.slice(),
    });
  }
  return out;
}

/** 自选区池：std15=官方全量（A+B 共 18）减已入指挥官池；cm=全部 22（官方 18 + CM 4，D11）减已入池；
 *  guantu/feiqiu 无自选区（恒空）。 */
function selfPoolFor(): string[] {
  if (_variant !== 'std15' && _variant !== 'cm') return [];
  const base = _variant === 'cm'
    ? [...COMMANDER_A, ...COMMANDER_B, ...CM_POOL]
    : [...COMMANDER_A, ...COMMANDER_B];
  const inPool = new Set(_commanderPool);
  return base.filter((c) => !inPool.has(c));
}

function debugSnapshot(): DoublesState {
  const wl = _winLoseList ?? [];
  return {
    live: _live,
    config: {
      matches: MATCHES,
      cmdsPerMatch: CMDS_PER_MATCH,
      extraFactors: spec().extraFactors,
      mutators: [],
      maps: [],
      matchMutators: _mutEntries.map((e) => e?.factors?.slice() ?? []),
      matchMutatorNames: _mutEntries.map((e) => e?.name ?? ''),
      matchMaps: _mutEntries.map((e) => e?.map ?? ''),
      variant: _variant,
      factorPoolSize: spec().factorPoolSize,
      cmdPoolSize: spec().cmdACount + spec().cmdBCount,
    },
    factorPool: _factorPool.slice(),
    commanderPool: _commanderPool.slice(),
    selfPool: selfPoolFor(),
    selection: {
      slots: (_slots ?? []).map((s) => ({
        cmds: (s.cmds ?? []).slice(),
        factors: (s.factors ?? []).slice(),
      })),
    },
    winLoseList: wl.slice(),
    winCount: wl.filter((v) => v === 1 || v === 2).length,
    winbCount: wl.filter((v) => v === 2).length,
    totalCount: wl.filter((v) => v === 0 || v === 1 || v === 2).length,
  };
}

export function getDoublesState(): DoublesState { return debugSnapshot(); }

// ---- 槽位写入 ----

export function setDoublesCmd(slot: number, idx: number, name: string): void {
  ensureSlot(slot); _slots[slot].cmds[idx] = name; exposeDebug();
}
export function clearDoublesCmd(slot: number, idx: number): void {
  ensureSlot(slot); _slots[slot].cmds[idx] = null; exposeDebug();
}
export function setDoublesFac(slot: number, idx: number, name: string): void {
  ensureSlot(slot); _slots[slot].factors[idx] = name; exposeDebug();
}
export function clearDoublesFac(slot: number, idx: number): void {
  ensureSlot(slot); _slots[slot].factors[idx] = null; exposeDebug();
}

// ---- Verdict ----

export function setDoublesVerdict(slot: number, verdict: 'win' | 'bonus' | 'lose'): void {
  if (!Array.isArray(_winLoseList) || _winLoseList.length < MATCHES) _winLoseList = new Array(MATCHES);
  _winLoseList[slot] = RESULT_VAL[verdict];
  exposeDebug();
}

export function doublesScore(): number {
  return (_winLoseList ?? []).filter((v) => v === 1 || v === 2).length;
}

// ---- 校验 / 随机填充 ----

export function validateDoubles(): { ok: boolean; firstError: string; errors: string[] } {
  const errors: string[] = [];
  const ef = spec().extraFactors;
  (_slots ?? []).forEach((s, i) => {
    const cmdFilled = (s.cmds ?? []).filter(Boolean).length;
    const facFilled = (s.factors ?? []).filter(Boolean).length;
    if (cmdFilled < CMDS_PER_MATCH) errors.push(`第 ${i + 1} 场指挥官未满（${cmdFilled}/${CMDS_PER_MATCH}）`);
    if (facFilled < ef) errors.push(`第 ${i + 1} 场随机因子未满（${facFilled}/${ef}）`);
  });
  return { ok: errors.length === 0, firstError: errors[0] ?? '', errors };
}

export function randomFillDoubles(): void {
  const ef = spec().extraFactors;
  let ci = 0;
  for (let slot = 0; slot < MATCHES; slot++) {
    for (let k = 0; k < CMDS_PER_MATCH; k++) {
      const name = _commanderPool[ci++];
      if (name) setDoublesCmd(slot, k, name);
    }
    for (let k = 0; k < ef; k++) {
      // 取模：guantu 池=9 / std15 池=17 顺序消费不回卷；feiqiu 池=3 则每场循环喂满那 3 个可分配因子。
      const name = _factorPool.length ? _factorPool[(slot * ef + k) % _factorPool.length] : undefined;
      if (name) setDoublesFac(slot, k, name);
    }
  }
}

/** 从 DoublesSnapshot 还原 jjbDoubles 闭包（按此码开局），直写闭包不改引擎逻辑（Cocos 红线）。 */
export function applyDoublesState(snap: DoublesSnapshot): void {
  _variant = snap.variant;
  _mutEntries = snap.mutEntries.map((e) => ({ name: e.name, map: e.map, factors: e.factors.slice() }));
  _factorPool = snap.facPool
    .map((idx) => (idx >= 0 && idx < FACTORS.length ? FACTORS[idx].name : null))
    .filter((n): n is string => n !== null);
  _commanderPool = snap.cmdPool.slice();
  _slots = snap.slots.map((s) => ({
    cmds: s.cmds.slice(),
    factors: s.facs.map((idx) => (idx < 0 || idx >= FACTORS.length ? null : FACTORS[idx].name)),
  }));
  _winLoseList = Array.from({ length: snap.wl.length }, (_, i) => {
    const v = snap.wl[i];
    return v === -1 ? undefined : v;
  });
  _live = true;
  exposeDebug();
}
