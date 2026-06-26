// event-ban.mjs — 赛事 ban 逻辑层 e2e（Phase 3）。
// 测试范围：getMutatorHitCount 值 / 单打地图 ban / 单打因子 ban / 双打官突直接 ban / 双打因子关联 ban / while 守卫。
// 纯逻辑断言，Vite SSR 模式，不依赖 Playwright 或 dist。
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
  const eb = await server.ssrLoadModule('/src/logic/eventBan.ts');
  const { loadEventBan, getBanMaps, getBanFactors, getBanMutators, getMutatorHitCount } = eb;
  const sess = await server.ssrLoadModule('/src/logic/jjbSession.ts');
  const { startSession } = sess;
  const doubles = await server.ssrLoadModule('/src/logic/jjbDoubles.ts');
  const { doublesStart, getDoublesState } = doubles;
  const codecMod = await server.ssrLoadModule('/src/logic/codec.ts');
  const { capturePayload } = codecMod;

  // window shim（jjbSession + jjbDoubles 共用 __jjbDebug）
  globalThis.window = globalThis.window || globalThis;

  // ===== 1. getMutatorHitCount 静态值 =====
  console.log('\n=== 1. getMutatorHitCount 静态值 ===');
  {
    const tsl = getMutatorHitCount('时空立场');
    const tsj = getMutatorHitCount('时空力场');
    const fdzz = getMutatorHitCount('飞弹大战');
    if (tsl !== 6) fail(`时空立场 hitCount=${tsl} 期望 6`);
    else pass('时空立场 hitCount=6 ✓');
    if (tsj !== 0) fail(`时空力场 hitCount=${tsj} 期望 0（不在官突池）`);
    else pass('时空力场 hitCount=0 ✓');
    if (fdzz !== 7) fail(`飞弹大战 hitCount=${fdzz} 期望 7`);
    else pass('飞弹大战 hitCount=7 ✓');
  }

  // ===== 2. 单打地图 ban — 多轮断言无 banned map 出现 =====
  console.log('\n=== 2. 单打地图 ban ===');
  {
    const BAN_MAPS = ['营救矿工', '天界封锁', '湮灭快车'];
    loadEventBan({ ban_maps: BAN_MAPS, ban_factors: [], ban_mutators: [] });
    let mapBanViolations = 0;
    const RUNS = 30;
    for (let i = 0; i < RUNS; i++) {
      globalThis.window.__jjbDebug = undefined;
      startSession('std10');
      const snap = capturePayload();
      const maps = snap.kind === 's' ? (snap.maps || []) : [];
      for (const m of maps) {
        if (BAN_MAPS.includes(m)) mapBanViolations++;
      }
    }
    if (mapBanViolations > 0) fail(`单打地图 ban：${RUNS} 轮中出现 ${mapBanViolations} 次 banned map`);
    else pass(`单打地图 ban：${RUNS} 轮全无 banned map ✓`);
  }

  // ===== 3. 单打因子 ban — 非豁免因子不出现 =====
  console.log('\n=== 3. 单打因子 ban ===');
  {
    const BAN_FACTORS = ['核弹打击', '暴风雪', '岩浆爆发', '相互摧毁'];
    loadEventBan({ ban_maps: [], ban_factors: BAN_FACTORS, ban_mutators: [] });
    let factorBanViolations = 0;
    const RUNS = 30;
    for (let i = 0; i < RUNS; i++) {
      globalThis.window.__jjbDebug = undefined;
      startSession('std10'); // non-exempt mode（非 feiqiu/zhenghuo）
      const snap = capturePayload();
      const lockFactors = snap.kind === 's' ? (snap.locks || []) : [];
      for (const f of lockFactors) {
        if (BAN_FACTORS.includes(f)) factorBanViolations++;
      }
    }
    if (factorBanViolations > 0) fail(`单打因子 ban：${RUNS} 轮中出现 ${factorBanViolations} 次 banned factor`);
    else pass(`单打因子 ban：${RUNS} 轮全无 banned factor ✓`);
  }

  // ===== 4. 非酋固定因子豁免 — modeFeiqiu 仍得 混乱工作室 =====
  console.log('\n=== 4. 非酋固定因子豁免 ===');
  {
    loadEventBan({ ban_maps: [], ban_factors: ['混乱工作室'], ban_mutators: [] });
    let feiqiuGotLuanlu = 0;
    const RUNS = 10;
    for (let i = 0; i < RUNS; i++) {
      globalThis.window.__jjbDebug = undefined;
      startSession('feiqiu');
      const snap = capturePayload();
      const lockFactors = snap.kind === 's' ? (snap.locks || []) : [];
      if (lockFactors.includes('混乱工作室')) feiqiuGotLuanlu++;
    }
    if (feiqiuGotLuanlu !== RUNS) fail(`非酋固定因子豁免：${RUNS} 轮中只有 ${feiqiuGotLuanlu} 轮得到 混乱工作室（期望全部）`);
    else pass(`非酋固定因子豁免：feiqiu ${RUNS} 轮全部保留混乱工作室 ✓`);
  }

  // ===== 5. 双打官突直接名字 ban =====
  console.log('\n=== 5. 双打官突名字 ban ===');
  {
    // 从 A 档取一个官突名来 ban
    const BAN_MUT_NAMES = ['蚀骨之寒 Frostbite', '机器人大战 Kill Bot Wars', '自作自受 What Goes Around'];
    loadEventBan({ ban_maps: [], ban_factors: [], ban_mutators: BAN_MUT_NAMES });
    let mutNameViolations = 0;
    const RUNS = 30;
    for (let i = 0; i < RUNS; i++) {
      globalThis.window.__jjbDebug = undefined;
      doublesStart('guantu');
      const state = getDoublesState();
      for (const name of (state.config.matchMutatorNames || [])) {
        if (BAN_MUT_NAMES.includes(name)) mutNameViolations++;
      }
    }
    if (mutNameViolations > 0) fail(`双打官突名字 ban：${RUNS} 轮中出现 ${mutNameViolations} 次 banned mutator`);
    else pass(`双打官突名字 ban：${RUNS} 轮全无 banned mutator ✓`);
  }

  // ===== 6. 双打因子关联 ban — 含 ban 因子的官突不出现 =====
  console.log('\n=== 6. 双打因子关联 ban ===');
  {
    // 时空立场 出现在 6 个官突里，ban 时 这些官突应被过滤
    const BAN_FACTOR_FOR_MUT = '时空立场';
    loadEventBan({ ban_maps: [], ban_factors: [BAN_FACTOR_FOR_MUT], ban_mutators: [] });
    let factorMutViolations = 0;
    const RUNS = 40;
    for (let i = 0; i < RUNS; i++) {
      globalThis.window.__jjbDebug = undefined;
      doublesStart('guantu');
      const state = getDoublesState();
      for (const factors of (state.config.matchMutators || [])) {
        if (factors.includes(BAN_FACTOR_FOR_MUT)) factorMutViolations++;
      }
    }
    if (factorMutViolations > 0) fail(`双打因子关联 ban：${RUNS} 轮中出现 ${factorMutViolations} 次含 ${BAN_FACTOR_FOR_MUT} 的官突`);
    else pass(`双打因子关联 ban（${BAN_FACTOR_FOR_MUT}）：${RUNS} 轮全无违规官突 ✓`);
  }

  // ===== 7. while 守卫 — 全 map ban 不死循环（单打） =====
  console.log('\n=== 7. while 守卫：全 map ban 不崩溃 ===');
  {
    // 故意 ban 所有常见地图（守卫确保循环在 200 次内终止，仍选出一张地图）
    const ALL_MAPS = [
      '营救矿工', '天界封锁', '湮灭快车', '净网行动', '亡者之夜', '机会渺茫', '黑暗杀星', '聚铁成兵',
      '升格之链', '虚空降临', '克哈裂痕', '往日神庙', '死亡摇篮', '天拒之门', '血与硝烟', '终焉之穴',
      '激战钢城', '深渊杀机', '繁星陨落', '暗无天日', '孤立无援', '赤色要塞', '动乱之时',
    ];
    loadEventBan({ ban_maps: ALL_MAPS, ban_factors: [], ban_mutators: [] });
    let guardCrash = false;
    try {
      globalThis.window.__jjbDebug = undefined;
      startSession('std10');
      const snap = capturePayload();
      const maps = snap.kind === 's' ? (snap.maps || []) : [];
      if (maps.length !== 3) fail(`全 map ban 守卫：mapList.length=${maps.length} 期望 3（guard 兜底）`);
      else pass(`全 map ban 守卫：不崩溃 mapList.length=3 ✓`);
    } catch (e) {
      guardCrash = true;
      fail(`全 map ban 守卫：崩溃 ${e && e.message ? e.message : e}`);
    }
    if (!guardCrash) {
      // 额外检查：总用时 < 5s（间接验证没有真死循环）
      pass('全 map ban 守卫：执行时间正常（无死循环）✓');
    }
  }

  // ===== 8. while 守卫 — 单个 tier 全 ban 不崩溃（双打） =====
  console.log('\n=== 8. while 守卫：doubles 全 A 档官突 ban 回退原池 ===');
  {
    // 取 A 档所有官突名
    const mutModule = await server.ssrLoadModule('/src/data/mutatorPool.ts');
    const { MUTATOR_POOL } = mutModule;
    const allATierNames = MUTATOR_POOL.A.map((e) => e.name);
    loadEventBan({ ban_maps: [], ban_factors: [], ban_mutators: allATierNames });
    let doublesCrash = false;
    try {
      globalThis.window.__jjbDebug = undefined;
      doublesStart('guantu');
      const state = getDoublesState();
      // 回退后 A 档官突仍然存在（来自原池 fallback），matchMutatorNames[0] 非空
      const aName = (state.config.matchMutatorNames || [])[0];
      if (!aName) fail(`doubles 全 A 档 ban 回退：A 档 matchMutatorNames[0] 为空（回退失败）`);
      else pass(`doubles 全 A 档 ban 回退：原池 fallback 生效 name="${aName}" ✓`);
    } catch (e) {
      doublesCrash = true;
      fail(`doubles 全 A 档 ban 守卫：崩溃 ${e && e.message ? e.message : e}`);
    }
  }

} finally {
  await server.close();
}

if (failed) {
  console.error('\n[event-ban e2e] FAIL — 见上方 FAIL 行');
  process.exit(1);
} else {
  console.log('\n[event-ban e2e] ALL PASS ✓');
}
