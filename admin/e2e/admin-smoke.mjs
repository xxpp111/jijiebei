// admin/e2e/admin-smoke.mjs
// 后台 admin e2e：前置 P5 在 8090 跑 + backend/verify-all.sh 已造数据（admin/host/viewer + players）。
// 断言：三角色登录 + 对局/选手/天梯/系数 fetch + role 守卫（viewer 不能读 logs，host 不能读 accounts）+ admin 调分。
// 纯 node fetch（v23 内置），直接打 8090/api（与 admin 前端 fetch /api 同源经 vite proxy 一致）。
const BASE = 'http://127.0.0.1:8090';
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✓', msg); } else { fail++; console.log('  ✗ FAIL:', msg); } }

async function auth(email, pw) {
  const r = await fetch(`${BASE}/api/collections/accounts/auth-with-password`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: email, password: pw }),
  });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, token: d.token, record: d.record };
}
async function get(path, token) {
  const r = await fetch(`${BASE}${path}`, { headers: token ? { Authorization: token } : {} });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

console.log('=== admin smoke e2e ===');

console.log('--- 登录（3 角色）---');
const adm = await auth('admin@jjb.test', 'Admin123456!');
ok(adm.ok && adm.record?.role === 'admin', `admin login (role=${adm.record?.role})`);
const host = await auth('host@jjb.test', 'Host123456!');
ok(host.ok && host.record?.role === 'host', `host login (role=${host.record?.role})`);
const view = await auth('viewer@jjb.test', 'Viewer123456!');
ok(view.ok && view.record?.role === 'viewer', `viewer login (role=${view.record?.role})`);

console.log('--- 对局列表（公开读）---');
const m = await get('/api/collections/matches/records?perPage=5');
ok(m.status === 200 && Array.isArray(m.data.items), `matches list (items=${m.data.items?.length})`);

console.log('--- 选手列表（公开读）---');
const p = await get('/api/collections/players/records?perPage=10&sort=nickname');
ok(p.status === 200 && Array.isArray(p.data.items) && p.data.items.length > 0, `players list (items=${p.data.items?.length})`);

console.log('--- 天梯 /api/rankings ---');
const rk = await get('/api/rankings');
ok(rk.status === 200 && Array.isArray(rk.data.rankings), `rankings (season=${rk.data.season}, count=${rk.data.count})`);

console.log('--- 系数 /api/scoring ---');
const sc = await get('/api/scoring');
ok(sc.status === 200 && typeof sc.data.coefficients === 'object', `scoring (season=${sc.data.current_season})`);

console.log('--- 日志：admin 可读 / viewer 被拒（空）---');
const logA = await get('/api/collections/logs/records?perPage=3', adm.token);
ok(logA.status === 200, `admin logs read (items=${logA.data.items?.length})`);
const logV = await get('/api/collections/logs/records?perPage=3', view.token);
ok(logV.status !== 200 || (logV.data.items?.length ?? 1) === 0, `viewer logs denied (status=${logV.status})`);

console.log('--- 账号：admin 可读 / host 被拒（空）---');
const accA = await get('/api/collections/accounts/records?perPage=3', adm.token);
ok(accA.status === 200 && Array.isArray(accA.data.items), `admin accounts read (items=${accA.data.items?.length})`);
const accH = await get('/api/collections/accounts/records?perPage=3', host.token);
ok(accH.status !== 200 || (accH.data.items?.length ?? 1) === 0, `host accounts denied (status=${accH.status})`);

console.log('--- admin 手动调分 POST scores → 进审计 + 天梯刷新 ---');
const pid = p.data.items[0]?.id;
// scores.match Required（schema 硬约束）→ 手动调分必须关联来源对局
const mlist = await get('/api/collections/matches/records?perPage=1');
const mid = mlist.data.items?.[0]?.id;
if (pid && mid) {
  const adjR = await fetch(`${BASE}/api/collections/scores/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: adm.token },
    body: JSON.stringify({ player: pid, match: mid, delta: 0.5, reason: 'e2e-adjust', season: sc.data.current_season || '2026S1' }),
  });
  ok(adjR.status === 200, `admin score adjust (${adjR.status})`);
  // 验证审计条已写
  const logAdj = await get('/api/collections/logs/records?filter=(action=\'score.adjust\')&perPage=1', adm.token);
  ok(logAdj.status === 200 && (logAdj.data.items?.length ?? 0) > 0, `score.adjust audit log written (items=${logAdj.data.items?.length})`);
} else {
  ok(false, 'no player for score adjust');
}

console.log(`\n=== RESULT: ${pass} pass, ${fail} fail ===`);
if (fail > 0) process.exit(1);
