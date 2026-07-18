// e2e/practice-post.mjs — Step6 practice 落库权限矩阵（需求1 阶段4）。
// 被测：1782000006_matches_practice_rule.go 放开 matches.CreateRule +
//   1782000009_matches_practice_ownership.go（Round S 安全止血：practice players 须为本人绑定 player）。
// 隔离 PB（临时 dir，绝不碰现网 pb_data），fetch 矩阵：
//   ① 选手 player token 落 mode=practice players=[本人绑定 player] → 200（CreateRule 放开 practice 自助落库，本人归属合法）
//   ② 选手 token 落 mode=match → ≠200（match 仍限 host||admin，选手无 role 刷不了正式天梯）
//   ③ 匿名落 practice → ≠200（@request.auth.id != '' 挡匿名）
// 注：他人/空/伪双打归属伪造的负测在 sec-practice-ownership.mjs（Round S 专项）；本脚本只验合法落库+match/匿名门。
import { startIsoPb, stopIsoPb } from './lib/isopb.mjs';
import { pass, fail, done } from './lib/harness.mjs';

const CT = { 'Content-Type': 'application/json' };
const PWD = 'Pwd12345';
const phone = `137${String(Date.now()).slice(-8)}`;
const matchBody = (mode, players = []) => JSON.stringify({ mode, game_mode: 'std8', payload_code: 'TESTCODE', payload_ver: 1, players, result: [1, 1, 1], score_total: 3 });

const pb = await startIsoPb();
const BASE = pb.base;
try {
  const reg = await (await fetch(`${BASE}/api/collections/player_accounts/records`, { method: 'POST', headers: CT, body: JSON.stringify({ email: `${phone}@phone.jjb`, password: PWD, passwordConfirm: PWD, nickname: '练习选手', phone }) })).json().catch(() => ({}));
  const auth = await fetch(`${BASE}/api/collections/player_accounts/auth-with-password`, { method: 'POST', headers: CT, body: JSON.stringify({ identity: `${phone}@phone.jjb`, password: PWD }) });
  const authJson = await auth.json().catch(() => ({}));
  const tok = authJson.token;
  if (!tok) fail('前置：选手登录拿 token 失败');
  // 注册 hook 自动建 players + 回填 player relation（本人绑定 player，practice 归属约束的合法归属源）。
  let ownPlayer = ''; for (let i = 0; i < 20 && !ownPlayer; i++) {
    const acc = await (await fetch(`${BASE}/api/collections/player_accounts/records/${reg.id}`, { headers: { Authorization: tok } })).json().catch(() => ({}));
    ownPlayer = acc.player || (Array.isArray(acc.player) ? acc.player[0] : ''); if (!ownPlayer) await new Promise((x) => setTimeout(x, 100));
  }
  if (!ownPlayer) fail('前置：注册 hook 未回填 player relation');

  // ① 选手 token 落 practice players=[本人绑定 player] → 200
  const p = await fetch(`${BASE}/api/collections/matches/records`, { method: 'POST', headers: { Authorization: tok, ...CT }, body: matchBody('practice', [ownPlayer]) });
  const pj = await p.json().catch(() => ({}));
  if (p.status === 200) pass('① 选手 token 落 practice players=[本人] → 200（CreateRule 放开练习自助落库，本人归属合法）');
  else fail(`① 选手落 practice status=${p.status}: ${JSON.stringify(pj).slice(0, 150)}`);

  // ② 选手 token 落 match → ≠200
  const mm = await fetch(`${BASE}/api/collections/matches/records`, { method: 'POST', headers: { Authorization: tok, ...CT }, body: matchBody('match') });
  if (mm.status !== 200) pass(`② 选手 token 落 match → ${mm.status} 挡住（match 仍限 host||admin，选手刷不了正式天梯）`);
  else fail('② 选手落 match status=200（应被挡）');

  // ③ 匿名落 practice → ≠200
  const anon = await fetch(`${BASE}/api/collections/matches/records`, { method: 'POST', headers: CT, body: matchBody('practice') });
  if (anon.status !== 200) pass(`③ 匿名落 practice → ${anon.status} 挡住（@request.auth.id != '' 须登录态）`);
  else fail('③ 匿名落 practice status=200（应被挡）');

  // ④ practice 落库后 scores 无派生（hook 按 mode 跳过算分，练习不进正式天梯）
  if (pj.id) {
    const sc = await fetch(`${BASE}/api/collections/scores/records?filter=(match='${pj.id}')`);
    const scj = await sc.json().catch(() => ({}));
    if (scj.totalItems === 0) pass('④ practice 局落库后 scores 无派生（hook 按 mode 跳过，练习不进正式天梯）');
    else fail(`④ practice 派生了 scores totalItems=${scj.totalItems}（应 0，practice 不该算分）`);
  }
} finally {
  await stopIsoPb(pb);
}
done('practice-post');
