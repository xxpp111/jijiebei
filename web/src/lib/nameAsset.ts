// 真实中文名 → design/v4-r2 PNG（design-relative rel；组件内部再 dz() 成 Vite URL）。
// 真实赛事 6 指挥官 + 6 因子 + design 资源完美对位；地图按场次 index 取 design 3 张示例图
// （真实地图名很多、design 仅 3 张示例，PoC 用 index 循环——地图名文字仍是真实 sessionMatches 值）。
// 未映射的名 fallback 默认图：不缺图，且设计精度对比看的是边框/文字/圆角/主题，不依赖图内容准确。
const CMD: Record<string, string> = {
  雷诺: 'assets/cmd-raynor.png',
  凯瑞甘: 'assets/cmd-kerrigan.png',
  阿塔尼斯: 'assets/cmd-artanis.png',
  诺娃: 'assets/cmd-nova.png',
  泰凯斯: 'assets/cmd-tychus.png',
  德哈卡: 'assets/cmd-dehaka.png',
};
const FAC: Record<string, string> = {
  暴风雪: 'assets/factor-blizzard.png',
  核弹打击: 'assets/factor-nuke.png',
  丧尸大战: 'assets/factor-zombie.png',
  虚空裂隙: 'assets/factor-void.png',
  岩浆爆发: 'assets/factor-lava.png',
  相互摧毁: 'assets/factor-money.png',
};
const MAP_BY_IDX = ['assets/map-korhal.png', 'assets/map-darkstar.png', 'assets/map-temple.png'];

export function cmdRel(name: string): string {
  return CMD[name] || 'assets/cmd-raynor.png';
}
export function facRel(name: string): string {
  return FAC[name] || 'assets/factor-blizzard.png';
}
export function mapRelByIdx(i: number): string {
  return MAP_BY_IDX[i % MAP_BY_IDX.length];
}
export function logoRel(_style: string, _mode: string): string {
  // 用户决策：所有皮肤 × 明暗统一金色浮雕 logo（金色联名是品牌核心）；对齐 jjbDesign JJBData.markFor。
  return 'assets/logo-cm-gold.png';
}
