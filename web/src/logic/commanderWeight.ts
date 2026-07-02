// 指挥官降权抽样（yb 2026-06-19 拍板「降权要做」）。
// 德哈卡 / 泰凯斯 权重 0.25 ≈ 正常出场率的 1/4，其余指挥官权重 1.0。
// 加权无放回抽样，供单打(jjbSession toSelectCore B 组)与双打(jjbDoubles doublesStart B 组)共用。
// 注：德哈卡/泰凯斯均属 B 组（强档），故仅 B 组抽取接此 helper；A 组无降权指挥官，保持等概率。
// CM 自制指挥官升权 2.0（D10 起步值，yb 拍板「权重起步，跑完看分布再调」）：
//   仅 cm 双打 B 组混抽命中（官方单打/其他双打池不含 CM 名，权重表命不中即 1.0，零影响）。
import { COMMANDERS } from '../config/commanders';
const CM_WEIGHT = 2;
export const COMMANDER_WEIGHTS: Record<string, number> = {
  德哈卡: 0.25,
  泰凯斯: 0.25,
  ...Object.fromEntries(COMMANDERS.filter((c) => c.source === 'cm').map((c) => [c.name, CM_WEIGHT])),
};

export function commanderWeightOf(name: string): number {
  return COMMANDER_WEIGHTS[name] ?? 1;
}

/** 从 pool 加权无放回抽 k 个（按 COMMANDER_WEIGHTS）。pool 不被修改（内部 slice 副本）。 */
export function weightedSampleNoReplace(pool: string[], k: number): string[] {
  const items = pool.slice();
  const out: string[] = [];
  for (let n = 0; n < k && items.length > 0; n++) {
    const total = items.reduce((s, x) => s + commanderWeightOf(x), 0);
    let r = Math.random() * total;
    let i = 0;
    for (; i < items.length - 1; i++) {
      r -= commanderWeightOf(items[i]);
      if (r <= 0) break;
    }
    out.push(items[i]);
    items.splice(i, 1);
  }
  return out;
}
