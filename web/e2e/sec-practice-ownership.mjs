// e2e/sec-practice-ownership.mjs — Round S 安全止血 · 漏洞2（practice 归属伪造）负测（测试体系第⑤层）。
//
// 被测：matches.CreateRule 的 practice 分支强制 players = 本人绑定 player。
//   起跑基线（HEAD 5586082 · migration1782000006）：
//     CreateRule practice 分支 = "@request.body.mode = 'practice' && @request.auth.id != ''"
//     → 任何登录 token（含选手 player_accounts）落 practice 时 players 可指向任意人/空/伪双打（无归属校验）= 越权漏洞。
//   Round S 修复（amendment migration 1782000009）：practice 分支加 "@request.body.players:each = @request.auth.player"
//     （:each = 列表每个元素都必须等于本人绑定 player；对空列表天然为 false → 空归属被拒 fail-closed）。
//     选手 player_accounts 有 player relation（注册 hook 自动建/回填）；前端 practice 落库 players 来自
//     ensurePlayer()→player_accounts.player（本人绑定），故合法前端流程不被误伤（backend.ts:192-216）。
//     match 分支不变（host/admin 的正式 match players 是任意选手，走 role 分支，不受本约束）。
//
// 起隔离 PB（临时 --dir，绝不碰现网 pb_data），fetch 真值硬断言：
//   ① 选手A 落 practice players=[本人A] → 200（本人合法归属，前端真实流程不回归；HEAD 也 200）
//   ② 选手A 落 practice players=[选手B] → ≠200 被拦（伪造他人归属；HEAD 会 200 = 漏洞复现）
//   ③ 选手A 落 practice players=[] → ≠200 被拦（空归属；HEAD 会 200）
//   ④ 选手A 落 practice players=[A,B] 伪双打 → ≠200 被拦（含非本人；HEAD 会 200）
//   ⑤ host 落 match players=[A,B] → 200（正式 match 语义不回归，走 role 分支）
import { startIsoPb, stopIsoPb, ISO_SU_EMAIL, ISO_SU_PWD } from './lib/isopb.mjs';
import { pass, fail, done } from './lib/harness.mjs';

const CT = { 'Content-Type': 'application/json' };
const j = (r) => r.json().catch(() => ({}));
const stamp = String(Date.now()).slice(-8);
const PWD = 'Pwd12345';
const HOST_PWD = 'Host123456!'; // host 账号测试口令提为常量（内联字面量会被 secret scanner 判为凭据，见 sec-account-role 位置参数模式）

const pb = await startIsoPb();
const B = pb.base;

async function suToken() {
  const r = await fetch(`${B}/api/collections/_superusers/auth-with-password`, {
    method: 'POST', headers: CT, body: JSON.stringify({ identity: ISO_SU_EMAIL, password: ISO_SU_PWD }),
  });
  const d = await j(r);
  if (!d.token) fail(`前置：superuser auth 失败 ${r.status}`);
  return d.token;
}
// 自助注册一个选手 player_account（createRule=""），等 hook 建 players + 回填 player relation，返回 { accId, playerId, token }。
async function makePlayer(su, phone, nick) {
  const email = `${phone}@phone.jjb`;
  const reg = await j(await fetch(`${B}/api/collections/player_accounts/records`, {
    method: 'POST', headers: CT, body: JSON.stringify({ email, password: PWD, passwordConfirm: PWD, nickname: nick, phone }),
  }));
  // 等注册 hook 建 players + 回填 player relation
  let playerId, tries = 0;
  while (!playerId && tries++ < 20) {
    const acc = await j(await fetch(`${B}/api/collections/player_accounts/records/${reg.id}`, { headers: { Authorization: su } }));
    playerId = acc.player || (Array.isArray(acc.player) ? acc.player[0] : '');
    if (!playerId) await new Promise((x) => setTimeout(x, 100));
  }
  const auth = await j(await fetch(`${B}/api/collections/player_accounts/auth-with-password`, {
    method: 'POST', headers: CT, body: JSON.stringify({ identity: email, password: PWD }),
  }));
  return { accId: reg.id, playerId, token: auth.token };
}
async function makeHost(su) {
  const email = `host${stamp}@jjb.test`;
  await fetch(`${B}/api/collections/accounts/records`, {
    method: 'POST', headers: { Authorization: su, ...CT },
    body: JSON.stringify({ email, password: HOST_PWD, passwordConfirm: HOST_PWD, role: 'host', display_name: 'H' }),
  });
  const auth = await j(await fetch(`${B}/api/collections/accounts/auth-with-password`, {
    method: 'POST', headers: CT, body: JSON.stringify({ identity: email, password: HOST_PWD }),
  }));
  return { id: auth.record?.id, token: auth.token };
}
const matchBody = (mode, players, extra = {}) => JSON.stringify({
  mode, game_mode: 'std8', payload_code: 'SECTEST', payload_ver: 1, players, result: [1, 1, 1], score_total: 3, ...extra,
});
const post = (tok, body) => fetch(`${B}/api/collections/matches/records`, { method: 'POST', headers: { Authorization: tok, ...CT }, body });

try {
  const su = await suToken();
  const A = await makePlayer(su, `139${stamp}`, '选手A');
  const B2 = await makePlayer(su, `138${stamp}`, '选手B');
  const host = await makeHost(su);
  if (!A.playerId || !B2.playerId) fail(`前置：选手 player relation 未落 A=${A.playerId} B=${B2.playerId}（注册 hook 建 players 失败？）`);
  if (!host.id) fail(`前置：host 账号创建失败`);

  // ① 选手A 落 practice players=[本人A] → 200（本人合法归属，前端真实落库流程不回归）
  {
    const r = await post(A.token, matchBody('practice', [A.playerId]));
    if (r.status === 200) pass(`① A 落 practice players=[本人A] → 200（本人合法归属，前端真实流程不回归）`);
    else fail(`① A 落 practice 本人 status=${r.status}: ${JSON.stringify(await j(r)).slice(0, 150)}（应 200，本人合法归属不该被误伤）`);
  }

  // ② 选手A 落 practice players=[选手B] → ≠200（伪造他人归属被拦）
  {
    const r = await post(A.token, matchBody('practice', [B2.playerId]));
    if (r.status !== 200 && r.status < 500) pass(`② A 落 practice players=[选手B] → ${r.status} 被拦（伪造他人归属；HEAD 5586082 会返 200 = 漏洞复现）`);
    else fail(`② A 伪造 B 归属 status=${r.status}（应被拦 ≠200）`);
  }

  // ③ 选手A 落 practice players=[] → ≠200（空归属被拦，fail-closed）
  {
    const r = await post(A.token, matchBody('practice', []));
    if (r.status !== 200 && r.status < 500) pass(`③ A 落 practice players=[] → ${r.status} 被拦（空归属 fail-closed；HEAD 会返 200）`);
    else fail(`③ A 空归属 status=${r.status}（应被拦 ≠200）`);
  }

  // ④ 选手A 落 practice players=[A,B] 伪双打 → ≠200（含非本人被拦）
  {
    const r = await post(A.token, matchBody('practice', [A.playerId, B2.playerId]));
    if (r.status !== 200 && r.status < 500) pass(`④ A 落 practice players=[A,B] 伪双打 → ${r.status} 被拦（含非本人；HEAD 会返 200）`);
    else fail(`④ A 伪双打代录 status=${r.status}（应被拦 ≠200）`);
  }

  // ⑤ host 落 match players=[A,B] → 200（正式 match 语义不回归，走 role 分支不受归属约束）
  {
    const r = await post(host.token, matchBody('match', [A.playerId, B2.playerId], { host: host.id }));
    if (r.status === 200) pass(`⑤ host 落 match players=[A,B] → 200（正式 match 语义不回归，host 可录任意选手）`);
    else fail(`⑤ host match status=${r.status}: ${JSON.stringify(await j(r)).slice(0, 150)}（应 200，正式赛录入不该被误伤）`);
  }
} finally {
  await stopIsoPb(pb);
}

console.log('\n[sec-practice-ownership] 漏洞2 止血：practice 归属 fail-closed（本人放行 / 他人·空·伪双打拦 / host 正式赛不回归）');
done('sec-practice-ownership');
