// 集结杯擅长指挥官全量枚举（选手注册选填用）。
// 18 官方 SC2 合作指挥官（= web/src/data/jjdata/指挥官配置.txt 抽签池全量，种族取该表阵营列）
//   + 4 CM 自定义指挥官（用户 2026-06-27 给定）。CM 种族未核实故不标，UI 单列「CM 指挥官」分组。
export interface CommanderDef { name: string; race?: 'P' | 'T' | 'Z'; source: 'official' | 'cm' }

export const COMMANDERS: readonly CommanderDef[] = [
  { name: '雷诺', race: 'T', source: 'official' },
  { name: '凯瑞甘', race: 'Z', source: 'official' },
  { name: '阿塔尼斯', race: 'P', source: 'official' },
  { name: '斯旺', race: 'T', source: 'official' },
  { name: '扎加拉', race: 'Z', source: 'official' },
  { name: '沃拉尊', race: 'P', source: 'official' },
  { name: '凯拉克斯', race: 'P', source: 'official' },
  { name: '阿巴瑟', race: 'Z', source: 'official' },
  { name: '阿纳拉克', race: 'P', source: 'official' },
  { name: '诺娃', race: 'T', source: 'official' },
  { name: '斯图科夫', race: 'Z', source: 'official' },
  { name: '菲尼克斯', race: 'P', source: 'official' },
  { name: '德哈卡', race: 'Z', source: 'official' },
  { name: '米拉', race: 'T', source: 'official' }, // 韩 & 霍纳
  { name: '泰凯斯', race: 'T', source: 'official' },
  { name: '泽拉图', race: 'P', source: 'official' },
  { name: '斯台特曼', race: 'Z', source: 'official' },
  { name: '蒙斯克', race: 'T', source: 'official' },
  // CM 自定义（种族待核，不标）
  { name: '诺温', source: 'cm' },
  { name: '莫比斯（杜兰）', source: 'cm' },
  { name: '塞伯鲁斯（塔利斯·柯根）', source: 'cm' },
  { name: '瓦伦里安', source: 'cm' },
];
