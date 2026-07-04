import ConfigData from '../legacy/JJConfigData';
export { jjbLive } from '../legacy/JJBData';

// 真实 csv（\r\n 分隔），编译期 raw 捆绑——无 fetch 时序、build 后亦可用。
const csv = import.meta.glob('../../data/jjdata/*.txt', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
function csvText(name: string): string {
  for (const k in csv) if (k.endsWith('/' + name)) return csv[k];
  throw new Error('[jjbSession] csv not found: ' + name);
}

let configInited = false;
// ConfigData.init(rule, map, commander, factor, ban) —— 参数顺序见 JJConfigData.init 签名。
function doInit(): void {
  ConfigData.init(
    csvText('规则参数配置.txt'),
    csvText('地图配置.txt'),
    csvText('指挥官配置.txt'),
    csvText('因子配置.txt'),
    csvText('ban指挥官.txt'),
  );
}
function initConfigOnce(): void {
  if (configInited) return;
  doInit();
  configInited = true;
}

/** 重置 ConfigData 母池（重跑 init 重建 factorList/commanderList/mapGrid/commadnerGroupList）。
 *  镜像 JJBDesignBoot.restoreConfigData：每局必调，防 factorList 枯竭 + 地图累积。 */
export function restoreConfig(): void {
  initConfigOnce();
  doInit();
}

export const rand = (n: number) => Math.floor(Math.random() * n);

export type SessionMode = 'std8' | 'std10' | 'std12' | 'rescue' | 'one-a' | 'hard1' | 'hard2' | 'feiqiu' | 'std15' | 'cm' | 'suiji' | 'doubles' | 'feiqiu-doubles';

/** URL 赛事模式白名单（App.tsx 与 SelectScreen.tsx 共用，避免重复定义）。
 *  suiji 第五格入口已由 feiqiu 顶替下线：故移出 URL 白名单 → ?mode=suiji / ?sessionMode=suiji 回落 std8。
 *  'suiji' 仍保留在 SessionMode 类型与 setModeFlags 内（startSession('suiji') 与 e2e 9 模式恒等式回归依赖），仅非 URL/首页可达。
 *  'doubles' 双打入白名单：官突双打。'feiqiu-doubles'：飞球（非酋）双打，混乱工作室+随机1替代官突 CSV 池。 */
const URL_SESSION_MODES: readonly SessionMode[] = ['std8', 'std10', 'std12', 'rescue', 'one-a', 'hard1', 'hard2', 'feiqiu', 'std15', 'cm', 'doubles', 'feiqiu-doubles'];

/** 解析 URL 赛事模式：优先 ?sessionMode=（白名单），兼容旧 ?mode=std10；非法/主题值(dark/light)回落 std8。
 *  SSR（typeof window==='undefined'）守卫防 Node 端崩。App.tsx 与 SelectScreen.tsx 共用此函数（LOW2 去重）。 */
export function querySessionMode(): SessionMode {
  if (typeof window === 'undefined') return 'std8';
  const p = new URLSearchParams(window.location.search);
  const explicit = p.get('sessionMode');
  if (explicit && (URL_SESSION_MODES as readonly string[]).includes(explicit)) return explicit as SessionMode;
  const legacy = p.get('mode');
  return legacy && (URL_SESSION_MODES as readonly string[]).includes(legacy) ? (legacy as SessionMode) : 'std8';
}
