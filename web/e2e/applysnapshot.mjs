// applysnapshot e2e — applySnapshot 还原往返闭环（Phase 2 gate）。
// 流程：startSession(mode) → randomFillSelection → capturePayload(snapA) → encode → decode(snapB)
//        → applySnapshot(snapB) → capturePayload(snapC) → deepEqual(snapA, snapC) on core fields
// 涵盖 std10 单打 + doubles 双打，验证 JijieData + jjbDoubles 闭包还原正确。
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

/** 比对还原后的 core 字段（排除 gold/ban/enemy 这些 applySnapshot 不还原的运行时态）。 */
function coreFields(snap) {
  if (snap.kind === 's') {
    const { v, p, kind, mode, mfc, flags, rm, maps, locks, pool, cmdA, cmdB, selCmd, selFac, wl } = snap;
    return { v, p, kind, mode, mfc, flags, rm, maps, locks, pool, cmdA, cmdB, selCmd, selFac, wl };
  } else {
    const { v, p, kind, variant, mutEntries, facPool, cmdPool, slots, wl } = snap;
    return { v, p, kind, variant, mutEntries, facPool, cmdPool, slots, wl };
  }
}

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
  const { capturePayload, encodePayload, decodePayload, applySnapshot } = codec;
  const sess = await server.ssrLoadModule('/src/logic/jjbSession.ts');
  const { startSession, randomFillSelection } = sess;

  // ===== 单打往返（std10）=====
  console.log('\n=== 单打 applySnapshot 往返（std10）===');
  startSession('std10');
  randomFillSelection();
  const snapA = capturePayload();
  const code = encodePayload(snapA);
  const snapB = decodePayload(code);
  applySnapshot(snapB);
  const snapC = capturePayload();

  const coreA = coreFields(snapA);
  const coreC = coreFields(snapC);

  if (!deepEqual(coreA, coreC)) {
    fail('单打 applySnapshot: 还原后 capturePayload core fields ≠ 原 snapshot\n' +
      '  snapA: ' + JSON.stringify(coreA).slice(0, 200) + '\n' +
      '  snapC: ' + JSON.stringify(coreC).slice(0, 200));
  } else {
    pass('单打 std10: encode→decode→applySnapshot→capturePayload core fields 深比对相等');
  }

  // 逐字段详细验证
  const checks = [
    ['mode', coreA.mode, coreC.mode],
    ['mfc', coreA.mfc, coreC.mfc],
    ['rm', coreA.rm, coreC.rm],
    ['maps', JSON.stringify(coreA.maps), JSON.stringify(coreC.maps)],
    ['locks', JSON.stringify(coreA.locks), JSON.stringify(coreC.locks)],
    ['pool', JSON.stringify(coreA.pool), JSON.stringify(coreC.pool)],
    ['cmdA', JSON.stringify(coreA.cmdA), JSON.stringify(coreC.cmdA)],
    ['cmdB', JSON.stringify(coreA.cmdB), JSON.stringify(coreC.cmdB)],
    ['selCmd', JSON.stringify(coreA.selCmd), JSON.stringify(coreC.selCmd)],
    ['selFac', JSON.stringify(coreA.selFac), JSON.stringify(coreC.selFac)],
    ['wl', JSON.stringify(coreA.wl), JSON.stringify(coreC.wl)],
    ['flags.vh', coreA.flags.vh, coreC.flags.vh],
    ['flags.rand', coreA.flags.rand, coreC.flags.rand],
  ];
  for (const [label, a, c] of checks) {
    if (JSON.stringify(a) !== JSON.stringify(c)) {
      fail(`  字段 ${label}: ${JSON.stringify(a)} → ${JSON.stringify(c)}`);
    }
  }
  if (!failed) pass('  逐字段验证全部一致');

  // ===== 双打往返（doubles）=====
  console.log('\n=== 双打 applySnapshot 往返（doubles）===');
  startSession('doubles');
  const db = await server.ssrLoadModule('/src/logic/jjbDoubles.ts');
  const { randomFillDoubles } = db;
  randomFillDoubles();
  const snapDA = capturePayload();
  const codeD = encodePayload(snapDA);
  const snapDB = decodePayload(codeD);
  applySnapshot(snapDB);
  const snapDC = capturePayload();

  const coreDA = coreFields(snapDA);
  const coreDC = coreFields(snapDC);
  if (!deepEqual(coreDA, coreDC)) {
    fail('双打 applySnapshot: 还原后 capturePayload core fields ≠ 原 snapshot\n' +
      '  snapDA: ' + JSON.stringify(coreDA).slice(0, 300) + '\n' +
      '  snapDC: ' + JSON.stringify(coreDC).slice(0, 300));
  } else {
    pass('双打 doubles: encode→decode→applySnapshot→capturePayload core fields 深比对相等');
  }

} finally {
  await server.close();
}

if (failed) {
  console.error('\n[applysnapshot-e2e] ❌ 有失败，见上');
  process.exit(1);
} else {
  console.log('\n[applysnapshot-e2e] ✅ 单打 + 双打 applySnapshot 往返全部 PASS');
}
