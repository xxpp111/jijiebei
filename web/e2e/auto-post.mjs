// e2e/auto-post.mjs — #94 落库触发链路修复：判定完成即后台自动 POST + 5s 改判缓冲 + 显式状态 chip。
// 被测：web/src/logic/matchRecord.ts autoPostIfComplete/局指纹防重 + web/src/screens/BattleScreen.tsx 接线。
// 拦截 /api/collections/matches/records（不起真后端）：计数 + 记请求体，断言触发时机与 payload 取值，
// 而不是验证 PocketBase 权限矩阵（那是 practice-post.mjs/auth-perm.mjs 的职责，本脚本只测前端触发链路）。
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
      // vite 在带色终端会把 ANSI 转义插进 URL 中间（host 与 port 之间），先剥色再匹配
      const plain = out.replace(/\x1b\[[0-9;]*m/g, '');
      if (plain.includes(`http://127.0.0.1:${port}`) || plain.includes(`http://localhost:${port}`)) {
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
  await page.goto(`${baseUrl}/${path}`, { waitUntil: 'networkidle', timeout: 45000 });
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

    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.route(/auth-refresh/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'e2e', record: {} }) }));
    // host 账号登录态（match 态落库需 kind=host）：每次导航都重新注入（addInitScript 每次 navigation 都跑）。
    // 注意：ruleMode 不放这里——addInitScript 会在后续每次导航时无条件重跑，把后面手动切 practice 的 sessionStorage 覆盖回 match；
    // ruleMode 改用 page.evaluate 在每次需要的 goto 前显式设置（sessionStorage 跨导航持久，读取仍在下一次模块加载时发生）。
    await page.addInitScript(() => {
      try {
        localStorage.setItem('jjb_auth', JSON.stringify({ token: 'e2e-host', account: { id: 'e2e-host-1', kind: 'host', display_name: 'e2e主播' } }));
      } catch { /* noop */ }
    });

    // ensurePlayer 兜底链路 mock：getPlayerByCode（GET ?filter=）查无 → createPlayer（POST）按 player_code 稳定建档。
    // 双打 deep-link 默认名会各 ensurePlayer 一次；这里按名字回 distinct id，钉住 body.players=[A,B] 形状。
    let matchPosts = [];
    const mockPlayersByCode = new Map();
    await page.route('**/collections/players/records**', (route) => {
      if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        const code = body.player_code || body.nickname || `e2e选手${mockPlayersByCode.size + 1}`;
        if (!mockPlayersByCode.has(code)) {
          mockPlayersByCode.set(code, {
            id: `e2e-player-${mockPlayersByCode.size + 1}`,
            nickname: body.nickname || code,
            player_code: code,
          });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockPlayersByCode.get(code)) });
      }
      const url = new URL(route.request().url());
      const filter = url.searchParams.get('filter') || '';
      const code = decodeURIComponent(filter).match(/player_code='([^']+)'/)?.[1];
      const existing = code ? mockPlayersByCode.get(code) : null;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: existing ? [existing] : [] }) });
    });
    await page.route('**/collections/matches/records', (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      matchPosts.push(JSON.parse(route.request().postData() || '{}'));
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'e2e-match-' + matchPosts.length }) });
    });

    const messages = [];
    page.on('console', (msg) => {
      if (msg.type() !== 'error' && msg.type() !== 'warning') return;
      if ((msg.location?.()?.url || '').includes('/api')) return;
      if (/fonts\.(googleapis|gstatic)\.com/.test(msg.location?.()?.url || '')) return;
      messages.push(`[${msg.type()}] ${msg.text()}`);
    });
    page.on('pageerror', (err) => messages.push(`[pageerror] ${err.message}`));

    // 热身导航：先落地一次拿到 origin 的 storage 上下文，再显式置 ruleMode=match（sessionStorage 跨导航持久，
    // 下一次导航时 sessionRuntime 模块重新加载才会读到）。
    await goto(page, '?screen=battle&style=sc2&mode=dark&sessionMode=std8&cb=auto-post-warmup');
    await page.evaluate(() => sessionStorage.setItem('jjb_rule_mode', 'match'));

    // ① 单打 3 场全判 → 5s 后自动 POST，chip=done；结果与 currentScore()/RESULT_VAL 语义一致（win/bonus/lose→1/2/0）。
    await goto(page, '?screen=battle&style=sc2&mode=dark&sessionMode=std8&cb=auto-post-single');
    await page.waitForSelector('.matches .match');
    await page.click('.matches .match:nth-child(1) .v-btn:has-text("胜利")');
    await page.click('.matches .match:nth-child(2) .v-btn:has-text("带奖励")');
    await page.waitForSelector('[data-record-chip]'); // 未判完：chip 已渲染（比赛态+有资格）但状态未 done
    const midState = await page.evaluate(() => document.querySelector('[data-record-chip]')?.getAttribute('data-record-state'));
    if (midState !== 'idle') fail(`① 只判 2 场时 chip 状态=${midState} != idle（不该提前发）`);
    await page.click('.matches .match:nth-child(3) .v-btn:has-text("失败")');
    await page.waitForSelector('[data-record-chip][data-record-state="done"]', { timeout: 8000 });
    if (matchPosts.length !== 1) fail(`① 3 场全判 5s 后 matches POST 次数=${matchPosts.length} != 1`);
    else {
      const body = matchPosts[0];
      if (JSON.stringify(body.result) !== JSON.stringify([1, 2, 0])) fail(`① result=${JSON.stringify(body.result)} != [1,2,0]（win/bonus/lose→RESULT_VAL）`);
      if (body.score_total !== 2) fail(`① score_total=${body.score_total} != 2（win+bonus 计胜场）`);
      if (body.mode !== 'match') fail(`① mode=${body.mode} != match`);
      pass(`① 单打 3 场全判：5s 后自动 POST 一次，result=${JSON.stringify(body.result)} score_total=${body.score_total}，chip=done`);
    }

    // ② 改判一场（match1 从胜利改判失败）→ 局指纹不变，等够 5s 仍只应有 1 次 POST（不产生第二条 matches）。
    await page.click('.matches .match:nth-child(1) .v-btn:has-text("失败")');
    await page.waitForTimeout(6000); // 满 5s 改判缓冲 + 余量，给可能的（错误）第二次 POST 机会暴露
    if (matchPosts.length !== 1) fail(`② 改判后 matches POST 次数=${matchPosts.length} != 1（局指纹防重应挡住第二次）`);
    else pass('② 改判一场后 6s：matches POST 仍只 1 次（局指纹防重生效，不产生第二条 matches）');
    const afterRejudgeState = await page.evaluate(() => document.querySelector('[data-record-chip]')?.getAttribute('data-record-state'));
    if (afterRejudgeState !== 'done') fail(`② 改判后 chip 状态=${afterRejudgeState} != done（duplicate 应仍视为已录入）`);

    // ③ 双打局：3 场全判 → payload 的 result/score_total 取双打引擎真值（jjbView 分流，不误读单打 JijieData）。
    matchPosts = [];
    await goto(page, '?screen=battle&style=sc2&mode=dark&sessionMode=doubles&cb=auto-post-doubles');
    await page.waitForSelector('[data-doubles-battle]');
    await page.click('.matches .match:nth-child(1) .v-btn:has-text("胜利")');
    await page.click('.matches .match:nth-child(2) .v-btn:has-text("失败")');
    await page.click('.matches .match:nth-child(3) .v-btn:has-text("带奖励")');
    await page.waitForSelector('[data-record-chip][data-record-state="done"]', { timeout: 8000 });
    if (matchPosts.length !== 1) fail(`③ 双打 3 场全判 matches POST 次数=${matchPosts.length} != 1`);
    else {
      const body = matchPosts[0];
      if (JSON.stringify(body.result) !== JSON.stringify([1, 0, 2])) fail(`③ 双打 result=${JSON.stringify(body.result)} != [1,0,2]（win/lose/bonus→RESULT_VAL）`);
      if (body.score_total !== 2) fail(`③ 双打 score_total=${body.score_total} != 2（doublesScore：win+bonus）`);
      if (body.game_mode !== 'doubles') fail(`③ 双打 game_mode=${body.game_mode} != doubles`);
      if (!Array.isArray(body.players) || body.players.length !== 2) fail(`③ 双打 players=${JSON.stringify(body.players)} 不是两元素数组`);
      else if (body.players[0] === body.players[1]) fail(`③ 双打 players 两元素不 distinct：${JSON.stringify(body.players)}`);
      pass(`③ 双打 3 场全判：result=${JSON.stringify(body.result)} score_total=${body.score_total} players=${JSON.stringify(body.players)}（双打引擎真值，非单打陈旧值）`);
    }

    // ④ 练习态：battle 屏不渲染任何落库 chip/警示（现有静默语义保留），无论账号是谁。
    await page.evaluate(() => sessionStorage.setItem('jjb_rule_mode', 'practice'));
    await goto(page, '?screen=battle&style=sc2&mode=dark&sessionMode=std10&cb=auto-post-practice');
    await page.waitForSelector('.matches .match');
    const practiceChip = await page.evaluate(() => !!document.querySelector('[data-record-chip], [data-record-warn]'));
    if (practiceChip) fail('④ 练习态 battle 屏出现了落库 chip/警示（应保持静默）');
    else pass('④ 练习态 battle 屏无落库 chip/警示（静默语义保留）');

    // ⑤ 比赛态 + 非主播账号（选手登录）：常驻警示「当前身份无法录入天梯」，不触发 POST。
    matchPosts = [];
    await page.evaluate(() => sessionStorage.setItem('jjb_rule_mode', 'match'));
    await page.addInitScript(() => {
      try { localStorage.setItem('jjb_auth', JSON.stringify({ token: 'e2e-player', account: { id: 'e2e-player-x', kind: 'player', nickname: 'e2e选手' } })); } catch { /* noop */ }
    });
    await goto(page, '?screen=battle&style=sc2&mode=dark&sessionMode=std12&cb=auto-post-nonhost-warn');
    await page.waitForSelector('.matches .match');
    const warnVisible = await page.evaluate(() => !!document.querySelector('[data-record-warn]'));
    if (!warnVisible) fail('⑤ 比赛态非主播账号未出现 [data-record-warn] 常驻警示');
    await page.click('.matches .match:nth-child(1) .v-btn:has-text("胜利")');
    await page.click('.matches .match:nth-child(2) .v-btn:has-text("胜利")');
    await page.click('.matches .match:nth-child(3) .v-btn:has-text("胜利")');
    await page.waitForTimeout(6000);
    if (matchPosts.length !== 0) fail(`⑤ 非主播账号判满 3 场后仍发出 matches POST 次数=${matchPosts.length}（应为 0）`);
    else pass('⑤ 比赛态非主播账号：常驻警示可见 + 判满 3 场也不触发 POST');

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
  console.error('[auto-post] FAIL');
  process.exit(1);
}
pass('auto-post 自动落库触发链路 e2e 全绿');
