import { startIsoPb, stopIsoPb, ISO_SU_EMAIL, ISO_SU_PWD } from './lib/isopb.mjs';
import { pass, fail, done } from './lib/harness.mjs';

const CT = { 'Content-Type': 'application/json' };
const stamp = String(Date.now()).slice(-8);
const json = (response) => response.json().catch(() => ({}));

const pb = await startIsoPb();
const base = pb.base;

async function superuserToken() {
  const response = await fetch(`${base}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: CT,
    body: JSON.stringify({ identity: ISO_SU_EMAIL, password: ISO_SU_PWD }),
  });
  const data = await json(response);
  if (!data.token) fail(`前置：superuser 登录失败 ${response.status}`);
  return data.token;
}

async function createAccount(superuser, role, password) {
  const email = `${role}${stamp}@jjb.test`;
  const response = await fetch(`${base}/api/collections/accounts/records`, {
    method: 'POST',
    headers: { Authorization: superuser, ...CT },
    body: JSON.stringify({
      email,
      password,
      passwordConfirm: password,
      role,
      display_name: role.toUpperCase(),
    }),
  });
  const record = await json(response);
  if (!record.id) fail(`前置：创建 ${role} 失败 ${response.status}`);
  const auth = await json(await fetch(`${base}/api/collections/accounts/auth-with-password`, {
    method: 'POST',
    headers: CT,
    body: JSON.stringify({ identity: email, password }),
  }));
  return { id: record.id, token: auth.token, record: auth.record };
}

const patch = (id, token, body) => fetch(`${base}/api/collections/accounts/records/${id}`, {
  method: 'PATCH',
  headers: { Authorization: token, ...CT },
  body: JSON.stringify(body),
});

try {
  const superuser = await superuserToken();
  const host = await createAccount(superuser, 'host', 'Host123456!');
  const admin = await createAccount(superuser, 'admin', 'Admin123456!');

  if (host.record?.potato_ai_bias === false) pass('① 新建 host 的 potato_ai_bias 默认 false');
  else fail(`① 新建 host 字段应为 false，实际 ${String(host.record?.potato_ai_bias)}`);

  {
    const response = await patch(host.id, host.token, { potato_ai_bias: true });
    if (response.status !== 200 && response.status < 500) pass(`② host 自开 potato_ai_bias → ${response.status} 被拦`);
    else fail(`② host 自开 potato_ai_bias status=${response.status}（应被拦）`);
  }

  {
    const response = await patch(host.id, host.token, { display_name: 'H-renamed' });
    const record = await json(response);
    if (response.status === 200 && record.display_name === 'H-renamed') pass('③ host 改普通字段 → 200');
    else fail(`③ host 改名 status=${response.status}（应为 200）`);
  }

  {
    const response = await patch(host.id, host.token, { potato_ai_bias: false });
    if (response.status === 200) pass('④ host 同值回写 false → 200');
    else fail(`④ host 同值回写 status=${response.status}（应为 200）`);
  }

  {
    const response = await patch(host.id, admin.token, { potato_ai_bias: true });
    const record = await json(response);
    if (response.status === 200 && record.potato_ai_bias === true) pass('⑤ admin 设置 host 标记 → 200');
    else fail(`⑤ admin 设置标记 status=${response.status} value=${String(record.potato_ai_bias)}`);
  }

  {
    const response = await patch(host.id, host.token, { role: 'admin' });
    if (response.status !== 200 && response.status < 500) pass(`⑥ host 自提权仍被拦 → ${response.status}`);
    else fail(`⑥ host 自提权 status=${response.status}（Round S 不得回归）`);
  }
} finally {
  await stopIsoPb(pb);
}

done('sec-potato-ai-bias');
