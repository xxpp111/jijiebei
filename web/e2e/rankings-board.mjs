// rankings-board.mjs — 天梯分榜 board=single/double 分流回归（补 routes.go rankingsHandler 零测试缺口）。
//
// 防的是：routes.go:50-54 的 boardCond 双打 game_mode 硬编码列表漂移。
//   2026-07-03 数据完整性诊断真实事故：Batch C 新增的 std15/cm 两个双打 variant 曾遗漏出该列表，
//   被误判进单刷榜。本脚本用真 isopb 造 4 局不同 game_mode，经真 /api/rankings SQL 分流断言：
//   - board=single 只统计单刷（std8），三个双打 total_delta=0
//   - board=double 只统计双打（doubles/std15/cm），单刷 total_delta=0
//   - board=all 四者皆 >0
//   - **核心**：std15 / cm 必须进双打榜（=boardCond 列表含它们）——这一条直接钉死上面那个事故。
//
// 红线：只往隔离 isopb 临时 dir 写；绝不碰 backend/pb_data 或 10.37.220.128。
import { startIsoPb, stopIsoPb, ISO_SU_EMAIL, ISO_SU_PWD } from './lib/isopb.mjs';

const CT = { 'Content-Type': 'application/json' };
let failed = false;
const pass = (m) => console.log('  PASS:', m);
const fail = (m) => { failed = true; console.error('  FAIL:', m); };
const expect = (cond, m) => { if (cond) pass(m); else fail(m); return !!cond; };

async function suToken(base) {
  const r = await fetch(`${base}/api/collections/_superusers/auth-with-password`, {
    method: 'POST', headers: CT, body: JSON.stringify({ identity: ISO_SU_EMAIL, password: ISO_SU_PWD }),
  });
  const d = await r.json().catch(() => ({}));
  if (!d.token) throw new Error(`superuser auth 失败: ${r.status} ${JSON.stringify(d).slice(0, 150)}`);
  return d.token;
}
async function suPost(base, token, path, body) {
  const r = await fetch(`${base}${path}`, { method: 'POST', headers: { Authorization: token, ...CT }, body: JSON.stringify(body) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
async function getJSON(base, path) {
  const r = await fetch(`${base}${path}`);
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
const deltaOf = (rows, pid) => (rows.find((r) => r.player_id === pid) || {}).total_delta || 0;

async function main() {
  const pb = await startIsoPb();
  const base = pb.base;
  const su = await suToken(base);

  // host 账号（matches.host relation + 审计 actor 需要一个 accounts 记录）
  const host = await suPost(base, su, '/api/collections/accounts/records', {
    email: `hostboard${Date.now()}@jjb.test`, password: 'Host123456!', passwordConfirm: 'Host123456!', role: 'host', display_name: '分榜测试主播',
  });
  const hostId = host.data.id;
  expect(host.status === 200 && !!hostId, `前置：建 host 账号 2xx（status=${host.status}）`);

  // 4 局：每个 game_mode 各一个专属 player（分开好断言分榜归属）。result=[1,1,0] → wins=2。
  const modes = [
    { key: 'std8', board: 'single', label: '单刷 std8' },
    { key: 'doubles', board: 'double', label: '双打 doubles' },
    { key: 'std15', board: 'double', label: '双打 std15（Batch C 新增，事故靶心）' },
    { key: 'cm', board: 'double', label: '双打 cm（Batch C 新增，事故靶心）' },
  ];
  const players = {};
  for (const m of modes) {
    const p = await suPost(base, su, '/api/collections/players/records', { nickname: `板_${m.key}`, player_code: `board-${m.key}-${Date.now()}`, active: true });
    if (!expect(p.status === 200 && !!p.data.id, `前置：建 ${m.key} 选手 2xx（status=${p.status}）`)) continue;
    players[m.key] = p.data.id;
    const mm = await suPost(base, su, '/api/collections/matches/records', {
      mode: 'match', game_mode: m.key, payload_code: `RB_${m.key}_${Date.now()}`, payload_ver: 1,
      players: [p.data.id], host: hostId, result: [1, 1, 0], score_total: 2,
    });
    expect(mm.status === 200 && !!mm.data.id, `前置：落 ${m.label} 局 2xx（status=${mm.status}）`);
  }

  await new Promise((r) => setTimeout(r, 800)); // 等 scoreMatch hook 为各局派生 scores

  // 派生确认：每局都有 scores（hook 真派生 → 分榜才有数据）
  for (const m of modes) {
    if (!players[m.key]) continue;
    const sc = await getJSON(base, `/api/collections/scores/records?perPage=50&filter=${encodeURIComponent(`player='${players[m.key]}'`)}`);
    expect(sc.data.totalItems >= 1, `${m.key} hook 派生 scores（totalItems=${sc.data?.totalItems}）`);
  }

  // ── board=all：4 者皆有分 ──
  const all = await getJSON(base, '/api/rankings?board=all');
  expect(all.data.board === 'all', `board=all 回显 board=all（实际 ${all.data.board}）`);
  for (const m of modes) {
    if (!players[m.key]) continue;
    expect(deltaOf(all.data.rankings, players[m.key]) > 0, `board=all：${m.label} total_delta>0（=${deltaOf(all.data.rankings, players[m.key])}）`);
  }

  // ── board=single：只单刷有分，三双打=0 ──
  const single = await getJSON(base, '/api/rankings?board=single');
  expect(single.data.board === 'single', `board=single 回显 single（实际 ${single.data.board}）`);
  expect(deltaOf(single.data.rankings, players.std8) > 0, `board=single：单刷 std8 total_delta>0（=${deltaOf(single.data.rankings, players.std8)}）`);
  for (const k of ['doubles', 'std15', 'cm']) {
    if (!players[k]) continue;
    expect(deltaOf(single.data.rankings, players[k]) === 0, `board=single：双打 ${k} 不进单刷榜 total_delta=0（=${deltaOf(single.data.rankings, players[k])}）`);
  }

  // ── board=double：三双打有分，单刷=0；核心防遗漏：std15/cm 必须 >0 ──
  const dbl = await getJSON(base, '/api/rankings?board=double');
  expect(dbl.data.board === 'double', `board=double 回显 double（实际 ${dbl.data.board}）`);
  expect(deltaOf(dbl.data.rankings, players.std8) === 0, `board=double：单刷 std8 不进双打榜 total_delta=0（=${deltaOf(dbl.data.rankings, players.std8)}）`);
  expect(deltaOf(dbl.data.rankings, players.doubles) > 0, `board=double：doubles total_delta>0（=${deltaOf(dbl.data.rankings, players.doubles)}）`);
  expect(deltaOf(dbl.data.rankings, players.std15) > 0, `board=double：★std15 进双打榜 total_delta>0（防 2026-07-03 遗漏事故复发）=${deltaOf(dbl.data.rankings, players.std15)}`);
  expect(deltaOf(dbl.data.rankings, players.cm) > 0, `board=double：★cm 进双打榜 total_delta>0（防 2026-07-03 遗漏事故复发）=${deltaOf(dbl.data.rankings, players.cm)}`);

  await stopIsoPb(pb);
}

await main().catch((e) => { console.error('  FATAL:', e.message); failed = true; });

if (failed) { console.error('[rankings-board] ❌ FAIL'); process.exit(1); }
console.log('[rankings-board] ✅ PASS — board=single/double 分流正确 + std15/cm 归双打榜（事故回归网）');
process.exit(0);
