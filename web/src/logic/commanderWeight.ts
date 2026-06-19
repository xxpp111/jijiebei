// 指挥官降权抽样（yb 2026-06-19 拍板「降权要做」）。
// 德哈卡 / 泰凯斯 权重 0.25 ≈ 正常出场率的 1/4，其余指挥官权重 1.0。
// 加权无放回抽样，供单打(jjbSession toSelectCore B 组)与双打(jjbDoubles doublesStart B 组)共用。
// 注：德哈卡/泰凯斯均属 B 组（强档），故仅 B 组抽取接此 helper；A 组无降权指挥官，保持等概率。
export const COMMANDER_WEIGHTS: Record<string, number> = { 德哈卡: 0.25, 泰凯斯: 0.25 };

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
