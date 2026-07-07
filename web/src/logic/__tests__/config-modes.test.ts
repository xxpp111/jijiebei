// config-modes.test — MODE_DEFS 声明配置单一真相源直接断言（#77 收敛后此前零直测）。
// 防的是：手改 config/modes.ts 打错某个 key 的 BP 态 / 清空某个 label，SelectScreen「比赛模式」栏空白、
//   或双打模式误开 BP 阶段（bpLocked=false），而无任何测试拦截（bp-rules 只间接覆盖部分键）。
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  MODE_DEFS,
  BP_MODE_KEYS,
  HOME_MODE_KEYS,
  URL_MODE_KEYS,
  doublesLabelFor,
  doublesModeLabelFor,
  lockTagFor,
  slotTagFor,
} from '../../config/modes';
import { querySessionMode } from '../jjbSession';

function codecModeCodesFromSource(): string[] {
  const src = readFileSync(resolve(process.cwd(), 'src/logic/codec.ts'), 'utf8');
  const match = src.match(/const MODE_CODES:[\s\S]*?=\s*\[([\s\S]*?)\];/);
  if (!match) throw new Error('MODE_CODES literal not found in codec.ts');
  return Array.from(match[1].matchAll(/'([^']+)'/g)).map((m) => m[1]);
}

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

  it('codec MODE_CODES 集合与 MODE_DEFS keys 集合一致（codec.ts schema v1 外部对账）', () => {
    expect([...codecModeCodesFromSource()].sort()).toEqual(Object.keys(MODE_DEFS).sort());
  });

  it('URL/HOME/BP 派生白名单内容和顺序保持旧行为', () => {
    expect(URL_MODE_KEYS).toEqual(['std8', 'std10', 'std12', 'rescue', 'one-a', 'hard1', 'hard2', 'feiqiu', 'std15', 'cm', 'doubles', 'feiqiu-doubles']);
    expect(HOME_MODE_KEYS).toEqual(['std8', 'std10', 'std12', 'rescue', 'feiqiu-doubles', 'doubles', 'std15', 'cm']);
    expect(BP_MODE_KEYS).toEqual(['std8', 'std10', 'std12', 'rescue', 'feiqiu', 'doubles', 'std15', 'cm']);
  });

  it('querySessionMode 仍拒绝 suiji URL，并接受 URL 派生白名单', () => {
    const original = globalThis.window;
    for (const mode of URL_MODE_KEYS) {
      (globalThis as any).window = { location: { search: `?sessionMode=${mode}` } };
      expect(querySessionMode()).toBe(mode);
    }
    (globalThis as any).window = { location: { search: '?sessionMode=suiji' } };
    expect(querySessionMode()).toBe('std8');
    (globalThis as any).window = original;
  });

  it('双打 label / lockTag / slotTag 从 MODE_DEFS 读取且覆盖四 variant', () => {
    expect(doublesModeLabelFor('doubles')).toBe('双打模式 · 官突');
    expect(doublesModeLabelFor('feiqiu-doubles')).toBe('双打模式 · 非酋');
    expect(doublesModeLabelFor('std15')).toBe('双打模式 · 15因子');
    expect(doublesModeLabelFor('cm')).toBe('双打模式 · CM');
    expect(doublesLabelFor('doubles')).toBe('双打 · 官突');
    expect(doublesLabelFor('feiqiu-doubles')).toBe('双打 · 非酋');
    expect(doublesLabelFor('std15')).toBe('双打 · 15因子');
    expect(doublesLabelFor('cm')).toBe('双打 · CM');

    expect(lockTagFor('feiqiu-doubles')).toBe('非酋');
    expect(lockTagFor('doubles')).toBe('官突');
    expect(lockTagFor('std15')).toBe('待选');
    expect(lockTagFor('cm')).toBe('锁定');

    expect(slotTagFor('feiqiu-doubles', { extraFactors: 3 })).toBe('非酋');
    expect(slotTagFor('std15', { extraFactors: 5 })).toBe('待选 5');
    expect(slotTagFor('cm', { extraFactors: 4 })).toBe('锁定 2 + 待选 4');
    expect(slotTagFor('doubles', { mutatorName: '聚铁成兵' })).toBe('官突 聚铁成兵');
  });
});
