// match-flow.mjs — P5 联调端到端：比赛模式真实 UI 流程落库验证
// dev 登录(host) → home match 选手 P001 → std8 开局 → 判定 3 场 → result → 落库 → 选手关联 → hook 派生 scores。
// 需 vite dev(7788) + PocketBase(8090, verify-all.sh 造的 P001/P002 数据) 在跑。
import { chromium } from 'playwright';
const base = 'http://localhost:7788';
const PB = 'http://localhost:7788/api';
const fail = (m) => { console.error('FAIL:', m); process.exit(1); };

const before = await (await fetch(`${PB}/collections/matches/records?perPage=1&filter=(mode='match')`)).json();
const m0 = before.totalItems;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1360, height: 820 } });
p.on('dialog', async (d) => {
  const msg = d.message();
  if (msg.includes('账号')) await d.accept('host@jjb.test');
  else if (msg.includes('密码')) await d.accept('Host123456!');
  else await d.accept();
});
const logs = [];
p.on('console', (m) => { const t = m.text(); if (t.includes('[jjb]')) logs.push(t); });

await p.goto(`${base}/?style=sc2&mode=dark&cb=${Date.now()}`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(800);
await p.click('[data-dev-login]'); await p.waitForTimeout(700);
if (!((await p.textContent('[data-dev-login]')) || '').includes('host')) fail('dev 登录失败');
await p.click('[data-home-tab="match"]'); await p.waitForTimeout(150);
const inp = await p.$('[data-player-input]'); if (inp) await inp.fill('P001');
await p.waitForTimeout(100);
await p.click('[data-mode-btn="std8"]'); await p.waitForTimeout(600);
await p.click('[data-random-fill-btn]'); await p.waitForTimeout(400);
await p.click('[data-start-btn]'); await p.waitForTimeout(700);
const winBtns = p.locator('.verdict .v-btn', { hasText: '胜利' });
const n = await winBtns.count();
if (n !== 3) fail(`判定按钮 ${n}≠3`);
for (let i = 0; i < n; i++) { await winBtns.nth(i).click(); await p.waitForTimeout(180); }
await p.waitForTimeout(300);
await p.click('[data-nav-result]'); await p.waitForTimeout(1000);
await b.close();

// 断言
if (!logs.some((l) => l.includes('已落库'))) fail('未见 [jjb] 落库 console: ' + JSON.stringify(logs));
const after = await (await fetch(`${PB}/collections/matches/records?perPage=1&filter=(mode='match')`)).json();
if (after.totalItems <= m0) fail(`matches 未增 ${m0}→${after.totalItems}`);
const all = await (await fetch(`${PB}/collections/matches/records?perPage=50&filter=(mode='match')`)).json();
const std8 = all.items.filter((m) => m.game_mode === 'std8');
const localGame = std8[std8.length - 1];
if (!localGame) fail('无 std8 比赛局');
if (!localGame.players?.length) fail('选手未关联（getPlayerByCode P001 失败）');
const sc = await (await fetch(`${PB}/collections/scores/records?filter=(match='${localGame.id}')`)).json();
if (sc.totalItems < 1) fail('scores 未派生');
const over512 = all.items.some((m) => (m.payload_code || '').length > 512);

console.log(`matches: ${m0}→${after.totalItems} | std8 局码长=${localGame.payload_code.length} players=${localGame.players.length} scores=${sc.totalItems} delta=${sc.items.map((i) => i.delta)}`);
console.log(`max 2048 修复验证: ${over512 ? '存在码长>512 的比赛局落库成功 ✓（旧 max512 必 400）' : '本轮无>512 码局'}`);
console.log('\n[match-flow] ✅ P5 联调端到端 PASS（dev登录→比赛局→判定3场→落库→选手关联→hook派生 scores）');
