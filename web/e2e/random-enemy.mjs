// random-enemy.mjs — 随机敌方端到端（Vite SSR 纯逻辑断言，同 run.mjs 模式）。
// 验证：开关 ON→单打/双打每场 roll 合法敌方(race/中文名 ∈ pool 配对)，OFF→全 undefined(不显示)；
//       数据 19 条 / 种族 8·6·5 / id 唯一(GroundClassic·AirClassic 跨种族重名消歧)；分布覆盖 P/T/Z。
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, '..');
const projectRoot = resolve(webRoot, '..');

let failed = false;
function fail(m) { console.error('FAIL: ' + m); failed = true; }
function pass(m) { console.log('PASS: ' + m); }

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
  const { startSession } = await server.ssrLoadModule('/src/logic/jjbSession.ts');
  const { setRandomEnemyEnabled } = await server.ssrLoadModule('/src/logic/randomConfig.ts');
  const { getEnemyRoll } = await server.ssrLoadModule('/src/logic/aiEnemySelector.ts');
  const { AI_ENEMY_POOL, AI_BY_RACE } = await server.ssrLoadModule('/src/data/aiEnemyPool.ts');

  // ① 数据完整性
  if (AI_ENEMY_POOL.length !== 19) fail(`AI 池应 19 条，实际 ${AI_ENEMY_POOL.length}`);
  if (AI_BY_RACE.P.length !== 8 || AI_BY_RACE.T.length !== 6 || AI_BY_RACE.Z.length !== 5)
    fail(`种族分布应 8/6/5，实际 ${AI_BY_RACE.P.length}/${AI_BY_RACE.T.length}/${AI_BY_RACE.Z.length}`);
  const ids = new Set(AI_ENEMY_POOL.map((e) => e.id));
  if (ids.size !== 19) fail(`AI id 应唯一(19)，实际 ${ids.size}（GroundClassic/AirClassic 重名未消歧？）`);
  else pass('AI 数据：19 条 / 种族 8·6·5 / id 唯一(跨种族重名已消歧)');

  // 合法配对：roll 的 (race, nameZh) 必须是 pool 里的真实条目
  const legal = (r) => r && AI_ENEMY_POOL.some((e) => e.race === r.race && e.nameZh === r.nameZh);

  // ② 单打 ON：每场 roll 合法
  setRandomEnemyEnabled(true);
  startSession('std8');
  let ok = true;
  for (let i = 0; i < 3; i++) {
    const r = getEnemyRoll(i);
    if (!r) { fail(`单打 ON 场${i} 应有敌方`); ok = false; }
    else if (!legal(r)) { fail(`单打 ON 场${i} (${r.race},${r.nameZh}) 非法配对`); ok = false; }
  }
  if (ok) pass('单打 ON：3 场各 roll 合法敌方（race/中文名 ∈ pool 配对）');

  // ③ 单打 OFF：全 undefined
  setRandomEnemyEnabled(false);
  startSession('std8');
  let offOk = true;
  for (let i = 0; i < 3; i++) if (getEnemyRoll(i) !== undefined) { fail(`单打 OFF 场${i} 应不显示(undefined)`); offOk = false; }
  if (offOk) pass('单打 OFF：3 场全 undefined（不显示、不占位）');

  // ④ 双打(官突) ON：每场 roll 合法
  setRandomEnemyEnabled(true);
  startSession('doubles');
  let dOk = true;
  for (let i = 0; i < 3; i++) {
    const r = getEnemyRoll(i);
    if (!r) { fail(`双打 ON 场${i} 应有敌方`); dOk = false; }
    else if (!legal(r)) { fail(`双打 ON 场${i} 非法配对`); dOk = false; }
  }
  if (dOk) pass('双打(官突) ON：3 场各 roll 合法敌方');

  // ⑤ 双打(非酋) OFF：全 undefined
  setRandomEnemyEnabled(false);
  startSession('feiqiu-doubles');
  let dOffOk = true;
  for (let i = 0; i < 3; i++) if (getEnemyRoll(i) !== undefined) { fail(`双打 OFF 场${i} 应 undefined`); dOffOk = false; }
  if (dOffOk) pass('双打(非酋) OFF：3 场全 undefined');

  // ⑥ 分布抽样：60 局应覆盖 P/T/Z 三种族（验证不是恒定单一）
  setRandomEnemyEnabled(true);
  const seen = new Set();
  for (let n = 0; n < 60; n++) { startSession('std8'); for (let i = 0; i < 3; i++) { const r = getEnemyRoll(i); if (r) seen.add(r.race); } }
  if (seen.size !== 3) fail(`60 局抽样应覆盖 P/T/Z 三种族，实际只见 ${[...seen].join(',')}`);
  else pass('分布抽样：60 局覆盖 P/T/Z 三种族（随机生效）');

  // ⑦ BUG#2 回归(gate)：roll 过后「只关开关、不重开局」，getEnemyRoll 应立即 undefined。
  //    印花不依赖 _rolls 清空，靠 gate _enabled 兜底（修 bpconfig 关开关后印花残留）。
  setRandomEnemyEnabled(true);
  startSession('std8');
  if (!getEnemyRoll(0)) fail('BUG#2 前置：ON 开局应有 roll');
  setRandomEnemyEnabled(false); // 只关，不重开局、不清 _rolls
  let gateOk = true;
  for (let i = 0; i < 3; i++) if (getEnemyRoll(i) !== undefined) { fail(`BUG#2: 关开关后场${i} 应立即 undefined(gate)`); gateOk = false; }
  if (gateOk) pass('BUG#2 回归(gate)：roll 后仅关开关，印花立即隐藏（不依赖清 _rolls）');
} catch (e) {
  fail('异常: ' + ((e && e.stack) || e));
} finally {
  await server.close();
}

console.log(failed ? '\n[random-enemy] ❌ FAILED' : '\n[random-enemy] ✅ 随机敌方 e2e PASS（开关ON合法/OFF隐藏/单打双打/数据/分布）');
process.exit(failed ? 1 : 0);
