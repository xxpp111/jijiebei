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
  // home-match 含 #84 review 已知竖向溢出；本轮先锚现状，修复轮用 --update 刷新。
  { url: BASE + '?screen=home&style=metal&mode=dark&cb=snap-home', sel: 'home' },
  { url: BASE + '?screen=select&style=metal&mode=dark&sessionMode=std10&cb=snap-select', sel: 'select' },
  { url: BASE + '?screen=battle&style=metal&mode=dark&sessionMode=std8&cb=snap-battle', sel: 'battle' },
  { url: BASE + '?screen=battle&style=metal&mode=dark&sessionMode=std8&cb=snap-result', sel: 'result' },
  { url: BASE + '?screen=obs&style=metal&mode=dark&bare=1&sessionMode=std8&cb=snap-obs', sel: 'obs' },
];

function mockOptionalBackend(page) {
  return page.route(/\/api\//, async (route) => {
    const url = route.request().url();
    if (url.includes('/auth-refresh')) {
      // record 必须是与 addInitScript 注入的 jjb_auth 一致的完整账号——曾用 record:{} 空对象，
      // 刷新回调拿到空账号态触发重渲/重开局，二次消耗固定随机序列 → obs 屏抽签内容间歇性漂移（diff 2.4%）。
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        token: 'snap',
        record: { id: 'snap-host', kind: 'host', role: 'host', display_name: 'snap-host' },
      }) });
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
  if (sel === 'home') {
    await page.waitForSelector('[data-screen-label="home-metal-dark"]');
    await page.click('[data-home-tab="match"]');
    await page.waitForFunction(() => document.querySelector('[data-home-mode]')?.getAttribute('data-home-mode') === 'match');
    await page.evaluate(() => {
      document.querySelector('[data-screen-label="home-metal-dark"]')?.setAttribute('data-capture', 'home');
    });
  }
  if (sel === 'select') {
    await page.click('[data-random-fill-btn]');
    await page.waitForFunction(() => document.querySelectorAll('[data-pool-fac] .fx-check').length > 0);
  }
  if (sel === 'battle') {
    await page.waitForSelector('.matches .match');
    await page.evaluate(() => {
      document.querySelector('[data-screen-label="battle-metal-dark-std8"]')?.setAttribute('data-capture', 'battle');
    });
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
  await page.evaluate(async (captureName) => {
    // img.complete 只保证「加载完」不保证「解码完」——snapDOM 序列化撞上未解码图会截出整块差异
    // （hub 验收实测：数据层 6 连跑逐字节一致，视觉仍间歇漂移 2.4%，红区=单场整行图元）。显式等解码。
    const el = document.querySelector(`[data-capture="${captureName}"]`);
    const imgs = Array.from(el?.querySelectorAll('img') || []);
    await Promise.all(imgs.map((img) => img.decode().catch(() => undefined)));
    await document.fonts?.ready?.catch?.(() => undefined);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, sel);
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
  // mock/route/固定随机注册在 context 级，每屏开全新 page —— 消除跨屏 sessionStorage/随机序列/时序残留
  // （hub 验收实测：复用单 page 连续 goto 时 obs 屏第 2 场抽签跨运行漂移 diff=2.4%，per-screen fresh page 归零）。
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await mockOptionalBackend(ctx);
  await ctx.addInitScript(() => {
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
    const page = await ctx.newPage();
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
        // capture-until-stable：snapDOM 序列化偶发单图未就绪 → 该场整行重排 → 固定区域二态漂移
        // （hub 验收实测：数据层 6 连跑恒定、diff 像素数两次 FAIL 完全相同 69630 = 固定区域瞬态）。
        // 连截直到相邻两次逐字节一致才接受，瞬态自然收敛；4 次仍不稳 = 真实不稳定，如实 FAIL。
        const shot = async () => {
          const b = await cap.captureNodeToBlob(el, { scale: sel === 'obs' ? 3 : 2 });
          const fr = new FileReader();
          return await new Promise((res) => { fr.onload = () => res({ size: b.size, dataUrl: fr.result }); fr.readAsDataURL(b); });
        };
        let prev = await shot();
        for (let i = 0; i < 3; i++) {
          const next = await shot();
          if (next.dataUrl === prev.dataUrl) return next;
          prev = next;
        }
        return { error: 'capture unstable: 4 consecutive shots never converged' };
      } catch (e) { return { error: String((e && e.message) || e) }; }
    }, s.sel);
    if (data.error) {
      console.log(`FAIL ${s.sel}: ${data.error}`);
      failed = true;
      await page.close();
      continue;
    }

    const actualPath = resolve(ACTUAL_DIR, `jjb-snap-${s.sel}.png`);
    const baselinePath = resolve(BASELINE_DIR, `jjb-snap-${s.sel}.png`);
    const diffPath = resolve(DIFF_DIR, `jjb-snap-${s.sel}.png`);
    writeFileSync(actualPath, Buffer.from(data.dataUrl.split(',')[1], 'base64'));

    if (update) {
      copyFileSync(actualPath, baselinePath);
      console.log(`UPDATE ${s.sel} size=${data.size} -> ${baselinePath}`);
      await page.close();
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
    await page.close();
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
