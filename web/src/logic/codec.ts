// codec.ts — 集结杯「码方案」编解码核心（P3 落地 · P5 后端 matches.payload_code 复用同一编码器）。
//
// 纯函数编解码 + 前端胶水 capturePayload（读当前局模块态→snapshot）。
//   encodePayload(snapshot) → 索引化 JSON → base64url 字符串（进 URL #hash，自包含、无需后端）
//   decodePayload(code)    → base64url → JSON → 三道闸校验 → snapshot
//   decodeResult(code)     → { ok, snap? | reason }（屏 D 用，不抛异常）
//   capturePayload()       → 读 getSelectState/getDoublesState + 敌方/点金/ban/winLose → snapshot
//
// 索引化纪律（docs/research-frontend-p2p3.md §B2/B5，已定真相不重新论证）：
//   - 因子池/手选因子/点金/ban → config/factors.ts FACTORS 下标（frozen；gen-config.mjs 按 CSV 行序输出，
//     脚本本身稳定，重排风险由 poolFingerprint 内容哈希兜底）
//   - 指挥官/地图/官突名/锁定因子名 → 稳定名（无 frozen 母表，P3 调研 §C.1 真缺口；过渡期存名最稳，长度代价小）
//   - 模式 → SessionMode 字面量（手钉 MODE_CODES 校验合法值，不靠 union 顺序）
//
// 版本校验三道闸（§B4）：
//   1. 版本闸：snap.v !== PAYLOAD_VER → reason 'version'（「码版本不符」）
//   2. 指纹闸：snap.p !== poolFingerprint() → reason 'pool'（「码版本/池不符」——FACTORS 重排/改名/删项）
//   3. 越界闸：facName(idx) idx≥FACTORS.length 或字段缺失 → reason 'invalid'
// 指纹基于内容（FACTORS 名串 + 模式码集 FNV-32a），非纯 length——抓「同长重排」（§B4 风险）。
//
// 本 round 冻结 schema v1（文档化见 docs/codec-schema.md，P5 后端复用契约）。
// applySnapshot 还原 select/battle 态（单打→JijieData，双打→jjbDoubles 闭包）。

import { FACTORS } from '../config/factors';
import type { SessionMode, SelectState } from './jjbSession';
import { getSelectState, getWinLoseList, getBpState, getGoldFor, applySelectState } from './jjbSession';
import type { DoublesState } from './jjbDoubles';
import { doublesLive, getDoublesState, applyDoublesState } from './jjbDoubles';
import { getEnemyRoll } from './aiEnemySelector';
import { getRandomEnemyEnabled } from './randomConfig';
import type { RaceCode } from '../data/aiEnemyPool';

// ===== 版本 + 模式码表 =====

export const PAYLOAD_VER = 1;

/** 模式↔码字面量双向校验表（手钉，不靠 union 顺序；码里存字面量，此表用于 decode 校验合法 mode）。 */
const MODE_CODES: readonly SessionMode[] = [
  'std8', 'std10', 'std12', 'rescue', 'one-a', 'hard1', 'hard2', 'feiqiu', 'suiji', 'doubles', 'feiqiu-doubles',
];

// ===== 因子名↔下标双向表 =====

const FAC_IDX = new Map<string, number>();
FACTORS.forEach((f, i) => FAC_IDX.set(f.name, i));

/** 因子名 → FACTORS 下标；null/undefined → -1；不在母表 → 抛（encode 期暴露运行期源与母表不一致）。 */
function facIdx(name: string | null | undefined): number {
  if (!name) return -1;
  const i = FAC_IDX.get(name);
  if (i === undefined) throw new Error('[codec] 因子不在 FACTORS 母表: ' + name);
  return i;
}

/** FACTORS 下标 → 因子名；idx<0 → null（空槽）；越界 → 抛（decode 期越界闸）。 */
function facName(idx: number): string | null {
  if (idx < 0) return null;
  if (idx >= FACTORS.length) throw new Error('[codec] 因子下标越界: ' + idx);
  return FACTORS[idx].name;
}

// ===== 池指纹（内容哈希，FNV-1a 32bit）=====

/**
 * 池指纹 = FNV-1a over FACTORS 全名串 + MODE_CODES 拼接。
 * 旧码遇 FACTORS 重排/改名/删项或模式码集变动 → 指纹不符 → reason 'pool'，而非错位还原。
 * 不用纯 length：同长重排（A 池换两条目顺序）length 指纹漏检（§B4 风险），内容哈希能抓。
 */
export function poolFingerprint(): number {
  let h = 0x811c9dc5;
  const mix = (s: string) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } };
  for (const f of FACTORS) mix(f.name);
  mix(''); // 分隔，防 FACTORS 末名与 MODE_CODES 首名拼接歧义
  mix(MODE_CODES.join('|'));
  return h >>> 0;
}

// ===== base64url（UTF-8 安全 · 浏览器 + Node SSR 通用）=====

function b64urlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(s.length + (4 - (s.length % 4)) % 4, '=');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// ===== Snapshot 类型（schema v1 · P5 复用契约）=====

interface EnemySnap { race: RaceCode; ai: string }

/** 单打 snapshot（kind 's'）。字段顺序 = 编码顺序（docs/codec-schema.md）。 */
export interface SingleSnapshot {
  v: 1;                       // payload_ver
  p: number;                  // poolFingerprint
  kind: 's';
  mode: SessionMode;          // 字面量
  mfc: number;                // modelFactorCount (0-4)
  flags: { vh: boolean; vh2: boolean; zj: boolean; op: boolean; fq: boolean; sj: boolean; rand: boolean };
  rm: 'practice' | 'match';
  maps: string[];             // 3 张地图（存名，无 frozen 母表）
  locks: string[];            // 3 锁定因子（存名，含「混乱工作室」等限定因子，存名免疫 frozen 重排）
  pool: number[];             // randomFactorPoor → FACTORS idx
  cmdA: string[];             // A 池指挥官（存名，含「自选」）
  cmdB: string[];             // B 池指挥官（存名）
  selCmd: (string | null)[];  // 3 手选指挥官（存名，null=未选）
  selFac: number[];           // 9 手选因子 → FACTORS idx（-1=未选）
  gold: number[];             // 本局点金因子 → FACTORS idx
  ban: number[];              // BP ban 因子 → FACTORS idx
  wl: number[];               // winLoseList（0/1/2，长度可变；贴码开局通常空）
  enemy: (EnemySnap | null)[] | null; // 随机敌方（开关 ON：3 元素；OFF：null）
}

/** 双打 snapshot（kind 'd'）。 */
export interface DoublesSnapshot {
  v: 1;
  p: number;
  kind: 'd';
  variant: 'guantu' | 'feiqiu';
  mutEntries: { name: string; map: string; factors: string[] }[]; // 3 场官突（factors 存名，含非酋「混乱工作室」）
  facPool: number[];          // factorPool → FACTORS idx（guantu=9 / feiqiu=3）
  cmdPool: string[];          // 6 指挥官池（存名）
  slots: { cmds: (string | null)[]; facs: number[] }[]; // 3×(2 指挥官存名 + 3 因子 idx，-1=未选)
  wl: number[];               // 3 场 winLoseList（-1=未判定）
  enemy: (EnemySnap | null)[] | null;
}

export type PayloadSnapshot = SingleSnapshot | DoublesSnapshot;

// ===== encode =====

/** snapshot → 索引化 JSON → base64url。P5 后端 matches.payload_code 存同一字符串。 */
export function encodePayload(snap: PayloadSnapshot): string {
  return b64urlEncode(JSON.stringify(snap));
}

// ===== decode（三道闸）=====

export type DecodeReason = 'invalid' | 'version' | 'pool';
export type DecodeOk = { ok: true; snap: PayloadSnapshot };
export type DecodeBad = { ok: false; reason: DecodeReason; message: string };
export type DecodeResult = DecodeOk | DecodeBad;

/** 屏 D 用：不抛异常，返回 { ok, snap? | reason, message }。 */
export function decodeResult(code: string): DecodeResult {
  let snap: PayloadSnapshot;
  try {
    snap = JSON.parse(b64urlDecode(code.trim()));
  } catch (e) {
    return { ok: false, reason: 'invalid', message: '对局码无效，请核对后重新粘贴' };
  }
  if (!snap || typeof snap !== 'object' || snap.v !== PAYLOAD_VER) {
    return { ok: false, reason: 'version', message: '对局码版本不符 · 该码为旧版本，请更新工具后重试' };
  }
  if (snap.p !== poolFingerprint()) {
    return { ok: false, reason: 'pool', message: '对局码版本不符 · 池已更新，请用新工具重新生成' };
  }
  try {
    if (snap.kind === 's') validateSingle(snap);
    else if (snap.kind === 'd') validateDoubles(snap);
    else return { ok: false, reason: 'invalid', message: '对局码无效，请核对后重新粘贴' };
  } catch (e) {
    return { ok: false, reason: 'invalid', message: '对局码无效，请核对后重新粘贴' };
  }
  return { ok: true, snap };
}

/** 抛异常版（e2e 往返用，假设合法码）。 */
export function decodePayload(code: string): PayloadSnapshot {
  const r = decodeResult(code);
  if (r.ok === false) throw new Error('[codec] decode 失败: ' + r.reason + ' — ' + r.message);
  return r.snap;
}

function assertMode(m: unknown): asserts m is SessionMode {
  if (typeof m !== 'string' || !(MODE_CODES as readonly string[]).includes(m)) {
    throw new Error('[codec] 非法 mode: ' + String(m));
  }
}

function validateSingle(s: any): asserts s is SingleSnapshot {
  assertMode(s.mode);
  if (typeof s.mfc !== 'number' || typeof s.rm !== 'string') throw new Error('[codec] single 字段缺失');
  if (!Array.isArray(s.maps) || !Array.isArray(s.locks) || !Array.isArray(s.pool)) throw new Error('[codec] single 字段缺失');
  if (!Array.isArray(s.cmdA) || !Array.isArray(s.cmdB) || !Array.isArray(s.selCmd) || !Array.isArray(s.selFac)) throw new Error('[codec] single 字段缺失');
  if (!Array.isArray(s.gold) || !Array.isArray(s.ban) || !Array.isArray(s.wl)) throw new Error('[codec] single 字段缺失');
  // 越界闸：每个因子 idx 必须可解
  for (const idx of [...s.pool, ...s.selFac, ...s.gold, ...s.ban]) facName(idx);
  // 指挥官/地图/锁定名必须是字符串（存名校验）
  for (const n of [...s.maps, ...s.locks, ...s.cmdA, ...s.cmdB]) if (typeof n !== 'string') throw new Error('[codec] single 名字段非 string');
}

function validateDoubles(s: any): asserts s is DoublesSnapshot {
  if (s.variant !== 'guantu' && s.variant !== 'feiqiu') throw new Error('[codec] 非法 variant');
  if (!Array.isArray(s.mutEntries) || !Array.isArray(s.facPool) || !Array.isArray(s.cmdPool) || !Array.isArray(s.slots) || !Array.isArray(s.wl)) throw new Error('[codec] doubles 字段缺失');
  for (const idx of s.facPool) facName(idx);
  for (const slot of s.slots) {
    if (!slot || !Array.isArray(slot.cmds) || !Array.isArray(slot.facs)) throw new Error('[codec] doubles slot 缺失');
    for (const idx of slot.facs) facName(idx);
  }
}

// ===== capturePayload（前端胶水：读当前局模块态 → snapshot）=====

/** 读当前局模块态 → snapshot。jjbView 门面分流：doublesLive() → 双打，否则单打。 */
export function capturePayload(): PayloadSnapshot {
  return doublesLive() ? captureDoubles() : captureSingle();
}

function captureEnemy(): (EnemySnap | null)[] | null {
  if (!getRandomEnemyEnabled()) return null;
  return [0, 1, 2].map((i) => {
    const e = getEnemyRoll(i);
    return e ? { race: e.race, ai: e.nameZh } : null;
  });
}

/** 本局出现的全部因子名（点金/ban 只编本局相关，与「码方案固化本局」语义一致）。 */
function singleFactorsInPlay(s: SelectState): string[] {
  const set = new Set<string>();
  s.lockFactorList.forEach((f) => f && set.add(f));
  s.randomFactorPoor.forEach((f) => set.add(f));
  s.selectedFactorList.forEach((f) => f && set.add(f));
  return [...set];
}

function captureSingle(): SingleSnapshot {
  const s = getSelectState();
  const bp = getBpState();
  const inPlay = singleFactorsInPlay(s);
  const gold = inPlay.filter((f) => getGoldFor(f)).map(facIdx);
  const ban = bp.banned.map(facIdx);
  return {
    v: PAYLOAD_VER,
    p: poolFingerprint(),
    kind: 's',
    mode: s.mode,
    mfc: s.modelFactorCount,
    flags: { vh: s.modeIsVeryHard, vh2: s.modeIsVeryHard2, zj: s.modeIsZhengjiu, op: s.modeIsOnePick, fq: s.modeFeiqiu, sj: s.modeSuiji, rand: s.modeIsRandom },
    rm: s.ruleMode,
    maps: s.mapList.slice(),
    locks: s.lockFactorList.slice(),
    pool: s.randomFactorPoor.map(facIdx),
    cmdA: s.randomCommanderPoorA.slice(),
    cmdB: s.randomCommanderPoorB.slice(),
    selCmd: s.selectedCommanderList.slice(),
    selFac: s.selectedFactorList.map((f) => facIdx(f)),
    gold,
    ban,
    wl: getWinLoseList().slice(),
    enemy: captureEnemy(),
  };
}

function captureDoubles(): DoublesSnapshot {
  const d = getDoublesState();
  const cfg = d.config;
  const mutEntries = [0, 1, 2].map((i) => ({
    name: cfg.matchMutatorNames[i] ?? '',
    map: cfg.matchMaps[i] ?? '',
    factors: (cfg.matchMutators[i] ?? []).slice(),
  }));
  return {
    v: PAYLOAD_VER,
    p: poolFingerprint(),
    kind: 'd',
    variant: cfg.variant,
    mutEntries,
    facPool: d.factorPool.map(facIdx),
    cmdPool: d.commanderPool.slice(),
    slots: d.selection.slots.map((s) => ({
      cmds: s.cmds.slice(),
      facs: s.factors.map((f) => facIdx(f)),
    })),
    // winLoseList：双打 doublesStart 用 new Array(3) 初始化（稀疏，空槽非 undefined），
    // map 会跳过空槽 → 仍稀疏 → JSON 序列化成 [null,null,null] 但与 decode 后真 null 不等。
    // 故 Array.from 显式遍历，空槽 → -1（未判定），避免稀疏数组往返不等价。
    wl: Array.from({ length: 3 }, (_, i) => {
      const v = d.winLoseList[i];
      return v == null ? -1 : v;
    }),
    enemy: captureEnemy(),
    // 双打点金不编入：双打点金是纯视觉态（GOLD_FACTORS 空 + 运行时 toggle 未接双打 UI），
    // 恒空 → 编不编往返等价；省字段省空间。单打点金编 gold[]（见 captureSingle）。
  };
}

// ===== applySnapshot 还原 =====

/** snapshot 还原 select/battle 态：单打→applySelectState 写 JijieData；双打→applyDoublesState 写 jjbDoubles 闭包。 */
export function applySnapshot(snap: PayloadSnapshot): void {
  if (snap.kind === 's') applySelectState(snap);
  else applyDoublesState(snap);
}
