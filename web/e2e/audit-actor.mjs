// audit-actor.mjs — #90 审计日志 actor 填充真后端验证（补 hooks.go match.create actor 零测试缺口）。
//
// 防的是：backend/hooks.go 的 match.create 审计 hook 把 actor 恒传 nil（logs.actor 有壳无芯）。
//   本轮改为 match 局用 matches.host 查 accounts 记录填 actor、practice/无 host 保持 nil。
//   本脚本用真 isopb（自起隔离 PB 8090）跑 hook 真链路，经 superuser 查 logs 断言：
//   - match 局（host=某 account）→ match.create log 的 actor = 该 host 账号 id（填充生效）
//   - practice 局（host 空）→ match.create log 的 actor 为空（practice 行为不变、不报错）
//   logs ListRule=admin-only → 查询必须用 superuser token（匿名读被 listRule 挡返回空）。
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
// logs ListRule=admin-only → 必须带 superuser token 查（否则 listRule 挡住返回空列表，假阴性）。
async function suGet(base, token, path) {
  const r = await fetch(`${base}${path}`, { headers: { Authorization: token } });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

// 查某 match 的 match.create 审计 log（用 superuser）。hook 是 afterCreate 异步，做几次轮询容错。
async function findMatchCreateLog(base, token, matchId) {
  const filter = encodeURIComponent(`action='match.create' && target_id='${matchId}'`);
  for (let i = 0; i < 10; i++) {
    const r = await suGet(base, token, `/api/collections/logs/records?perPage=50&filter=${filter}`);
    if (r.data.totalItems >= 1) return r.data.items[0];
    await new Promise((x) => setTimeout(x, 200));
  }
  return null;
}

async function main() {
  const pb = await startIsoPb();
  const base = pb.base;
  const su = await suToken(base);

  // 前置：建 host 账号（match 局的 matches.host + 期望 actor 指向它）
  const host = await suPost(base, su, '/api/collections/accounts/records', {
    email: `auditactorhost${Date.now()}@jjb.test`, password: 'Host123456!', passwordConfirm: 'Host123456!', role: 'host', display_name: '审计actor测试主播',
  });
  const hostId = host.data.id;
  if (!expect(host.status === 200 && !!hostId, `前置：建 host 账号 2xx（status=${host.status}）`)) { await stopIsoPb(pb); return; }

  // ── 用例 A：match 局（host=该账号）→ match.create log 的 actor 应 = hostId ──
  const matchRec = await suPost(base, su, '/api/collections/matches/records', {
    mode: 'match', game_mode: 'std8', payload_code: `AUDIT_MATCH_${Date.now()}`, payload_ver: 1,
    host: hostId, result: [1, 1, 0], score_total: 2,
  });
  expect(matchRec.status === 200 && !!matchRec.data.id, `A1 落 match 局（host 非空）2xx（status=${matchRec.status}）`);
  const matchLog = matchRec.data.id ? await findMatchCreateLog(base, su, matchRec.data.id) : null;
  if (expect(!!matchLog, `A2 match 局产生 match.create 审计 log`)) {
    // actor 是 relation（MaxSelect 1）：PB 返回单值字符串或单元素数组，规整后比对。
    const actor = Array.isArray(matchLog.actor) ? matchLog.actor[0] : matchLog.actor;
    expect(actor === hostId, `A3 ★match 局 actor 被填充 = host 账号 id（actor='${actor}' 期望 '${hostId}'）`);
    // 审计 detail.host 未被 actor 逻辑污染（仍是原 host 字符串）
    expect(matchLog.detail?.host === hostId, `A4 detail.host 仍为原值 '${matchLog.detail?.host}'（未被 actor 逻辑改写）`);
  }

  // ── 用例 B：practice 局（host 空）→ match.create log 的 actor 应为空（行为不变、不报错）──
  const practiceRec = await suPost(base, su, '/api/collections/matches/records', {
    mode: 'practice', game_mode: 'std8', payload_code: `AUDIT_PRACTICE_${Date.now()}`, payload_ver: 1,
    result: [1, 2, 0], score_total: 2, // host 省略 → 空
  });
  expect(practiceRec.status === 200 && !!practiceRec.data.id, `B1 落 practice 局（host 空）2xx（status=${practiceRec.status}）`);
  const practiceLog = practiceRec.data.id ? await findMatchCreateLog(base, su, practiceRec.data.id) : null;
  if (expect(!!practiceLog, `B2 practice 局产生 match.create 审计 log（practice 也审计，行为不变）`)) {
    const actor = Array.isArray(practiceLog.actor) ? practiceLog.actor[0] : practiceLog.actor;
    const empty = actor === '' || actor == null || (Array.isArray(practiceLog.actor) && practiceLog.actor.length === 0);
    expect(empty, `B3 ★practice 局 actor 为空（actor=${JSON.stringify(practiceLog.actor)}）——无 host 保持 nil`);
    expect(practiceLog.detail?.host === '' || practiceLog.detail?.host == null, `B4 practice detail.host 为空（=${JSON.stringify(practiceLog.detail?.host)}）`);
  }

  await stopIsoPb(pb);
}

await main().catch((e) => { console.error('  FATAL:', e.message); failed = true; });

if (failed) { console.error('[audit-actor] ❌ FAIL'); process.exit(1); }
console.log('[audit-actor] ✅ PASS — match 局 actor=host 填充生效 + practice 局 actor 空（行为不变）');
process.exit(0);
