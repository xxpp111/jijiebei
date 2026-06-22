// backend-integ.mjs — P5 联调 e2e：前端 fetch /api（经 vite proxy 7788→8090）落库全链路
// 验证：host auth → postMatch → hook 派生 scores → 天梯增量。需 vite dev(7788) + PocketBase(8090) 在跑。
const API = 'http://localhost:7788/api'; // 经 vite proxy → 8090（同源链路，等价生产 nginx /api）
const j = (r) => r.json();
const fail = (m) => { console.error('FAIL:', m); process.exit(1); };

// 1. host 登录（测试账号，verify 造）
const auth = await fetch(`${API}/collections/accounts/auth-with-password`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identity: 'host@jjb.test', password: 'Host123456!' }),
});
if (auth.status !== 200) fail(`host auth ${auth.status}`);
const ad = await j(auth);
const token = ad.token, hostId = ad.record.id;
console.log('1. host auth: 200 role=' + ad.record.role);

// 2. 取 2 选手
const pl = await j(await fetch(`${API}/collections/players/records`));
if ((pl.items || []).length < 2) fail('players < 2');
const p1 = pl.items[0].id, p2 = pl.items[1].id;
console.log('2. players:', pl.items.map((x) => x.player_code).join(','));

// 3. rankings before
const rb = await j(await fetch(`${API}/rankings`));
const p1Before = rb.rankings.find((r) => r.player_id === p1)?.total_delta || 0;

// 4. postMatch（mode=match, std12, result=[1,2,0] → wins=2 × coef1.2 = delta 2.4）
const pm = await fetch(`${API}/collections/matches/records`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token },
  body: JSON.stringify({ mode: 'match', game_mode: 'std12', payload_code: 'INTEG_TEST_CODE', payload_ver: 1, players: [p1, p2], host: hostId, result: [1, 2, 0], score_total: 2 }),
});
if (pm.status !== 200) fail(`postMatch ${pm.status}: ${(await pm.text()).slice(0, 150)}`);
const pmd = await j(pm);
console.log('4. postMatch: 200 id=' + pmd.id);

// 5. 回读 hook 派生 scores（2 条 delta=2.4）
await new Promise((r) => setTimeout(r, 400));
const sc = await j(await fetch(`${API}/collections/scores/records?filter=(match='${pmd.id}')`));
if (sc.totalItems !== 2) fail(`scores 派生 ${sc.totalItems}≠2`);
const deltas = sc.items.map((i) => i.delta);
if (!deltas.every((d) => d === 2.4)) fail(`delta ${deltas}≠2.4`);
console.log('5. hook 派生 scores: 2 条 delta=2.4 ✓');

// 6. 回读 match 确认
const gm = await j(await fetch(`${API}/collections/matches/records/${pmd.id}`));
if (gm.payload_code !== 'INTEG_TEST_CODE') fail('回读 payload_code 不符');
console.log('6. 回读 match: payload_code 一致 ✓');

// 7. 天梯增量
const ra = await j(await fetch(`${API}/rankings`));
const p1After = ra.rankings.find((r) => r.player_id === p1)?.total_delta || 0;
const inc = +(p1After - p1Before).toFixed(1);
if (inc !== 2.4) fail(`天梯增量 ${inc}≠2.4`);
console.log(`7. 天梯 P1: ${p1Before} → ${p1After} (增量 ${inc}) ✓`);

console.log('\n[backend-integ] ✅ 前端→/api 落库全链路 PASS（auth + postMatch + hook派生 + 回读 + 天梯增量）');
