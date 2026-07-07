// 「随机敌方」全局开关（设计稿 01：BP 设置面独立分区 + select 顶部镜像，两处共享此状态）。
// localStorage 持久化（设备级，与「记住我」jjb_auth 同口径）：群反馈「每次进都要重新勾选」，
// 刷新/重开标签保留上次勾选；node(window undefined) 与存储异常回默认关，e2e SSR 直调不受影响。

const KEY = 'jjb_random_enemy';

function loadEnabled(): boolean {
  try { return window.localStorage?.getItem(KEY) === '1'; } catch { return false; }
}
let _enabled = typeof window !== 'undefined' ? loadEnabled() : false; // 默认关

function persist(): void {
  try { window.localStorage?.setItem(KEY, _enabled ? '1' : '0'); } catch { /* noop */ }
}

export function getRandomEnemyEnabled(): boolean {
  return _enabled;
}
export function setRandomEnemyEnabled(v: boolean): void {
  _enabled = v;
  persist();
}
export function toggleRandomEnemy(): void {
  _enabled = !_enabled;
  persist();
}
