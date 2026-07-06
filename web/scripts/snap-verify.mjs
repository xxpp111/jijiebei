// P2 snapDOM 视觉回归：自起 preview，采集 3 屏 actual PNG，并用 pixelmatch 对比 baseline。
import { chromium } from 'playwright';
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { createServer as createNetServer } from 'net';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { comparePngs } from './visual-diff.mjs';

const webRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const update = process.argv.includes('--update');
const requestedPort = Number(process.env.JJB_SNAP_PORT || process.env.JJB_UI_PORT || 0);
const port = requestedPort || await findFreePort();
const BASE = `http://127.0.0.1:${port}/`;
const OUT_ROOT = resolve(webRoot, 'e2e/snapshots');
const ACTUAL_DIR = resolve(OUT_ROOT, 'actual');
const BASELINE_DIR = resolve(OUT_ROOT, 'baseline');
const DIFF_DIR = resolve(OUT_ROOT, 'diff');
const maxDiffRatio = Number(process.env.JJB_SNAP_MAX_DIFF_RATIO || 0.001);
const pixelThreshold = Number(process.env.JJB_SNAP_PIXEL_THRESHOLD || 0.08);

for (const dir of [ACTUAL_DIR, BASELINE_DIR, DIFF_DIR]) mkdirSync(dir, { recursive: true });

function findFreePort() {
  return new Promise((res, rej) => {
    const probe = createNetServer();
    probe.once('error', rej);
    probe.listen(0, '127.0.0.1', () => {
      const addr = probe.address();
      const p = typeof addr === 'object' && addr ? addr.port : 0;
      probe.close(() => res(p));
    });
  });
}

function waitForServer(proc) {
  return new Promise((res, rej) => {
    let out = '';
    const timer = setTimeout(() => rej(new Error('preview server did not become ready')), 15000);
    const onData = (buf) => {
      // 剥 ANSI 色码再匹配：FORCE_COLOR 环境下 vite 会输出 `127.0.0.1:\x1b[1m<port>\x1b[22m`，
      // 夹着转义符 includes 永远不命中 → 假性超时（hub 验收实测抓到的环境敏感 bug）。
      out += String(buf).replace(/\x1b\[[0-9;]*m/g, '');
      if (out.includes(`127.0.0.1:${port}`) || out.includes(`localhost:${port}`)) {
        clearTimeout(timer);
        res();
      }
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.once('exit', (code) => {
      clearTimeout(timer);
      rej(new Error(`preview exited before ready: ${code}`));
    });
  });
}

const screens = [
  { url: BASE + '?screen=select&style=metal&mode=dark&sessionMode=std10&cb=snap-select', sel: 'select' },
  { url: BASE + '?screen=battle&style=metal&mode=dark&sessionMode=std8&cb=snap-result', sel: 'result' },
  { url: BASE + '?screen=obs&style=metal&mode=dark&bare=1&sessionMode=std8&cb=snap-obs', sel: 'obs' },
];

function mockOptionalBackend(page) {
  return page.route(/\/api\//, async (route) => {
    const url = route.request().url();
    if (url.includes('/auth-refresh')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'snap', record: {} }) });
      return;
    }
    if (url.includes('/event-rules')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ban_maps: [], ban_factors: [], ban_mutators: [] }) });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
}

async function prepareScreen(page, sel) {
  if (sel === 'select') {
    await page.click('[data-random-fill-btn]');
    await page.waitForFunction(() => document.querySelectorAll('[data-pool-fac] .fx-check').length > 0);
  }
  if (sel === 'result') {
    await page.waitForSelector('.matches .match');
    const buttons = await page.locator('.matches .match .v-btn:has-text("胜利")').all();
    for (const b of buttons) await b.click();
    await page.click('[data-nav-result]');
    await page.waitForSelector('[data-capture="result"]');
    await page.waitForFunction(() => document.querySelector('[data-result-wins]')?.textContent?.trim() === '3');
  }
  if (sel === 'obs') {
    await page.waitForSelector('[data-capture="obs"]');
  }
}

async function waitForCaptureReady(page, sel) {
  await page.waitForFunction((captureName) => {
    const el = document.querySelector(`[data-capture="${captureName}"]`);
    if (!el) return false;
    const imgs = Array.from(el.querySelectorAll('img'));
    return imgs.every((img) => img.complete && img.naturalWidth > 0 && img.naturalHeight > 0);
  }, sel);
  await page.evaluate(async () => {
    await document.fonts?.ready?.catch?.(() => undefined);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

const preview = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: webRoot,
  stdio: ['ignore', 'pipe', 'pipe'],
  // 双保险禁色：waitForServer 靠 stdout 文本匹配端口，色码转义会打断匹配（剥 ANSI 之外再从源头关掉）。
  env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
});
let browser;
let failed = false;

try {
  if (!existsSync(resolve(webRoot, 'dist/index.html'))) {
    console.error('FAIL: dist/index.html missing. Run `npm run build` first.');
    process.exit(1);
  }

  await waitForServer(preview);
  browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await mockOptionalBackend(page);
  await page.addInitScript(() => {
    let seed = 0x5eed1234;
    Math.random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    try {
      localStorage.setItem('jjb_auth', JSON.stringify({
        token: 'snap',
        account: { id: 'snap-host', kind: 'host', role: 'host', display_name: 'snap-host' },
      }));
    } catch { /* noop */ }
  });

  for (const s of screens) {
    await page.goto(s.url);
    try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch {}
    await prepareScreen(page, s.sel);
    await waitForCaptureReady(page, s.sel);
    const data = await page.evaluate(async (sel) => {
      try {
        const cap = window.__jjbCapture;
        if (!cap) return { error: 'no __jjbCapture (capture.ts not loaded)' };
        await cap.warmupFonts();
        const el = document.querySelector(`[data-capture="${sel}"]`);
        if (!el) return { error: 'no el for ' + sel };
        const b = await cap.captureNodeToBlob(el, { scale: sel === 'obs' ? 3 : 2 });
        const fr = new FileReader();
        return await new Promise(res => { fr.onload = () => res({ size: b.size, dataUrl: fr.result }); fr.readAsDataURL(b); });
      } catch (e) { return { error: String((e && e.message) || e) }; }
    }, s.sel);
    if (data.error) {
      console.log(`FAIL ${s.sel}: ${data.error}`);
      failed = true;
      continue;
    }

    const actualPath = resolve(ACTUAL_DIR, `jjb-snap-${s.sel}.png`);
    const baselinePath = resolve(BASELINE_DIR, `jjb-snap-${s.sel}.png`);
    const diffPath = resolve(DIFF_DIR, `jjb-snap-${s.sel}.png`);
    writeFileSync(actualPath, Buffer.from(data.dataUrl.split(',')[1], 'base64'));

    if (update) {
      copyFileSync(actualPath, baselinePath);
      console.log(`UPDATE ${s.sel} size=${data.size} -> ${baselinePath}`);
      continue;
    }

    const result = comparePngs(actualPath, baselinePath, diffPath, { maxDiffRatio, pixelThreshold });
    if (!result.ok) failed = true;
    if (result.reason === 'match') {
      console.log(`OK ${s.sel} diff=${result.diffPixels}/${result.totalPixels} ratio=${result.diffRatio.toFixed(6)} -> ${actualPath}`);
    } else if (result.reason === 'missing-baseline') {
      console.log(`FAIL ${s.sel}: missing baseline ${baselinePath} (run: npm run snap:visual -- --update)`);
    } else if (result.reason === 'size-mismatch') {
      console.log(`FAIL ${s.sel}: size ${result.actualSize} != baseline ${result.baselineSize}`);
    } else {
      console.log(`FAIL ${s.sel}: diff=${result.diffPixels}/${result.totalPixels} ratio=${result.diffRatio.toFixed(6)} > ${result.maxDiffRatio} diff=${diffPath}`);
    }
  }
} finally {
  if (browser) await browser.close();
  preview.kill('SIGTERM');
}

if (failed) {
  console.error(update ? 'UPDATE completed with capture failures' : 'SNAP VISUAL FAIL');
  process.exit(1);
}

console.log(update ? 'SNAP BASELINES UPDATED' : 'SNAP VISUAL PASS');
