// jjbDoubles — 双打真引擎（R7 Phase 4）。
// 从 web/src/data/mutatorPool.ts（源 docs/官突ABC配置_官突池.csv）读官突池，
// 按 A/B/C 档每场抽 1 官突（含地图 + 锁定因子），不再委托 @jjb/JJBDoubles（Cocos 占位引擎保留只读）。
// 飞球（非酋）双打：混乱工作室 + {礼尚往来/风暴英雄/虚空裂隙}随机1 替代官突 CSV 池。
import { RESULT_VAL, VAL_RESULT, type MatchVM } from '@jjb/JJBData';
import { MUTATOR_POOL, type MutatorEntry } from '../data/mutatorPool';

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
const CMD_A_COUNT = 4; // 双打池 A 档出 4
const CMD_B_COUNT = 2; // 双打池 B 档出 2

// 飞球（非酋）因子。
const FEIQIU_FIXED = '混乱工作室';
const FEIQIU_RANDOM_POOL = ['礼尚往来', '风暴英雄', '虚空裂隙'];

const MATCHES = 3;
const CMDS_PER_MATCH = 2;
const EXTRA_FACTORS = 3;
const CMD_POOL_SIZE = CMD_A_COUNT + CMD_B_COUNT;     // 6
const FACTOR_POOL_SIZE = MATCHES * EXTRA_FACTORS;  // 9
const TIER_ORDER: Array<'A' | 'B' | 'C'> = ['A', 'B', 'C'];
const SLOT_LABELS = ['第 1 场', '第 2 场', 'BOSS 战'];

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
let _variant: 'guantu' | 'feiqiu' = 'guantu';
let _mutEntries: MutatorEntry[] = [];   // per-match [A, B, C]
let _factorPool: string[] = [];
let _commanderPool: string[] = [];
let _slots: { cmds: (string | null)[]; factors: (string | null)[] }[] = [];
let _winLoseList: (number | undefined)[] = [];

function freshSlots() {
  return Array.from({ length: MATCHES }, () => ({
    cmds: new Array<string | null>(CMDS_PER_MATCH).fill(null),
    factors: new Array<string | null>(EXTRA_FACTORS).fill(null),
  }));
}

function ensureSlot(slot: number): void {
  if (_slots.length !== MATCHES) _slots = freshSlots();
  const s = _slots[slot];
  if (!s) return;
  while (s.cmds.length < CMDS_PER_MATCH) s.cmds.push(null);
  while (s.factors.length < EXTRA_FACTORS) s.factors.push(null);
}

function exposeDebug(): void {
  try {
    const w = window as unknown as Record<string, unknown>;
    w.__jjbDebug = (w.__jjbDebug as Record<string, unknown>) || {};
    (w.__jjbDebug as Record<string, unknown>).doubles = debugSnapshot();
  } catch { /* noop */ }
}

// ---- 开局 / 重置（由 jjbSession.ts 调用） ----

export function doublesStart(variant: 'guantu' | 'feiqiu' = 'guantu'): void {
  _variant = variant;
  if (variant === 'feiqiu') {
    const feiqiuFac = FEIQIU_RANDOM_POOL[Math.floor(Math.random() * FEIQIU_RANDOM_POOL.length)];
    const feiFacs = [FEIQIU_FIXED, feiqiuFac];
    // 三场共享同一套非酋因子，地图自选（不绑官突地图）。
    _mutEntries = TIER_ORDER.map(() => ({ name: '非酋', map: '—', factors: feiFacs.slice() }));
    const lockedFacs = new Set(feiFacs);
    _factorPool = shuffle(FACTOR_SOURCE.filter((f) => !lockedFacs.has(f))).slice(0, FACTOR_POOL_SIZE);
  } else {
    _mutEntries = TIER_ORDER.map((t) => {
      const pool = MUTATOR_POOL[t];
      return pool[Math.floor(Math.random() * pool.length)];
    });
    const lockedFacs = new Set(_mutEntries.flatMap((e) => e.factors));
    _factorPool = shuffle(FACTOR_SOURCE.filter((f) => !lockedFacs.has(f))).slice(0, FACTOR_POOL_SIZE);
  }
  // 指挥官池：A 档出 4 人，B 档出 2 人，共 6（对齐 cmdPoolSize）。
  _commanderPool = [
    ...shuffle(COMMANDER_A).slice(0, CMD_A_COUNT),
    ...shuffle(COMMANDER_B).slice(0, CMD_B_COUNT),
  ];
  _slots = freshSlots();
  _winLoseList = new Array(MATCHES);
  _live = true;
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
  exposeDebug();
}

// ---- 只读查询 ----

export function doublesLive(): boolean { return _live; }
export function doublesModeLabel(): string { return _variant === 'feiqiu' ? '双打模式 · 非酋' : '双打模式 · 官突'; }
export type { MatchVM };

// ---- 类型 ----

export interface DoublesConfig {
  matches: number;
  cmdsPerMatch: number;
  extraFactors: number;
  mutators: string[];        // legacy compat（真引擎恒空，请用 matchMutators）
  maps: string[];            // legacy compat（真引擎恒空，请用 matchMaps）
  matchMutators: string[][]; // 每场锁定因子（官突=CSV 条目因子 / 非酋=混乱工作室+随机1）
  matchMutatorNames: string[]; // 每场官突名（官突=CSV name字段 / 非酋='非酋'）
  matchMaps: string[];       // 每场地图（非酋 = '—'）
  variant: 'guantu' | 'feiqiu'; // 双打变体
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

function debugSnapshot(): DoublesState {
  const wl = _winLoseList ?? [];
  return {
    live: _live,
    config: {
      matches: MATCHES,
      cmdsPerMatch: CMDS_PER_MATCH,
      extraFactors: EXTRA_FACTORS,
      mutators: [],
      maps: [],
      matchMutators: _mutEntries.map((e) => e?.factors?.slice() ?? []),
      matchMutatorNames: _mutEntries.map((e) => e?.name ?? ''),
      matchMaps: _mutEntries.map((e) => e?.map ?? ''),
      variant: _variant,
      factorPoolSize: FACTOR_POOL_SIZE,
      cmdPoolSize: CMD_POOL_SIZE,
    },
    factorPool: _factorPool.slice(),
    commanderPool: _commanderPool.slice(),
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
  (_slots ?? []).forEach((s, i) => {
    const cmdFilled = (s.cmds ?? []).filter(Boolean).length;
    const facFilled = (s.factors ?? []).filter(Boolean).length;
    if (cmdFilled < CMDS_PER_MATCH) errors.push(`第 ${i + 1} 场指挥官未满（${cmdFilled}/${CMDS_PER_MATCH}）`);
    if (facFilled < EXTRA_FACTORS) errors.push(`第 ${i + 1} 场随机因子未满（${facFilled}/${EXTRA_FACTORS}）`);
  });
  return { ok: errors.length === 0, firstError: errors[0] ?? '', errors };
}

export function randomFillDoubles(): void {
  let ci = 0;
  let fi = 0;
  for (let slot = 0; slot < MATCHES; slot++) {
    for (let k = 0; k < CMDS_PER_MATCH; k++) {
      const name = _commanderPool[ci++];
      if (name) setDoublesCmd(slot, k, name);
    }
    for (let k = 0; k < EXTRA_FACTORS; k++) {
      const name = _factorPool[fi++];
      if (name) setDoublesFac(slot, k, name);
    }
  }
}
