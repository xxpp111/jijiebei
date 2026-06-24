// record-to-score.mjs — 天梯兜底落库全链路 e2e（验「随便输名就能上天梯」）。
//
// 覆盖 ensurePlayer 兜底语义 + record→score→rankings 链路 + 幂等同名累加：
//   1 host auth
//   2 rankings before（countBefore）
//   3 ensurePlayer 兜底：getByCode 精确匹配优先，找不到以输入名为 player_code 建 active:true 选手
//   4 不重复建：同 player_code 仅 1 条
//   5 postMatch(mode=match,std12,result=[1,2,0]→wins2×coef1.2=delta2.4)
//   6 hook 派生 scores（1 条 delta=2.4 wins=2 games=3）
//   7 rankings after：该选手出现 total_delta>0 + count>0 +（新建则）count 较 before 增
//   8 幂等：再 ensurePlayer(同名) 返回同一 id，不新建；再 postMatch 累加到同一 player（count 不增）
//
// API 基址：默认本地（vite proxy 7788→8090，需 vite dev + PocketBase 在跑）；
//   联调/公网走一局用 JJB_API 覆盖，例：JJB_API=https://<tunnel>/api node e2e/record-to-score.mjs
// 选手名：默认带 e2e 前缀避免污染真实选手；JJB_TESTNAME 可覆盖。
const API = process.env.JJB_API || 'http://localhost:7788/api';
const NAME = process.env.JJB_TESTNAME || 'e2e兜底选手';
const j = (r) => r.json();
const fail = (m) => { console.error('FAIL:', m); process.exit(1); };
const wins = (arr) => arr.filter((v) => v === 1 || v === 2).length;
console.log(`[record-to-score] API=${API} 选手名=${NAME}\n`);

// 1. host 登录
const auth = await fetch(`${API}/collections/accounts/auth-with-password`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identity: 'host@jjb.test', password: 'Host123456!' }),
});
if (auth.status !== 200) fail(`host auth ${auth.status}: ${(await auth.text()).slice(0, 200)}`);
const ad = await j(auth);
const token = ad.token, hostId = ad.record.id;
console.log(`1. host auth: 200 role=${ad.record.role}`);

// 2. rankings before
const rb = await j(await fetch(`${API}/rankings`));
const countBefore = rb.count;
console.log(`2. rankings before: count=${countBefore} season=${rb.season}`);

// ensurePlayer 兜底逻辑（镜像 web/src/logic/backend.ts: getByCode 优先 → 找不到建 active:true）
async function ensurePlayer(name) {
  const byCode = await j(await fetch(`${API}/collections/players/records?filter=(player_code='${encodeURIComponent(name)}')`));
  const hit = (byCode.items || [])[0];
  if (hit) return { player: hit, created: false };
  const cp = await fetch(`${API}/collections/players/records`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify({ nickname: name, player_code: name, active: true }),
  });
  if (cp.status !== 200) fail(`createPlayer ${cp.status}: ${(await cp.text()).slice(0, 250)}`);
  return { player: await j(cp), created: true };
}

async function postMatch(playerId, result) {
  const pm = await fetch(`${API}/collections/matches/records`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify({ mode: 'match', game_mode: 'std12', payload_code: 'R2S_' + Date.now() + '_' + Math.round(performance.now()), payload_ver: 1, players: [playerId], host: hostId, result, score_total: wins(result) }),
  });
  if (pm.status !== 200) fail(`postMatch ${pm.status}: ${(await pm.text()).slice(0, 250)}`);
  return (await j(pm)).id;
}
const deltaOf = (ranks, pid) => (ranks.find((r) => r.player_id === pid) || {}).total_delta || 0;

// 3. ensurePlayer 兜底（找不到则建 active:true）
const { player, created } = await ensurePlayer(NAME);
if (player.player_code !== NAME) fail(`player_code=${player.player_code} ≠ ${NAME}`);
if (player.active !== true) fail(`新建/命中选手 active=${player.active} ≠ true（不入天梯！）`);
console.log(`3. ensurePlayer: ${created ? '新建' : '命中已存在'} id=${player.id} active=${player.active}`);

// 4. 不重复建
const dup = await j(await fetch(`${API}/collections/players/records?filter=(player_code='${encodeURIComponent(NAME)}')`));
if (dup.totalItems !== 1) fail(`同 player_code 应只 1 条，实际 ${dup.totalItems}`);
console.log(`4. 不重复建：player_code='${NAME}' totalItems=1 ✓`);

// 5+6. postMatch → hook 派生 scores
const m1 = await postMatch(player.id, [1, 2, 0]); // wins=2
await new Promise((r) => setTimeout(r, 500));
const sc = await j(await fetch(`${API}/collections/scores/records?filter=(match='${m1}')`));
if (sc.totalItems !== 1) fail(`scores 派生 ${sc.totalItems} ≠ 1（hook 未派生→链路断）`);
const s0 = sc.items[0];
if (s0.delta !== 2.4 || s0.wins !== 2 || s0.games !== 3) fail(`score delta/wins/games=${s0.delta}/${s0.wins}/${s0.games} ≠ 2.4/2/3`);
console.log(`5+6. postMatch ${m1} → hook 派生 scores: delta=${s0.delta} wins=${s0.wins} games=${s0.games} ✓`);

// 7. rankings after：该选手 total_delta>0 + count>0 +（新建则）count 增
const ra = await j(await fetch(`${API}/rankings`));
const d1 = deltaOf(ra.rankings, player.id);
if (!(d1 > 0)) fail(`选手 total_delta=${d1} 不 >0`);
if (!(ra.count > 0)) fail(`rankings count=${ra.count} 不 >0（天梯仍空）`);
if (created && ra.count <= countBefore) fail(`新建选手后 count ${countBefore}→${ra.count} 未增`);
console.log(`7. rankings after: count=${countBefore}→${ra.count}（>0）| 选手 total_delta=${d1} ✓`);

// 8. 幂等：再 ensurePlayer(同名) → 同一 id 不新建；再 postMatch → 累加同一 player，count 不增
const again = await ensurePlayer(NAME);
if (again.created) fail('幂等违反：同名再 ensurePlayer 又新建了');
if (again.player.id !== player.id) fail(`幂等违反：同名 id ${again.player.id} ≠ ${player.id}`);
const countAfter1 = ra.count;
const m2 = await postMatch(player.id, [1, 1, 1]); // wins=3 → delta 3.6
await new Promise((r) => setTimeout(r, 500));
const ra2 = await j(await fetch(`${API}/rankings`));
const d2 = deltaOf(ra2.rankings, player.id);
if (Math.abs(d2 - (d1 + 3.6)) > 0.001) fail(`累加错误：total_delta ${d1}→${d2} ≠ +3.6`);
if (ra2.count !== countAfter1) fail(`幂等违反：第二局后 count ${countAfter1}→${ra2.count} 变了（应累加同一 player 不新建行）`);
console.log(`8. 幂等同名累加: 再 ensurePlayer 命中同一 id ✓ | 第二局 total_delta ${d1}→${d2}(+3.6) count 不增(${ra2.count}) ✓`);

console.log(`\n[record-to-score] ✅ 兜底建+关联→scores 派生→天梯 count>0 + 幂等同名累加同一 player PASS`);
console.log(`R2S_PLAYER_ID=${player.id}`);
