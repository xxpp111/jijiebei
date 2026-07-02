// codec 码方案编解码单测（测试体系第①层）。
// 被测：web/src/logic/codec.ts —— 集结杯「码方案」核心，URL #hash 自包含、无需后端。
// 复刻 e2e/codec.mjs 的三阶段断言，用 vitest 重写：9 单打模式 + 2 双打模式 capture→encode→decode 往返 deepEqual
//   + 三道闸（version / pool / invalid）+ 越界 idx 拦截。
// 加载方式与 e2e 同款（vitest 内置 Vite 解析 codec.ts → jjbSession.ts → jjdata csv），setup.ts 注入 window shim。
import { describe, it, expect, beforeAll } from 'vitest';
import {
  capturePayload, encodePayload, decodePayload, decodeResult, PAYLOAD_VER, poolFingerprint,
} from '../codec';
import type { DecodeResult } from '../codec';
import { startSession } from '../jjbSession';

const g = globalThis as any;
const SOLO_MODES = ['std8', 'std10', 'std12', 'rescue', 'one-a', 'hard1', 'hard2', 'feiqiu', 'suiji'] as const;

/** 取 DecodeResult 的 reason（tsc 对第三方 expect 后的 union 收窄不稳，显式收窄到 DecodeBad）。 */
function reasonOf(r: DecodeResult): string {
  return r.ok === false ? r.reason : '(ok)';
}

describe('codec 基础', () => {
  it('PAYLOAD_VER = 1（schema v1 冻结）', () => {
    expect(PAYLOAD_VER).toBe(1);
  });

  it('poolFingerprint 返回 32bit 无符号整数（同进程稳定）', () => {
    const fp = poolFingerprint();
    expect(Number.isInteger(fp)).toBe(true);
    expect(fp).toBeGreaterThanOrEqual(0);
    expect(fp).toBe(poolFingerprint()); // 内容哈希稳定
  });
});

describe('codec 往返等价：capture → encode → decode deepEqual', () => {
  beforeAll(() => { g.__jjbDebug = undefined; });

  it.each(SOLO_MODES)('单打 %s：kind=s 且往返 deepEqual', (mode) => {
    g.__jjbDebug = undefined;
    startSession(mode);
    const snap1 = capturePayload();
    expect(snap1.kind).toBe('s');
    const snap2 = decodePayload(encodePayload(snap1));
    expect(snap2).toEqual(snap1);
  });

  it('双打 doubles：kind=d 且往返 deepEqual', () => {
    g.__jjbDebug = undefined;
    startSession('doubles');
    const snap1 = capturePayload();
    expect(snap1.kind).toBe('d');
    const snap2 = decodePayload(encodePayload(snap1));
    expect(snap2).toEqual(snap1);
  });

  it('双打 feiqiu-doubles（非酋）：kind=d 且往返 deepEqual', () => {
    g.__jjbDebug = undefined;
    startSession('feiqiu-doubles');
    const snap1 = capturePayload();
    expect(snap1.kind).toBe('d');
    const snap2 = decodePayload(encodePayload(snap1));
    expect(snap2).toEqual(snap1);
  });

  it('双打 std15（Batch C 双打化）：kind=d、variant=std15 且往返 deepEqual', () => {
    g.__jjbDebug = undefined;
    startSession('std15');
    const snap1 = capturePayload();
    expect(snap1.kind).toBe('d');
    if (snap1.kind === 'd') expect(snap1.variant).toBe('std15');
    const snap2 = decodePayload(encodePayload(snap1));
    expect(snap2).toEqual(snap1);
  });

  it('双打 cm（Batch C 双打化）：kind=d、variant=cm 且往返 deepEqual', () => {
    g.__jjbDebug = undefined;
    startSession('cm');
    const snap1 = capturePayload();
    expect(snap1.kind).toBe('d');
    if (snap1.kind === 'd') expect(snap1.variant).toBe('cm');
    const snap2 = decodePayload(encodePayload(snap1));
    expect(snap2).toEqual(snap1);
  });

  it('码长 < 2000（URL #hash 上限）', () => {
    for (const mode of [...SOLO_MODES, 'doubles', 'feiqiu-doubles', 'std15', 'cm'] as const) {
      g.__jjbDebug = undefined;
      startSession(mode);
      expect(encodePayload(capturePayload()).length).toBeLessThan(2000);
    }
  });
});

describe('codec 三道闸（version / pool / invalid）', () => {
  // 基于真实合法单打 snapshot 构造违规变体（v/p 合法前提下逐闸破坏）
  let snap: ReturnType<typeof capturePayload>;
  beforeAll(() => {
    g.__jjbDebug = undefined;
    startSession('std10');
    snap = capturePayload();
  });

  it('版本闸：v ≠ PAYLOAD_VER → reason=version', () => {
    // as any：构造违规变体本就是破坏不变量，TS 的 snap.v 字面量类型(1)在此是噪音。
    const r = decodeResult(encodePayload({ ...snap, v: 999 } as any));
    expect(r.ok).toBe(false);
    expect(reasonOf(r)).toBe('version');
  });

  it('指纹闸：p ≠ poolFingerprint() → reason=pool', () => {
    const r = decodeResult(encodePayload({ ...snap, p: poolFingerprint() + 1 } as any));
    expect(r.ok).toBe(false);
    expect(reasonOf(r)).toBe('pool');
  });

  it('越界闸（非法 base64url 乱码）→ reason=invalid', () => {
    const r = decodeResult('!!!不是合法base64url!!!');
    expect(r.ok).toBe(false);
    expect(reasonOf(r)).toBe('invalid');
  });

  it('越界闸（因子 idx ≥ FACTORS.length）→ reason=invalid', () => {
    const oob = { ...snap, selFac: [99999, -1, -1, -1, -1, -1, -1, -1, -1] } as any;
    const r = decodeResult(encodePayload(oob));
    expect(r.ok).toBe(false);
    expect(reasonOf(r)).toBe('invalid');
  });

  it('合法码 → ok=true（对照组）', () => {
    const r = decodeResult(encodePayload(snap));
    expect(r.ok).toBe(true);
  });

  it('双打版本闸：kind=d 也走版本闸 → reason=version', () => {
    g.__jjbDebug = undefined;
    startSession('doubles');
    const dSnap = capturePayload();
    const r = decodeResult(encodePayload({ ...dSnap, v: 999 } as any));
    expect(r.ok).toBe(false);
    expect(reasonOf(r)).toBe('version');
  });
});
