// config-modes.test — MODE_DEFS 声明配置单一真相源直接断言（#77 收敛后此前零直测）。
// 防的是：手改 config/modes.ts 打错某个 key 的 BP 态 / 清空某个 label，SelectScreen「比赛模式」栏空白、
//   或双打模式误开 BP 阶段（bpLocked=false），而无任何测试拦截（bp-rules 只间接覆盖部分键）。
import { describe, it, expect } from 'vitest';
import { MODE_DEFS } from '../../config/modes';

describe('MODE_DEFS 声明配置', () => {
  // 双打 4 键：BP 未实装 → 一律锁死、不默认开（防手改误让双打进 BP 阶段）
  const doublesModes = ['doubles', 'feiqiu-doubles', 'std15', 'cm'];
  for (const k of doublesModes) {
    it(`双打模式 ${k}: bpLocked=true 且 bpDefault 非 true`, () => {
      expect(MODE_DEFS[k]?.bpLocked).toBe(true);
      expect(MODE_DEFS[k]?.bpDefault ?? false).toBe(false);
    });
  }

  // 渲染态模式 label 非空（currentModeLabel 靠它；空 label 会让选/结算屏「比赛模式」栏空白）
  const labeledModes = ['std8', 'std10', 'std12', 'rescue', 'feiqiu', 'std15', 'cm'];
  for (const k of labeledModes) {
    it(`模式 ${k}: label 非空`, () => {
      const label = MODE_DEFS[k]?.label;
      expect(typeof label === 'string' && label.length > 0).toBe(true);
    });
  }

  // 默认开 BP 的仅 std8/std10（防误把某模式默认开，改变 BP 面板默认态）
  it('仅 std8/std10 bpDefault=true', () => {
    const on = Object.entries(MODE_DEFS)
      .filter(([, d]) => d.bpDefault === true)
      .map(([k]) => k)
      .sort();
    expect(on).toEqual(['std10', 'std8']);
  });
});
