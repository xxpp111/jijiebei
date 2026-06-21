// jjb web BP 规则专项门（P1b done-when 1-6 综合）。
// Vite SSR 加载 jjbSession + jjbDoubles + bpConfig，跑 BP 规则断言。零额外依赖（vite 已装；与 run.mjs 同框架）。
// 聚焦 done-when 5(双打 2A1B 不拦+cmdPool=6) + done-when 6(feiqiu-doubles=locked) + done-when 1-4 综合 smoke。
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
    startSession, getSelectState, validate,
    setSelectedCmd, toggleBanFactor, getBpState,
    setRuleMode, getSelectWarn, getBpExclusive,
  } = mod;
  const dmod = await server.ssrLoadModule('/src/logic/jjbDoubles.ts');
  const { getDoublesState, validateDoubles, randomFillDoubles, doublesLive } = dmod;
  const cmod = await server.ssrLoadModule('/src/logic/bpConfig.ts');
  const { getBpModeState } = cmod;

  // ===== done-when 6：bpConfig feiqiu-doubles 键 locked(显式键) + 既有6键状态不变 =====
  if (getBpModeState('feiqiu-doubles') !== 'locked') fail(`done6: feiqiu-doubles 应 locked, got=${getBpModeState('feiqiu-doubles')}`);
  const expectKeys = { std8: 'on', std10: 'on', std12: 'offable', rescue: 'offable', feiqiu: 'offable', doubles: 'locked' };
  for (const [k, v] of Object.entries(expectKeys)) {
    if (getBpModeState(k) !== v) fail(`done6: 既有键 ${k} 应 ${v}, got=${getBpModeState(k)}`);
  }
  pass('done-when 6: feiqiu-doubles=locked(显式键不再 fallback) + 既有6键(std8/std10 on·std12/rescue/feiqiu offable·doubles locked) 不变');

  // ===== done-when 5：双打(doubles + feiqiu-doubles)走独立池 cmdPool=6 + validateDoubles 无 2A1B 配额(不拦) =====
  for (const dmode of ['doubles', 'feiqiu-doubles']) {
    globalThis.window.__jjbDebug = undefined;
    setRuleMode('match'); // 即使比赛态，双打也不触发单打 2A1B（走独立 validateDoubles）
    startSession(dmode);
    if (!doublesLive()) fail(`done5 ${dmode}: doublesLive 应 true`);
    const st = getDoublesState();
    if (st.config.cmdPoolSize !== 6) fail(`done5 ${dmode}: cmdPoolSize 应 6(A4+B2 纯随机), got=${st.config.cmdPoolSize}`);
    if ((st.commanderPool || []).length !== 6) fail(`done5 ${dmode}: commanderPool 应 6, got=${(st.commanderPool || []).length}`);
    randomFillDoubles();
    const vd = validateDoubles();
    if (!vd.ok) fail(`done5 ${dmode}: 双打全填 validateDoubles 应通过(无 2A1B 拦), err=${JSON.stringify(vd.errors)}`);
    if ((vd.errors || []).some((e) => e.includes('A组') || e.includes('B组'))) fail(`done5 ${dmode}: 双打不应有 A/B 配额拦, got=${JSON.stringify(vd.errors)}`);
    pass(`done-when 5: ${dmode} 走独立池(cmdPool=6 纯随机不分A/B配额) + validateDoubles 无 2A1B(A/B 不拦) ✓`);
  }

  // ===== done-when 1+2：同引擎 practice/match 分流 + ban 不强拦 =====
  globalThis.window.__jjbDebug = undefined;
  setRuleMode('practice');
  startSession('std10');
  const sp = getSelectState();
  toggleBanFactor((sp.randomFactorPoor || [])[0]); toggleBanFactor((sp.randomFactorPoor || [])[1]);
  if (getBpState().banned.length !== 2) fail('done1: practice 态 ban 2 个应无限制累加');
  if (getSelectWarn()) fail('done1: practice 态 ban 不应提示');
  setRuleMode('match');
  startSession('std10');
  const sm = getSelectState();
  toggleBanFactor((sm.randomFactorPoor || [])[0]);
  toggleBanFactor((sm.randomFactorPoor || [])[1]); // 第2个被挡
  if (getBpState().banned.length !== 1) fail('done2: match 态 ban 上限 1');
  if (!getSelectWarn().includes('超出比赛规则')) fail('done2: match 禁第2个应提示「超出比赛规则」');
  pass('done-when 1+2: 同引擎 practice(无限不提示)/match(上限1超出「超出比赛规则」不强拦) 分流 ✓');

  // ===== done-when 3：2A1B（std8 单刷三模式纳入）=====
  setRuleMode('match');
  startSession('std8');
  const s8 = getSelectState();
  const a8 = (s8.randomCommanderPoorA || []).filter((c) => c !== '自选');
  if (a8.length >= 3) {
    setSelectedCmd(0, a8[0]); setSelectedCmd(1, a8[1]); setSelectedCmd(2, a8[2]); // 3A
    const v8 = validate();
    if (!v8.warnings.some((w) => w.includes('A组'))) fail(`done3: std8 3A 应报 A组 软违规, got=${JSON.stringify(v8.warnings)}`);
    if (v8.errors.some((e) => e.includes('A组'))) fail(`done3: std8 A组超额不应进硬错误, got=${JSON.stringify(v8.errors)}`);
  } else {
    fail(`done3: std8 A 池应 >=3, got=${a8.length}`);
  }
  pass('done-when 3: std8(单刷三模式)纳入 2A1B(3A→A组软违规不强拦) ✓');

  // ===== done-when 4：二选一互斥 + bpExclusive 可读 =====
  setRuleMode('match');
  startSession('std10');
  const s10 = getSelectState();
  if (getBpExclusive() !== null) fail(`done4: 初始 bpExclusive 应 null, got=${getBpExclusive()}`);
  toggleBanFactor((s10.randomFactorPoor || [])[0]);
  if (getBpExclusive() !== 'ban') fail(`done4: ban 后 bpExclusive 应 'ban', got=${getBpExclusive()}`);
  const self10 = (s10.selfPool || [])[0];
  if (self10) {
    setSelectedCmd(0, self10);
    if (getBpExclusive() !== 'conflict') fail(`done4: ban+自选 bpExclusive 应 'conflict', got=${getBpExclusive()}`);
    if (!getSelectWarn().includes('二选一')) fail(`done4: ban+自选应即时提示二选一, got=${getSelectWarn()}`);
    const v10 = validate();
    if (!v10.warnings.some((w) => w.includes('二选一'))) fail(`done4: validate 应报二选一软违规, got=${JSON.stringify(v10.warnings)}`);
  } else {
    fail('done4: std10 selfPool 应非空');
  }
  pass('done-when 4: 二选一互斥(ban⊕自选) bpExclusive(null→ban→conflict) + 即时提示 + validate 软违规 ✓');

  console.log('\n[bp-rules] ✅ BP 规则 done-when 1-6 全覆盖 PASS');
} catch (e) {
  fail(`bp-rules: 异常 ${e && e.message ? e.message : e}`);
} finally {
  await server.close();
}

if (failed) { console.error('\n[bp-rules] ❌ 至少 1 断言失败'); process.exit(1); }
