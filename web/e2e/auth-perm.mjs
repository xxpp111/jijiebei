// e2e/auth-perm.mjs — player_accounts 权限矩阵测试（测试体系第⑤层 · 需求1）。
// 被测：backend/pb_migrations/1782000005_player_accounts.go 的 API Rules
//   （list/view/update = @request.auth.id = id / create = "" / delete = admin / idx_pa_phone unique）。
//
// 起隔离 PB（临时 --dir，绝不碰现网 pb_data），fetch 真值对比硬断言：
//   ① 无 auth 注册（createRule=""）→ 200
//   ② 选手 token list player_accounts → totalItems=1（只看自己）
//   ③ 无 token list → totalItems=0（listRule 挡匿名）
//   ④ 重复 phone 注册 → 400 validation_not_unique（idx_pa_phone）
//   ⑤ 选手 token 改别人档案 → ≠200 改不了（PB viewRule 在 query 层过滤越权记录 → 404；安全边界达成）
import { startIsoPb, stopIsoPb } from './lib/isopb.mjs';
import { pass, fail, done } from './lib/harness.mjs';

const CT = { 'Content-Type': 'application/json' };
const j = (r) => r.json();
const PWD = 'Pwd12345';
// 唯一手机号（139/138 + 时间戳后 8 位 = 11 位，避 phone unique 400；A/B 各一）
const phoneA = `139${String(Date.now()).slice(-8)}`;
const phoneB = `138${String(Date.now()).slice(-8)}`;
const regBody = (phone, nick) => JSON.stringify({
  email: `${phone}@phone.jjb`, password: PWD, passwordConfirm: PWD, nickname: nick, phone,
});

const pb = await startIsoPb();
const BASE = pb.base;
try {
  // ① 无 auth 注册选手 A（createRule="" 期望 200）
  const regA = await fetch(`${BASE}/api/collections/player_accounts/records`, { method: 'POST', headers: CT, body: regBody(phoneA, '选手A') });
  const dA = await j(regA).catch(() => ({}));
  if (regA.status === 200 && dA.id) pass(`① 无 auth 注册选手A 200（createRule="" 自助注册）id=${dA.id}`);
  else fail(`① 注册 A status=${regA.status}: ${JSON.stringify(dA).slice(0, 120)}`);
  const idA = dA.id;

  // 选手 A 登录拿 token（identity = {phone}@phone.jjb 兜底容器，对齐 backend.ts pbAuthPlayer）
  const authA = await fetch(`${BASE}/api/collections/player_accounts/auth-with-password`, { method: 'POST', headers: CT, body: JSON.stringify({ identity: `${phoneA}@phone.jjb`, password: PWD }) });
  const tokA = (await j(authA).catch(() => ({}))).token;

  // ② 选手 A token list → totalItems=1 且只看自己（listRule = @request.auth.id = id）
  const listA = await fetch(`${BASE}/api/collections/player_accounts/records`, { headers: { Authorization: tokA } });
  const la = await j(listA).catch(() => ({}));
  if (la.totalItems === 1 && la.items?.[0]?.id === idA) pass(`② A token list → totalItems=1 只看自己（listRule 隔离）`);
  else fail(`② A list totalItems=${la.totalItems} ids=${JSON.stringify(la.items?.map((x) => x.id))}（应=1 且只含 A）`);

  // ③ 无 token list → totalItems=0（listRule 挡匿名，返回空集 200）
  const listN = await fetch(`${BASE}/api/collections/player_accounts/records`);
  const ln = await j(listN).catch(() => ({}));
  if (ln.totalItems === 0) pass(`③ 无 token list → totalItems=0（listRule 挡匿名）`);
  else fail(`③ 匿名 list totalItems=${ln.totalItems}（应 0）`);

  // 注册选手 B（供 ⑤ 越权测试）
  const regB = await fetch(`${BASE}/api/collections/player_accounts/records`, { method: 'POST', headers: CT, body: regBody(phoneB, '选手B') });
  const idB = (await j(regB).catch(() => ({}))).id;
  if (!idB) fail('前置：选手 B 注册失败，⑤ 无法测');

  // ④ 重复 phone 注册 → 400 + data.phone.code = validation_not_unique（idx_pa_phone）
  const dup = await fetch(`${BASE}/api/collections/player_accounts/records`, { method: 'POST', headers: CT, body: regBody(phoneA, '重复') });
  const dupJ = await j(dup).catch(() => ({}));
  if (dup.status === 400 && dupJ?.data?.phone?.code === 'validation_not_unique') pass(`④ 重复 phone → 400 validation_not_unique（idx_pa_phone）`);
  else fail(`④ 重复 phone status=${dup.status} data=${JSON.stringify(dupJ?.data)}（应 400 + phone not_unique）`);

  // ⑤ 选手 A token PATCH B → ≠200 改不了。PB viewRule/updateRule = @request.auth.id = id 在 query 层
  //    过滤越权记录（B 对 A 不可见）→ 404，非契约字面 403；但「选手改不了别人档案」的安全边界达成。
  if (idB && tokA) {
    const patch = await fetch(`${BASE}/api/collections/player_accounts/records/${idB}`, { method: 'PATCH', headers: { Authorization: tokA, ...CT }, body: JSON.stringify({ nickname: '被A改了' }) });
    if (patch.status !== 200 && patch.status < 500) pass(`⑤ A token 改 B → ${patch.status} 改不了（updateRule 越权过滤；PB 语义 404 非字面 403，安全边界达成）`);
    else fail(`⑤ A 改 B status=${patch.status}（应被挡 ≠200）`);
  }
} finally {
  await stopIsoPb(pb);
}

console.log('\n[auth-perm] 权限矩阵：create 自助 / list 自隔离 / unique / 越权挡');
done('auth-perm');
