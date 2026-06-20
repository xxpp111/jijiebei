// 「随机敌方」全局开关（设计稿 01：BP 设置面独立分区 + select 顶部镜像，两处共享此状态）。
// 照 bpConfig.ts 形态：内存态 + get/set/toggle，不持久化（每次起服重置，与 BP 开关一致）。

let _enabled = false; // 默认关

export function getRandomEnemyEnabled(): boolean {
  return _enabled;
}
export function setRandomEnemyEnabled(v: boolean): void {
  _enabled = v;
}
export function toggleRandomEnemy(): void {
  _enabled = !_enabled;
}
