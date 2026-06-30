// jjbSession 开局编排单测（测试体系第①层）。
// 被测：web/src/logic/jjbSession.ts —— React↔XP 接缝，复刻 9 模式真实开局。
// 两类断言：①池=槽恒等式（randomFactorPoor.length === sum(manualSlots)，9 模式逐个）
//         ②开局契约（map=3/lock=3/9 格 null/status=2）+ factorScore 白名单 fallback。
// 加载链同 e2e/run.mjs：setup.ts 注入 window shim，startSession 写 window.__jjbDebug 供 getSelectState 读。
import { describe, it, expect, beforeEach } from 'vitest';
import { startSession, getSelectState, factorScore } from '../jjbSession';

const g = globalThis as any;
// suiji 之外的 8 个单打开局模式（suiji 池=0 单独验）
const SOLO_MODES = ['std8', 'std10', 'std12', 'rescue', 'one-a', 'hard1', 'hard2', 'feiqiu', 'cm'] as const;

describe('jjbSession 池=槽恒等式（赛制核心，此前全 e2e 零断言）', () => {
  beforeEach(() => { g.__jjbDebug = undefined; });

  it.each(SOLO_MODES)('%s：randomFactorPoor.length === sum(manualSlots)', (mode) => {
    startSession(mode);
    const s = getSelectState();
    expect(s.identityPass).toBe(true);
    expect(s.randomFactorPoor.length).toBe(s.sumSlots);
  });

  it('suiji 模式：池=0、manualSlots=[0,0,0]（随机模式无因子）', () => {
    startSession('suiji');
    const s = getSelectState();
    expect(s.randomFactorPoor.length).toBe(0);
    expect(s.manualSlots).toEqual([0, 0, 0]);
    expect(s.sumSlots).toBe(0);
  });

  it('std15 模式：池=15、manualSlots=[0,0,0]、无锁定（纯随机每场 5）', () => {
    startSession('std15');
    const s = getSelectState();
    expect(s.randomFactorPoor.length).toBe(15);
    expect(s.manualSlots).toEqual([0, 0, 0]);
    expect(s.identityPass).toBe(true); // 池=15/slots=0 豁免恒等式
    expect(s.lockFactorList.length).toBe(0); // 纯随机无锁定因子
  });
});

describe('jjbSession 开局契约', () => {
  beforeEach(() => { g.__jjbDebug = undefined; });

  it('std10：map=3 / lock=3 / 9 格 null / status=2', () => {
    startSession('std10');
    const s = getSelectState();
    expect(s.mapList).toHaveLength(3);
    expect(s.lockFactorList).toHaveLength(3);
    expect(s.selectedCommanderList).toEqual([null, null, null]);
    expect(s.selectedFactorList).toEqual(new Array(9).fill(null));
    expect(s.status).toBe(2);
    expect(s.modelFactorCount).toBe(3);
  });

  it('各单打模式开局后 jjbLive=true（局已起）', () => {
    for (const mode of [...SOLO_MODES, 'suiji'] as const) {
      g.__jjbDebug = undefined;
      startSession(mode);
      expect(getSelectState().jjbLive).toBe(true);
    }
  });
});

describe('factorScore（config/factors.ts 单一真相源，Batch5 cutover）', () => {
  // 真值来源：config/factors.ts points（docs/因子点数配置.csv 经 gen-config 生成，71 条全表）。
  //   光子过载 = 1（csv 正常值）；
  //   虚空重生者 = 5（yb 2026-06-30 按官方 config，覆盖旧 fallback 7）；
  //   混乱工作室 / 礼尚往来 = 7（csv「限定」→ yb 2026-06-30 拍 7，非酋模式恒锁/可分配因子）；
  //   空 / config 未登记名 → 0（防 typo 被静默记成高分）。
  beforeEach(() => { g.__jjbDebug = undefined; startSession('std10'); /* 触发 ConfigData.init */ });

  it('空名 → 0', () => {
    expect(factorScore('')).toBe(0);
  });

  it('正常因子：光子过载 = 1', () => {
    expect(factorScore('光子过载')).toBe(1);
  });

  it('虚空重生者 = 5（yb 2026-06-30 按官方 config，覆盖旧 fallback 7）', () => {
    expect(factorScore('虚空重生者')).toBe(5);
  });

  it('非酋恒锁/可分配因子：混乱工作室 / 礼尚往来 = 7（csv「限定」→ 7）', () => {
    expect(factorScore('混乱工作室')).toBe(7);
    expect(factorScore('礼尚往来')).toBe(7);
  });

  it('config 未登记名 → 0（防 typo 静默高分）', () => {
    expect(factorScore('不存在的因子xyz')).toBe(0);
  });
});
