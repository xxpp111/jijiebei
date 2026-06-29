// verify_player_hook.mjs — 隔离 PB 真验 player_accounts→players 自动建 hook（需求1 阶段4 遗留项）。
//
// 复用 worktree 的 e2e/lib/isopb.mjs（真二进制 migrate up + serve，hook 已编译进 pocketbase）。
// 覆盖：①注册选手→players 自动建(nickname/player_code=pa-<id>) ②player relation 回设
//       ③重复同 phone 不重复建 players ④直接幂等：账号预绑 player → hook 跳过不重复建。
import { startIsoPb, stopIsoPb } from './lib/isopb.mjs';

const SU_EMAIL = 'admin@jjb.test';
const SU_PWD = 'Admin123456!';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { console.log(`  PASS ${msg}`); pass++; } else { console.log(`  FAIL ${msg}`); fail++; } };

async function jreq(base, path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = token;
  const r = await fetch(`${base}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await r.json(); } catch { /* 无 body */ }
  return { status: r.status, ok: r.ok, data };
}

async function suToken(base) {
  const r = await jreq(base, '/api/collections/_superusers/auth-with-password', {
    method: 'POST', body: { identity: SU_EMAIL, password: SU_PWD },
  });
  if (!r.ok || !r.data?.token) throw new Error(`superuser auth 失败: ${r.status} ${JSON.stringify(r.data)}`);
  return r.data.token;
}

// 注册选手（前端 backend.ts 的 phone→email 容器映射在此复刻）。
async function registerPlayer(base, { nickname, phone }) {
  const email = `${phone}@phone.jjb`;
  return jreq(base, '/api/collections/player_accounts/records', {
    method: 'POST',
    body: { nickname, phone, email, emailVisibility: false, password: 'Player123456!', passwordConfirm: 'Player123456!' },
  });
}

const listPlayers = (base, token) =>
  jreq(base, '/api/collections/players/records?perPage=200', { token });

(async () => {
  let pb;
  try {
    console.log('[setup] 起隔离 PB（migrate up + serve，hook 已编译进二进制）...');
    pb = await startIsoPb();
    const base = pb.base;
    const token = await suToken(base);

    // baseline：players 初始为空
    let pl = await listPlayers(base, token);
    ok(pl.ok && pl.data.totalItems === 0, `baseline players 空（totalItems=${pl.data?.totalItems}）`);

    // ① 注册选手 A
    console.log('\n[①] 注册选手 A（phone=13800000001, nickname=阿尔法）');
    const regA = await registerPlayer(base, { nickname: '阿尔法', phone: '13800000001' });
    ok(regA.ok, `注册返回 2xx（status=${regA.status}）`);
    const accAId = regA.data?.id;
    ok(!!accAId, `拿到 player_accounts.id=${accAId}`);

    // ② players 自动建 + nickname + player_code=pa-<accId>
    pl = await listPlayers(base, token);
    ok(pl.data.totalItems === 1, `players 自动建 1 条（totalItems=${pl.data.totalItems}）`);
    const playerA = pl.data.items?.[0];
    ok(playerA?.nickname === '阿尔法', `players.nickname 取自账号（=${playerA?.nickname}）`);
    ok(playerA?.player_code === `pa-${accAId}`, `players.player_code=pa-<accId>（=${playerA?.player_code}）`);

    // ③ player_accounts.player relation 回设指向新建 players（superuser 重取，不依赖 POST 响应序列化时机）
    const accA = await jreq(base, `/api/collections/player_accounts/records/${accAId}`, { token });
    ok(accA.ok, `superuser 重取账号 2xx`);
    ok(accA.data?.player === playerA?.id, `account.player relation 回设 = 新 player.id（${accA.data?.player} == ${playerA?.id}）`);

    // ④ 审计 player.autocreate 落库 1 条
    const logs = await jreq(base, `/api/collections/logs/records?filter=${encodeURIComponent("action='player.autocreate'")}`, { token });
    ok(logs.data?.totalItems === 1, `审计 player.autocreate 1 条（totalItems=${logs.data?.totalItems}）`);

    // ⑤ 幂等-A：重复注册同 phone → DB unique 挡掉 → players 不增
    console.log('\n[⑤] 重复注册同 phone=13800000001（应被 unique 挡，players 不增）');
    const regDup = await registerPlayer(base, { nickname: '阿尔法重复', phone: '13800000001' });
    ok(!regDup.ok, `重复同 phone 注册被拒（status=${regDup.status}，非 2xx）`);
    pl = await listPlayers(base, token);
    ok(pl.data.totalItems === 1, `players 仍为 1（重复同 phone 不重复建，totalItems=${pl.data.totalItems}）`);

    // ⑥ 第二个选手 B（不同 phone）→ players 增到 2（hook 对新账号正常触发）
    console.log('\n[⑥] 注册选手 B（phone=13800000002, nickname=贝塔）');
    const regB = await registerPlayer(base, { nickname: '贝塔', phone: '13800000002' });
    ok(regB.ok, `选手 B 注册 2xx（status=${regB.status}）`);
    pl = await listPlayers(base, token);
    ok(pl.data.totalItems === 2, `players 增到 2（新账号正常自动建，totalItems=${pl.data.totalItems}）`);

    // ⑦ 直接幂等：superuser 建一个账号且预绑 player → hook 命中 `已绑则跳过` → players 不增
    console.log('\n[⑦] 直接幂等：账号预绑 player（player 字段已有值）→ hook 跳过不重复建');
    const preLinked = await jreq(base, '/api/collections/player_accounts/records', {
      method: 'POST', token,
      body: {
        nickname: '伽马预绑', phone: '13800000003', email: '13800000003@phone.jjb',
        emailVisibility: false, password: 'Player123456!', passwordConfirm: 'Player123456!',
        player: playerA.id, // 预绑到已存在的 playerA
      },
    });
    ok(preLinked.ok, `预绑账号创建 2xx（status=${preLinked.status}）`);
    pl = await listPlayers(base, token);
    ok(pl.data.totalItems === 2, `players 仍为 2（预绑账号 hook 跳过，不建第三个，totalItems=${pl.data.totalItems}）`);
    const accC = await jreq(base, `/api/collections/player_accounts/records/${preLinked.data.id}`, { token });
    ok(accC.data?.player === playerA.id, `预绑账号 player 保持原值（=${accC.data?.player}，未被覆盖）`);

    console.log(`\n===== 结果：${pass} PASS / ${fail} FAIL =====`);
  } catch (e) {
    console.error('[error]', e?.message || e);
    fail++;
  } finally {
    await stopIsoPb(pb);
  }
  process.exit(fail === 0 ? 0 : 1);
})();
