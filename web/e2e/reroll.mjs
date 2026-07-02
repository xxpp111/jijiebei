// jjb web 因子「重新揉」(reroll) 专项门。
// Vite SSR 加载 jjbSession，跑三组断言：
//   ① 限次（照抄 bp-rules 范式）：practice 无限不提示 / match 每局限 3 次、超限「超出比赛规则」软违规不执行。
//   ② 不重复：reroll 后新因子 ≠ 旧 且 ∉ 当前 3 场已用集合（getJijieFactor 只从活池抽）。
//   ③ 难度实时重算：difficultyTotal 随 reroll 精确变 = D0 - 旧分 + 新分。
// 覆盖两种落点：池候选（randomFactorPoor[i]）、已落槽手选（selectedFactorList[facFlatIdx]）。
// Batch C：std15 已改双打且 v1 砍 reroll（D5），原 std15 场上用例迁移为 std10 池候选用例。
// 零额外依赖（vite 已装；与 run.mjs / bp-rules.mjs 同框架）。
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, '..');
const projectRoot = resolve(webRoot, '..');

let failed = false;
function fail(msg) { console.error('FAIL: ' + msg); failed = true; }
function pass(msg) { console.log('PASS: ' + msg); }

const server = await createServer({
  root: webRoot,
  configFile: false,
  resolve: { alias: { '@logic': resolve(projectRoot, 'assets/Script/jijie2'), '@jjb': resolve(projectRoot, 'assets/Script/jjbDesign') } },
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
  ssr: { noExternal: true, target: 'node' },
});

try {
  globalThis.window = globalThis.window || globalThis;
  const mod = await server.ssrLoadModule('/src/logic/jjbSession.ts');
  const {
    startSession, getSelectState, setRuleMode, setSelectedFac,
    rerollFactor, getRerollState, getSelectWarn, factorScore, difficultyTotal,
  } = mod;
  const jdmod = await server.ssrLoadModule('/src/logic/legacy/JJBData.ts');
  const { facFlatIdx } = jdmod;

  // ===== ①-A + ②：std10 池候选 reroll（不重复；池候选不入难度分，难度应不变） =====
  globalThis.window.__jjbDebug = undefined;
  setRuleMode('practice');
  startSession('std10');
  const s = getSelectState();
  const pool0 = (s.randomFactorPoor || []).slice(); // std10 池 = Σ手选槽 = 7（2/2/3；10 因子 = 3 锁定 + 7 池）
  if (pool0.length !== s.sumSlots) fail(`std10 池应 = Σ槽 ${s.sumSlots}, got=${pool0.length}`);
  const usedBefore = new Set([...(s.lockFactorList || []), ...pool0]); // 当前 3 场在场集（锁定∪池）
  const oldFac = pool0[0];
  const D0 = difficultyTotal();

  const ok = rerollFactor('pool', 0); // 换池第 1 个候选
  if (!ok) fail('std10 pool reroll 应成功(practice 无限)');
  const s2 = getSelectState();
  const nf = (s2.randomFactorPoor || [])[0];
  if (nf === oldFac) fail(`② pool: reroll 后应换成新因子, 仍=${oldFac}`);
  if (usedBefore.has(nf)) fail(`② pool: 新因子 ${nf} 不应 ∈ 当前 3 场已用集合(不重复)`);
  const dupCount = (s2.randomFactorPoor || []).filter((x) => x === nf).length;
  if (dupCount !== 1) fail(`② pool: 新因子 ${nf} 应仅出现 1 次, got=${dupCount}`);
  const D1 = difficultyTotal();
  if (D1 !== D0) fail(`①-A pool: 池候选不入难度分, 难度应不变 ${D0}, got=${D1}`);
  pass(`①-A + ② std10 池候选: reroll ${oldFac}(→${nf}) 不重复 ∉ 在场集 + 难度 ${D0} 不变(池候选不入难度) ✓`);

  // ===== ①-B practice 无限：连揉多次全成功、不提示 =====
  let allOk = true;
  for (let n = 0; n < 8; n++) { if (!rerollFactor('pool', n % pool0.length)) allOk = false; }
  if (!allOk) fail('①-B practice: 连揉 8 次应全成功(无限)');
  if (getSelectWarn()) fail(`①-B practice: 不应有软违规提示, got=${getSelectWarn()}`);
  if (getRerollState().count < 9) fail(`①-B practice: count 应累加≥9, got=${getRerollState().count}`);
  pass(`①-B practice 无限: 连揉 8 次全成功、零提示、count=${getRerollState().count} ✓`);

  // ===== ①-C match 限次：每局限 3、超限软违规不执行 =====
  globalThis.window.__jjbDebug = undefined;
  setRuleMode('match');
  startSession('std10'); // startSession 重置 rerollCount
  const rs0 = getRerollState();
  if (rs0.count !== 0 || rs0.limit !== 3 || rs0.remaining !== 3) fail(`①-C match: 开局应 {0,3,3}, got=${JSON.stringify(rs0)}`);
  for (let n = 0; n < 3; n++) {
    if (!rerollFactor('pool', n)) fail(`①-C match: 第 ${n + 1} 次(限内)应成功`);
  }
  if (getRerollState().remaining !== 0) fail(`①-C match: 3 次后 remaining 应 0, got=${getRerollState().remaining}`);
  const over = rerollFactor('pool', 4); // 第 4 次超限
  if (over) fail('①-C match: 第 4 次超限应返回 false(不执行)');
  if (!getSelectWarn().includes('超出比赛规则')) fail(`①-C match: 超限应提示「超出比赛规则」, got=${getSelectWarn()}`);
  if (getRerollState().count !== 3) fail(`①-C match: 超限不计数, count 应 3, got=${getRerollState().count}`);
  pass('①-C match 限次: 每局 3 次内成功 / 第 4 次「超出比赛规则」软违规不执行不计数 ✓');

  // ===== ②+③ 已落槽手选 reroll（普通模式 std10：slot 因子进难度） =====
  globalThis.window.__jjbDebug = undefined;
  setRuleMode('practice');
  startSession('std10');
  const s10 = getSelectState();
  const poolFac = (s10.randomFactorPoor || []).slice();
  const oldSlot = poolFac[0];
  setSelectedFac(0, 0, oldSlot); // 落进第 1 场第 1 槽
  const oldSlotScore = factorScore(oldSlot);
  const Ds0 = difficultyTotal(); // 含 3 场锁定 + 该 slot 因子
  const okSlot = rerollFactor('slot', 0, 0);
  if (!okSlot) fail('已落槽 reroll 应成功');
  const s10b = getSelectState();
  const nfSlot = (s10b.selectedFactorList || [])[facFlatIdx(0, 0)];
  if (nfSlot === oldSlot) fail(`② 已落槽: reroll 后应换成新因子, 仍=${oldSlot}`);
  const usedSlotSet = new Set([...(s10.lockFactorList || []), ...poolFac]);
  if (usedSlotSet.has(nfSlot)) fail(`② 已落槽: 新因子 ${nfSlot} 不应 ∈ 锁定∪池(不重复)`);
  const Ds1 = difficultyTotal();
  const nfSlotScore = factorScore(nfSlot);
  if (Ds1 !== Ds0 - oldSlotScore + nfSlotScore) fail(`③ 已落槽: 难度应 ${Ds0 - oldSlotScore + nfSlotScore}, got=${Ds1}`);
  pass(`②+③ 已落槽手选: slot(0,0) ${oldSlot}→${nfSlot} 不重复 + 难度 ${Ds0}→${Ds1} 实时重算 ✓`);

  console.log('\n[reroll] ✅ 重揉门：限次(practice无限/match限3超软违规不执行) + 不重复(∉在场集) + 难度实时重算 全覆盖 PASS');
} catch (e) {
  fail(`reroll: 异常 ${e && e.stack ? e.stack : e}`);
} finally {
  await server.close();
}

if (failed) { console.error('\n[reroll] ❌ 至少 1 断言失败'); process.exit(1); }
