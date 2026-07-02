// codec e2e — 码方案编解码往返等价 + 三道闸断言（P3 · 本 round 确定性 gate）。
// 阶段 1：Vite SSR 加载 codec.ts + jjbSession.ts，9 模式 + 双打 capturePayload→encode→decode 深比对。
// 阶段 2：三道闸（version / pool / invalid）+ 越界 idx + 随机敌方 ON 往返 + 码长报告。
// 纯逻辑断言，不渲染 React，不依赖 dist 产物。参考 e2e/run.mjs 的 Vite SSR 模式。
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, '..');
const projectRoot = resolve(webRoot, '..');

let failed = false;
function fail(msg) { console.error('FAIL: ' + msg); failed = true; }
function pass(msg) { console.log('PASS: ' + msg); }

function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!deepEqual(a[k], b[k])) return false;
  return true;
}

const MODES = ['std8', 'std10', 'std12', 'rescue', 'one-a', 'hard1', 'hard2', 'feiqiu', 'suiji'];

const server = await createServer({
  root: webRoot,
  configFile: false,
  resolve: {
    alias: {
      '@logic': resolve(projectRoot, 'assets/Script/jijie2'),
      '@jjb': resolve(projectRoot, 'assets/Script/jjbDesign'),
    },
  },
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
  ssr: { noExternal: true, target: 'node' },
});

try {
  const codec = await server.ssrLoadModule('/src/logic/codec.ts');
  const { capturePayload, encodePayload, decodePayload, decodeResult, PAYLOAD_VER, poolFingerprint } = codec;
  const sess = await server.ssrLoadModule('/src/logic/jjbSession.ts');
  const { startSession } = sess;
  const rc = await server.ssrLoadModule('/src/logic/randomConfig.ts');
  const { setRandomEnemyEnabled, getRandomEnemyEnabled } = rc;

  console.log('\n=== 阶段 1：9 模式 + 双打 往返等价 ===');
  console.log('mode            kind  码长  往返等价  PASS/FAIL');
  console.log('--------------  ----  ----  --------  --------');

  const codeLens = [];
  // std15/cm 已改双打（Batch C）：走双打 kind='d' 目标，variant='std15'/'cm'
  const DOUBLES_TARGETS = ['doubles', 'feiqiu-doubles', 'std15', 'cm'];
  const allTargets = [...MODES, ...DOUBLES_TARGETS];
  for (const mode of allTargets) {
    try {
      globalThis.window = globalThis.window || globalThis;
      globalThis.window.__jjbDebug = undefined;
      startSession(mode);

      const snap1 = capturePayload();
      const code = encodePayload(snap1);
      const snap2 = decodePayload(code);

      const eq = deepEqual(snap1, snap2);
      const kind = snap1.kind;
      codeLens.push({ mode, kind, len: code.length });

      // 额外断言：kind 与 mode 一致（双打 kind='d'，单打 kind='s'）
      const isDoubles = DOUBLES_TARGETS.includes(mode);
      if (isDoubles && kind !== 'd') fail(`${mode}: kind=${kind} 应为 'd'`);
      if (!isDoubles && kind !== 's') fail(`${mode}: kind=${kind} 应为 's'`);
      if (mode === 'std15' && snap1.variant !== 'std15') fail(`std15: snapshot.variant=${snap1.variant} 应为 'std15'`);
      if (mode === 'cm' && snap1.variant !== 'cm') fail(`cm: snapshot.variant=${snap1.variant} 应为 'cm'`);

      if (!eq) fail(`${mode}: 往返不等价\n  snap1=${JSON.stringify(snap1)}\n  snap2=${JSON.stringify(snap2)}`);
      console.log(`${mode.padEnd(14)}  ${kind.padEnd(4)}  ${String(code.length).padStart(4)}  ${(eq ? '✓' : '✗').padStart(8)}  ${eq ? 'PASS' : 'FAIL'}`);
    } catch (e) {
      fail(`${mode}: 异常 ${e && e.message ? e.message : e}\n${e && e.stack ? e.stack : ''}`);
      console.log(`${mode.padEnd(14)}  ----  ----  --------  FAIL`);
    }
  }

  // ===== 阶段 2a：随机敌方 ON 往返等价 =====
  console.log('\n=== 阶段 2a：随机敌方 ON 往返等价 ===');
  try {
    globalThis.window = globalThis.window || globalThis;
    globalThis.window.__jjbDebug = undefined;
    setRandomEnemyEnabled(true);
    if (!getRandomEnemyEnabled()) fail('randomConfig: setRandomEnemyEnabled(true) 未生效');
    startSession('std10');
    const snap1 = capturePayload();
    if (!snap1.enemy) fail('随机敌方 ON: snap1.enemy 应非 null');
    else if (snap1.enemy.length !== 3) fail(`随机敌方 ON: enemy 长度=${snap1.enemy.length} ≠ 3`);
    else if (snap1.enemy.some((e) => !e || !e.race || !e.ai)) fail('随机敌方 ON: enemy 元素缺 race/ai');
    const code = encodePayload(snap1);
    const snap2 = decodePayload(code);
    if (!deepEqual(snap1, snap2)) fail('随机敌方 ON: 往返不等价');
    else pass('随机敌方 ON: enemy[3] 编入 + 往返等价 ✓');
    setRandomEnemyEnabled(false); // 复位
  } catch (e) {
    fail('随机敌方 ON: 异常 ' + (e && e.message ? e.message : e));
  }

  // ===== 阶段 2b：三道闸断言 =====
  console.log('\n=== 阶段 2b：三道闸（version / pool / invalid）===');
  try {
    globalThis.window = globalThis.window || globalThis;
    startSession('std10');
    const snap = capturePayload();
    const curP = poolFingerprint();

    // 版本闸：v !== PAYLOAD_VER → reason 'version'
    const vBad = encodePayload({ ...snap, v: 999 });
    const vr = decodeResult(vBad);
    if (!vr.ok && vr.reason === 'version') pass('版本闸: v≠PAYLOAD_VER → reason=version ✓');
    else fail(`版本闸: 期望 reason=version, got=${JSON.stringify(vr)}`);

    // 指纹闸：p !== poolFingerprint() → reason 'pool'
    const pBad = encodePayload({ ...snap, p: curP + 1 });
    const pr = decodeResult(pBad);
    if (!pr.ok && pr.reason === 'pool') pass('指纹闸: p≠poolFingerprint → reason=pool ✓');
    else fail(`指纹闸: 期望 reason=pool, got=${JSON.stringify(pr)}`);

    // 损坏码 → reason 'invalid'
    const ir1 = decodeResult('!!!不是合法base64url!!!');
    if (!ir1.ok && ir1.reason === 'invalid') pass('越界闸(乱码): → reason=invalid ✓');
    else fail(`越界闸(乱码): 期望 reason=invalid, got=${JSON.stringify(ir1)}`);

    // 越界 idx → reason 'invalid'（构造 selFac 含超大 idx，但 v/p 合法）
    const snapOob = { ...snap, selFac: [99999, -1, -1, -1, -1, -1, -1, -1, -1] };
    const oobCode = encodePayload(snapOob);
    const ir2 = decodeResult(oobCode);
    if (!ir2.ok && ir2.reason === 'invalid') pass('越界闸(idx≥FACTORS.length): → reason=invalid ✓');
    else fail(`越界闸(idx): 期望 reason=invalid, got=${JSON.stringify(ir2)}`);

    // 合法码 → ok
    const okCode = encodePayload(snap);
    const okr = decodeResult(okCode);
    if (okr.ok) pass('合法码: → ok=true ✓');
    else fail(`合法码: 期望 ok=true, got=${JSON.stringify(okr)}`);

    // 双打版本闸（kind='d' 也走版本闸）
    startSession('doubles');
    const dSnap = capturePayload();
    const dvBad = encodePayload({ ...dSnap, v: 999 });
    const dvr = decodeResult(dvBad);
    if (!dvr.ok && dvr.reason === 'version') pass('双打版本闸: → reason=version ✓');
    else fail(`双打版本闸: 期望 reason=version, got=${JSON.stringify(dvr)}`);
  } catch (e) {
    fail('三道闸: 异常 ' + (e && e.message ? e.message : e) + '\n' + (e && e.stack ? e.stack : ''));
  }

  // ===== 码长报告 =====
  console.log('\n=== 码长报告（目标 ~150B 内为优；URL 上限 2000，实际远低于）===');
  console.log('mode            kind  码长(bytes)');
  console.log('--------------  ----  -----------');
  for (const c of codeLens) console.log(`${c.mode.padEnd(14)}  ${c.kind.padEnd(4)}  ${c.len}`);
  const maxLen = Math.max(...codeLens.map((c) => c.len));
  console.log(`最长码: ${maxLen} 字符（URL #hash 上限 2000，余量 ${2000 - maxLen}）`);
  if (maxLen > 2000) fail(`码长 ${maxLen} 超 URL 上限 2000`);
  pass(`码方案 ${codeLens.length} 个目标全部编解码往返等价 + 三道闸拦截 + 码长合规`);
} finally {
  await server.close();
}

if (failed) {
  console.error('\n[codec-e2e] ❌ 编解码往返或三道闸失败');
  process.exit(1);
}
console.log('\n[codec-e2e] ✅ 9 单打模式 + 4 双打(官突/非酋/std15/cm) 往返等价 + 随机敌方 ON + 三道闸(version/pool/invalid) + 越界拦截 PASS');
