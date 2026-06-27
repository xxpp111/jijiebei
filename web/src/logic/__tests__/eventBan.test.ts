// eventBan 赛事 ban 共享状态机单测（测试体系第①层）。
// 被测：web/src/logic/eventBan.ts —— loadEventBan 写 3-Set + getter + getMutatorHitCount 静态计数。
// 纯逻辑（不渲染、不网络），唯一外部依赖 MUTATOR_POOL（编译期捆绑，同 jjbSession.test.ts 加载链）。
import { describe, it, expect, beforeEach } from 'vitest';
import { loadEventBan, getBanMaps, getBanFactors, getBanMutators, getMutatorHitCount } from '../eventBan';

describe('eventBan loadEventBan → 3-Set 状态', () => {
  beforeEach(() => loadEventBan()); // 每例先清空，避免跨例污染

  it('空 ruleset / 不传 → 三 Set 全空（无 ban）', () => {
    loadEventBan();
    expect(getBanMaps().size).toBe(0);
    expect(getBanFactors().size).toBe(0);
    expect(getBanMutators().size).toBe(0);
  });

  it('加载 ruleset → 三 Set 各就位', () => {
    loadEventBan({ ban_maps: ['亡者之夜'], ban_factors: ['飞弹大战', '时间扭曲'], ban_mutators: ['炸弹机器人 Bomb Bot'] });
    expect([...getBanMaps()]).toEqual(['亡者之夜']);
    expect(getBanFactors().has('飞弹大战')).toBe(true);
    expect(getBanFactors().has('时间扭曲')).toBe(true);
    expect(getBanFactors().size).toBe(2);
    expect([...getBanMutators()]).toEqual(['炸弹机器人 Bomb Bot']);
  });

  it('重新 load 覆盖旧状态（不累加）', () => {
    loadEventBan({ ban_maps: ['亡者之夜'], ban_factors: [], ban_mutators: [] });
    loadEventBan({ ban_maps: ['湮灭快车'], ban_factors: [], ban_mutators: [] });
    expect([...getBanMaps()]).toEqual(['湮灭快车']); // 旧的亡者之夜被覆盖、不残留
  });

  it('部分字段缺失（undefined）→ 该 Set 空、其余正常', () => {
    loadEventBan({ ban_maps: ['亡者之夜'], ban_factors: undefined as unknown as string[], ban_mutators: [] });
    expect(getBanMaps().size).toBe(1);
    expect(getBanFactors().size).toBe(0);
  });
});

describe('eventBan getMutatorHitCount（静态计数，与当前 ban 状态无关）', () => {
  it('时空立场 → 命中 6 个官突（hub/spoke 双实现交叉验证基线）', () => {
    expect(getMutatorHitCount('时空立场')).toBe(6);
  });

  it('时空力场（官突池 0 命中、与时空立场易混淆）→ 0', () => {
    expect(getMutatorHitCount('时空力场')).toBe(0);
  });

  it('飞弹大战 / 短视症 / 极性不定（用户 ban 例，双打有效）→ > 0', () => {
    expect(getMutatorHitCount('飞弹大战')).toBeGreaterThan(0);
    expect(getMutatorHitCount('短视症')).toBeGreaterThan(0);
    expect(getMutatorHitCount('极性不定')).toBeGreaterThan(0);
  });

  it('母表存在但官突池 0 命中的因子（ban 对双打空转、单打仍有效）→ 0', () => {
    expect(getMutatorHitCount('生命吸取')).toBe(0); // 阶段0对账：19 个母表因子官突池 0 命中之一
  });

  it('计数不受当前 ban 状态影响（load 后仍同值）', () => {
    const before = getMutatorHitCount('时空立场');
    loadEventBan({ ban_maps: [], ban_factors: ['时空立场'], ban_mutators: [] });
    expect(getMutatorHitCount('时空立场')).toBe(before);
  });
});
