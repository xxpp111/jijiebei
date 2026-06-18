// Browser UI smoke for the React PoC.
//
// Runs with:
//   npm run build
//   npm run e2e:ui
//
// Uses the repo-local Playwright devDependency but launches the installed Chrome
// channel, so the test does not require downloading Playwright browsers.
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { createServer as createNetServer } from 'net';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const webRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const distIndex = resolve(webRoot, 'dist/index.html');
const requestedPort = Number(process.env.JJB_UI_PORT || 0);
const port = requestedPort || await findFreePort();
const baseUrl = `http://127.0.0.1:${port}`;

let failed = false;
function fail(message) {
  failed = true;
  console.error('FAIL: ' + message);
}
function pass(message) {
  console.log('PASS: ' + message);
}

if (!existsSync(distIndex)) {
  console.error('FAIL: dist/index.html missing. Run `npm run build` first.');
  process.exit(1);
}

function findFreePort() {
  return new Promise((resolvePort, reject) => {
    const probe = createNetServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const addr = probe.address();
      const freePort = typeof addr === 'object' && addr ? addr.port : 0;
      probe.close(() => resolvePort(freePort));
    });
  });
}

function waitForServer(proc) {
  return new Promise((resolveReady, reject) => {
    let out = '';
    const timer = setTimeout(() => reject(new Error('preview server did not become ready')), 15000);
    const onData = (buf) => {
      out += String(buf);
      if (out.includes(`http://127.0.0.1:${port}`) || out.includes(`http://localhost:${port}`)) {
        clearTimeout(timer);
        resolveReady();
      }
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`preview server exited before ready: ${code}`));
    });
  });
}

async function main() {
  const preview = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: webRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let browser;

  try {
    await waitForServer(preview);
    browser = await chromium.launch({ channel: 'chrome' });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const messages = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        messages.push(`[${msg.type()}] ${msg.text()}`);
      }
    });
    page.on('pageerror', (err) => messages.push(`[pageerror] ${err.message}`));

    await page.goto(`${baseUrl}/?screen=select&style=sc2&mode=dark&cb=ui-smoke-select`, { waitUntil: 'networkidle' });
    const initial = await page.evaluate(() => ({
      label: document.querySelector('[data-screen-label]')?.getAttribute('data-screen-label'),
      poolChecks: document.querySelectorAll('[data-pool-fac] .fx-check').length,
      slotChecks: document.querySelectorAll('[data-slot-fac] .fx-check').length,
      difficulty: document.querySelector('[data-difficulty-total]')?.textContent?.trim() || '',
    }));
    if (initial.label !== 'select-sc2-dark-std8') fail(`select label=${initial.label}`);
    if (initial.poolChecks !== 0 || initial.slotChecks !== 0) fail(`initial checks pool=${initial.poolChecks} slot=${initial.slotChecks}`);
    if (!/^·\s*\d+$/.test(initial.difficulty)) fail(`initial difficulty invalid: ${initial.difficulty}`);

    await page.click('[data-random-fill-btn]');
    await page.waitForFunction(() => document.querySelectorAll('[data-pool-fac] .fx-check').length === 5);
    const afterFill = await page.evaluate(() => ({
      poolChecks: document.querySelectorAll('[data-pool-fac] .fx-check').length,
      slotChecks: document.querySelectorAll('[data-slot-fac] .fx-check').length,
      difficulty: document.querySelector('[data-difficulty-total]')?.textContent?.trim() || '',
    }));
    if (afterFill.poolChecks !== 5) fail(`after fill poolChecks=${afterFill.poolChecks}`);
    if (afterFill.slotChecks !== 0) fail(`after fill slotChecks=${afterFill.slotChecks}`);
    if (!/^·\s*\d+$/.test(afterFill.difficulty)) fail(`after fill difficulty invalid: ${afterFill.difficulty}`);

    await page.goto(`${baseUrl}/?screen=select&style=sc2&mode=std8&cb=ui-smoke-session-mode-param`, { waitUntil: 'networkidle' });
    const sessionModeParam = await page.evaluate(() => ({
      label: document.querySelector('[data-screen-label]')?.getAttribute('data-screen-label'),
      appClass: document.querySelector('.jjb')?.className || '',
    }));
    if (sessionModeParam.label !== 'select-sc2-dark-std8') fail(`session mode param label=${sessionModeParam.label}`);
    if (!sessionModeParam.appClass.includes('mode-dark')) fail(`session mode param appClass=${sessionModeParam.appClass}`);

    await page.goto(`${baseUrl}/?screen=select&style=sc2&mode=light&sessionMode=std10&cb=ui-smoke-session-mode-explicit`, { waitUntil: 'networkidle' });
    const explicitSessionMode = await page.evaluate(() => ({
      label: document.querySelector('[data-screen-label]')?.getAttribute('data-screen-label'),
      appClass: document.querySelector('.jjb')?.className || '',
    }));
    if (explicitSessionMode.label !== 'select-sc2-light-std10') fail(`explicit sessionMode label=${explicitSessionMode.label}`);
    if (!explicitSessionMode.appClass.includes('mode-light')) fail(`explicit sessionMode appClass=${explicitSessionMode.appClass}`);

    // ===== 段3④ phase3：双打 select/battle 真机 data-* 透出（每个 data-* 显式 expect，与 __jjbDebug.doubles 一致）=====
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${baseUrl}/?screen=select&style=sc2&mode=dark&sessionMode=doubles&cb=ui-smoke-doubles-select`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-doubles-select]');
    const dblSelect = await page.evaluate(() => {
      const dbg = window.__jjbDebug && window.__jjbDebug.doubles;
      return {
        label: document.querySelector('[data-screen-label]')?.getAttribute('data-screen-label'),
        slots: Number(document.querySelector('[data-doubles-slots]')?.getAttribute('data-doubles-slots') ?? -1),
        slotDivs: document.querySelectorAll('[data-doubles-slot]').length,
        modeLabel: document.querySelector('[data-doubles-mode]')?.textContent?.trim() || '',
        poolCmds: document.querySelectorAll('[data-doubles-pool-cmd]').length,
        poolFacs: document.querySelectorAll('[data-doubles-pool-fac]').length,
        lock0: document.querySelector('[data-doubles-slot="0"]')?.getAttribute('data-doubles-lock') || '',
        dbgLive: dbg?.live, dbgSlots: dbg?.selection?.slots?.length,
        dbgCmdPool: dbg?.commanderPool?.length, dbgFacPool: dbg?.factorPool?.length,
        dbgMuts: (dbg?.config?.mutators || []).join(','),
      };
    });
    if (dblSelect.label !== 'select-sc2-dark-doubles') fail(`doubles select label=${dblSelect.label}`);
    if (dblSelect.dbgLive !== true) fail(`doubles __jjbDebug.doubles.live=${dblSelect.dbgLive}`);
    if (dblSelect.slots !== 3 || dblSelect.slots !== dblSelect.dbgSlots) fail(`doubles data-doubles-slots=${dblSelect.slots} ≠ __jjbDebug ${dblSelect.dbgSlots}`);
    if (dblSelect.slotDivs !== 3) fail(`doubles slot divs=${dblSelect.slotDivs} ≠ 3`);
    if (dblSelect.poolCmds !== dblSelect.dbgCmdPool || dblSelect.poolCmds !== 6) fail(`doubles data-doubles-pool-cmd=${dblSelect.poolCmds} ≠ __jjbDebug ${dblSelect.dbgCmdPool}`);
    if (dblSelect.poolFacs !== dblSelect.dbgFacPool || dblSelect.poolFacs !== 9) fail(`doubles data-doubles-pool-fac=${dblSelect.poolFacs} ≠ __jjbDebug ${dblSelect.dbgFacPool}`);
    if (!dblSelect.lock0 || dblSelect.lock0 !== dblSelect.dbgMuts) fail(`doubles data-doubles-lock(slot0)=${dblSelect.lock0} ≠ mutators ${dblSelect.dbgMuts}`);
    if (!dblSelect.modeLabel.includes('双打')) fail(`doubles data-doubles-mode=${dblSelect.modeLabel}`);
    pass(`doubles select data-*: label/slots(3)/poolCmd(6)/poolFac(9)/lock(${dblSelect.lock0}) ↔ __jjbDebug.doubles 一致`);

    await page.click('[data-doubles-random-fill-btn]');
    await page.waitForFunction(() => document.querySelectorAll('[data-doubles-cmd]').length === 6);
    const dblFilled = await page.evaluate(() => {
      const dbg = window.__jjbDebug.doubles;
      const selCmd = dbg.selection.slots.reduce((n, s) => n + s.cmds.filter(Boolean).length, 0);
      const selFac = dbg.selection.slots.reduce((n, s) => n + s.factors.filter(Boolean).length, 0);
      return {
        domCmd: document.querySelectorAll('[data-doubles-cmd]').length,
        domFac: document.querySelectorAll('[data-doubles-fac]').length,
        selCmd, selFac,
      };
    });
    if (dblFilled.domCmd !== 6 || dblFilled.domCmd !== dblFilled.selCmd) fail(`doubles 填充 data-doubles-cmd dom=${dblFilled.domCmd} ≠ selection ${dblFilled.selCmd}`);
    if (dblFilled.domFac !== 9 || dblFilled.domFac !== dblFilled.selFac) fail(`doubles 填充 data-doubles-fac dom=${dblFilled.domFac} ≠ selection ${dblFilled.selFac}`);
    pass(`doubles randomFill: dom cmd(6)/fac(9) ↔ __jjbDebug.doubles selection 一致`);

    await page.click('[data-doubles-start-btn]');
    await page.waitForFunction(() => new URLSearchParams(window.location.search).get('screen') === 'battle');
    await page.waitForSelector('[data-doubles-battle]');
    const dblBattle = await page.evaluate(() => ({
      label: document.querySelector('[data-screen-label]')?.getAttribute('data-screen-label'),
      battleMatches: Number(document.querySelector('[data-doubles-battle]')?.getAttribute('data-doubles-battle') ?? -1),
      matchRows: document.querySelectorAll('.matches .match').length,
    }));
    if (dblBattle.label !== 'battle-sc2-dark-doubles') fail(`doubles battle label=${dblBattle.label}`);
    if (dblBattle.battleMatches !== 3 || dblBattle.matchRows !== 3) fail(`doubles battle data-doubles-battle=${dblBattle.battleMatches} rows=${dblBattle.matchRows}`);
    await page.click('.matches .match:nth-child(1) .v-btn:has-text("胜利")');
    await page.waitForFunction(() => window.__jjbDebug.doubles.winLoseList[0] === 1);
    const verdict0 = await page.evaluate(() => window.__jjbDebug.doubles.winLoseList[0]);
    if (verdict0 !== 1) fail(`doubles battle verdict0=${verdict0} ≠ 1(win)`);
    pass(`doubles battle data-*: label/matches(3)/verdict→__jjbDebug.doubles.winLoseList[0]=1 一致`);

    await page.setViewportSize({ width: 800, height: 400 });
    await page.goto(`${baseUrl}/?screen=obs&style=sc2&mode=dark&cb=ui-smoke-obs`, { waitUntil: 'networkidle' });
    const obs = await page.evaluate(() => {
      const host = document.querySelector('.obs-host');
      const bar = document.querySelector('.obsbar');
      const rect = bar?.getBoundingClientRect();
      return {
        back: !!document.querySelector('[data-back-select]'),
        control: !!document.querySelector('[data-obs-control]'),
        overflowX: host ? getComputedStyle(host).overflowX : '',
        hostScrollWidth: host?.scrollWidth || 0,
        hostClientWidth: host?.clientWidth || 0,
        docScrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        barWidth: Math.round(rect?.width || 0),
        barHeight: Math.round(rect?.height || 0),
      };
    });
    if (!obs.back || !obs.control) fail(`obs controls missing back=${obs.back} control=${obs.control}`);
    if (obs.overflowX !== 'auto') fail(`obs overflowX=${obs.overflowX}`);
    if (obs.docScrollWidth > obs.innerWidth) fail(`obs page overflows ${obs.docScrollWidth}>${obs.innerWidth}`);
    if (obs.hostScrollWidth <= obs.hostClientWidth) fail(`obs host should own horizontal scroll ${obs.hostScrollWidth}<=${obs.hostClientWidth}`);
    if (obs.barWidth !== 1280 || obs.barHeight !== 232) fail(`obs bar size ${obs.barWidth}x${obs.barHeight}`);

    // 两级返回（yb 06-18 确认）：OBS 默认回 battle（继续判定），仅 battle 空（因子+官全空 或 未开局）才回 select。
    // 本场景 ObsScreen 兜底 startRandomSession(2)→fillSelectionSlots 填满 9 格因子→battle 非空→走 battle 分支。
    // （battle 空→select 分支需独立构造无因子路径，本 smoke 暂未覆盖。）
    await page.click('[data-back-select]');
    await page.waitForFunction(() => new URLSearchParams(window.location.search).get('screen') === 'battle');
    const backState = await page.evaluate(() => ({
      search: window.location.search,
      hasSelectMeta: !!document.querySelector('[data-meta-mode]'),
    }));
    if (!backState.search.includes('screen=battle')) fail(`two-level return expected battle, got: ${backState.search}`);
    if (backState.hasSelectMeta) fail(`two-level return should skip select but data-meta-mode present`);

    await page.goto(`${baseUrl}/?screen=obs&style=sc2&mode=dark&bare=1&cb=ui-smoke-bare`, { waitUntil: 'networkidle' });
    const bare = await page.evaluate(() => {
      const host = document.querySelector('.obs-host');
      const rect = document.querySelector('.obsbar')?.getBoundingClientRect();
      return {
        bare: host?.getAttribute('data-bare') || '',
        back: !!document.querySelector('[data-back-select]'),
        control: !!document.querySelector('[data-obs-control]'),
        overflowX: host ? getComputedStyle(host).overflowX : '',
        maxWidth: host ? getComputedStyle(host).maxWidth : '',
        barWidth: Math.round(rect?.width || 0),
        barHeight: Math.round(rect?.height || 0),
      };
    });
    if (bare.bare !== '1') fail(`bare attr=${bare.bare}`);
    if (bare.back || bare.control) fail(`bare controls visible back=${bare.back} control=${bare.control}`);
    if (bare.overflowX !== 'visible' || bare.maxWidth !== 'none') fail(`bare styles overflow=${bare.overflowX} maxWidth=${bare.maxWidth}`);
    if (bare.barWidth !== 1280 || bare.barHeight !== 232) fail(`bare bar size ${bare.barWidth}x${bare.barHeight}`);

    if (messages.length) {
      for (const message of messages) fail('console: ' + message);
    }
  } finally {
    if (browser) await browser.close();
    preview.kill('SIGTERM');
  }
}

await main();

if (failed) {
  console.error('[react-ui-smoke] FAIL');
  process.exit(1);
}
pass('React UI smoke passed');
