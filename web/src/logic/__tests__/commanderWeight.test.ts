// 指挥官降权抽样单测（测试体系第①层）。
// 被测：web/src/logic/commanderWeight.ts —— yb 2026-06-19 拍板的赛制核心，此前全 e2e 零断言、最危险。
// 期望值来源：commanderWeight.ts 的 COMMANDER_WEIGHTS 表（德哈卡/泰凯斯=0.25，其余=1）。
import { describe, it, expect } from 'vitest';
import { commanderWeightOf, weightedSampleNoReplace } from '../commanderWeight';

describe('commanderWeightOf', () => {
  it('德哈卡/泰凯斯权重 0.25，其余（含未知名/空串）权重 1', () => {
    expect(commanderWeightOf('德哈卡')).toBe(0.25);
    expect(commanderWeightOf('泰凯斯')).toBe(0.25);
    // 正常指挥官与未知名/空串都回落 1（?? 1 兜底）
    expect(commanderWeightOf('雷诺')).toBe(1);
    expect(commanderWeightOf('任意未登记的指挥官')).toBe(1);
    expect(commanderWeightOf('')).toBe(1);
  });
});

describe('weightedSampleNoReplace', () => {
  it('无放回：返回 k 个不重复元素，全部来自入参 pool', () => {
    const pool = ['雷诺', '凯瑞甘', '德哈卡', '泰凯斯', '斯旺'];
    const out = weightedSampleNoReplace(pool, 3);
    expect(out).toHaveLength(3);
    expect(new Set(out).size).toBe(3); // 无放回 → 无重复
    out.forEach((x) => expect(pool).toContain(x));
  });

  it('不改入参 pool（内部 slice 副本）', () => {
    const pool = ['雷诺', '凯瑞甘', '德哈卡', '泰凯斯', '斯旺'];
    const snapshot = pool.slice();
    weightedSampleNoReplace(pool, 3);
    expect(pool).toEqual(snapshot); // 入参未被原地修改
  });

  it('k 超过 pool 长度时取尽 pool（不报错、不多取）', () => {
    const pool = ['雷诺', '凯瑞甘'];
    const out = weightedSampleNoReplace(pool, 5);
    expect(out).toHaveLength(2);
    expect(new Set(out).size).toBe(2);
  });

  it('N=10000 统计：德哈卡（权重 0.25）入选率 ≈ 正常指挥官（权重 1）的 1/4，带容差', () => {
    // 单抽 1 个：池内德哈卡(0.25) + 3 个正常(各 1)，权重和 3.25。
    //   德哈卡入选率 ≈ 0.25/3.25 ≈ 0.077；正常指挥官 ≈ 1/3.25 ≈ 0.308；比值 ≈ 0.25 = 1/4。
    // 容差放 ±0.03 吸收 N=10000 的统计噪声（降权是数量级语义，非精确值）。
    const pool = ['雷诺', '凯瑞甘', '德哈卡', '斯旺'];
    const N = 10000;
    let dehakaHit = 0;
    let normalHit = 0; // 统计「雷诺」作为正常指挥官代表
    for (let i = 0; i < N; i++) {
      const [picked] = weightedSampleNoReplace(pool, 1);
      if (picked === '德哈卡') dehakaHit++;
      else if (picked === '雷诺') normalHit++;
    }
    const dehakaRate = dehakaHit / N;
    const normalRate = normalHit / N;
    // 德哈卡绝对入选率 ≈ 0.077
    expect(dehakaRate).toBeGreaterThan(0.077 - 0.03);
    expect(dehakaRate).toBeLessThan(0.077 + 0.03);
    // 德哈卡 : 正常 ≈ 1 : 4（降权到 1/4 的赛制语义）
    expect(dehakaRate / normalRate).toBeGreaterThan(0.25 - 0.1);
    expect(dehakaRate / normalRate).toBeLessThan(0.25 + 0.1);
  });
});
