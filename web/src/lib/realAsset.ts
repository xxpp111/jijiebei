// realAsset — 真实游戏图（assets/resources/images 中文名 PNG）→ Vite URL，与 Cocos 真身同源。
// 根治 nameAsset 的有损 design 占位映射：地图/指挥官/因子按真实中文名直接命中（实测 maps15/commander93/
// factor82 齐备、逐字对齐 JijieData 输出），杜绝「沃拉尊画成雷诺、地图按 index 循环艺术字≠真实名」。
// logo 是品牌 dM 字标、真实游戏图无独立件，沿用 design 金色 logo（对齐 JJBData.markFor 全皮肤统一金色）。
import { dz } from './designAssets';

const real = import.meta.glob('../images/**/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

function pick(dir: string, name: string): string {
  if (!name || name === '—') return '';
  const target = '/images/' + dir + '/' + name + '.png';
  for (const k in real) if (k.endsWith(target)) return real[k];
  // eslint-disable-next-line no-console
  console.warn('[realAsset] 缺图:', dir, name);
  return ''; // 空串不显示破图，比错图诚实
}

export const mapUrl = (name: string): string => pick('maps', name);
export const cmdUrl = (name: string): string => pick('commander', name);
export const facUrl = (name: string): string => pick('factor', name);

// 种族印花（随机敌方）：web 侧素材 web/src/assets/races/race-{protoss,terran,zerg}.png（非 assets/resources 红线）。
// 印花 png 入库前 glob 为空 → raceUrl 返回 ''，EnemyBadge 走种族文字徽章兜底；入库后自动命中真图。
const raceImgs = import.meta.glob('../assets/races/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const RACE_FILE: Record<'P' | 'T' | 'Z', string> = { P: 'race-protoss', T: 'race-terran', Z: 'race-zerg' };
export const raceUrl = (code: 'P' | 'T' | 'Z'): string => {
  const target = '/races/' + RACE_FILE[code] + '.png';
  for (const k in raceImgs) if (k.endsWith(target)) return raceImgs[k];
  return '';
};
// logo：品牌 dM 字标，真实游戏图无独立件，沿用 design 金色 logo（全皮肤统一；保留 style/mode 入参供将来分皮肤）。
export const logoUrl = (_style?: string, _mode?: string): string => dz('assets/logo-cm-gold.png');
// 集结杯艺术字标题（真实图 images/brand/jjb-title-{style}-{mode}.png，对齐后端 JJBHome/JJBResult 的 jjb-title sprite）。
export const titleUrl = (style: string, mode: string): string => pick('brand', `jjb-title-${style}-${mode}`);
