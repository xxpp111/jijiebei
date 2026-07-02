// Batch B 产品快赢 e2e：D12 记住我默认勾 + D17 隐私协议注册门（纯前端）。
//
// Runs with:
//   npm run build
//   node e2e/register-privacy.mjs
//
// 断言：
//   ① login 屏「记住我」默认勾选（D12）
//   ② register 屏填满必填但未勾协议 → 点注册被前端拦截（error banner 含「同意」，且 0 次 player_accounts 请求）
//   ③ 勾选协议 → error banner 清除（clearErr 生效）
//   ④ 勾选后再点注册 → 前端门放行（player_accounts 请求发出；preview 无 /api proxy，后端结果不在本测范围）
// 基建照抄 ui-smoke.mjs（vite preview + Playwright chrome channel）。
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
    // 去掉 ANSI 颜色：带色输出会把端口号包进控制码，waitForServer 字符串匹配不上
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
  });
  let browser;

  try {
    await waitForServer(preview);
    browser = await chromium.launch({ channel: 'chrome' });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

    // ① D12：login 屏记住我默认勾选
    await page.goto(`${baseUrl}/?style=sc2-dark&screen=login`, { waitUntil: 'networkidle' });
    const label = await page.locator('[data-screen-label]').first().getAttribute('data-screen-label');
    if (label && label.startsWith('login')) pass(`login 屏直达（label=${label}）`);
    else fail(`login 屏未直达（label=${label}）`);
    const rememberChecked = await page.locator('[data-login-remember] input').isChecked();
    if (rememberChecked) pass('① D12 记住我默认勾选');
    else fail('① D12 记住我默认未勾选');

    // register 屏 + player_accounts 请求监听（前端门的硬证据）
    const paRequests = [];
    page.on('request', (r) => { if (r.url().includes('player_accounts')) paRequests.push(r.url()); });
    await page.goto(`${baseUrl}/?style=sc2-dark&screen=register`, { waitUntil: 'networkidle' });
    const regLabel = await page.locator('[data-screen-label]').first().getAttribute('data-screen-label');
    if (regLabel && regLabel.startsWith('register')) pass(`register 屏直达（label=${regLabel}）`);
    else fail(`register 屏未直达（label=${regLabel}）`);

    // ② 填满必填但不勾协议 → 点注册应被前端拦截
    await page.fill('[data-reg-field="昵称"]', 'e2e隐私门');
    await page.fill('[data-reg-field="手机号"]', '13900001234');
    await page.fill('[data-reg-field="密码"]', 'pass12345');
    await page.fill('[data-reg-field="确认密码"]', 'pass12345');
    const agreedBefore = await page.locator('[data-reg-privacy] input').isChecked();
    if (!agreedBefore) pass('② 协议默认未勾选');
    else fail('② 协议默认竟是勾选态');
    await page.click('[data-reg-btn]');
    const banner = page.locator('[data-reg-banner="error"]');
    await banner.waitFor({ state: 'visible', timeout: 3000 });
    const bannerText = (await banner.textContent()) || '';
    if (bannerText.includes('同意')) pass(`② 未勾协议被拦截（banner=「${bannerText.trim()}」）`);
    else fail(`② 拦截文案不对（banner=「${bannerText.trim()}」）`);
    if (paRequests.length === 0) pass('② 拦截为纯前端（0 次 player_accounts 请求）');
    else fail(`② 未勾协议竟发出 ${paRequests.length} 次 player_accounts 请求`);

    // ③ 勾选协议 → error banner 清除
    await page.check('[data-reg-privacy] input');
    await banner.waitFor({ state: 'detached', timeout: 3000 });
    pass('③ 勾选协议后 error banner 清除');

    // ④ 勾选后再点注册 → 前端门放行（请求发出即证明；preview 无 proxy，后端结果不看）
    await page.click('[data-reg-btn]');
    await page.waitForTimeout(1500);
    if (paRequests.length > 0) pass(`④ 勾选后门放行（发出 ${paRequests.length} 次 player_accounts 请求）`);
    else fail('④ 勾选后仍未发出 player_accounts 请求（门未放行）');

    await page.screenshot({ path: resolve(webRoot, 'e2e-register-privacy.png') });
  } catch (err) {
    fail(`e2e 异常：${err && err.message ? err.message : err}`);
  } finally {
    if (browser) await browser.close();
    preview.kill('SIGTERM');
  }

  if (failed) {
    console.error('register-privacy e2e FAILED');
    process.exit(1);
  }
  console.log('register-privacy e2e OK');
}

await main();
