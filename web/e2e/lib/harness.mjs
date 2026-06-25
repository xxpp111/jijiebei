// e2e/lib/harness.mjs — AI-E2E flows 公共件。
//
// 抽自 ui-smoke.mjs 的 spawn-preview / waitForServer / chromium.launch 骨架，
// 让每条 flow 只写「导航 + 交互 + 断言 + 截图」，不重复起服务/起浏览器的样板。
//
// 用法（见 e2e/flows/*.flow.mjs）：
//   import { withPreview, expect, pass, fail, done, shot } from '../lib/harness.mjs';
//   await withPreview(async (page, { baseUrl }) => {
//     await page.goto(`${baseUrl}/?screen=login`, { waitUntil: 'networkidle' });
//     expect(await page.$('.login-stage'), 'login 屏渲染');
//     await shot(page, 'login');
//   });
//   done('login');
//
// 断言纪律（继承 jjb-verify）：不许只看 HTTP200/无 error；每条 flow 必有 __jjbDebug/DOM count 硬断言 + 截图；
//   落库类 flow 必 curl 后端基线对比（matches/scores/rankings Δ），不只信前端 console。
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { createServer as createNetServer } from 'net';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const webRoot = resolve(fileURLToPath(new URL('..', import.meta.url)), '..'); // lib → e2e → web

export function findFreePort() {
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

function waitForServer(proc, port) {
  return new Promise((res, rej) => {
    let out = '';
    const timer = setTimeout(() => rej(new Error('preview server did not become ready')), 15000);
    const onData = (buf) => {
      out += String(buf);
      if (out.includes(`127.0.0.1:${port}`) || out.includes(`localhost:${port}`)) { clearTimeout(timer); res(); }
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.once('exit', (code) => { clearTimeout(timer); rej(new Error(`preview exited before ready: ${code}`)); });
  });
}

// ── 断言工具（flow 共用，failed 累积到 done() 决定退出码）──
let failed = false;
export function pass(m) { console.log('  PASS:', m); }
export function fail(m) { failed = true; console.error('  FAIL:', m); }
export function expect(cond, m) { if (cond) pass(m); else fail(m); return !!cond; }
export function done(flowName) {
  if (failed) { console.error(`[${flowName}] ❌ FAIL`); process.exit(1); }
  console.log(`[${flowName}] ✅ PASS`); process.exit(0);
}
export async function shot(page, name) {
  await page.screenshot({ path: `/tmp/jjb-flow-${name}.png` });
}

/** 起 preview + launch chrome，跑 fn(page, ctx)，自动 cleanup（关浏览器 + 杀 preview）。
 *  ctx = { baseUrl, browser, page, errors[] }。console error 自动放行 /api（后端可选）。 */
export async function withPreview(fn, opts = {}) {
  const distIndex = resolve(webRoot, 'dist/index.html');
  if (!existsSync(distIndex)) { console.error('FAIL: dist/index.html missing — 先 npm run build'); process.exit(1); }
  const port = Number(process.env.JJB_UI_PORT || 0) || await findFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const preview = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: webRoot, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let browser;
  try {
    await waitForServer(preview, port);
    browser = await chromium.launch({ channel: 'chrome' });
    const page = await browser.newPage({ viewport: opts.viewport || { width: 1320, height: 800 } });
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' && !((m.location?.()?.url || '').includes('/api'))) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    return await fn(page, { baseUrl, browser, page, errors });
  } finally {
    if (browser) await browser.close();
    preview.kill('SIGTERM');
  }
}
