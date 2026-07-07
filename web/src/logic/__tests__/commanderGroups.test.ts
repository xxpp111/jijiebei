// commanderGroups.test — COMMANDERS.group 必须与 jjdata/指挥官配置.txt 第 2 列一致。
// 防止双打 A/B 池从 config 化后与真实 CSV 静默漂移。
import { describe, it, expect } from 'vitest';
import commanderCsv from '../../data/jjdata/指挥官配置.txt?raw';
import { COMMANDERS } from '../../config/commanders';

function csvGroups(): Array<{ name: string; group: 'A' | 'B' }> {
  return commanderCsv.trim().split(/\r?\n/).slice(1).map((line) => {
    const [name, group] = line.split(',');
    if (group !== 'A' && group !== 'B') throw new Error(`bad commander group: ${line}`);
    return { name, group };
  });
}

describe('COMMANDERS group 数据', () => {
  it('official 指挥官 group 与 jjdata CSV 第 2 列逐项一致', () => {
    const fromConfig = COMMANDERS
      .filter((c) => c.source === 'official')
      .map((c) => ({ name: c.name, group: c.group }));
    expect(fromConfig).toEqual(csvGroups());
  });

  it('A/B 组顺序保持原 jjbDoubles 硬编码顺序', () => {
    expect(COMMANDERS.filter((c) => c.group === 'A').map((c) => c.name)).toEqual([
      '雷诺', '凯瑞甘', '阿塔尼斯', '斯旺', '扎加拉', '沃拉尊',
      '阿巴瑟', '阿纳拉克', '斯图科夫', '菲尼克斯', '米拉',
    ]);
    expect(COMMANDERS.filter((c) => c.group === 'B').map((c) => c.name)).toEqual([
      '凯拉克斯', '诺娃', '德哈卡', '泰凯斯', '泽拉图', '斯台特曼', '蒙斯克',
    ]);
  });

  it('CM 自定义指挥官不带官方 A/B group', () => {
    expect(COMMANDERS.filter((c) => c.source === 'cm').every((c) => c.group === undefined)).toBe(true);
  });
});
