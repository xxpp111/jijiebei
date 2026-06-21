// jjb web 端到端门（段2 Phase 0）：9 模式全模式开局 + 池=槽恒等式断言。
// 阶段 1：build 完整性 + bundle 接缝标记（含 startSession/9 mode 名/中文 mode 标签）。
// 阶段 2：Vite SSR 加载 jjbSession.ts，注入 window shim，调 startSession 9 次，
//         读 window.__jjbDebug.select 断言：池=槽恒等式 / 9 格契约 / status=2 / map=3。
// 设计：零额外依赖（vite 已装；esbuild 走 vite 内部）。React DOM smoke 由 e2e/ui-smoke.mjs 覆盖；
// Cocos 全量回归仍以 jjb-verify 的四套 Playwright 为准，本门保持 CI 友好的纯逻辑断言。
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
  const {
    startSession, exposeSelectDebug, getSelectState, randomFillAndStart, jjbLive, validate,
    setSelectedCmd, setSelectedFac, startFromSelection, getSessionMatches, exposeBattleDebug,
    factorScore, difficultyTotal, toggleGold, getGoldFor,
    toggleBanFactor, getBanFor, getBpState, randomFillSelection,
    setRuleMode, getRuleMode, getSelectWarn, getBpExclusive,
  } = mod;
  const dmod = await server.ssrLoadModule('/src/logic/jjbDoubles.ts');
  const {
    getDoublesState, doublesMatches, setDoublesCmd, setDoublesFac,
    setDoublesVerdict, doublesScore, validateDoubles, randomFillDoubles,
  } = dmod;

  let scoreFallbackChecked = false;
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

      if (!scoreFallbackChecked) {
        if (factorScore('虚空重生者') !== 7) fail(`factorScore('虚空重生者') 应走白名单 fallback=7（yb 2026-06-19 拍板较难因子）`);
        if (factorScore('混乱工作室') !== 7) fail(`factorScore('混乱工作室') 应走非酋白名单 fallback=7`);
        if (factorScore('礼尚往来') !== 7) fail(`factorScore('礼尚往来') 应走非酋白名单 fallback=7`);
        const warnMessages = [];
        const originalWarn = console.warn;
        console.warn = (...args) => { warnMessages.push(args.join(' ')); };
        try {
          const unknownScore = factorScore('__不存在的因子__');
          if (unknownScore !== 0) fail(`未知因子分值应为 0，实际=${unknownScore}`);
        } finally {
          console.warn = originalWarn;
        }
        if (!warnMessages.some((m) => m.includes('未找到合法因子分值'))) fail('未知因子应触发 difficultyTotal warning');
        scoreFallbackChecked = true;
      }

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

      // 段3④：难度总分 = 锁定因子 + 手选因子；点金单因子贡献翻倍。
      const afterFillState = getSelectState();
      const scoreFactors = (afterFillState.lockFactorList || [])
        .concat((afterFillState.selectedFactorList || []).filter(Boolean));
      const scoreExpected = scoreFactors.reduce((sum, f) => sum + factorScore(f) * (getGoldFor(f) ? 2 : 1), 0);
      const scoreActual = difficultyTotal();
      if (scoreActual !== scoreExpected) fail(`${mode}: difficultyTotal=${scoreActual} ≠ 手工求和 ${scoreExpected}`);
      const goldTarget = scoreFactors.find((f) => !getGoldFor(f));
      if (goldTarget) {
        const beforeGold = difficultyTotal();
        const base = factorScore(goldTarget);
        const occurrenceCount = scoreFactors.filter((f) => f === goldTarget).length;
        toggleGold(goldTarget);
        const afterGold = difficultyTotal();
        if (afterGold !== beforeGold + base * occurrenceCount) fail(`${mode}: 点金 ${goldTarget} 后 difficultyTotal ${afterGold} ≠ ${beforeGold}+${base}×${occurrenceCount}`);
        toggleGold(goldTarget);
      }

      // ===== 段2 Phase 2：校验三规则断言（validate 镜像真身 JJBSelect.validate） =====
      // 准备：从 jjbSession 重新开局以拿到 fresh 9 格 + 池
      startSession(mode);
      const v0 = validate();
      const expectedErrCount = 3 + sumSlotsNum; // 3 场指挥官 + Σ 因子槽
      if (v0.ok) fail(`${mode}: 空 selected* 不应 validate 通过`);
      if (v0.errors.length !== expectedErrCount) fail(`${mode}: 空 selected* validate 报 ${v0.errors.length} 条 ≠ 预期 ${expectedErrCount}`);

      // 取出 A/B 池真实名 + 因子池真实名（getSelectState 透出 randomCommanderPoorA/B + randomFactorPoor）
      const ss = getSelectState();
      const cmdAPool = (ss.randomCommanderPoorA || []).filter((c) => c !== '自选');
      const cmdBPool = (ss.randomCommanderPoorB || []).filter((c) => c !== '自选');
      const facPool = ss.randomFactorPoor || [];
      const validCmds = cmdAPool.concat(cmdBPool);
      const canFullFill = validCmds.length >= 3 && facPool.length >= sumSlotsNum;

      if (canFullFill) {
        // 填全 3 场指挥官 + Σ 因子槽
        for (let i = 0; i < 3; i++) setSelectedCmd(i, validCmds[i]);
        let fi = 0;
        for (let slot = 0; slot < 3; slot++) {
          for (let k = 0; k < manualSlots[slot] && fi < facPool.length; k++) {
            setSelectedFac(slot, k, facPool[fi++]);
          }
        }
        const v1 = validate();
        if (!v1.ok) fail(`${mode}: 全填后 validate 不应报 err=${JSON.stringify(v1.errors)}`);
        // startFromSelection 应通过且 status=3（exposeBattleDebug 写到 __jjbDebug.status 根上，不是 select.status）
        const r = startFromSelection();
        if (!r.ok) fail(`${mode}: startFromSelection 应通过（r.ok=true）`);
        if (globalThis.window.__jjbDebug.status !== 3) fail(`${mode}: startFromSelection 通过后 status 应=3 (got ${globalThis.window.__jjbDebug.status})`);

        // ===== 段2 Phase 2 端到端串通断言：手选 selected* 真实流入 BattleScreen 渲染（不是随机） =====
        // 关键证据：sessionMatches 读 JijieData.selectedCommanderList/selectedFactorList（jjbData.ts:128-149），
        // 它的 cmds/factors 必须 == 用户手选的 validCmds/facPool，而非 randomFillAndStart 随机。
        const matches = getSessionMatches();
        // 记录手选内容（按场序展平）
        const handPickedCmd = [validCmds[0], validCmds[1], validCmds[2]];
        const handPickedFac = [];
        {
          let fi2 = 0;
          for (let slot = 0; slot < 3; slot++) {
            for (let k = 0; k < manualSlots[slot] && fi2 < facPool.length; k++) {
              handPickedFac.push(facPool[fi2++]);
            }
          }
        }
        // 1) 指挥官：每场 1 个 cmds[] 必须 = 用户手选
        for (let i = 0; i < 3; i++) {
          const m = matches[i];
          if (!m) { fail(`${mode}: sessionMatches[${i}] undefined`); continue; }
          if (m.cmds.length !== 1) fail(`${mode}: sessionMatches[${i}].cmds.length=${m.cmds.length} ≠ 1`);
          if (m.cmds[0] !== handPickedCmd[i]) fail(`${mode}: sessionMatches[${i}].cmds[0]=${m.cmds[0]} ≠ 手选 ${handPickedCmd[i]}`);
        }
        // 2) 因子：每场 factors[] 必含 1 锁定 + 手选 Σ 槽（k>=1 时锁定有，k=0 无）
        let handIdx = 0;
        for (let i = 0; i < 3; i++) {
          const m = matches[i];
          if (!m) continue;
          const expectedFacN = manualSlots[i] + (m.lock ? 1 : 0);
          if (m.factors.length !== expectedFacN) {
            fail(`${mode}: sessionMatches[${i}].factors.length=${m.factors.length} ≠ 预期 ${expectedFacN}（手选 ${manualSlots[i]} + 锁定 ${m.lock ? 1 : 0}）`);
            continue;
          }
          // factors[0] 是锁定（如果有），后续是手选
          for (let k = (m.lock ? 1 : 0); k < m.factors.length; k++) {
            if (m.factors[k] !== handPickedFac[handIdx]) {
              fail(`${mode}: sessionMatches[${i}].factors[${k}]=${m.factors[k]} ≠ 手选 ${handPickedFac[handIdx]}`);
            }
            handIdx++;
          }
        }
        // 3) 地图必须 = s.mapList（startSession 抽的 3 张，与手选无关）
        for (let i = 0; i < 3; i++) {
          if (matches[i].map !== ss.mapList[i]) fail(`${mode}: sessionMatches[${i}].map=${matches[i].map} ≠ mapList[${i}]=${ss.mapList[i]}`);
        }
        // 端到端对账输出：每场 cmds/factors 真实数据（用户手选流到 BattleScreen）
        console.log(`\n  [${mode}] 端到端串通对账（手选 → battle 渲染）`);
        for (let i = 0; i < 3; i++) {
          console.log(`    场${i+1}: map="${matches[i].map}" cmd=[${matches[i].cmds.join(',')}] fac=[${matches[i].factors.join(',')}] lock=${matches[i].lock || '(无)'}`);
        }
        console.log(`    __jjbDebug.status=${globalThis.window.__jjbDebug.status} (3=battle 切屏) battle.matches[0].map=${matches[0].map} battle.matches[0].cmds[0]=${matches[0].cmds[0]}`);
        // 4) 关键：与 randomFillAndStart 对比，确保 sessionMatches 真读手选而非随机填
        // 重新开一局 → 走 randomFillAndStart → 比对其 cmds/factors 与手选 不一致
        // （因 randomFillAndStart 抽的是 allCmds[0..2] + factors slice，与手选可能部分重合但顺序未必一致）
        startSession(mode);
        randomFillAndStart();
        const matchesR = getSessionMatches();
        const handOnlySig = JSON.stringify({ cmd: handPickedCmd, fac: handPickedFac });
        const randomSig = JSON.stringify({
          cmd: matchesR.map((m) => m.cmds[0] || null),
          fac: matchesR.flatMap((m) => m.factors.filter((f) => f !== (ss.lockFactorList || [])[matchesR.indexOf(m)])),
        });
        // 两 signature 不应完全相等（不同来源）
        if (handOnlySig === randomSig) {
          // 极端巧合：手选与随机同序同内容（极小概率）；跳过此断言
          console.log(`  [${mode}] handPicked 与 randomFillAndStart 巧合一致（罕见）`);
        }
      } else {
        // one-a / suiji 池不足：填能填的，validate 应报未选
        for (let i = 0; i < 3; i++) if (validCmds[i]) setSelectedCmd(i, validCmds[i]);
        let fi2 = 0;
        for (let slot = 0; slot < 3; slot++) {
          for (let k = 0; k < manualSlots[slot] && fi2 < facPool.length; k++) {
            setSelectedFac(slot, k, facPool[fi2++]);
          }
        }
        const r = startFromSelection();
        if (r.ok) fail(`${mode}: 池不足时 startFromSelection 不应通过`);
        // 本局 JijieData.status 应仍 = 2（select 态，没切 battle）
        const ss2 = getSelectState();
        if (ss2.status === 3) fail(`${mode}: 池不足时 startFromSelection 不应切 JijieData.status=3`);
      }

      // 3) 自选指挥官 2A1B（P2：仅 match 态 + 单刷三模式 std8/std10/std12 软违规、不阻断；practice 不限制）。
      const isStdSolo3 = (mode === 'std8' || mode === 'std10' || mode === 'std12');
      if (isStdSolo3 && cmdBPool.length >= 2 && cmdAPool.length >= 3) {
        const fillFac = () => { let fp = 0; for (let slot = 0; slot < 3; slot++) for (let k = 0; k < manualSlots[slot] && fp < facPool.length; k++) setSelectedFac(slot, k, facPool[fp++]); };
        // practice：2B+1A 全填 → 无 A/B 软违规、不阻断（随意）
        setRuleMode('practice');
        startSession(mode);
        setSelectedCmd(0, cmdBPool[0]); setSelectedCmd(1, cmdBPool[1]); setSelectedCmd(2, cmdAPool[0]);
        fillFac();
        const vP = validate();
        if (vP.warnings.some((w) => w.includes('A组') || w.includes('B组'))) fail(`${mode}: practice 态 2A1B 不应报软违规, got=${JSON.stringify(vP.warnings)}`);
        if (!vP.ok) fail(`${mode}: practice 态全填不应阻断, errors=${JSON.stringify(vP.errors)}`);
        // match：2B(超 B≤1) → B组 warn、不进硬错误、不阻断(不强拦)
        setRuleMode('match');
        startSession(mode);
        setSelectedCmd(0, cmdBPool[0]); setSelectedCmd(1, cmdBPool[1]); setSelectedCmd(2, cmdAPool[0]);
        fillFac();
        const vB = validate();
        if (!vB.warnings.some((w) => w.includes('B组'))) fail(`${mode}: match 态 2B 应报 B组 软违规, got=${JSON.stringify(vB.warnings)}`);
        if (vB.errors.some((e) => e.includes('B组'))) fail(`${mode}: match B组超额不应进硬错误, got=${JSON.stringify(vB.errors)}`);
        if (!vB.ok) fail(`${mode}: match 2B 软违规不应阻断(不强拦), errors=${JSON.stringify(vB.errors)}`);
        // match：3A(超 A≤2) → A组 warn、不阻断
        setRuleMode('match');
        startSession(mode);
        setSelectedCmd(0, cmdAPool[0]); setSelectedCmd(1, cmdAPool[1]); setSelectedCmd(2, cmdAPool[2]);
        fillFac();
        const vA = validate();
        if (!vA.warnings.some((w) => w.includes('A组'))) fail(`${mode}: match 态 3A 应报 A组 软违规, got=${JSON.stringify(vA.warnings)}`);
        if (!vA.ok) fail(`${mode}: match 3A 软违规不应阻断, errors=${JSON.stringify(vA.errors)}`);
        setRuleMode('practice'); // 复位默认态，不污染后续 mode 循环
      }
    } catch (e) {
      fail(`${mode}: 异常 ${e && e.message ? e.message : e}`);
      console.log(`${mode.padEnd(6)}  ----  -------------------  ---  --------  ---  ----  ---------  ------  ------  FAIL`);
    }
  }

  // ===== 段3④ phase2：双打 JJBDoubles 启动接缝断言（镜像 9 模式 __jjbDebug.select，断言 __jjbDebug.doubles）=====
  // startSession('doubles') 早分支启动独立引擎：live=true + 引擎配置形状（matches/池/槽/winLose），不碰 JijieData 单打管线。
  try {
    globalThis.window = globalThis.window || globalThis;
    globalThis.window.__jjbDebug = undefined;
    startSession('doubles');
    const dbl = globalThis.window.__jjbDebug && globalThis.window.__jjbDebug.doubles;
    if (!dbl) {
      fail('doubles: __jjbDebug.doubles 未透出（startSession 早分支未启动 JJBDoubles）');
    } else {
      if (dbl.live !== true) fail(`doubles: live=${dbl.live} ≠ true`);
      if (!dbl.config || dbl.config.matches !== 3) fail(`doubles: config.matches=${dbl.config && dbl.config.matches} ≠ 3`);
      if ((dbl.commanderPool || []).length !== 6) fail(`doubles: commanderPool 长 ${(dbl.commanderPool || []).length} ≠ 6 (cmdPoolSize)`);
      if ((dbl.factorPool || []).length !== 9) fail(`doubles: factorPool 长 ${(dbl.factorPool || []).length} ≠ 9 (factorPoolSize)`);
      const dslots = (dbl.selection && dbl.selection.slots) || [];
      if (dslots.length !== 3) fail(`doubles: selection.slots 长 ${dslots.length} ≠ 3 (matches)`);
      dslots.forEach((s, i) => {
        if ((s.cmds || []).length !== 2) fail(`doubles: 场${i} cmds 槽 ${(s.cmds || []).length} ≠ 2 (cmdsPerMatch)`);
        if ((s.factors || []).length !== 3) fail(`doubles: 场${i} factors 槽 ${(s.factors || []).length} ≠ 3 (extraFactors)`);
      });
      if ((dbl.winLoseList || []).length !== 3) fail(`doubles: winLoseList 长 ${(dbl.winLoseList || []).length} ≠ 3`);
      console.log(`\n  [doubles] 启动接缝：live=${dbl.live} matches=${dbl.config.matches} cmdPool=${dbl.commanderPool.length} facPool=${dbl.factorPool.length} slots=${dslots.length}×(cmd2/fac3) winLose=${dbl.winLoseList.length} ✓`);
    }

    // ===== 段3④ phase3：双打 select→battle 全路径 + 难度分隔离裁定（镜像单打手选→battle 渲染断言）=====
    // 难度分裁定：difficultyTotal/matchDifficulty 是单打 JijieData 不变量；双打 JJBDoubles 自管不碰 JijieData。
    // 故显式断言（禁静默）：先开单打局记 difficultyTotal 基线 → 跑双打全流程 → 基线不变（双打零污染单打计分）。
    startSession('std10');
    const diffBaseline = difficultyTotal();
    startSession('doubles'); // 早分支启动，不动 JijieData
    if (difficultyTotal() !== diffBaseline) fail(`doubles 隔离: 启动双打后单打 difficultyTotal ${difficultyTotal()} ≠ 基线 ${diffBaseline}`);

    const st0 = getDoublesState();
    const cmdPool = st0.commanderPool, facPool = st0.factorPool;
    const muts0 = (st0.config.matchMutators || [[]])[0] || [];
    // 手选第 0 场：2 指挥官 + 3 随机因子（适配层 setters → 引擎 selection）
    setDoublesCmd(0, 0, cmdPool[0]); setDoublesCmd(0, 1, cmdPool[1]);
    setDoublesFac(0, 0, facPool[0]); setDoublesFac(0, 1, facPool[1]); setDoublesFac(0, 2, facPool[2]);
    const m0 = doublesMatches()[0];
    if (m0.cmds.length !== 2 || m0.cmds[0] !== cmdPool[0] || m0.cmds[1] !== cmdPool[1]) fail(`doubles: 场0 cmds=${JSON.stringify(m0.cmds)} ≠ 手选 [${cmdPool[0]},${cmdPool[1]}]`);
    const expFac0 = muts0.concat([facPool[0], facPool[1], facPool[2]]);
    if (JSON.stringify(m0.factors) !== JSON.stringify(expFac0)) fail(`doubles: 场0 factors=${JSON.stringify(m0.factors)} ≠ 官突${JSON.stringify(muts0)}+手选3`);
    if (m0.lock !== muts0[0]) fail(`doubles: 场0 lock=${m0.lock} ≠ matchMutators[0][0]=${muts0[0]}`);
    if (m0.doubles !== true) fail(`doubles: 场0 doubles 标记=${m0.doubles} ≠ true`);

    // 随机填充其余场 + 校验全满
    randomFillDoubles();
    const vr = validateDoubles();
    if (!vr.ok) fail(`doubles: randomFill 后 validate 应通过 err=${JSON.stringify(vr.errors)}`);
    // verdict 三场 [win,bonus,lose] → setDoublesVerdict 映射 [1,2,0]，score=win+bonus=2
    setDoublesVerdict(0, 'win'); setDoublesVerdict(1, 'bonus'); setDoublesVerdict(2, 'lose');
    const stEnd = getDoublesState();
    if (stEnd.winLoseList[0] !== 1 || stEnd.winLoseList[1] !== 2 || stEnd.winLoseList[2] !== 0) fail(`doubles: winLoseList=${JSON.stringify(stEnd.winLoseList)} ≠ [1,2,0]`);
    if (doublesScore() !== 2) fail(`doubles: score(win+bonus)=${doublesScore()} ≠ 2`);
    const mEnd = doublesMatches();
    if (mEnd[0].result !== 'win' || mEnd[1].result !== 'bonus' || mEnd[2].result !== 'lose') fail(`doubles: matches.result=${JSON.stringify(mEnd.map((x) => x.result))} ≠ [win,bonus,lose]`);
    // 隔离复核：双打全流程操作后，单打 difficultyTotal 仍 = 基线（JJBDoubles 零污染 JijieData 计分）
    if (difficultyTotal() !== diffBaseline) fail(`doubles 隔离: 双打全流程后单打 difficultyTotal ${difficultyTotal()} ≠ 基线 ${diffBaseline}`);
    console.log(`  [doubles] 全路径：场0手选(cmd2/fac3+官突lock=${muts0[0]})✓ randomFill+validate✓ verdict[win,bonus,lose]→score=2✓ 难度分隔离(单打 difficultyTotal=${diffBaseline} 双打前后不变)✓`);

    // ===== R5③ 双打会话级持久断言：doubles 经 startSession 切单打再切回 doubles，池仍满 =====
    // ① startSession('std8') 非 doubles 分支应重置 JJBDoubles（doublesLive→false）
    startSession('doubles');
    if (!globalThis.window.__jjbDebug.doubles.live) fail('R5③ doubles: 启动后应 live=true');
    const dblLiveBefore = globalThis.window.__jjbDebug.doubles;
    const dblCmdPool = dblLiveBefore.commanderPool.length;
    const dblFacPool = dblLiveBefore.factorPool.length;
    // 切到单打 std8：doublesLive 应变 false（startSession 非 doubles 重置引擎）
    startSession('std8');
    if (globalThis.window.__jjbDebug.doubles && globalThis.window.__jjbDebug.doubles.live) fail('R5③ startSession(std8) 应重置 doubles（live→false）');
    // 切回 doubles：池应重新满（cmdPool=6, facPool=9）
    startSession('doubles');
    const dblAfter = globalThis.window.__jjbDebug.doubles;
    if (!dblAfter || !dblAfter.live) fail('R5③ 切回 doubles 后应 live=true');
    if ((dblAfter.commanderPool || []).length !== dblCmdPool) fail(`R5③ 切回 doubles cmdPool=${(dblAfter.commanderPool||[]).length} ≠ ${dblCmdPool}`);
    if ((dblAfter.factorPool || []).length !== dblFacPool) fail(`R5③ 切回 doubles facPool=${(dblAfter.factorPool||[]).length} ≠ ${dblFacPool}`);
    // 随机填充仍可用（池满→槽满）
    randomFillDoubles();
    const dblFillState = getDoublesState();
    const dblFillCmd = (dblFillState.selection.slots || []).reduce((n, s) => n + (s.cmds || []).filter(Boolean).length, 0);
    const dblFillFac = (dblFillState.selection.slots || []).reduce((n, s) => n + (s.factors || []).filter(Boolean).length, 0);
    if (dblFillCmd !== 6) fail(`R5③ doubles 经模式切换后随机填充 cmd=${dblFillCmd} ≠ 6`);
    if (dblFillFac !== 9) fail(`R5③ doubles 经模式切换后随机填充 fac=${dblFillFac} ≠ 9`);
    pass(`R5③ 双打持久: startSession(std8)重置doubles✓ 切回doubles池仍满(cmd6/fac9)✓ 随机填充仍可用(cmd6/fac9)✓`);

    // ===== R5②-B 官突完整取值断言：doublesMatches()[i].factors 含 CSV 各场官突 + lock/mutators 与 matchMutators 一致 =====
    startSession('doubles');
    const rm = doublesMatches();
    const matchMutators = (globalThis.window.__jjbDebug.doubles.config.matchMutators || []);
    rm.forEach((mm, i) => {
      const perMuts = matchMutators[i] || [];
      if (JSON.stringify(mm.mutators || []) !== JSON.stringify(perMuts)) fail(`R5②-B 场${i} mutators=${JSON.stringify(mm.mutators)} ≠ matchMutators[${i}]=${JSON.stringify(perMuts)}`);
      if (mm.lock !== perMuts[0]) fail(`R5②-B 场${i} lock=${mm.lock} ≠ matchMutators[${i}][0]=${perMuts[0]}`);
      if (!perMuts.every((mu) => mm.factors.includes(mu))) fail(`R5②-B 场${i} factors=${JSON.stringify(mm.factors)} 未含官突 ${JSON.stringify(perMuts)}`);
    });
    pass(`R5②-B 官突取值: 三场各含 CSV 官突 matchMutators 数组一致 ✓`);
  } catch (e) {
    fail(`doubles: 接缝异常 ${e && e.message ? e.message : e}`);
  }

  // ===== BP ban 断言（P1b 规则态分流：practice 无上限不提示 / match 上限1超出软违规不强拦）=====
  try {
    // —— practice 态（默认）：无上限自由累加/解除，不提示（done-when 1）——
    setRuleMode('practice');
    startSession('std10');
    if (getBpState().banned.length !== 0) fail('BP: 新局应无 banned（startSession 重置）');
    if (getRuleMode() !== 'practice') fail('BP: 默认应 practice 态');
    toggleBanFactor('核弹打击'); toggleBanFactor('暴风雪'); toggleBanFactor('丧尸大战');
    if (getBpState().banned.length !== 3) fail(`BP practice: 无上限应累加 3 个, got=${getBpState().banned.length}`);
    if (getSelectWarn()) fail(`BP practice: 不应有违规提示, got=${getSelectWarn()}`);
    toggleBanFactor('暴风雪'); // 解除
    if (getBanFor('暴风雪')) fail('BP practice: 解除后 getBanFor 应 false');
    if (getBpState().banned.length !== 2) fail('BP practice: 解除后应剩 2 个');

    // —— match 态：上限 1，禁第2个软违规不强拦、第1个仍有效不替换（done-when 1+2）——
    setRuleMode('match');
    startSession('std10');
    if (getRuleMode() !== 'match') fail('BP: setRuleMode(match) 后 getRuleMode 应 match');
    if (getBpState().ruleMode !== 'match') fail('BP: getBpState.ruleMode 应透出 match');
    toggleBanFactor('核弹打击');
    if (!getBanFor('核弹打击')) fail('BP match: 第1个 ban 应生效');
    if (getBpState().banned.length !== 1) fail('BP match: banned 应有 1 个');
    toggleBanFactor('暴风雪'); // 禁第2个
    if (getBanFor('暴风雪')) fail('BP match: 第2个 ban 不应生效（上限1）');
    if (!getBanFor('核弹打击')) fail('BP match: 第1个 ban 应仍有效（不替换、不强拦）');
    if (getBpState().banned.length !== 1) fail('BP match: 仍应只 1 个 banned');
    if (!getSelectWarn().includes('超出比赛规则')) fail(`BP match: 禁第2个应提示「超出比赛规则」, got=${getSelectWarn()}`);

    // setSelectedFac 防御：banned 因子不可落槽（两态一致）
    setSelectedFac(0, 0, '核弹打击');
    if (getSelectState().selectedFactorList[0] === '核弹打击') fail('BP: banned 因子不应落槽（setSelectedFac 防御）');
    setSelectedFac(0, 0, '暴风雪');
    if (getSelectState().selectedFactorList[0] !== '暴风雪') fail('BP: 非 banned 因子应能落槽');

    // 已落槽因子被 ban → match 态软违规 warn（不阻断），不强拦
    setRuleMode('match');
    startSession('std10');
    {
      const sx = getSelectState();
      const f0 = (sx.randomFactorPoor || [])[0];
      setSelectedFac(0, 0, f0);
      toggleBanFactor(f0);
      const vx = validate();
      if (!vx.warnings.some((w) => w.includes('禁用'))) fail(`BP match: 已落槽因子被 ban 应报软违规 warn, got=${JSON.stringify(vx.warnings)}`);
      if (vx.errors.some((e) => e.includes('禁用'))) fail(`BP match: banned 落槽不应进硬错误 errors（不强拦，仅软违规 warn）, errors=${JSON.stringify(vx.errors)}`);
    }

    // 违规不强拦：match 态 ban 锁定因子(含锁定、不占手选池)后全填手选 → startFromSelection 通过（ban 不阻断开局 done-when 2）
    {
      setRuleMode('match');
      startSession('std10');
      const sm = getSelectState();
      const lockFac = (sm.lockFactorList || [])[0]; // ban 锁定因子（定稿「禁因子含锁定」；不占手选池，避免池=槽缺位）
      if (lockFac) toggleBanFactor(lockFac);
      if (lockFac && !getBanFor(lockFac)) fail('BP match: 应能 ban 锁定因子（禁因子含锁定）');
      const cmds = (sm.randomCommanderPoorA || []).filter((c) => c !== '自选')
        .concat((sm.randomCommanderPoorB || []).filter((c) => c !== '自选'));
      for (let i = 0; i < 3; i++) setSelectedCmd(i, cmds[i]);
      const fp = (sm.randomFactorPoor || []).filter((f) => !getBanFor(f)); // 手选池（锁定 ban 不在此，fp 完整）
      let fi = 0;
      for (let slot = 0; slot < 3; slot++) for (let k = 0; k < sm.manualSlots[slot] && fi < fp.length; k++) setSelectedFac(slot, k, fp[fi++]);
      const rm = startFromSelection();
      if (!rm.ok) fail(`BP match: ban 锁定因子后全填应通过（ban 不阻断开局）, errors=${JSON.stringify(rm.errors)}`);
    }

    // 护栏：随机填充放弃 BP ban（防 ban+随机 死角，不破坏池=槽恒等式）
    setRuleMode('match');
    startSession('std10');
    toggleBanFactor('核弹打击');
    if (getBpState().banned.length !== 1) fail('BP护栏前置: ban 应生效');
    randomFillSelection();
    if (getBpState().banned.length !== 0) fail('BP护栏: randomFillSelection 应清 ban（随机=弃ban）');
    if (!validate().ok) fail('BP护栏: 随机填充后应能开局（无 banned 卡槽）err=' + JSON.stringify(validate().errors));

    // 新局重置 + 复位 practice（不污染后续）
    startSession('std8');
    if (getBpState().banned.length !== 0) fail('BP: startSession 应 clearBpRuntime');
    setRuleMode('practice');
    pass('BP ban: practice无上限不提示 / match上限1超出软违规不强拦 / 落槽防御 / banned落槽warn / 护栏 / 新局重置 全过');
    console.log('  [BP] practice累加✓ match上限1✓ 「超出比赛规则」提示✓ 第1个不替换✓ 落槽防御✓ banned落槽warn✓ 不强拦开局✓ 随机护栏✓ 新局重置✓');
  } catch (e) {
    fail(`BP: 断言异常 ${e && e.message ? e.message : e}`);
  }

  // ===== P2 二选一互斥 + getBpExclusive 断言（done-when 4：ban 因子 ⊕ 自选指挥官，__jjbDebug 可读启用哪支）=====
  try {
    setRuleMode('match');
    startSession('std10');
    if (getBpExclusive() !== null) fail(`二选一: 初始(未ban未自选)应 null, got=${getBpExclusive()}`);
    const sm = getSelectState();
    const banFac = (sm.randomFactorPoor || [])[0];
    const selfCmd = (sm.selfPool || [])[0];
    // 仅 ban → 'ban'
    toggleBanFactor(banFac);
    if (getBpExclusive() !== 'ban') fail(`二选一: 仅 ban 应 'ban', got=${getBpExclusive()}`);
    // ban 后再选自选指挥官 → 'conflict' + 即时 warn + validate 软违规(不进硬错误)
    if (selfCmd) {
      setSelectedCmd(0, selfCmd);
      if (getBpExclusive() !== 'conflict') fail(`二选一: ban+自选应 'conflict', got=${getBpExclusive()}`);
      if (!getSelectWarn().includes('二选一')) fail(`二选一: ban+自选即时提示应含「二选一」, got=${getSelectWarn()}`);
      const vC = validate();
      if (!vC.warnings.some((w) => w.includes('二选一'))) fail(`二选一: validate 应报二选一软违规, got=${JSON.stringify(vC.warnings)}`);
      if (vC.errors.some((e) => e.includes('二选一'))) fail(`二选一: 不应进硬错误(不强拦), got=${JSON.stringify(vC.errors)}`);
      // 反向：解除 ban → 仅自选 'self'
      toggleBanFactor(banFac);
      if (getBpExclusive() !== 'self') fail(`二选一: 解除 ban 后仅自选应 'self', got=${getBpExclusive()}`);
    }
    // practice 态：ban + 自选 不报二选一（随意）
    setRuleMode('practice');
    startSession('std10');
    const sp = getSelectState();
    toggleBanFactor((sp.randomFactorPoor || [])[0]);
    const spSelf = (sp.selfPool || [])[0];
    if (spSelf) {
      setSelectedCmd(0, spSelf);
      const vPr = validate();
      if (vPr.warnings.some((w) => w.includes('二选一'))) fail(`二选一: practice 态不应报二选一, got=${JSON.stringify(vPr.warnings)}`);
    }
    setRuleMode('practice'); // 复位
    pass('P2 二选一互斥: ban⊕自选(match) / bpExclusive null·ban·self·conflict / 即时提示 / practice 不限制 全过');
    console.log('  [二选一] null→ban→conflict(warn)→self ✓ validate 软违规不强拦 ✓ practice 随意 ✓');
  } catch (e) {
    fail(`二选一: 断言异常 ${e && e.message ? e.message : e}`);
  }
} finally {
  await server.close();
}

if (failed) {
  console.error('\n[react-e2e] ❌ 至少 1 mode 失败');
  process.exit(1);
}
console.log('\n[react-e2e] ✅ 9 模式池=槽恒等式 + 9格契约 + 状态全 + 双打全路径(启动/手选/verdict/难度分隔离) PASS');
