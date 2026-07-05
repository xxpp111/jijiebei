// jjbDoubles.test — 双打引擎边界补测（此前无专属测试，靠 e2e/codec 分布式覆盖，边界分支裸奔）。
// 补 E 维度点名的三处薄弱点：doublesScore 0/3 边界、validateDoubles 失败分支、各 variant randomFill 填满。
import { describe, it, expect, beforeEach } from 'vitest';
import {
  doublesStart, doublesReset, setDoublesVerdict, doublesScore,
  validateDoubles, randomFillDoubles,
} from '../jjbDoubles';

const VARIANTS = ['guantu', 'feiqiu', 'std15', 'cm'] as const;

describe('jjbDoubles 边界', () => {
  beforeEach(() => doublesReset());

  describe('doublesScore 三场判定边界（win+bonus 计胜，不双计）', () => {
    it('全负 → 0', () => {
      doublesStart('guantu');
      for (let s = 0; s < 3; s++) setDoublesVerdict(s, 'lose');
      expect(doublesScore()).toBe(0);
    });
    it('全胜 → 3', () => {
      doublesStart('guantu');
      for (let s = 0; s < 3; s++) setDoublesVerdict(s, 'win');
      expect(doublesScore()).toBe(3);
    });
    it('win/bonus/lose → 2', () => {
      doublesStart('guantu');
      setDoublesVerdict(0, 'win');
      setDoublesVerdict(1, 'bonus');
      setDoublesVerdict(2, 'lose');
      expect(doublesScore()).toBe(2);
    });
  });

  describe('validateDoubles 失败/成功分支', () => {
    it('开局未填 → ok=false + errors/firstError 非空', () => {
      doublesStart('guantu');
      const v = validateDoubles();
      expect(v.ok).toBe(false);
      expect(v.errors.length).toBeGreaterThan(0);
      expect(v.firstError).toContain('未满');
    });
    it('randomFill 后 → ok=true + errors 空', () => {
      doublesStart('guantu');
      randomFillDoubles();
      const v = validateDoubles();
      expect(v.ok).toBe(true);
      expect(v.errors).toEqual([]);
      expect(v.firstError).toBe('');
    });
  });

  // 4 个 variant 各自 randomFill 后都应填满通过校验——feiqiu(池仅 3 因子)通过 = 分池回卷复用真生效
  // （若不回卷，第 2/3 场因子耗尽 → 未满 → ok=false）；std15(池 17)/cm(池 14 + 恒锁) 顺序消费应各自够填。
  describe('各 variant randomFill 填满', () => {
    for (const v of VARIANTS) {
      it(`${v} randomFill 后 validateDoubles 通过`, () => {
        doublesStart(v);
        randomFillDoubles();
        expect(validateDoubles().ok).toBe(true);
      });
    }
  });
});
