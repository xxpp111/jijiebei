// jjbDoubles.test — 双打引擎边界补测（此前无专属测试，靠 e2e/codec 分布式覆盖，边界分支裸奔）。
// 补 E 维度点名的三处薄弱点：doublesScore 0/3 边界、validateDoubles 失败分支、各 variant randomFill 填满。
import { describe, it, expect, beforeEach } from 'vitest';
import {
  doublesStart, doublesReset, setDoublesVerdict, doublesScore,
  validateDoubles, randomFillDoubles, filterWithFallback,
  getDoublesState, setDoublesCmd, setDoublesFac, clearDoublesFac,
  rerollDoublesCommander, rerollDoublesFactor, getDoublesRerollState,
} from '../jjbDoubles';
import { getRuleMode, getSelectWarn, setRuleMode } from '../jjbSession';

const VARIANTS = ['guantu', 'feiqiu', 'std15', 'cm'] as const;

describe('jjbDoubles 边界', () => {
  beforeEach(() => { setRuleMode('practice'); doublesReset(); });

  describe('filterWithFallback', () => {
    it('过滤结果数量足够时返回过滤池，不足时回退原池', () => {
      const pool = [1, 2, 3, 4];
      expect(filterWithFallback(pool, (n) => n > 2, 2)).toEqual([3, 4]);
      expect(filterWithFallback(pool, (n) => n > 3, 2)).toEqual(pool);
    });
  });

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

  describe('官突双打独立重揉', () => {
    it('指挥官/因子池单项替换后池内无重复，且清空已落同名槽位', () => {
      doublesStart('guantu');
      const before = getDoublesState();
      const oldCmd = before.commanderPool[0];
      const oldFac = before.factorPool[0];
      setDoublesCmd(0, 0, oldCmd);
      setDoublesFac(0, 0, oldFac);

      expect(rerollDoublesCommander(0)).toBe(true);
      expect(rerollDoublesFactor(0)).toBe(true);

      const after = getDoublesState();
      expect(after.commanderPool).toHaveLength(before.commanderPool.length);
      expect(after.factorPool).toHaveLength(before.factorPool.length);
      expect(new Set(after.commanderPool).size).toBe(after.commanderPool.length);
      expect(new Set(after.factorPool).size).toBe(after.factorPool.length);
      expect(after.commanderPool).not.toContain(oldCmd);
      expect(after.factorPool).not.toContain(oldFac);
      expect(after.selection.slots[0].cmds[0]).toBeNull();
      expect(after.selection.slots[0].factors[0]).toBeNull();
    });

    it('feiqiu variant guard: 返回 false、不改池、不计数并提示', () => {
      doublesStart('feiqiu');
      const before = getDoublesState();
      expect(rerollDoublesCommander(0)).toBe(false);
      expect(rerollDoublesFactor(0)).toBe(false);
      const after = getDoublesState();
      expect(after.commanderPool).toEqual(before.commanderPool);
      expect(after.factorPool).toEqual(before.factorPool);
      expect(getDoublesRerollState().count).toBe(0);
      expect(getSelectWarn()).toContain('非酋');
    });

    it('match 态限 3 次，超限不执行且不计数；新 doublesStart 清零', () => {
      setRuleMode('match');
      expect(getRuleMode()).toBe('match');
      doublesStart('guantu');
      expect(getDoublesRerollState()).toEqual({ count: 0, limit: 3, remaining: 3 });
      expect(rerollDoublesFactor(0)).toBe(true);
      expect(rerollDoublesFactor(1)).toBe(true);
      expect(rerollDoublesFactor(2)).toBe(true);
      const beforeOver = getDoublesState().factorPool.slice();
      expect(getDoublesRerollState()).toEqual({ count: 3, limit: 3, remaining: 0 });
      expect(rerollDoublesFactor(3)).toBe(false);
      expect(getDoublesState().factorPool).toEqual(beforeOver);
      expect(getDoublesRerollState().count).toBe(3);
      expect(getSelectWarn()).toContain('超出比赛规则');
      doublesStart('guantu');
      expect(getDoublesRerollState()).toEqual({ count: 0, limit: 3, remaining: 3 });
    });
  });

  // Phase1：reroll 从官突扩到 std15/CM（引擎零改，UI 放开；feiqiu 不开）。验证 variant 中立的 reroll 引擎在 std15/cm 上同样成立：
  // 替换后池内无重复 / 不含锁定因子 / match 限 3 次 / 落槽联动清空。
  describe('std15/CM 双打独立重揉（reroll 扩展）', () => {
    for (const v of ['std15', 'cm'] as const) {
      it(`${v} 指挥官/因子池单项替换后池内无重复，且清空已落同名槽位`, () => {
        doublesStart(v);
        const before = getDoublesState();
        const oldCmd = before.commanderPool[0];
        const oldFac = before.factorPool[0];
        setDoublesCmd(0, 0, oldCmd);
        setDoublesFac(0, 0, oldFac);

        expect(rerollDoublesCommander(0)).toBe(true);
        expect(rerollDoublesFactor(0)).toBe(true);

        const after = getDoublesState();
        expect(after.commanderPool).toHaveLength(before.commanderPool.length);
        expect(after.factorPool).toHaveLength(before.factorPool.length);
        expect(new Set(after.commanderPool).size).toBe(after.commanderPool.length);
        expect(new Set(after.factorPool).size).toBe(after.factorPool.length);
        expect(after.commanderPool).not.toContain(oldCmd);
        expect(after.factorPool).not.toContain(oldFac);
        expect(after.selection.slots[0].cmds[0]).toBeNull();
        expect(after.selection.slots[0].factors[0]).toBeNull();
      });

      it(`${v} 因子重揉候选排除当场锁定因子（不灌回 lockedFacs）`, () => {
        doublesStart(v);
        const locked = new Set((getDoublesState().config.matchMutators ?? []).flat());
        // std15 无锁定因子（locked 空），cm 每场恒锁风暴英雄+虚空裂隙
        if (locked.size === 0) {
          expect(locked.size).toBe(0); // std15 无锁定，排除项为空集，仍记录断言
        }
        for (let n = 0; n < 20; n++) {
          expect(rerollDoublesFactor(n % getDoublesState().factorPool.length)).toBe(true);
          for (const f of getDoublesState().factorPool) expect(locked.has(f)).toBe(false);
        }
      });

      it(`${v} match 态限 3 次，超限不执行且不计数`, () => {
        setRuleMode('match');
        doublesStart(v);
        expect(getDoublesRerollState()).toEqual({ count: 0, limit: 3, remaining: 3 });
        const poolLen = getDoublesState().factorPool.length;
        expect(rerollDoublesFactor(0)).toBe(true);
        expect(rerollDoublesFactor(1 % poolLen)).toBe(true);
        expect(rerollDoublesFactor(2 % poolLen)).toBe(true);
        const beforeOver = getDoublesState().factorPool.slice();
        expect(getDoublesRerollState()).toEqual({ count: 3, limit: 3, remaining: 0 });
        expect(rerollDoublesFactor(3 % poolLen)).toBe(false);
        expect(getDoublesState().factorPool).toEqual(beforeOver);
        expect(getDoublesRerollState().count).toBe(3);
        expect(getSelectWarn()).toContain('超出比赛规则');
        doublesStart(v);
        expect(getDoublesRerollState()).toEqual({ count: 0, limit: 3, remaining: 3 });
      });

      it(`${v} 重揉已落槽项：清空同名槽位并给 warn 提示`, () => {
        doublesStart(v);
        const fac = getDoublesState().factorPool[0];
        setDoublesFac(0, 0, fac);
        expect(rerollDoublesFactor(0)).toBe(true);
        expect(getDoublesState().selection.slots[0].factors[0]).toBeNull();
        expect(getSelectWarn()).toContain('已重揉');
      });
    }
  });

  describe('双打因子去重', () => {
    it('同一因子不能从池重复落到两个槽，清空后可再落；指挥官不拦截', () => {
      doublesStart('guantu');
      const st = getDoublesState();
      const fac = st.factorPool[0];
      const cmd = st.commanderPool[0];

      setDoublesFac(0, 0, fac);
      setDoublesFac(1, 0, fac);
      let after = getDoublesState();
      expect(after.selection.slots[0].factors[0]).toBe(fac);
      expect(after.selection.slots[1].factors[0]).toBeNull();
      expect(getSelectWarn()).toContain('因子已使用');

      setDoublesCmd(0, 0, cmd);
      setDoublesCmd(1, 0, cmd);
      after = getDoublesState();
      expect(after.selection.slots[0].cmds[0]).toBe(cmd);
      expect(after.selection.slots[1].cmds[0]).toBe(cmd);

      clearDoublesFac(0, 0);
      setDoublesFac(1, 0, fac);
      after = getDoublesState();
      expect(after.selection.slots[0].factors[0]).toBeNull();
      expect(after.selection.slots[1].factors[0]).toBe(fac);
    });

    it('feiqiu 豁免去重：固定 3 因子跨场复用手填 9 槽全部成功（workflow blocker 回归锁）', () => {
      doublesStart('feiqiu');
      const pool = getDoublesState().factorPool;
      expect(pool).toHaveLength(3);
      for (let s = 0; s < 3; s++) {
        for (let k = 0; k < 3; k++) {
          expect(setDoublesFac(s, k, pool[k])).toBe(true);
        }
      }
      const st = getDoublesState();
      for (let s = 0; s < 3; s++) {
        expect(st.selection.slots[s].factors.filter(Boolean)).toHaveLength(3);
      }
    });
  });

  describe('重揉与锁定因子/落槽联动（workflow 复查回归锁）', () => {
    it('guantu 因子重揉候选排除当场官突锁定因子（不灌回开局剔除的 lockedFacs）', () => {
      doublesStart('guantu');
      const locked = new Set((getDoublesState().config.matchMutators ?? []).flat());
      expect(locked.size).toBeGreaterThan(0);
      for (let n = 0; n < 20; n++) {
        expect(rerollDoublesFactor(n % 9)).toBe(true);
        for (const f of getDoublesState().factorPool) expect(locked.has(f)).toBe(false);
      }
    });

    it('重揉已落槽项：清空同名槽位并给 warn 提示（契约「已落槽联动」）', () => {
      doublesStart('guantu');
      const fac = getDoublesState().factorPool[0];
      setDoublesFac(0, 0, fac);
      expect(rerollDoublesFactor(0)).toBe(true);
      expect(getDoublesState().selection.slots[0].factors[0]).toBeNull();
      expect(getSelectWarn()).toContain('已重揉');
    });
  });
});
