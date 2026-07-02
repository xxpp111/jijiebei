import { spawn } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { createServer as createNetServer } from 'net';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const webRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const distIndex = resolve(webRoot, 'dist/index.html');
const shotDir = process.env.JJB_R6_SCREENSHOT_DIR || '/tmp/jjb-r6-doubles-downstream';
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
mkdirSync(shotDir, { recursive: true });

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

async function goto(page, path) {
  await page.goto(`${baseUrl}/${path}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
}

async function shot(page, name) {
  await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete), { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${shotDir}/${name}.png`, fullPage: false });
}

async function assertBrand(page, style, mode, screen) {
  await page.waitForSelector('[data-brand-lockup]');
  const brand = await page.evaluate(() => {
    const lockup = document.querySelector('[data-brand-lockup]');
    const cn = lockup?.querySelector('.lockup-cn');
    const en = lockup?.querySelector('.lockup-en');
    const mark = lockup?.querySelector('.lockup-mark');
    const cnStyle = cn ? getComputedStyle(cn) : null;
    return {
      text: lockup?.textContent || '',
      hasLogo: !!(mark && (mark.tagName === 'IMG' || mark.textContent?.trim() === 'CM')),
      hasTitleImage: !!lockup?.querySelector('.lockup-title'),
      cnBackground: cnStyle?.backgroundImage || '',
      cnColor: cnStyle?.color || '',
      enColor: en ? getComputedStyle(en).color : '',
    };
  });
  if (!brand.text.includes('集结杯')) fail(`${style}-${mode}-${screen}: brand missing 集结杯`);
  if (!brand.text.includes('REGROUP CUP')) fail(`${style}-${mode}-${screen}: brand missing REGROUP CUP`);
  if (!brand.hasLogo) fail(`${style}-${mode}-${screen}: brand logo missing`);
  if (brand.hasTitleImage) fail(`${style}-${mode}-${screen}: brand still uses title image`);
  if (!brand.cnBackground.includes('linear-gradient')) fail(`${style}-${mode}-${screen}: cn gold gradient missing (${brand.cnBackground || brand.cnColor})`);
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
    // 绕登录门（同 ui-smoke task #54 范式）：注入 player auth，否则 ?screen=select/battle 被 App 守卫踢回 home。
    await page.addInitScript(() => {
      try {
        localStorage.setItem('jjb_auth', JSON.stringify({ token: 'e2e', account: { id: 'e2e-player', kind: 'player', nickname: 'e2e' } }));
      } catch { /* noop */ }
    });
    // 本机可能跑着真 PB（relay 部署链路）：拦 auth-refresh 返 200 假续期，防注入的 e2e auth 被 401 清掉、导航被踢回 home。
    await page.route('**/auth-refresh', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'e2e', record: {} }),
    }));
    const messages = [];
    page.on('console', (msg) => {
      if (msg.type() !== 'error' && msg.type() !== 'warning') return;
      // 放行后端可选的 /api resource error（展示屏 fetch /api，P5 未跑时失败，前端有 catch 兜底；前端 e2e 不应因后端缺席而 FAIL）
      if ((msg.location?.()?.url || '').includes('/api')) return;
      // 同理放行落库告警：e2e 注入假 auth，结算落库对真/假后端都可能 4xx；前端 catch 兜底不阻断结算
      if (msg.text().includes('落库失败（不阻断结算）')) return;
      messages.push(`[${msg.type()}] ${msg.text()}`);
    });
    page.on('pageerror', (err) => messages.push(`[pageerror] ${err.message}`));

    await goto(page, '?screen=select&style=sc2&mode=dark&sessionMode=doubles&cb=r6-flow');
    await page.waitForSelector('[data-doubles-select]');
    await page.click('[data-doubles-random-fill-btn]');
    await page.waitForFunction(() => document.querySelectorAll('[data-doubles-cmd]').length === 6);
    await page.click('[data-doubles-start-btn]');
    await page.waitForSelector('[data-doubles-battle]');
    const battleInitial = await page.evaluate(() => {
      const dbg = window.__jjbDebug?.doubles;
      return {
        label: document.querySelector('[data-screen-label]')?.getAttribute('data-screen-label'),
        rows: document.querySelectorAll('.matches .match').length,
        difficultyText: [...document.querySelectorAll('.match-difficulty')].map((n) => n.textContent?.trim()),
        difficultyAttrs: document.querySelectorAll('.matches .match[data-match-difficulty]').length,
        gold: document.querySelectorAll('.matches .match .fx.gold').length,
        mutator: document.querySelectorAll('.matches .match .fx.mutator').length,
        lockTags: document.querySelectorAll('.matches .match .fx-tag.lock').length,
        expectedMutator: dbg?.config?.matchMutators ? dbg.config.matchMutators.reduce((s, m) => s + m.length, 0) : (dbg?.config?.matches || 0) * (dbg?.config?.mutators?.length || 0),
      };
    });
    if (battleInitial.label !== 'battle-sc2-dark-doubles') fail(`battle label=${battleInitial.label}`);
    if (battleInitial.rows !== 3) fail(`battle rows=${battleInitial.rows} != 3`);
    if (battleInitial.difficultyText.length || battleInitial.difficultyAttrs) fail(`battle doubles difficulty leaked text=${battleInitial.difficultyText.join('|')} attrs=${battleInitial.difficultyAttrs}`);
    if (battleInitial.gold > 0) fail(`battle: official mutators must not be gold frame (got ${battleInitial.gold})`);
    if (battleInitial.mutator < battleInitial.expectedMutator) fail(`battle mutator frames=${battleInitial.mutator} < expected ${battleInitial.expectedMutator}`);
    if (battleInitial.lockTags < battleInitial.expectedMutator) fail(`battle lock tags=${battleInitial.lockTags} < expected ${battleInitial.expectedMutator}`);
    await shot(page, 'battle-doubles');
    pass(`battle doubles: mutator=${battleInitial.mutator}, no gold, no difficulty, rows=3`);

    await page.click('.matches .match:nth-child(1) .v-btn:has-text("胜利")');
    await page.click('.matches .match:nth-child(2) .v-btn:has-text("带奖励")');
    await page.click('.matches .match:nth-child(3) .v-btn:has-text("失败")');
    await page.waitForFunction(() => window.__jjbDebug?.doubles?.totalCount === 3);
    await page.click('[data-nav-result]');
    await page.waitForFunction(() => new URLSearchParams(window.location.search).get('screen') === 'result');
    await page.waitForSelector('.rcard');
    const result = await page.evaluate(() => {
      const dbg = window.__jjbDebug?.doubles;
      return {
        label: document.querySelector('[data-screen-label]')?.getAttribute('data-screen-label'),
        wins: document.querySelector('[data-result-wins]')?.textContent?.trim(),
        cards: document.querySelectorAll('.rcard').length,
        difficultyText: [...document.querySelectorAll('.rcard-difficulty')].map((n) => n.textContent?.trim()),
        difficultyAttrs: document.querySelectorAll('.rcard[data-match-difficulty]').length,
        gold: document.querySelectorAll('.rcard .fx.gold').length,
        mutator: document.querySelectorAll('.rcard .fx.mutator').length,
        expectedMutator: dbg?.config?.matchMutators ? dbg.config.matchMutators.reduce((s, m) => s + m.length, 0) : (dbg?.config?.matches || 0) * (dbg?.config?.mutators?.length || 0),
      };
    });
    if (result.label !== 'result-sc2-dark') fail(`result label=${result.label}`);
    if (result.wins !== '2') fail(`result wins=${result.wins} != 2`);
    if (result.cards !== 3) fail(`result cards=${result.cards} != 3`);
    if (result.difficultyText.length || result.difficultyAttrs) fail(`result doubles difficulty leaked text=${result.difficultyText.join('|')} attrs=${result.difficultyAttrs}`);
    if (result.gold > 0) fail(`result: official mutators must not be gold frame (got ${result.gold})`);
    if (result.mutator < result.expectedMutator) fail(`result mutator frames=${result.mutator} < expected ${result.expectedMutator}`);
    await shot(page, 'result-doubles');
    pass(`result doubles: wins=2, mutator=${result.mutator}, no gold, no difficulty`);

    await page.click('[data-nav-obs]');
    await page.waitForSelector('.obsbar');
    const obs = await page.evaluate(() => {
      const dbg = window.__jjbDebug?.doubles;
      return {
        rows: document.querySelectorAll('.obs-match').length,
        cmdCards: document.querySelectorAll('.obs-match .obs-cmds .cc').length,
        gold: document.querySelectorAll('.obs-match .fx.gold').length,
        mutator: document.querySelectorAll('.obs-match .fx.mutator').length,
        expectedMutator: dbg?.config?.matchMutators ? dbg.config.matchMutators.reduce((s, m) => s + m.length, 0) : (dbg?.config?.matches || 0) * (dbg?.config?.mutators?.length || 0),
        difficulty: !!document.querySelector('.obsbar [data-difficulty-total]'),
        brandText: document.querySelector('.obs-score-brand')?.textContent || '',
      };
    });
    if (obs.rows !== 3) fail(`obs rows=${obs.rows} != 3`);
    if (obs.cmdCards !== 6) fail(`obs cmdCards=${obs.cmdCards} != 6`);
    if (obs.gold > 0) fail(`obs: official mutators must not be gold frame (got ${obs.gold})`);
    if (obs.mutator < obs.expectedMutator) fail(`obs mutator frames=${obs.mutator} < expected ${obs.expectedMutator}`);
    if (obs.difficulty) fail('obs doubles difficulty total is visible');
    if (!obs.brandText.includes('集结杯') || !obs.brandText.includes('REGROUP CUP')) fail(`obs brand text=${obs.brandText}`);
    await page.click('[data-obs-control] > div:nth-child(3) .v-btn:has-text("胜")');
    await page.waitForFunction(() => window.__jjbDebug?.doubles?.winLoseList?.[2] === 1);
    await shot(page, 'obs-doubles');
    pass(`obs doubles: cmdCards=6, mutator=${obs.mutator}, no gold, no difficulty, verdict writes doubles engine`);

    await goto(page, '?screen=select&style=sc2&mode=dark&sessionMode=doubles&cb=r6-rerandom');
    await page.waitForSelector('[data-doubles-select]');
    await page.click('[data-rerandom-btn]');
    await page.waitForSelector('[data-doubles-select]');
    const rerandom = await page.evaluate(() => {
      const dbg = window.__jjbDebug?.doubles;
      return {
        label: document.querySelector('[data-screen-label]')?.getAttribute('data-screen-label'),
        live: dbg?.live,
        cmdPool: dbg?.commanderPool?.length,
        facPool: dbg?.factorPool?.length,
        sessionMode: new URLSearchParams(window.location.search).get('sessionMode'),
      };
    });
    if (rerandom.label !== 'select-sc2-dark-doubles' || !rerandom.live) fail(`rerandom degraded: ${JSON.stringify(rerandom)}`);
    if (rerandom.cmdPool !== 6 || rerandom.facPool !== 9) fail(`rerandom pools invalid: ${JSON.stringify(rerandom)}`);
    if (rerandom.sessionMode !== 'doubles') fail(`rerandom sessionMode=${rerandom.sessionMode}`);
    pass('rerandom doubles: remains doubles with full pools');

    await goto(page, '?screen=battle&style=sc2&mode=dark&sessionMode=doubles&cb=r6-refresh-battle');
    await page.waitForSelector('[data-doubles-battle]');
    const refreshBattle = await page.evaluate(() => ({
      label: document.querySelector('[data-screen-label]')?.getAttribute('data-screen-label'),
      rows: document.querySelectorAll('.matches .match').length,
      live: window.__jjbDebug?.doubles?.live,
    }));
    if (refreshBattle.label !== 'battle-sc2-dark-doubles' || refreshBattle.rows !== 3 || !refreshBattle.live) fail(`battle refresh degraded: ${JSON.stringify(refreshBattle)}`);

    await goto(page, '?screen=result&style=sc2&mode=dark&sessionMode=doubles&cb=r6-refresh-result');
    await page.waitForFunction(() => document.querySelectorAll('.rcard').length === 3);
    const refreshResult = await page.evaluate(() => ({
      modeLabel: document.querySelector('[data-meta-mode]')?.textContent || '',
      cards: document.querySelectorAll('.rcard').length,
      live: window.__jjbDebug?.doubles?.live,
    }));
    if (!refreshResult.modeLabel.includes('双打') || refreshResult.cards !== 3 || !refreshResult.live) fail(`result refresh degraded: ${JSON.stringify(refreshResult)}`);
    pass('refresh: battle/result deep links preserve doubles');

    const styles = ['metal', 'sc2', 'minimal'];
    const modes = ['dark', 'light'];
    const screens = ['home', 'select', 'battle', 'result', 'obs', 'bpconfig'];
    for (const style of styles) {
      for (const mode of modes) {
        for (const screen of screens) {
          const bare = screen === 'obs' ? '&bare=1' : '';
          const sessionMode = screen === 'home' || screen === 'bpconfig' ? 'std8' : 'doubles';
          await goto(page, `?screen=${screen}&style=${style}&mode=${mode}&sessionMode=${sessionMode}${bare}&cb=r6-brand-${style}-${mode}-${screen}`);
          await assertBrand(page, style, mode, screen);
          await shot(page, `brand-${style}-${mode}-${screen}`);
        }
      }
    }
    pass(`brand: 6 themes x 6 screens captured under ${shotDir}`);

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
  console.error('[r6-doubles-downstream] FAIL');
  process.exit(1);
}
pass('R6 doubles downstream verifier passed');
