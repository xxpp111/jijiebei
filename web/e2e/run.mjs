// jjb web 端到端门（段2 Phase 0）：9 模式全模式开局 + 池=槽恒等式断言。
// 阶段 1：build 完整性 + bundle 接缝标记（含 startSession/9 mode 名/中文 mode 标签）。
// 阶段 2：Vite SSR 加载 jjbSession.ts，注入 window shim，调 startSession 9 次，
//         读 window.__jjbDebug.select 断言：池=槽恒等式 / 9 格契约 / status=2 / map=3。
// 设计：零额外依赖（vite 已装；esbuild 走 vite 内部）；不上 Playwright（段1 PoC 的真浏览器回归已
// 由 .playwright-mcp + jjb-verify 完成，phase 0 走纯逻辑断言足够，本门 CI 友好即可）。
import { readFileSync, existsSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, '..');
const dist = join(here, '..', 'dist');
const projectRoot = resolve(webRoot, '..');

let failed = false;
function fail(msg) { console.error('FAIL: ' + msg); failed = true; }
function pass(msg) { console.log('PASS: ' + msg); }

// ===== 阶段 1: build 完整性 =====
if (!existsSync(join(dist, 'index.html'))) {
  fail('dist/index.html missing — run `npm run build` first');
  process.exit(1);
}
const assetsDir = join(dist, 'assets');
const js = readdirSync(assetsDir).find((f) => f.endsWith('.js'));
if (!js) { fail('no js bundle in dist/assets'); process.exit(1); }
const bundle = readFileSync(join(assetsDir, js), 'utf8');
// bundle 标记符：接缝 + 9 mode 名（minify 后函数名会变，校验 mode 字符串与 jjbSession 真身关键串）
// 9 mode 名为 jjbSession 硬编码；'随机因子数极难'/'混乱工作室'/'礼尚往来'/'极难因子组' 为 toStart/toSelect 真身用到的因子表名
const bundleMarkers = [
  '__jjbDebug', 'winLoseList', '集结杯', 'jjbSession',
  'std8', 'std10', 'std12', 'rescue', 'one-a', 'hard1', 'hard2', 'feiqiu', 'suiji',
  '随机因子数极难', '混乱工作室', '礼尚往来', '极难因子组',
];
const bundleMissing = bundleMarkers.filter((m) => !bundle.includes(m));
if (bundleMissing.length) fail('bundle missing markers: ' + bundleMissing.join(', '));
else pass('bundle contains all 16 markers');

// ===== 阶段 2: Vite SSR 加载 jjbSession 跑 9 模式 =====
const MODES = ['std8', 'std10', 'std12', 'rescue', 'one-a', 'hard1', 'hard2', 'feiqiu', 'suiji'];

// manualSlots 镜像（JJBData.ts:96-112），客户端跑通前用本地镜像校验
function manualSlotsMirror(modeFlags) {
  const { modelFactorCount, modeSuiji, modeFeiqiu, modeIsVeryHard, modeIsOnePick } = modeFlags;
  if (modeSuiji) return [0, 0, 0];
  if (modeFeiqiu) return [1, 1, 1];
  const out = [];
  for (let slotIdx = 0; slotIdx < 3; slotIdx++) {
    let f = modelFactorCount;
    if (slotIdx === 2) {
      f++;
      if (modeIsVeryHard) f = 4;
      if (modeIsOnePick && modelFactorCount === 3) f = 3;
    } else if (slotIdx === 1) {
      if (modelFactorCount === 2) f++;
      if (modeIsVeryHard) f = 3;
    } else {
      if (modeIsVeryHard) f = 3;
    }
    out.push(Math.min(f - 1, 3));
  }
  return out;
}

console.log('\n=== Phase 0 全模式开局断言 ===');
console.log('mode    pool  manualSlots(0/1/2)  sum  identity  map  lock  selFacLen  selCmd  status  PASS/FAIL');
console.log('------  ----  -------------------  ---  --------  ---  ----  ---------  ------  ------  --------');

// Vite SSR server（外部模式，避免污染主进程）
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
  // 加载 jjbSession（顶部 import 链会拉 JijieData + JJConfigData + JJBData + GameData + PlayerData，无 cc 依赖）
  const mod = await server.ssrLoadModule('/src/logic/jjbSession.ts');
  const { startSession, exposeSelectDebug, getSelectState, randomFillAndStart, jjbLive } = mod;

  // 9 模式循环
  for (const mode of MODES) {
    try {
      // 每模式重置 globalThis.window（避免上局残留）
      globalThis.window = globalThis.window || globalThis;
      globalThis.window.__jjbDebug = undefined;

      startSession(mode);

      const dbg = globalThis.window.__jjbDebug;
      const sel = dbg && dbg.select;
      if (!sel) { fail(`${mode}: __jjbDebug.select 未透出`); continue; }

      const { randomFactorPoorLen, manualSlots, sumSlots, identityPass, selectedFactorListLen, selectedCommanderList, status, mapCount, lockCount, modeIsRandom, modelFactorCount } = sel;

      // 断言 1：池=槽恒等式
      if (!identityPass) fail(`${mode}: 池=槽恒等式失败 pool=${randomFactorPoorLen} sum=${sumSlots}`);
      // 断言 2：9 格契约
      if (selectedFactorListLen !== 9) fail(`${mode}: selectedFactorList 长 ${selectedFactorListLen} ≠ 9`);
      // 断言 3：selectedCommanderList = [null,null,null]
      const isNullTriple = selectedCommanderList.length === 3 && selectedCommanderList.every((c) => c === null);
      if (!isNullTriple) fail(`${mode}: selectedCommanderList=${JSON.stringify(selectedCommanderList)} ≠ [null,null,null]`);
      // 断言 4：status=2（开局完毕）
      if (status !== 2) fail(`${mode}: status=${status} ≠ 2`);
      // 断言 5：map=3, lock=3
      if (mapCount !== 3) fail(`${mode}: mapCount=${mapCount} ≠ 3`);
      if (lockCount !== 3) fail(`${mode}: lockCount=${lockCount} ≠ 3`);
      // 断言 6：manualSlots 对账表
      const ms = manualSlotsMirror({ modelFactorCount, modeSuiji: sel.modeSuiji, modeFeiqiu: sel.modeFeiqiu, modeIsVeryHard: sel.modeIsVeryHard, modeIsOnePick: sel.modeIsOnePick });
      const msMatch = ms[0] === manualSlots[0] && ms[1] === manualSlots[1] && ms[2] === manualSlots[2];
      if (!msMatch) fail(`${mode}: manualSlots ${manualSlots.join('/')} ≠ 镜像 ${ms.join('/')}`);

      const passed = identityPass && selectedFactorListLen === 9 && isNullTriple && status === 2 && mapCount === 3 && lockCount === 3 && msMatch;
      console.log(
        `${mode.padEnd(6)}  ${String(randomFactorPoorLen).padStart(4)}  ${manualSlots.join('/').padStart(19)}  ${String(sumSlots).padStart(3)}  ${(identityPass ? '✓' : '✗').padStart(8)}  ${String(mapCount).padStart(3)}  ${String(lockCount).padStart(4)}  ${String(selectedFactorListLen).padStart(9)}  ${String(selectedCommanderList.length).padStart(6)}  ${String(status).padStart(6)}  ${passed ? 'PASS' : 'FAIL'}`,
      );

      // ===== 段2 Phase 1 select 渲染断言（getSelectState 9 模式透出 + randomFillAndStart 接缝） =====
      // getSelectState 透出 + 池=槽恒等式（与 __jjbDebug.select 一致）
      const sState = getSelectState();
      if (!sState) fail(`${mode}: getSelectState() 返回 undefined`);
      if (sState && (sState.mode !== mode || !sState.jjbLive || sState.mapList.length !== 3 || sState.lockFactorList.length !== 3 || sState.sumSlots !== sumSlots || sState.manualSlots.join('/') !== manualSlots.join('/') || sState.randomFactorPoor.length !== randomFactorPoorLen)) {
        fail(`${mode}: getSelectState 字段不一致 mode=${sState && sState.mode} jjbLive=${sState && sState.jjbLive} map=${sState && sState.mapList && sState.mapList.length} lock=${sState && sState.lockFactorList && sState.lockFactorList.length} pool=${sState && sState.randomFactorPoor && sState.randomFactorPoor.length} sumSlots=${sState && sState.sumSlots}`);
      }

      // randomFillAndStart 接缝：填充后 jjbLive 仍 true、status=3、9 格 selectedFactorList 全非空、3 场指挥官均非空
      randomFillAndStart();
      if (!jjbLive()) fail(`${mode}: randomFillAndStart 后 jjbLive=false`);
      const d = globalThis.window.__jjbDebug;
      const battle = d && d.battle;
      const selFac2 = (battle && d.selectedFactorList) || [];
      const selCmd2 = (battle && d.selectedCommanderList) || [];
      if (selFac2.length !== 9) fail(`${mode}: randomFillAndStart 后 selectedFactorList 长 ${selFac2.length} ≠ 9`);
      if (selCmd2.length !== 3) fail(`${mode}: randomFillAndStart 后 selectedCommanderList 长 ${selCmd2.length} ≠ 3`);
      // one-a / suiji 模式真身 toSelect 不预填 randomCommanderPoorA/B（one-a 由玩家自选、suiji 随机），
      // randomFillAndStart 无池可填时 selectedCommanderList 保留 [null,null,null]（与真身一致，不强制）。
      const noCmdPool = mode === 'one-a' || mode === 'suiji';
      if (!noCmdPool) {
        const allCmdFilled = selCmd2.every((c) => c != null && c !== '');
        if (!allCmdFilled) fail(`${mode}: randomFillAndStart 后 selectedCommanderList 未全填=${JSON.stringify(selCmd2)}`);
      }
      // 至少应填 manualSlots(0)+manualSlots(1)+manualSlots(2) 个因子（jjbLive 模式下 pool=Σ 槽）
      const sumSlotsNum = manualSlots[0] + manualSlots[1] + manualSlots[2];
      const facFilledCnt = selFac2.filter((f) => f != null && f !== '').length;
      if (sumSlotsNum > 0 && facFilledCnt !== sumSlotsNum) fail(`${mode}: randomFillAndStart 后 selectedFactorList 填 ${facFilledCnt} ≠ ΣmanualSlots ${sumSlotsNum}`);
    } catch (e) {
      fail(`${mode}: 异常 ${e && e.message ? e.message : e}`);
      console.log(`${mode.padEnd(6)}  ----  -------------------  ---  --------  ---  ----  ---------  ------  ------  FAIL`);
    }
  }
} finally {
  await server.close();
}

if (failed) {
  console.error('\n[react-e2e] ❌ 至少 1 mode 失败');
  process.exit(1);
}
console.log('\n[react-e2e] ✅ 9 模式池=槽恒等式 + 9格契约 + 状态全 PASS');
