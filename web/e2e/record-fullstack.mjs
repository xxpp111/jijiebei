// e2e/record-fullstack.mjs — #94 全栈端到端真机验证（补 auto-post↔practice-post 之间的真接缝）。
//
// 验证缺口（本脚本填的坑）：
//   auto-post.mjs   走前端真 UI（playwright 驱动 battle 屏判定），但【全程 mock 后端】
//                   （page.route 拦 /collections/matches/records）——只证"前端会发 POST + payload 取值对"。
//   practice-post.mjs 用【真 isopb 后端】，但直接 curl API 提交，【不走前端 UI】、且 players:[] 为空
//                   ——只证"后端 API 接受 payload + scores hook 行为"，从不解析 players relation。
//   两半之间的接缝 = "前端 autoPostIfComplete 发出的真实 payload（players 非空、经 ensurePlayer relation）
//                    能否穿过真 PB 的 CreateRule + relation 校验真正落库" = #94 触发时机 × #89 relation 解析的交汇。
//
// 本脚本：起隔离 isopb（8090，临时 dir）+ vite preview（/api proxy→8090 真后端，不 mock）。
//   P1 practice 选手路径：API 注册真 player_account → 前端真 UI 填手机号+密码登录（非注入假 token）
//     → home 练习 tab → 开 std8 → playwright 驱动走完 3 场判定 → 等 autoPostIfComplete 5s 缓冲自动 POST
//     → 断言真 isopb：matches 有该局(mode=practice, players 指向 pa-<accId> 真 player) + scores 无派生。
//   P2 match 主播路径：superuser 建 host 账号 → 前端真 UI 主播 tab 登录 → home 比赛 tab → 开 std8
//     → 判定 → 自动 POST → 断言真 isopb：matches 有该局(mode=match, host=host.id) + scores 有派生（进天梯）。
//   P3 doubles 双打路径：复用 host 比赛态 → HomeScreen 采两名（选手A/B）→ 点双打格 → select 随机填 → 开局 → 判定 → 自动 POST
//     → 断言真 isopb：matches 有 doubles 局(game_mode=doubles, result/score_total 走 currentMatches/currentScore 双打分流真值)
//       + #84：players = 两个 distinct 真实 player id（各 ensurePlayer，非单占位「双打战队」）+ scores 两条（两名各一条，各 wins=2）。
//       = #94 双打分流事故靶心 + #84 两名归属修复在"前端真UI→真isopb"链路上的真机坐实，
//       补 P1/P2 只覆盖 std8 单打的缺口（doublesLive 分支此前从未穿过真后端）。
//
// 红线：只往隔离 isopb 临时 dir 写；绝不碰 backend/pb_data 或 10.37.220.128。前端登录用脚本自建测试账号。
// 断言纪律（docs/testing.md §7）：DOM/__jjbDebug 硬断言 + 真后端 curl 基线对比（matches/scores Δ），不只信前端 console。
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { startIsoPb, stopIsoPb, ISO_SU_EMAIL, ISO_SU_PWD } from './lib/isopb.mjs';

const webRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const distIndex = resolve(webRoot, 'dist/index.html');

let failed = false;
const pass = (m) => console.log('  PASS:', m);
const fail = (m) => { failed = true; console.error('  FAIL:', m); };
const expect = (cond, m) => { if (cond) pass(m); else fail(m); return !!cond; };

const CT = { 'Content-Type': 'application/json' };
const PWD = 'Pwd12345';
// 唯一手机号（139 + 时间戳后 8 位 = 11 位，避 phone unique 400）
const phone = `139${String(Date.now()).slice(-8)}`;
const playerEmail = `${phone}@phone.jjb`;
const hostEmail = `host${String(Date.now()).slice(-7)}@jjb.test`;
const HOST_PWD = 'Host123456!';

const fixedPort = Number(process.env.JJB_UI_PORT || 7788); // 与 vite preview 默认端口一致（proxy /api→8090）

// ── 后端只读查询（superuser token，绕过 listRule 看真实落库，避免匿名读被规则遮蔽成空数组的陷阱）──
async function suToken(base) {
  const r = await fetch(`${base}/api/collections/_superusers/auth-with-password`, {
    method: 'POST', headers: CT, body: JSON.stringify({ identity: ISO_SU_EMAIL, password: ISO_SU_PWD }),
  });
  const d = await r.json().catch(() => ({}));
  if (!d.token) throw new Error(`superuser auth 失败: ${r.status} ${JSON.stringify(d).slice(0, 150)}`);
  return d.token;
}
async function suGet(base, token, path) {
  const r = await fetch(`${base}${path}`, { headers: { Authorization: token } });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

function waitForServer(proc, port) {
  return new Promise((res, rej) => {
    let out = '';
    const timer = setTimeout(() => rej(new Error('preview server did not become ready')), 20000);
    const onData = (buf) => {
      out += String(buf).replace(/\x1b\[[0-9;]*m/g, ''); // 剥 ANSI（vite 带色终端会把转义插进 URL）
      if (out.includes(`127.0.0.1:${port}`) || out.includes(`localhost:${port}`)) { clearTimeout(timer); res(); }
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.once('exit', (code) => { clearTimeout(timer); rej(new Error(`preview exited before ready: ${code}`)); });
  });
}

// 走完一局 std8 的 3 场判定（真点 battle 屏 v-btn，触发 setCurrentVerdict + autoPostIfComplete）。
async function drivePlay(page, baseUrl, verdicts) {
  await page.goto(`${baseUrl}/?screen=battle&style=sc2&mode=dark&sessionMode=std8&cb=${Date.now()}`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForSelector('.matches .match', { timeout: 15000 });
  for (let i = 0; i < verdicts.length; i++) {
    await page.click(`.matches .match:nth-child(${i + 1}) .v-btn:has-text("${verdicts[i]}")`);
  }
}

async function main() {
  if (!existsSync(distIndex)) { console.error('FAIL: dist/index.html missing — 先 npm run build'); process.exit(1); }

  const pb = await startIsoPb();
  const base = pb.base;
  const su = await suToken(base);

  // 前置基线：matches/scores 空
  let mBase = await suGet(base, su, '/api/collections/matches/records?perPage=200');
  let sBase = await suGet(base, su, '/api/collections/scores/records?perPage=200');
  expect(mBase.data.totalItems === 0, `基线 matches 空（totalItems=${mBase.data?.totalItems}）`);
  expect(sBase.data.totalItems === 0, `基线 scores 空（totalItems=${sBase.data?.totalItems}）`);

  // P1 前置：API 注册真 player_account（hook 自动建 players + 回填 player relation，player_code=pa-<accId>）
  const reg = await fetch(`${base}/api/collections/player_accounts/records`, {
    method: 'POST', headers: CT,
    body: JSON.stringify({ email: playerEmail, password: PWD, passwordConfirm: PWD, nickname: '全栈练习选手', phone }),
  });
  const regJson = await reg.json().catch(() => ({}));
  const playerAccId = regJson.id;
  expect(reg.status === 200 && !!playerAccId, `P1 前置：注册 player_account 2xx（status=${reg.status}, accId=${playerAccId}）`);
  // 确认 hook 自动建了 players 且 player_code=pa-<accId>（#89 relation 的落点）
  const autoPlayer = await suGet(base, su, `/api/collections/players/records?filter=${encodeURIComponent(`player_code='pa-${playerAccId}'`)}`);
  const autoPlayerId = autoPlayer.data.items?.[0]?.id;
  expect(!!autoPlayerId, `P1 前置：注册 hook 自动建 players（player_code=pa-${playerAccId} → id=${autoPlayerId}）`);

  // P2 前置：superuser 建 host 账号（accounts 集合，role=host）
  const hostReg = await fetch(`${base}/api/collections/accounts/records`, {
    method: 'POST', headers: { Authorization: su, ...CT },
    body: JSON.stringify({ email: hostEmail, password: HOST_PWD, passwordConfirm: HOST_PWD, role: 'host', display_name: '全栈主播' }),
  });
  const hostJson = await hostReg.json().catch(() => ({}));
  const hostId = hostJson.id;
  expect(hostReg.status === 200 && !!hostId, `P2 前置：建 host 账号 2xx（status=${hostReg.status}, hostId=${hostId}）`);

  const preview = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(fixedPort), '--strictPort'], {
    cwd: webRoot, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const baseUrl = `http://127.0.0.1:${fixedPort}`;
  let browser;
  try {
    await waitForServer(preview, fixedPort);
    browser = await chromium.launch({ channel: 'chrome' });
    const page = await browser.newPage({ viewport: { width: 1320, height: 800 } });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    const pageErrors = [];
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const url = m.location?.()?.url || '';
      if (url.includes('/api')) return; // 后端可选错误（本脚本靠真后端 curl 断言，不靠 console）
      if (/fonts\.(googleapis|gstatic)\.com/.test(url)) return; // 主动 abort 的字体 CDN（networkidle 防挂），非断言对象
      pageErrors.push(`${m.text()} @ ${url || '(no-url)'}`);
    });
    page.on('pageerror', (e) => pageErrors.push('pageerror: ' + e.message));

    // ============ P1 · practice 选手路径 端到端 ============
    console.log('\n[P1] practice 选手路径：真 UI 登录 → 练习局 std8 → 自动落库 → 真 isopb 断言');
    // 前端真 UI 登录（选手 tab，填手机号+密码，不注入假 token）
    await page.goto(`${baseUrl}/?screen=login&style=sc2&mode=dark`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForSelector('.login-stage', { timeout: 15000 });
    await page.fill('[data-login-acct]', phone);
    await page.fill('[data-login-pwd]', PWD);
    await page.click('[data-login-btn]');
    await page.waitForFunction(() => document.querySelector('[data-login-banner]')?.getAttribute('data-login-banner') === 'success', { timeout: 8000 })
      .catch(() => {});
    const loginBanner = await page.evaluate(() => document.querySelector('[data-login-banner]')?.getAttribute('data-login-banner') || 'none');
    expect(loginBanner === 'success', `P1 选手真 UI 登录 → success banner（真 isopb 认证，非注入 token）实际 ${loginBanner}`);
    // 确认登录态确实是选手（kind=player）且 token 落到 storage（后续 ensurePlayer 走 relation 路径靠它）
    const authKind = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('jjb_auth') || sessionStorage.getItem('jjb_auth') || '{}').account?.kind; } catch { return null; } });
    expect(authKind === 'player', `P1 登录态 kind=player（ensurePlayer 走 relation 路径的前提）实际 ${authKind}`);

    // 练习态：sessionStorage jjb_rule_mode=practice（home 练习 tab 的等价设置，battle 直跳需显式置）
    await page.evaluate(() => sessionStorage.setItem('jjb_rule_mode', 'practice'));
    await drivePlay(page, baseUrl, ['胜利', '带奖励', '失败']); // win/bonus/lose → RESULT_VAL [1,2,0]，score_total=2
    // 练习态 battle 屏无落库 chip（静默语义）——不能靠 chip 等，改等真后端出现该局。
    await page.waitForTimeout(6500); // 5s autoPostIfComplete 缓冲 + 余量

    // 断言真 isopb 落库（superuser 读，避 listRule 遮蔽）
    const mP1 = await suGet(base, su, '/api/collections/matches/records?perPage=200&sort=-created');
    const practiceMatch = (mP1.data.items || []).find((m) => m.mode === 'practice');
    if (!expect(!!practiceMatch, `P1 真 isopb 落库：matches 有 practice 局（totalItems=${mP1.data?.totalItems}）`)) {
      console.error('  [P1 诊断] matches 全量:', JSON.stringify(mP1.data.items || []).slice(0, 400));
    } else {
      expect(practiceMatch.game_mode === 'std8', `P1 game_mode=std8（实际 ${practiceMatch.game_mode}）`);
      expect(JSON.stringify(practiceMatch.result) === JSON.stringify([1, 2, 0]), `P1 result=[1,2,0]（win/bonus/lose）实际 ${JSON.stringify(practiceMatch.result)}`);
      expect(practiceMatch.score_total === 2, `P1 score_total=2（win+bonus）实际 ${practiceMatch.score_total}`);
      // #89 关键：players 数组指向真实 player id（注册 hook 建的 pa-<accId>），relation 解析成功、未被 CreateRule 挡 4xx
      const pl = practiceMatch.players || [];
      expect(pl.length === 1 && pl[0] === autoPlayerId, `P1 #89 players=[${pl}] 指向注册选手真 player id ${autoPlayerId}（relation 经 ensurePlayer 解析成功）`);
    }
    // scores：practice 不进正式天梯（hook 按 mode 跳过算分）
    const sP1 = await suGet(base, su, `/api/collections/scores/records?perPage=200${practiceMatch ? `&filter=${encodeURIComponent(`match='${practiceMatch.id}'`)}` : ''}`);
    if (practiceMatch) expect(sP1.data.totalItems === 0, `P1 scores 无该 practice 局派生（practice 不进天梯）实际 totalItems=${sP1.data?.totalItems}`);

    // ============ P2 · match 主播路径 端到端 ============
    console.log('\n[P2] match 主播路径：真 UI 主播登录 → 比赛局 std8 → 自动落库 → 真 isopb 断言');
    // 换 host 登录：先清登录态，前端真 UI 主播 tab 登录
    await page.goto(`${baseUrl}/?screen=login&style=sc2&mode=dark`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.evaluate(() => { try { localStorage.removeItem('jjb_auth'); sessionStorage.removeItem('jjb_auth'); } catch { /* noop */ } });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.login-stage', { timeout: 15000 });
    await page.click('[data-login-tab="host"]'); // 切主播 tab
    await page.waitForTimeout(200);
    await page.fill('[data-login-acct]', hostEmail);
    await page.fill('[data-login-pwd]', HOST_PWD);
    await page.click('[data-login-btn]');
    await page.waitForFunction(() => document.querySelector('[data-login-banner]')?.getAttribute('data-login-banner') === 'success', { timeout: 8000 })
      .catch(() => {});
    const hostBanner = await page.evaluate(() => document.querySelector('[data-login-banner]')?.getAttribute('data-login-banner') || 'none');
    expect(hostBanner === 'success', `P2 主播真 UI 登录 → success banner 实际 ${hostBanner}`);
    const hostKind = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('jjb_auth') || sessionStorage.getItem('jjb_auth') || '{}').account?.kind; } catch { return null; } });
    expect(hostKind === 'host', `P2 登录态 kind=host（canPostResult match 落库前提）实际 ${hostKind}`);

    // 比赛态：jjb_rule_mode=match
    await page.evaluate(() => sessionStorage.setItem('jjb_rule_mode', 'match'));
    await drivePlay(page, baseUrl, ['胜利', '胜利', '失败']); // win/win/lose → [1,1,0]，score_total=2
    // match 态有落库 chip：等 chip=done（更可靠）
    await page.waitForSelector('[data-record-chip][data-record-state="done"]', { timeout: 12000 }).catch(() => {});
    const chipState = await page.evaluate(() => document.querySelector('[data-record-chip]')?.getAttribute('data-record-state') || 'none');
    expect(chipState === 'done', `P2 battle 屏落库 chip=done（前端确认已录入）实际 ${chipState}`);
    await page.waitForTimeout(500);

    const mP2 = await suGet(base, su, '/api/collections/matches/records?perPage=200&sort=-created');
    const matchMatch = (mP2.data.items || []).find((m) => m.mode === 'match');
    if (!expect(!!matchMatch, `P2 真 isopb 落库：matches 有 match 局（totalItems=${mP2.data?.totalItems}）`)) {
      console.error('  [P2 诊断] matches 全量:', JSON.stringify(mP2.data.items || []).slice(0, 400));
    } else {
      expect(matchMatch.game_mode === 'std8', `P2 game_mode=std8（实际 ${matchMatch.game_mode}）`);
      expect(matchMatch.host === hostId, `P2 host 字段=host.id ${hostId}（实际 ${matchMatch.host}）`);
      expect(JSON.stringify(matchMatch.result) === JSON.stringify([1, 1, 0]), `P2 result=[1,1,0]（win/win/lose）实际 ${JSON.stringify(matchMatch.result)}`);
      // scores：match 进正式天梯（hook 派生）——players 非空才有派生
      const sP2 = await suGet(base, su, `/api/collections/scores/records?perPage=200&filter=${encodeURIComponent(`match='${matchMatch.id}'`)}`);
      expect(sP2.data.totalItems >= 1, `P2 scores 有该 match 局派生（进正式天梯，hook 算分）实际 totalItems=${sP2.data?.totalItems}`);
      if (sP2.data.totalItems >= 1) {
        const sc = sP2.data.items[0];
        expect(sc.wins === 2, `P2 派生 scores.wins=2（win+win 计胜场）实际 ${sc.wins}`);
      }
    }

    // ============ P3 · doubles 双打真机落库 端到端（#94 双打分流 + #84 两名真选手各记分）============
    console.log('\n[P3] doubles 双打路径：复用 host 比赛态 → HomeScreen 采两名 → 点双打格 → select 随机填 → 开局 → 判定 → 自动落库 → 真 isopb 断言');
    // 复用 P2 host 登录态 + jjb_rule_mode=match（双打比赛局才派生 scores）。
    // #84：从 HomeScreen 走真链路——填「选手A」+「选手B」两个输入框，点 doubles 模式格开局（start 内 setDoublesPlayers 写两名到 jjbDoubles 闭包）。
    //   navigate 是 client-side（App.tsx setScreen，无 reload），jjbDoubles 模块闭包跨 home→select→battle 存活，两名不丢。
    const P3_A = `双打甲${String(Date.now()).slice(-5)}`;
    const P3_B = `双打乙${String(Date.now()).slice(-5)}`;
    await page.goto(`${baseUrl}/?screen=home&style=sc2&mode=dark&cb=${Date.now()}`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForSelector('[data-player-input]', { timeout: 15000 });
    // 切比赛 tab（match 态才派生 scores）+ 填两名
    await page.click('[data-home-tab="match"]').catch(() => {});
    await page.fill('[data-player-input]', P3_A);
    await page.fill('[data-player-input-b]', P3_B);
    // 点 doubles 模式格（官突双打）→ start(doubles) → setDoublesPlayers(A,B) → onStart → navigate('select')
    await page.click('[data-mode-btn="doubles"]');
    await page.waitForSelector('[data-doubles-select]', { timeout: 15000 });
    // 两名已写进闭包（__jjbDebug.doubles.players）——select 屏「参赛战队」展示与落库同源
    const p3Players = await page.evaluate(() => window.__jjbDebug?.doubles?.players || []);
    expect(JSON.stringify(p3Players) === JSON.stringify([P3_A, P3_B]), `P3 #84 HomeScreen 采两名写入 jjbDoubles 闭包（__jjbDebug.doubles.players=${JSON.stringify(p3Players)} 期望 [${P3_A},${P3_B}]）`);
    await page.click('[data-doubles-random-fill-btn]');
    await page.waitForFunction(() => document.querySelectorAll('[data-doubles-cmd]').length === 6, { timeout: 10000 });
    await page.click('[data-doubles-start-btn]');
    await page.waitForSelector('[data-doubles-battle]', { timeout: 15000 });
    // 双打 battle 判定按钮复用单打 .matches .match .v-btn（r6-doubles-downstream 已证）
    for (let i = 0; i < 3; i++) {
      await page.click(`.matches .match:nth-child(${i + 1}) .v-btn:has-text("${['胜利', '带奖励', '失败'][i]}")`);
    }
    await page.waitForFunction(() => window.__jjbDebug?.doubles?.totalCount === 3, { timeout: 8000 }).catch(() => {});
    // 落库等待：优先 chip=done（若双打 battle 屏挂了 record-chip），否则等 autoPostIfComplete 5s 缓冲兜底
    const dGotChip = await page.waitForSelector('[data-record-chip][data-record-state="done"]', { timeout: 8000 }).then(() => true).catch(() => false);
    if (!dGotChip) await page.waitForTimeout(6500);

    const mP3 = await suGet(base, su, '/api/collections/matches/records?perPage=200&sort=-created');
    const dblMatch = (mP3.data.items || []).find((m) => m.game_mode === 'doubles');
    if (!expect(!!dblMatch, `P3 真 isopb 落库：matches 有 doubles 局（#94 双打分流真穿真后端，非 mock）totalItems=${mP3.data?.totalItems}`)) {
      console.error('  [P3 诊断] matches 全量:', JSON.stringify(mP3.data.items || []).slice(0, 500));
    } else {
      expect(dblMatch.mode === 'match', `P3 mode=match（双打比赛局）实际 ${dblMatch.mode}`);
      expect(dblMatch.host === hostId, `P3 host=host.id ${hostId}（实际 ${dblMatch.host}）`);
      expect(JSON.stringify(dblMatch.result) === JSON.stringify([1, 2, 0]), `P3 result=[1,2,0]（win/bonus/lose，双打引擎 currentMatches 真值非单打陈旧值）实际 ${JSON.stringify(dblMatch.result)}`);
      expect(dblMatch.score_total === 2, `P3 score_total=2（currentScore 双打分流）实际 ${dblMatch.score_total}`);
      // #84 靶心：players = 两名各 ensurePlayer 的两个真实 player id（非单个占位「双打战队」）。
      const dpl = dblMatch.players || [];
      expect(dpl.length === 2, `P3 #84 双打 players 含两个真实 player id（不再单占位）实际 =[${dpl}] len=${dpl.length}`);
      // 两 id 各解析为 P3_A / P3_B（players 表 player_code=输入名，host 昵称兜底建）——两 distinct 真选手
      const plExpand = await suGet(base, su, `/api/collections/players/records?perPage=200&filter=${encodeURIComponent(`player_code='${P3_A}' || player_code='${P3_B}'`)}`);
      const codeById = Object.fromEntries((plExpand.data.items || []).map((p) => [p.id, p.player_code]));
      const resolvedCodes = dpl.map((id) => codeById[id]).sort();
      expect(JSON.stringify(resolvedCodes) === JSON.stringify([P3_A, P3_B].sort()), `P3 #84 两 player id 各解析为真两名（player_code=${JSON.stringify(resolvedCodes)} 期望 ${JSON.stringify([P3_A, P3_B].sort())}）`);
      expect(dpl[0] !== dpl[1], `P3 #84 两名是两个 distinct player 实体（idA=${dpl[0]} ≠ idB=${dpl[1]}），各自独立上天梯`);
      // scores：#84 后端 scoreMatch 为每个 player 各写一条 → 两名各得分（进正式天梯 board=double）。
      const sP3 = await suGet(base, su, `/api/collections/scores/records?perPage=200&filter=${encodeURIComponent(`match='${dblMatch.id}'`)}`);
      expect(sP3.data.totalItems === 2, `P3 #84 scores 两条派生（两名各一条，board=double 各得分）实际 totalItems=${sP3.data?.totalItems}`);
      if (sP3.data.totalItems >= 1) {
        const scoredPlayers = (sP3.data.items || []).map((s) => s.player).sort();
        expect(JSON.stringify(scoredPlayers) === JSON.stringify([...dpl].sort()), `P3 #84 两条 scores 各归两名真 player（scores.player=${JSON.stringify(scoredPlayers)} = players ${JSON.stringify([...dpl].sort())}）`);
        expect((sP3.data.items || []).every((s) => s.wins === 2), `P3 #84 两名各 wins=2（win+bonus 计胜场，两人同局各记分）实际 ${JSON.stringify((sP3.data.items || []).map((s) => s.wins))}`);
      }
    }

    // ============ P4 · doubles deep-link 默认名落库（#84 review defer：不经 HomeScreen）============
    console.log('\n[P4] doubles deep-link 默认名路径：复用 host 比赛态 → 直达 select&sessionMode=doubles → 判定 → 自动落库 → 真 isopb 断言');
    // 不经 HomeScreen，不填 A/B。App 的 select 兜底按 URL sessionMode=doubles 开新局，
    // jjbDoubles.doublesStart 重置 players 为默认「选手A」「选手B」，验证 deep-link/贴码兜底路径不回退占位单归属。
    await page.evaluate(() => sessionStorage.setItem('jjb_rule_mode', 'match'));
    await page.goto(`${baseUrl}/?screen=select&style=sc2&mode=dark&sessionMode=doubles&cb=deep-link-${Date.now()}`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForSelector('[data-doubles-select]', { timeout: 15000 });
    const p4Defaults = await page.evaluate(() => window.__jjbDebug?.doubles?.players || []);
    expect(JSON.stringify(p4Defaults) === JSON.stringify(['选手A', '选手B']), `P4 deep-link 默认名写入 jjbDoubles（__jjbDebug.doubles.players=${JSON.stringify(p4Defaults)} 期望 [选手A,选手B]）`);
    await page.click('[data-doubles-random-fill-btn]');
    await page.waitForFunction(() => document.querySelectorAll('[data-doubles-cmd]').length === 6, { timeout: 10000 });
    await page.click('[data-doubles-start-btn]');
    await page.waitForSelector('[data-doubles-battle]', { timeout: 15000 });
    for (let i = 0; i < 3; i++) {
      await page.click(`.matches .match:nth-child(${i + 1}) .v-btn:has-text("${['胜利', '失败', '带奖励'][i]}")`);
    }
    await page.waitForFunction(() => window.__jjbDebug?.doubles?.totalCount === 3, { timeout: 8000 }).catch(() => {});
    const p4GotChip = await page.waitForSelector('[data-record-chip][data-record-state="done"]', { timeout: 8000 }).then(() => true).catch(() => false);
    if (!p4GotChip) await page.waitForTimeout(6500);

    const mP4 = await suGet(base, su, '/api/collections/matches/records?perPage=200&sort=-created');
    const deepMatch = (mP4.data.items || []).find((m) => m.game_mode === 'doubles' && (!dblMatch || m.id !== dblMatch.id));
    if (!expect(!!deepMatch, `P4 真 isopb 落库：matches 有新的 deep-link doubles 局（不同于 P3，totalItems=${mP4.data?.totalItems}）`)) {
      console.error('  [P4 诊断] matches 全量:', JSON.stringify(mP4.data.items || []).slice(0, 700));
    } else {
      expect(deepMatch.mode === 'match', `P4 mode=match（复用 host 比赛态）实际 ${deepMatch.mode}`);
      expect(deepMatch.host === hostId, `P4 host=host.id ${hostId}（实际 ${deepMatch.host}）`);
      expect(JSON.stringify(deepMatch.result) === JSON.stringify([1, 0, 2]), `P4 result=[1,0,2]（win/lose/bonus，deep-link 双打真值）实际 ${JSON.stringify(deepMatch.result)}`);
      expect(deepMatch.score_total === 2, `P4 score_total=2（win+bonus）实际 ${deepMatch.score_total}`);
      const p4pl = deepMatch.players || [];
      expect(p4pl.length === 2, `P4 deep-link players 含两个真实 player id（默认名各 ensurePlayer）实际 =[${p4pl}] len=${p4pl.length}`);
      const p4Expand = await suGet(base, su, `/api/collections/players/records?perPage=200&filter=${encodeURIComponent(`player_code='选手A' || player_code='选手B'`)}`);
      const p4CodeById = Object.fromEntries((p4Expand.data.items || []).map((p) => [p.id, p.player_code]));
      const p4ResolvedCodes = p4pl.map((id) => p4CodeById[id]).sort();
      expect(JSON.stringify(p4ResolvedCodes) === JSON.stringify(['选手A', '选手B'].sort()), `P4 deep-link 两 player id 各解析为默认名（player_code=${JSON.stringify(p4ResolvedCodes)} 期望 ${JSON.stringify(['选手A', '选手B'].sort())}）`);
      expect(p4pl[0] !== p4pl[1], `P4 deep-link 默认名是两个 distinct player 实体（idA=${p4pl[0]} ≠ idB=${p4pl[1]}）`);
      const sP4 = await suGet(base, su, `/api/collections/scores/records?perPage=200&filter=${encodeURIComponent(`match='${deepMatch.id}'`)}`);
      expect(sP4.data.totalItems === 2, `P4 deep-link scores 两条派生（默认两名各一条）实际 totalItems=${sP4.data?.totalItems}`);
      if (sP4.data.totalItems >= 1) {
        const p4ScoredPlayers = (sP4.data.items || []).map((s) => s.player).sort();
        expect(JSON.stringify(p4ScoredPlayers) === JSON.stringify([...p4pl].sort()), `P4 deep-link 两条 scores 各归默认两名（scores.player=${JSON.stringify(p4ScoredPlayers)} = players ${JSON.stringify([...p4pl].sort())}）`);
        expect((sP4.data.items || []).every((s) => s.wins === 2), `P4 deep-link 两名各 wins=2（win+bonus 计胜场）实际 ${JSON.stringify((sP4.data.items || []).map((s) => s.wins))}`);
      }
    }

    if (pageErrors.length) for (const e of pageErrors) fail('page console error: ' + e);
  } finally {
    if (browser) await browser.close();
    preview.kill('SIGTERM');
    await stopIsoPb(pb);
  }
}

await main();

if (failed) { console.error('[record-fullstack] ❌ FAIL'); process.exit(1); }
console.log('[record-fullstack] ✅ PASS — #94 前端真UI→真isopb落库接缝通 + #89 注册选手 relation 真解析 + #84 deep-link 默认名双打归属');
process.exit(0);
