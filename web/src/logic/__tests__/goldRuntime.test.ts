// goldRuntime.test.ts — 瘦身 Batch2 goldRuntime 跨局泄漏 bug 修复验证。
// bug：clearGoldRuntime() 全仓 0 调用方（兄弟 clearBpRuntime() 在 3 个开局点都重置），
//   上一局 SelectScreen 点金的因子带进下一局，经 getGoldFor→weightedFactorScore 让该因子 difficulty×2 污染记分。
// 修：startSession(326)/randomFillAndStart(606)/randomFillSelection(616) 接 clearGoldRuntime()（与 clearBpRuntime 并列）。
// 本测锁定 gold clear 的核心机制：开局重置后上局点金不再生效。
import { describe, it, expect, beforeEach } from 'vitest';
import { toggleGold, getGoldFor, clearGoldRuntime } from '../jjbSession';

const F = '__test_gold_factor__'; // 肯定不在 GOLD_FACTORS 固定表，纯走 goldRuntime 路径

describe('goldRuntime 跨局重置（Batch2 记分污染 bug 修复）', () => {
  beforeEach(() => clearGoldRuntime());

  it('toggleGold 累加 → getGoldFor=true（点金生效）', () => {
    expect(getGoldFor(F)).toBe(false); // 初始非点金
    toggleGold(F);
    expect(getGoldFor(F)).toBe(true);  // goldRuntime 含 → ×2
  });

  it('clearGoldRuntime 清空 → getGoldFor=false（镜像开局重置，下局不再带点金 →不再×2污染）', () => {
    toggleGold(F);
    expect(getGoldFor(F)).toBe(true);
    clearGoldRuntime(); // ← startSession/randomFill 开局接的就是这个
    expect(getGoldFor(F)).toBe(false); // 跨局泄漏被堵
  });

  it('二次 toggleGold 取消点金（手动取消路径不受影响）', () => {
    toggleGold(F); expect(getGoldFor(F)).toBe(true);
    toggleGold(F); expect(getGoldFor(F)).toBe(false);
  });
});
