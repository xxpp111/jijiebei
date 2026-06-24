// 官突池（mutatorPool）数据漂移守护单测（测试体系第①层）。
// 被测：web/src/data/mutatorPool.ts（AUTO-GENERATED from docs/官突ABC配置_官突池.csv）。
// 期望值来源：live 文件 grep 实测——A 档 51 条 / B 档 57 条 / C 档 32 条；首末条目 anchor 取文件实际行。
// 防的是：CSV 重排/删项/改分类（A↔B↔C 迁移）被 gen-config 静默吞掉，三档容量变化无人察觉。
import { describe, it, expect } from 'vitest';
import { MUTATOR_POOL } from '../../data/mutatorPool';

describe('mutatorPool 三档容量（live 实测：A=51 / B=57 / C=32）', () => {
  it('A 档 51 条', () => expect(MUTATOR_POOL.A).toHaveLength(51));
  it('B 档 57 条', () => expect(MUTATOR_POOL.B).toHaveLength(57));
  it('C 档 32 条', () => expect(MUTATOR_POOL.C).toHaveLength(32));
});

describe('mutatorPool 条目结构', () => {
  it('每条 = { name, map, factors[] }，name/map 非空串、factors 至少 1 个', () => {
    for (const tier of ['A', 'B', 'C'] as const) {
      for (const e of MUTATOR_POOL[tier]) {
        expect(typeof e.name).toBe('string');
        expect(e.name.length).toBeGreaterThan(0);
        expect(typeof e.map).toBe('string');
        expect(Array.isArray(e.factors)).toBe(true);
        expect(e.factors.length).toBeGreaterThan(0);
      }
    }
  });

  it('首/末条目 anchor（防整体重排静默回归）', () => {
    // 真值取自 mutatorPool.ts 实际首末行
    expect(MUTATOR_POOL.A[0]).toEqual({
      name: '特别快递 Special Delivery', map: '虚空降临', factors: ['进攻部署', '异形寄生', '自毁程序'],
    });
    expect(MUTATOR_POOL.C[MUTATOR_POOL.C.length - 1].name).toBe('多线操作训练 Multitasking Trainer');
  });
});
