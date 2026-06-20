// 敌方 AI 体系数据：种族(神族P/人族T/虫族Z) + 19 种敌军组合（残酷难度全集）。
// 来源：workflow 三源互证(starcraft2coop / 灰机wiki / Fandom)，2026-06-20。
// id 用 `${race}_${内部名}` 避免 GroundClassic/AirClassic 跨种族重名；展示只用 nameZh。

export type RaceCode = 'P' | 'T' | 'Z';

export interface AIEnemy {
  id: string;
  race: RaceCode;
  nameZh: string;
  nameEn: string; // 内部名(编辑器标识)，展示不用，留作对照/调试
}

export const RACES: Array<{ code: RaceCode; nameZh: string; nameEn: string }> = [
  { code: 'P', nameZh: '神族', nameEn: 'PROTOSS' },
  { code: 'T', nameZh: '人族', nameEn: 'TERRAN' },
  { code: 'Z', nameZh: '虫族', nameEn: 'ZERG' },
];

export const AI_ENEMY_POOL: AIEnemy[] = [
  // 神族 P（8）
  { id: 'P_Gateway', race: 'P', nameZh: '大师机械', nameEn: 'Gateway' },
  { id: 'P_RoboColossus', race: 'P', nameZh: '步战机甲', nameEn: 'RoboColossus' },
  { id: 'P_RoboReaver', race: 'P', nameZh: '袭扰炮击', nameEn: 'RoboReaver' },
  { id: 'P_SkytossCarrier', race: 'P', nameZh: '卡莱的希望', nameEn: 'SkytossCarrier' },
  { id: 'P_SkytossTempest', race: 'P', nameZh: '风暴迫临', nameEn: 'SkytossTempest' },
  { id: 'P_Techy', race: 'P', nameZh: '暗影袭扰', nameEn: 'Techy' },
  { id: 'P_GroundClassic', race: 'P', nameZh: '艾尔先锋', nameEn: 'GroundClassic' },
  { id: 'P_AirClassic', race: 'P', nameZh: '族长之军', nameEn: 'AirClassic' },
  // 人族 T（6）
  { id: 'T_BioMechStar', race: 'T', nameZh: '突击团', nameEn: 'BioMechStar' },
  { id: 'T_MechStarport', race: 'T', nameZh: '战争机械团', nameEn: 'MechStarport' },
  { id: 'T_ShadowTech', race: 'T', nameZh: '暗影科技团', nameEn: 'ShadowTech' },
  { id: 'T_SkyTerran', race: 'T', nameZh: '帝国战斗群', nameEn: 'SkyTerran' },
  { id: 'T_BioClassic', race: 'T', nameZh: '旧世步兵团', nameEn: 'BioClassic' },
  { id: 'T_MechClassic', race: 'T', nameZh: '旧世机械团', nameEn: 'MechClassic' },
  // 虫族 Z（5）
  { id: 'Z_Ground', race: 'Z', nameZh: '肆虐扩散', nameEn: 'Ground' },
  { id: 'Z_MutaLing', race: 'Z', nameZh: '滋生腐化', nameEn: 'MutaLing' },
  { id: 'Z_Swarmy', race: 'Z', nameZh: '爆炸威胁', nameEn: 'Swarmy' },
  { id: 'Z_GroundClassic', race: 'Z', nameZh: '侵略虫群', nameEn: 'GroundClassic' },
  { id: 'Z_AirClassic', race: 'Z', nameZh: '遮天蔽日', nameEn: 'AirClassic' },
];

export const AI_BY_RACE: Record<RaceCode, AIEnemy[]> = {
  P: AI_ENEMY_POOL.filter((e) => e.race === 'P'),
  T: AI_ENEMY_POOL.filter((e) => e.race === 'T'),
  Z: AI_ENEMY_POOL.filter((e) => e.race === 'Z'),
};

export function raceNameZh(code: RaceCode): string {
  return RACES.find((r) => r.code === code)?.nameZh ?? code;
}
