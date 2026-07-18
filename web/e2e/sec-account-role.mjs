// e2e/sec-account-role.mjs — Round S 安全止血 · 漏洞1（account role 自提权）负测（测试体系第⑤层）。
//
// 被测：accounts.UpdateRule 字段级不可变 role。
//   起跑基线（HEAD 5586082 · migration 1782000001）：UpdateRule = "@request.auth.id = id || @request.auth.role = 'admin'"
//     → 任何账号可 PATCH 自己 record 把 role 改成 admin（无字段级限制）= 提权漏洞。
//   Round S 修复（amendment migration1782000008）：本人可改自己 record 但 role 不可变；admin 合法角色管理保留。
//     rule = "(@request.auth.id = id && @request.body.role:changed = false) || @request.auth.role = 'admin'"
//     （:changed 是 PB 0.39 内建修饰符，展开为 role:isset && role != 当前值 —— 只在「提交了 role 且值变了」时为 true）
//
// 起隔离 PB（临时 --dir，绝不碰现网 pb_data），fetch 真值硬断言：
//   ① viewer 自 PATCH role=admin → ≠200 被拦（修复前此断言会红：当前 HEAD 返 200 提权成功）
//   ② host 自 PATCH role=admin → ≠200 被拦
//   ③ viewer 改自己 display_name（非 role 字段）→ 200 仍按设计工作（本人合法更新不回归）
//   ④ admin 改他人（viewer）role→host → 200 合法角色管理保留
import { startIsoPb, stopIsoPb, ISO_SU_EMAIL, ISO_SU_PWD } from './lib/isopb.mjs';
import { pass, fail, done } from './lib/harness.mjs';

const CT = { 'Content-Type': 'application/json' };
const j = (r) => r.json().catch(() => ({}));
const stamp = String(Date.now()).slice(-7);

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
// superuser 造一个 accounts 记录 + 登录拿 token。
async function makeAccount(su, role, pwd) {
  const email = `${role}${stamp}@jjb.test`;
  await fetch(`${B}/api/collections/accounts/records`, {
    method: 'POST', headers: { Authorization: su, ...CT },
    body: JSON.stringify({ email, password: pwd, passwordConfirm: pwd, role, display_name: role.toUpperCase() }),
  });
  const auth = await j(await fetch(`${B}/api/collections/accounts/auth-with-password`, {
    method: 'POST', headers: CT, body: JSON.stringify({ identity: email, password: pwd }),
  }));
  return { id: auth.record?.id, token: auth.token, role: auth.record?.role };
}
const patch = (id, tok, body) => fetch(`${B}/api/collections/accounts/records/${id}`, {
  method: 'PATCH', headers: { Authorization: tok, ...CT }, body: JSON.stringify(body),
});

try {
  const su = await suToken();
  const viewer = await makeAccount(su, 'viewer', 'View123456!');
  const host = await makeAccount(su, 'host', 'Host123456!');
  const admin = await makeAccount(su, 'admin', 'Admin123456!');
  if (!viewer.id || !host.id || !admin.id) fail(`前置：账号创建不全 v=${viewer.id} h=${host.id} a=${admin.id}`);

  // ① viewer 自 PATCH role=admin → ≠200（提权被拦）。PB updateRule 越权在 query 层过滤 → 404，非字面 403；安全边界达成。
  {
    const r = await patch(viewer.id, viewer.token, { role: 'admin' });
    const d = await j(r);
    if (r.status !== 200 && r.status < 500) pass(`① viewer 自提权 role=admin → ${r.status} 被拦（role 字段级不可变）`);
    else fail(`① viewer 自提权 status=${r.status} role=${d.role}（应被拦 ≠200；HEAD 5586082 会返 200 提权成功 = 漏洞复现）`);
  }

  // ② host 自 PATCH role=admin → ≠200（提权被拦）
  {
    const r = await patch(host.id, host.token, { role: 'admin' });
    const d = await j(r);
    if (r.status !== 200 && r.status < 500) pass(`② host 自提权 role=admin → ${r.status} 被拦`);
    else fail(`② host 自提权 status=${r.status} role=${d.role}（应被拦 ≠200）`);
  }

  // ③ viewer 改自己 display_name（非 role 字段）→ 200 仍工作（本人合法更新不回归）
  {
    const r = await patch(viewer.id, viewer.token, { display_name: 'V-renamed' });
    const d = await j(r);
    if (r.status === 200 && d.display_name === 'V-renamed') pass(`③ viewer 改自己 display_name → 200（本人非 role 字段合法更新按设计工作）`);
    else fail(`③ viewer 改名 status=${r.status} name=${d.display_name}（应 200 且改名生效，本人合法更新不该被误伤）`);
  }

  // ④ admin 改他人 role → 200（合法角色管理保留）
  {
    const r = await patch(viewer.id, admin.token, { role: 'host' });
    const d = await j(r);
    if (r.status === 200 && d.role === 'host') pass(`④ admin 改 viewer role→host → 200（admin 合法角色管理路径保留）`);
    else fail(`④ admin 角色管理 status=${r.status} role=${d.role}（应 200 且 role=host，admin 合法路径不该回归）`);
  }
} finally {
  await stopIsoPb(pb);
}

console.log('\n[sec-account-role] 漏洞1 止血：role 字段级不可变（自提权拦 / 本人非 role 更新放行 / admin 角色管理保留）');
done('sec-account-role');
