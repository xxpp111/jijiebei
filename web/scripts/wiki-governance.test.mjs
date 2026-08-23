// wiki-governance 测试套件 — JJB Alioth v2 账本 registrar（2026-08-23 · Spoke A）。
// node --test 红绿矩阵，覆盖 registrar-spec §6 十类：
//   1 正常注册 / 2 幂等 REPLAYED / 3 冲突 / 4 路径逃逸 / 5 SHA 漂移 /
//   6 非法 transition / 7 中断恢复 / 8 bootstrap / 9 lm 标记 / 10 零态重建
// 隔离纪律：每个用例独立 mkdtemp fixture（--repo-root 指向该目录），绝不触碰真实 docs/wiki 账。
// 断言以真实 CLI 面为准：子进程退出码 + --json stdout 的 code/errors/counts。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, appendFileSync, symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  stableStringify as stable, countTestCases, checkReadmeProjection, loadConfig,
  DEFAULT_CONFIG, MODES, TRANSITIONS,
} from './wiki-governance.mjs'; // 复用 CLI 真相源：稳定序列化 + schema parity 枚举

const CLI = fileURLToPath(new URL('wiki-governance.mjs', import.meta.url));
const HERE = dirname(fileURLToPath(import.meta.url));

// ───────────────────────────────────────────────────────────────────────────
// helpers
// ───────────────────────────────────────────────────────────────────────────
function makeFixture(t) {
  const fx = mkdtempSync(join(tmpdir(), 'jjbwiki-'));
  t.after(() => rmSync(fx, { recursive: true, force: true }));
  return fx;
}
// 运行 CLI（子进程），返回 { status, stdout, stderr }；status=0 成功
function runCli(fx, args) {
  try {
    const stdout = execFileSync(process.execPath, [CLI, ...args, '--repo-root', fx], { encoding: 'utf8' });
    return { status: 0, stdout };
  } catch (e) {
    return { status: e.status ?? 1, stdout: String(e.stdout || '') };
  }
}
function runJson(fx, args) {
  const r = runCli(fx, args);
  let j = null;
  try { j = JSON.parse(r.stdout); } catch { /* 保持 null */ }
  return { ...r, json: j };
}
// 写一个带 lm 标记的 plan html，返回其 manifest 基础对象（缺省字段由 CLI 补）
function writePlan(fx, slug, ts, { type = 'plan', title = 'plan 标题', lm = null } = {}) {
  const slugName = slug.replace(/^jijiebei\//, '');
  const dir = join(fx, 'docs', 'wiki', 'jijiebei', slugName);
  mkdirSync(dir, { recursive: true });
  const path = `docs/wiki/jijiebei/${slugName}/r${ts}.${type}.html`;
  const marker = lm === null ? `<!--lm ${slug}@r${ts}-->` : lm;
  writeFileSync(join(fx, path), `${marker}\n<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body><h1>${title}</h1></body></html>\n`);
  return { id: `${slug}@r${ts}`, path, title, type, topic: 't', owner: 'tester' };
}
function logLines(fx) {
  const p = join(fx, 'docs', 'wiki', 'log.jsonl');
  if (!existsSync(p)) return [];
  return readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}
function lcLines(fx) {
  const p = join(fx, 'docs', 'wiki', 'lifecycle.jsonl');
  if (!existsSync(p)) return [];
  return readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

// ───────────────────────────────────────────────────────────────────────────
// 1. 正常注册 plan(html)：log/lifecycle 各 +1，check 绿
// ───────────────────────────────────────────────────────────────────────────
test('T1 正常注册 plan(html) → 双账 +1 且 check 绿', (t) => {
  const fx = makeFixture(t);
  const manifest = writePlan(fx, 'jijiebei/demo-plan', '20260823-100000');
  const mf = join(fx, 'manifest.json');
  writeFileSync(mf, JSON.stringify(manifest));

  const ok = runJson(fx, ['register', '--manifest', mf, '--json']);
  assert.equal(ok.status, 0, ok.stdout);
  assert.equal(ok.json.code, 'OK');
  assert.equal(ok.json.counts.log_lines, 1);

  const log = logLines(fx);
  assert.equal(log.length, 1);
  assert.equal(log[0].id, 'jijiebei/demo-plan@r20260823-100000');
  assert.equal(log[0].type, 'plan');
  assert.equal(log[0].life, 'flow'); // plan ⇒ 注册 life=flow
  assert.match(log[0].registration_id, /^reg-/);
  assert.match(log[0].source_sha256, /^[0-9a-f]{64}$/);
  const lc = lcLines(fx);
  assert.equal(lc.length, 1);
  assert.equal(lc[0].event, 'register-flow');
  assert.equal(lc[0].from, null);
  assert.equal(lc[0].to.life, 'flow');

  const chk = runJson(fx, ['check', '--json']);
  assert.equal(chk.status, 0, chk.stdout);
  assert.equal(chk.json.code, 'CHECK_OK');
  assert.equal(chk.json.counts.log_lines, 1);
  assert.equal(chk.json.counts.objects, 1);

  // 红例：type 非法
  const bad = { ...manifest, type: 'memo' };
  const mf2 = join(fx, 'manifest-bad.json');
  writeFileSync(mf2, JSON.stringify(bad));
  const badRes = runJson(fx, ['register', '--manifest', mf2, '--json']);
  assert.equal(badRes.status, 1);
  assert.equal(badRes.json.code, 'INVALID_INPUT');
});

// ───────────────────────────────────────────────────────────────────────────
// 2. 幂等：同 manifest 再注册 → REPLAYED，行数不变
// ───────────────────────────────────────────────────────────────────────────
test('T2 幂等：同 manifest 再注册 → REPLAYED 且行数不变', (t) => {
  const fx = makeFixture(t);
  const manifest = writePlan(fx, 'jijiebei/idem', '20260823-110000');
  const mf = join(fx, 'manifest.json');
  writeFileSync(mf, JSON.stringify(manifest));

  assert.equal(runJson(fx, ['register', '--manifest', mf, '--json']).json.code, 'OK');
  const second = runJson(fx, ['register', '--manifest', mf, '--json']);
  assert.equal(second.status, 0, second.stdout);
  assert.equal(second.json.code, 'REPLAYED');
  assert.equal(logLines(fx).length, 1);
  assert.equal(lcLines(fx).length, 1);
  assert.equal(runJson(fx, ['check', '--json']).json.code, 'CHECK_OK');
});

// ───────────────────────────────────────────────────────────────────────────
// 3. 冲突：同 id 改 title → REGISTRATION_CONFLICT，行数不变
// ───────────────────────────────────────────────────────────────────────────
test('T3 冲突：同 id 改 title → REGISTRATION_CONFLICT', (t) => {
  const fx = makeFixture(t);
  const manifest = writePlan(fx, 'jijiebei/conf', '20260823-120000');
  const mf = join(fx, 'manifest.json');
  writeFileSync(mf, JSON.stringify(manifest));
  assert.equal(runJson(fx, ['register', '--manifest', mf, '--json']).json.code, 'OK');

  const conflict = { ...manifest, title: '改了标题' };
  const mf2 = join(fx, 'manifest-conflict.json');
  writeFileSync(mf2, JSON.stringify(conflict));
  const res = runJson(fx, ['register', '--manifest', mf2, '--json']);
  assert.equal(res.status, 1);
  assert.equal(res.json.code, 'REGISTRATION_CONFLICT');
  assert.equal(logLines(fx).length, 1); // 未追加
  // 绿例对照：原 manifest 再次注册仍是 REPLAYED（幂等路径不受冲突污染）
  assert.equal(runJson(fx, ['register', '--manifest', mf, '--json']).json.code, 'REPLAYED');
});

// ───────────────────────────────────────────────────────────────────────────
// 4. 路径逃逸：../ / 绝对 / 错 slug / type-ext 不符 → PATH_ESCAPE / PATH_MISMATCH
// ───────────────────────────────────────────────────────────────────────────
test('T4 路径逃逸与模板不符分层报错', (t) => {
  const fx = makeFixture(t);
  const base = writePlan(fx, 'jijiebei/esc', '20260823-130000');
  const mf = (name, obj) => { const p = join(fx, name); writeFileSync(p, JSON.stringify(obj)); return p; };

  const dotdot = mf('m1.json', { ...base, path: '../evil.md' });
  assert.equal(runJson(fx, ['register', '--manifest', dotdot, '--json']).json.code, 'PATH_ESCAPE');

  const abs = mf('m2.json', { ...base, path: '/etc/passwd' });
  assert.equal(runJson(fx, ['register', '--manifest', abs, '--json']).json.code, 'PATH_ESCAPE');

  const wrongSlug = mf('m3.json', { ...base, path: 'docs/wiki/jijiebei/wrong/r20260823-130000.plan.html' });
  assert.equal(runJson(fx, ['register', '--manifest', wrongSlug, '--json']).json.code, 'PATH_MISMATCH');

  const wrongExt = mf('m4.json', { ...base, type: 'plan', path: 'docs/wiki/jijiebei/esc/r20260823-130000.plan.md' });
  const mdPath = join(fx, 'docs', 'wiki', 'jijiebei', 'esc', 'r20260823-130000.plan.md');
  mkdirSync(dirname(mdPath), { recursive: true });
  writeFileSync(mdPath, '<!--lm jijiebei/esc@r20260823-130000-->\n# x\n');
  assert.equal(runJson(fx, ['register', '--manifest', wrongExt, '--json']).json.code, 'PATH_MISMATCH');

  // symlink 逃逸：目标 symlink 指向 repo 外文件（/etc/hosts，macOS 恒存在）
  const linkRel = 'docs/wiki/jijiebei/esc/r20260823-130000.plan.html';
  rmSync(join(fx, linkRel), { force: true });
  symlinkSync('/etc/hosts', join(fx, linkRel));
  const slMf = mf('m5.json', { id: 'jijiebei/esc@r20260823-130000', path: linkRel, title: 'sym', type: 'plan' });
  assert.equal(runJson(fx, ['register', '--manifest', slMf, '--json']).json.code, 'PATH_ESCAPE');
});

// ───────────────────────────────────────────────────────────────────────────
// 5. source SHA 漂移：manifest 提供 SHA 与磁盘不符 → SOURCE_SHA_DRIFT
// ───────────────────────────────────────────────────────────────────────────
test('T5 source SHA 漂移 → SOURCE_SHA_DRIFT（红），提供正确 SHA 则绿', (t) => {
  const fx = makeFixture(t);
  const manifest = writePlan(fx, 'jijiebei/sha', '20260823-140000');
  const mf = join(fx, 'manifests', 'm.json');
  mkdirSync(dirname(mf), { recursive: true });

  // 红例：先算正确 SHA，改文件后再用旧 SHA 注册
  const correctSha = createHash('sha256').update(readFileSync(join(fx, manifest.path), 'utf8')).digest('hex');
  writeFileSync(mf, JSON.stringify({ ...manifest, source_sha256: correctSha }));
  // 改文件（再 append 一行）→ 磁盘 SHA 变化
  appendFileSync(join(fx, manifest.path), '<p>changed</p>\n');
  const drift = runJson(fx, ['register', '--manifest', mf, '--json']);
  assert.equal(drift.status, 1);
  assert.equal(drift.json.code, 'SOURCE_SHA_DRIFT');

  // 绿例：manifest 提供与磁盘一致 SHA 且缺省 source_sha256 两种都能过
  const fx2 = makeFixture(t);
  const m2 = writePlan(fx2, 'jijiebei/sha2', '20260823-140001');
  const sha2 = createHash('sha256').update(readFileSync(join(fx2, m2.path), 'utf8')).digest('hex');
  writeFileSync(join(fx2, 'm2.json'), JSON.stringify({ ...m2, source_sha256: sha2 }));
  assert.equal(runJson(fx2, ['register', '--manifest', join(fx2, 'm2.json'), '--json']).json.code, 'OK');
  assert.equal(runJson(fx2, ['register', '--manifest', join(fx2, 'm2.json'), '--json']).json.code, 'REPLAYED');
});

// ───────────────────────────────────────────────────────────────────────────
// 6. 非法 transition：手喂坏 lifecycle fixture → INVALID_TRANSITION，check fail
// ───────────────────────────────────────────────────────────────────────────
test('T6 非法 transition → INVALID_TRANSITION（红）；合法 promote 且同步 log.life 则绿', (t) => {
  // schema/CLI parity + 当前账兼容：直接读取两份 schema 与 live ledger，不复制第三真相。
  const repoRoot = join(HERE, '..', '..');
  const artifactSchema = JSON.parse(readFileSync(join(repoRoot, 'docs', 'wiki', 'schemas', 'artifact-record.schema.json'), 'utf8'));
  const lifecycleSchema = JSON.parse(readFileSync(join(repoRoot, 'docs', 'wiki', 'schemas', 'lifecycle-receipt.schema.json'), 'utf8'));
  const schemaEvents = lifecycleSchema.properties.event.enum;
  assert.deepEqual([...schemaEvents].sort(), Object.keys(TRANSITIONS).sort(), 'lifecycle schema event enum 必须与 CLI TRANSITIONS 同集');
  assert.deepEqual([...artifactSchema.properties.type.enum].sort(), [...DEFAULT_CONFIG.types].sort(), 'artifact schema type enum 必须与 CLI 同集');
  assert.deepEqual([...artifactSchema.properties.life.enum].sort(), [...DEFAULT_CONFIG.lifeValues].sort(), 'artifact schema life enum 必须与 CLI 同集');
  for (const mode of Object.keys(MODES)) {
    assert.ok(artifactSchema.description.includes(mode), `artifact schema description 必须说明 mode=${mode}`);
  }
  assert.match(artifactSchema.description, /(?:不带|无)\s*mode|legacy/i, 'artifact schema description 必须说明无 mode 的 legacy default');
  const currentLifecycle = readFileSync(join(repoRoot, 'docs', 'wiki', 'lifecycle.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  currentLifecycle.forEach((row, index) => {
    assert.ok(schemaEvents.includes(row.event), `当前 lifecycle 第 ${index + 1} 行 event=${row.event} 必须被 schema 接受`);
  });

  // 红例：register-flow 之后接 promote（knowledge→flow 回退，不在转换表）
  const fx = makeFixture(t);
  const manifest = writePlan(fx, 'jijiebei/trans', '20260823-150000');
  const mf = join(fx, 'm.json');
  writeFileSync(mf, JSON.stringify(manifest));
  assert.equal(runJson(fx, ['register', '--manifest', mf, '--json']).json.code, 'OK');
  appendFileSync(join(fx, 'docs', 'wiki', 'lifecycle.jsonl'),
    JSON.stringify({
      event_id: 'lce-ffffffffffffffffffff-2', object: manifest.id, from: { state: 'registered', life: 'knowledge' },
      to: { state: 'registered', life: 'flow' }, event: 'promote', actor: 'test', authority: 'fixture',
      evidence: [], actions: [], occurred_at: '2026-08-23T00:00:00.000Z',
    }) + '\n');
  const bad = runJson(fx, ['check', '--json']);
  assert.equal(bad.status, 1);
  assert.equal(bad.json.code, 'CHECK_FAILED');
  assert.ok(bad.json.errors.some((e) => e.includes('INVALID_TRANSITION') || e.includes('非法 transition')), bad.json.errors.join('|'));

  // 绿例：合法 promote（flow→knowledge）且同步 log.life=knowledge → check 绿
  const fx2 = makeFixture(t);
  const m2 = writePlan(fx2, 'jijiebei/trans2', '20260823-150001');
  writeFileSync(join(fx2, 'm2.json'), JSON.stringify(m2));
  assert.equal(runJson(fx2, ['register', '--manifest', join(fx2, 'm2.json'), '--json']).json.code, 'OK');
  appendFileSync(join(fx2, 'docs', 'wiki', 'lifecycle.jsonl'),
    JSON.stringify({
      event_id: 'lce-eeeeeeeeeeeeeeeeeeee-2', object: m2.id, from: { state: 'registered', life: 'flow' },
      to: { state: 'registered', life: 'knowledge' }, event: 'promote', actor: 'test', authority: 'fixture',
      evidence: [], actions: [], occurred_at: '2026-08-23T00:00:00.000Z',
    }) + '\n');
  // 同步 log.life（promote 事件产生方负责把 log 行 life 重算到折叠值——纪律见 docs/wiki/README）
  const logP = join(fx2, 'docs', 'wiki', 'log.jsonl');
  const rows = logLines(fx2).map((r) => (r.id === m2.id ? { ...r, life: 'knowledge' } : r));
  writeFileSync(logP, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const good = runJson(fx2, ['check', '--json']);
  assert.equal(good.status, 0, good.stdout);
  assert.equal(good.json.code, 'CHECK_OK');
});

// ───────────────────────────────────────────────────────────────────────────
// 7. 中断恢复：journal+staged 完整 → 续 rename；损坏 staged → RECOVERED_ABORTED 回滚
// ───────────────────────────────────────────────────────────────────────────
test('T7 中断恢复：staged 完整续 rename（绿）', (t) => {
  const fx = makeFixture(t);
  const manifest = writePlan(fx, 'jijiebei/rec', '20260823-160000');
  const manifest2 = writePlan(fx, 'jijiebei/rec2', '20260823-160001');
  const mf = join(fx, 'm.json');
  writeFileSync(mf, JSON.stringify(manifest2));

  // 手工伪造中断：journal 已写 + staged 完整（rename 未做），对应一次漏掉的 rec 注册
  const planAbs = join(fx, manifest.path);
  const recLog = {
    registration_id: 'reg-fake1', id: manifest.id, path: manifest.path, title: manifest.title,
    type: 'plan', life: 'flow', topic: 't', owner: 'tester', close_policy: '',
    canonical_targets: [], source_refs: [],
    source_sha256: createHash('sha256').update(readFileSync(planAbs, 'utf8')).digest('hex'),
    ts: '2026-08-23T00:00:00.000Z',
  };
  const recEv = {
    event_id: 'lce-aaaaaaaaaaaaaaaaaaaa-1', object: manifest.id, from: null,
    to: { state: 'registered', life: 'flow' }, event: 'register-flow', actor: 'cli', authority: 'contract',
    evidence: [], actions: [], occurred_at: '2026-08-23T00:00:00.000Z',
  };
  const sha = (s) => createHash('sha256').update(s).digest('hex');
  const logText = logLinesLike([recLog]);
  const lcText = logLinesLike([recEv]);
  const wikiDir = join(fx, 'docs', 'wiki');
  writeFileSync(join(wikiDir, '.registrar.journal.json'), JSON.stringify({
    txn_id: 'txn-fake', created_at: '2026-08-23T00:00:00.000Z',
    intent: {
      append_log_lines: [recLog], append_lifecycle_events: [recEv], base_log_sha256: null, base_lifecycle_sha256: null,
      expected_log_sha256: sha(logText), expected_lifecycle_sha256: sha(lcText),
    },
  }));
  writeFileSync(join(wikiDir, 'log.jsonl.new'), logText);
  writeFileSync(join(wikiDir, 'lifecycle.jsonl.new'), lcText);

  // 触发恢复 + 本次注册
  const res = runJson(fx, ['register', '--manifest', mf, '--json']);
  assert.equal(res.status, 0, res.stdout);
  assert.equal(res.json.recovered, 'resumed');
  assert.equal(logLines(fx).length, 2); // 恢复 1 + 本次 1
  assert.equal(runJson(fx, ['check', '--json']).json.code, 'CHECK_OK');
  assert.equal(existsSync(join(wikiDir, 'log.jsonl.new')), false, 'staged 应已清理');
  assert.equal(existsSync(join(wikiDir, '.registrar.journal.json')), false, 'journal 应已清理');
});

function logLinesLike(objs) {
  return objs.map((o) => `${stable(o)}\n`).join('');
}

test('T7b 中断恢复：损坏 staged → RECOVERED_ABORTED 回滚后继续，账本仅含本次注册', (t) => {
  const fx = makeFixture(t);
  const manifest = writePlan(fx, 'jijiebei/rec', '20260823-160000');
  const manifest2 = writePlan(fx, 'jijiebei/rec2', '20260823-160001');
  const mf = join(fx, 'm.json');
  writeFileSync(mf, JSON.stringify(manifest2));
  const wikiDir = join(fx, 'docs', 'wiki');
  const sha = (s) => createHash('sha256').update(s).digest('hex');
  const planAbs = join(fx, manifest.path);
  const recLog = {
    registration_id: 'reg-fake2', id: manifest.id, path: manifest.path, title: manifest.title,
    type: 'plan', life: 'flow', topic: 't', owner: 'tester', close_policy: '',
    canonical_targets: [], source_refs: [],
    source_sha256: createHash('sha256').update(readFileSync(planAbs, 'utf8')).digest('hex'),
    ts: '2026-08-23T00:00:00.000Z',
  };
  const recEv = {
    event_id: 'lce-bbbbbbbbbbbbbbbbbbbb-1', object: manifest.id, from: null,
    to: { state: 'registered', life: 'flow' }, event: 'register-flow', actor: 'cli', authority: 'contract',
    evidence: [], actions: [], occurred_at: '2026-08-23T00:00:00.000Z',
  };
  const logText = logLinesLike([recLog]);
  const badLcText = 'GARBAGE-NOT-JSON\n';
  writeFileSync(join(wikiDir, '.registrar.journal.json'), JSON.stringify({
    txn_id: 'txn-fake2', created_at: '2026-08-23T00:00:00.000Z',
    intent: {
      append_log_lines: [recLog], append_lifecycle_events: [recEv], base_log_sha256: null, base_lifecycle_sha256: null,
      expected_log_sha256: sha(logText), expected_lifecycle_sha256: sha('WRONG'),
    },
  }));
  writeFileSync(join(wikiDir, 'log.jsonl.new'), logText);
  writeFileSync(join(wikiDir, 'lifecycle.jsonl.new'), badLcText);

  const res = runJson(fx, ['register', '--manifest', mf, '--json']);
  assert.equal(res.status, 0, res.stdout);
  assert.equal(res.json.recovered, 'aborted');
  assert.equal(logLines(fx).length, 1); // 仅本次注册，garbage 已回滚
  assert.equal(lcLines(fx).length, 1);
  assert.equal(runJson(fx, ['check', '--json']).json.code, 'CHECK_OK');
  assert.equal(existsSync(join(wikiDir, 'log.jsonl.new')), false);
  assert.equal(existsSync(join(wikiDir, '.registrar.journal.json')), false);
});

test('T7c 只读命令在 journal 残留时 fail closed（NEEDS_RECOVERY）', (t) => {
  const fx = makeFixture(t);
  const wikiDir = join(fx, 'docs', 'wiki');
  mkdirSync(wikiDir, { recursive: true });
  writeFileSync(join(wikiDir, '.registrar.journal.json'), '{"txn_id":"orphan"}');
  const res = runJson(fx, ['check', '--json']);
  assert.equal(res.status, 1);
  assert.equal(res.json.code, 'NEEDS_RECOVERY');
});

// ───────────────────────────────────────────────────────────────────────────
// 8. bootstrap：fixture 3 篇导入 + 磁盘多余 → missing-disposition；SHA 漂移 → drift
// ───────────────────────────────────────────────────────────────────────────
test('T8 bootstrap 导入 + 双向对账（绿），多/漏与 SHA 漂移（红）', (t) => {
  const fx = makeFixture(t);
  execFileSync('git', ['-C', fx, 'init', '-q']); // coverage 基线 = git tracked（blocker 修复语义）
  mkdirSync(join(fx, 'docs'), { recursive: true });
  writeFileSync(join(fx, 'docs', 'a.md'), '---\ntitle: 甲文档\n---\n\n# 甲\n');
  writeFileSync(join(fx, 'docs', 'b.md'), '---\ntitle: 乙文档\n---\n\n# 乙\n');
  writeFileSync(join(fx, 'docs', 'c.md'), '---\ntitle: 丙文档\n---\n\n# 丙\n');
  execFileSync('git', ['-C', fx, 'add', 'docs/a.md', 'docs/b.md', 'docs/c.md']);
  const boot = {
    generated_at: '2026-08-23T00:00:00.000Z',
    coverage: ['docs/*.md'],
    items: [
      { path: 'docs/a.md', id: 'jijiebei/a@r20260823-000000', type: 'report', life: 'flow', disposition: 'current', reason: 't' },
      { path: 'docs/b.md', id: 'jijiebei/b@r20260823-000000', type: 'report', life: 'flow', disposition: 'current', reason: 't' },
      { path: 'docs/c.md', id: 'jijiebei/c@r20260823-000000', type: 'digest', life: 'knowledge', disposition: 'current', reason: 't' },
    ],
  };
  const wikiDir = join(fx, 'docs', 'wiki');
  mkdirSync(wikiDir, { recursive: true });
  const bootPath = join(wikiDir, 'bootstrap.json');
  writeFileSync(bootPath, JSON.stringify(boot));

  const ok = runJson(fx, ['bootstrap', '--manifest', bootPath, '--json']);
  assert.equal(ok.status, 0, ok.stdout);
  assert.equal(ok.json.code, 'OK');
  assert.equal(ok.json.counts.inserted, 3);
  const log = logLines(fx);
  assert.equal(log.length, 3);
  assert.ok(log.every((r) => String(r.registration_id).startsWith('boot-')));
  assert.equal(log.find((r) => r.id === 'jijiebei/a@r20260823-000000').title, '甲文档'); // front matter title 解析
  const lc = lcLines(fx);
  assert.equal(lc.length, 3);
  assert.ok(lc.every((e) => e.event === 'bootstrap-import' && e.from === null));

  // 绿：check 双向一致 + 幂等 bootstrap REPLAYED
  assert.equal(runJson(fx, ['check', '--json']).json.code, 'CHECK_OK');
  const replay = runJson(fx, ['bootstrap', '--manifest', bootPath, '--json']);
  assert.equal(replay.json.code, 'REPLAYED');

  // 红：新 tracked 一篇未登记 → MISSING_DISPOSITION（blocker 修复语义：tracked 才进 coverage）
  writeFileSync(join(fx, 'docs', 'd.md'), '---\ntitle: 丁文档\n---\n\n# 丁\n');
  execFileSync('git', ['-C', fx, 'add', 'docs/d.md']);
  const miss = runJson(fx, ['check', '--json']);
  assert.equal(miss.status, 1);
  assert.ok(miss.json.errors.some((e) => e.includes('MISSING_DISPOSITION')), miss.json.errors.join('|'));

  // 红：改 c.md → SOURCE_SHA_DRIFT
  rmSync(join(fx, 'docs', 'd.md'), { force: true });
  appendFileSync(join(fx, 'docs', 'c.md'), 'changed\n');
  const drift = runJson(fx, ['check', '--json']);
  assert.equal(drift.status, 1);
  assert.ok(drift.json.errors.some((e) => e.includes('SOURCE_SHA_DRIFT')), drift.json.errors.join('|'));
});

// ───────────────────────────────────────────────────────────────────────────
// 9. lm 标记：plan/decision 必须首行 <!--lm id-->；report/digest 免检
// ───────────────────────────────────────────────────────────────────────────
test('T9 plan 缺 lm 标记或与 id 不符 → LM_MARKER_MISSING；report(md) 免检', (t) => {
  const fx = makeFixture(t);
  const noMarker = writePlan(fx, 'jijiebei/nomark', '20260823-170000', { lm: '<h1>no marker</h1>' });
  const mf1 = join(fx, 'm1.json');
  writeFileSync(mf1, JSON.stringify(noMarker));
  const r1 = runJson(fx, ['register', '--manifest', mf1, '--json']);
  assert.equal(r1.status, 1);
  assert.equal(r1.json.code, 'LM_MARKER_MISSING');

  const wrongMarker = writePlan(fx, 'jijiebei/wrongmark', '20260823-170001', { lm: '<!--lm jijiebei/other@r00000000-000000-->' });
  const mf2 = join(fx, 'm2.json');
  writeFileSync(mf2, JSON.stringify(wrongMarker));
  const r2 = runJson(fx, ['register', '--manifest', mf2, '--json']);
  assert.equal(r2.status, 1);
  assert.equal(r2.json.code, 'LM_MARKER_MISSING');

  // 绿：report（md，无 lm 要求）
  const repDir = join(fx, 'docs', 'wiki', 'jijiebei', 'rep');
  mkdirSync(repDir, { recursive: true });
  const repPath = `docs/wiki/jijiebei/rep/r20260823-170002.report.md`;
  writeFileSync(join(fx, repPath), '# 调研报告\n');
  const repMf = join(fx, 'm3.json');
  writeFileSync(repMf, JSON.stringify({ id: 'jijiebei/rep@r20260823-170002', path: repPath, title: '调研', type: 'report', topic: 't', owner: 'tester' }));
  const r3 = runJson(fx, ['register', '--manifest', repMf, '--json']);
  assert.equal(r3.status, 0, r3.stdout);
  assert.equal(r3.json.code, 'OK');
  assert.equal(logLines(fx).find((r) => r.id === 'jijiebei/rep@r20260823-170002').life, 'knowledge'); // report ⇒ knowledge
});

// ───────────────────────────────────────────────────────────────────────────
// 10. 零态重建：空 log/lifecycle 起步 → check 绿，build-context 空 entries
// ───────────────────────────────────────────────────────────────────────────
test('T10 零态起步：check 从空账重建并绿；build-context 空；query NOT_FOUND', (t) => {
  const fx = makeFixture(t);
  // 完全空 fixture（无 docs/wiki 目录/文件）
  const chk = runJson(fx, ['check', '--json']);
  assert.equal(chk.status, 0, chk.stdout);
  assert.equal(chk.json.code, 'CHECK_OK');
  assert.equal(chk.json.counts.log_lines, 0);
  assert.equal(chk.json.counts.objects, 0);

  const ctx = runJson(fx, ['build-context', '--json']);
  assert.equal(ctx.status, 0, ctx.stdout);
  assert.equal(ctx.json.counts.entries, 0);
  assert.ok(existsSync(join(fx, 'docs', '.context-manifest.json')));

  const q = runJson(fx, ['query', 'jijiebei/none', '--json']);
  assert.equal(q.status, 1);
  assert.equal(q.json.code, 'NOT_FOUND');
});

// ───────────────────────────────────────────────────────────────────────────
// 11. coverage 语义（Alioth v2 blocker 修复）：基线 = git tracked ∩ globs ∪ 显式声明 ∩ globs
//     ignored（node_modules/design inputs/harness runtime）与未声明 untracked 一律不进 coverage
// ───────────────────────────────────────────────────────────────────────────
test('T11 coverage：register path 可作 disposition（绿）；仅 tracked 未登记仍检出（红）', (t) => {
  const fx = makeFixture(t);
  execFileSync('git', ['-C', fx, 'init', '-q']);
  // tracked 基线：一篇已登记；ignored 面全部不 git add
  mkdirSync(join(fx, 'docs'), { recursive: true });
  writeFileSync(join(fx, 'docs', 'gov.md'), '---\ntitle: 治理\n---\n\n# 治理\n');
  execFileSync('git', ['-C', fx, 'add', 'docs/gov.md']);
  mkdirSync(join(fx, 'web', 'node_modules', 'pkg'), { recursive: true });
  writeFileSync(join(fx, 'web', 'node_modules', 'pkg', 'README.md'), '# dep\n');
  mkdirSync(join(fx, 'design', 'inputs'), { recursive: true });
  writeFileSync(join(fx, 'design', 'inputs', 'poster.md'), '# poster\n');
  const runtimeDir = join(fx, '.harness-runtime-fake');
  mkdirSync(runtimeDir, { recursive: true });
  writeFileSync(join(runtimeDir, 'progress.md'), '# runtime\n');
  writeFileSync(join(fx, 'docs', 'untracked-note.md'), '# 未声明 untracked\n'); // untracked 且不在 items
  const boot = {
    generated_at: '2026-08-23T00:00:00.000Z',
    coverage: ['docs/**/*.md', 'web/**/*.md', 'design/**/*.md'],
    items: [
      { path: 'docs/gov.md', id: 'jijiebei/gov@r20260823-000000', type: 'report', life: 'knowledge', disposition: 'current', reason: 't' },
    ],
  };
  const wikiDir = join(fx, 'docs', 'wiki');
  mkdirSync(wikiDir, { recursive: true });
  const bootPath = join(wikiDir, 'bootstrap.json');
  writeFileSync(bootPath, JSON.stringify(boot));
  const imp = runJson(fx, ['bootstrap', '--manifest', bootPath, '--json']);
  assert.equal(imp.status, 0, imp.stdout); // items 先落账（check 对账前提）

  // 绿：ignored/untracked 不产生 MISSING_DISPOSITION；coverage_files 只数 tracked∩globs（=1）
  const g = runJson(fx, ['check', '--json']);
  assert.equal(g.status, 0, g.stdout);
  assert.equal(g.json.code, 'CHECK_OK');
  assert.equal(g.json.counts.coverage_files, 1);
  assert.ok(!g.json.errors.some((e) => e.includes('node_modules')), 'node_modules 不得进 coverage');
  assert.ok(!g.json.errors.some((e) => e.includes('inputs')), 'design inputs 不得进 coverage');
  assert.ok(!g.json.errors.some((e) => e.includes('runtime')), 'harness runtime md 不得进 coverage');

  // 绿：先经 registrar register 的 Markdown，进入 fixture 自己的 git index 后已有 log disposition。
  const registeredPath = 'docs/wiki/jijiebei/t11-registered/r20260823-000001.report.md';
  mkdirSync(dirname(join(fx, registeredPath)), { recursive: true });
  writeFileSync(join(fx, registeredPath), '# T11 registered report\n');
  const registeredManifest = join(fx, 't11-register.json');
  writeFileSync(registeredManifest, JSON.stringify({
    mode: 'report-validating',
    id: 'jijiebei/t11-registered@r20260823-000001',
    path: registeredPath,
    title: 'T11 registered report',
    topic: 'test',
    owner: 'tester',
    close_policy: 'fixture',
    evidence: ['test:T11'],
    actor: 'test',
    authority: 'fixture',
  }));
  const reg = runJson(fx, ['register', '--manifest', registeredManifest, '--json']);
  assert.equal(reg.status, 0, reg.stdout);
  assert.equal(reg.json.code, 'OK');
  execFileSync('git', ['-C', fx, 'add', registeredPath]);
  const registered = runJson(fx, ['check', '--json']);
  assert.equal(registered.status, 0, registered.stdout);
  assert.equal(registered.json.code, 'CHECK_OK');
  assert.equal(registered.json.counts.coverage_files, 2);

  // 红：另一个只 git add、未 bootstrap/register 的文件 → MISSING_DISPOSITION
  execFileSync('git', ['-C', fx, 'add', 'docs/untracked-note.md']);
  const r = runJson(fx, ['check', '--json']);
  assert.equal(r.status, 1);
  assert.ok(r.json.errors.some((e) => e.includes('MISSING_DISPOSITION: 磁盘有 docs/untracked-note.md')), r.json.errors.join('|'));

  // 红：仅破坏隔离 fixture 的 .git，让 git ls-files 必然失败；真实仓 index 零接触。
  rmSync(join(fx, '.git'), { recursive: true, force: true });
  const gitEnumerationFailure = runJson(fx, ['check', '--json']);
  assert.equal(gitEnumerationFailure.status, 2, gitEnumerationFailure.stdout);
  assert.equal(gitEnumerationFailure.json.code, 'FATAL_CONFIG');
  assert.ok(gitEnumerationFailure.json.errors.some((e) => e.includes('git ls-files')));
});

// ───────────────────────────────────────────────────────────────────────────
// 12. 真实双进程并发（gen3 A3#3）：两进程同时 register，恰一个成功、另一个 LOCKED；
//     账本收敛无半写/重复
// ───────────────────────────────────────────────────────────────────────────
test('T12 真实双进程并发注册：恰好一个 OK，另一个 LOCKED，账本收敛', async (t) => {
  const fx = makeFixture(t);
  const writeMf = (slug, ts, name) => {
    const manifest = writePlan(fx, slug, ts);
    const p = join(fx, name);
    writeFileSync(p, JSON.stringify(manifest));
    return p;
  };
  const mfA = writeMf('jijiebei/race-a', '20260823-180000', 'ma.json');
  const mfB = writeMf('jijiebei/race-b', '20260823-180001', 'mb.json');
  // wrapper（CommonJS -e）：两个真实进程先各写 ready，再等待各自 start 信号。
  // 仅 A patch fs：O_EXCL 创建并完整写入锁后发 lock-ready，再同步持锁 400ms；
  // 父进程看到 lock-ready 才放行未 patch 的 B，确保 B 读取完整 fresh payload → LOCKED。
  const W = [
    `const fs = require('fs');`,
    `const moduleBuiltin = require('node:module');`,
    `const { pathToFileURL } = require('url');`,
    `const [node0, role, readyFile, startFile, lockReadyFile, cli, ...args] = process.argv;`,
    `if (role === 'A') {`,
    `  const originalWriteFileSync = fs.writeFileSync;`,
    `  const lockHold = new Int32Array(new SharedArrayBuffer(4));`,
    `  fs.writeFileSync = function patchedWriteFileSync(file, data, options) {`,
    `    const result = originalWriteFileSync(file, data, options);`,
    `    const flag = typeof options === 'string' ? options : options && options.flag;`,
    `    if (String(file).endsWith('/.registrar.lock') && flag === 'wx') {`,
    `      originalWriteFileSync(lockReadyFile, String(process.pid));`,
    `      Atomics.wait(lockHold, 0, 0, 400);`,
    `    }`,
    `    return result;`,
    `  };`,
    `  moduleBuiltin.syncBuiltinESMExports();`,
    `}`,
    `fs.writeFileSync(readyFile, String(process.pid));`,
    `const t0 = Date.now();`,
    `while (!fs.existsSync(startFile)) {`,
    `  if (Date.now() - t0 > 15000) { console.error('TIME_OUT'); process.exit(3); }`,
    `  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2);`,
    `}`,
    `import(pathToFileURL(cli).href).then((m) => {`,
    `  process.argv = [node0, cli, ...args];`,
    `  m.main();`,
    `}).catch((e) => { console.error('WRAP_ERR ' + (e && e.stack || e)); process.exit(4); });`,
  ].join('\n');
  const readyA = join(fx, 'ready-a');
  const readyB = join(fx, 'ready-b');
  const startA = join(fx, 'start-a');
  const startB = join(fx, 'start-b');
  const lockReady = join(fx, 'lock-ready');
  const spawnCli = (role, ready, start, mf) => spawn(process.execPath,
    ['-e', W, role, ready, start, lockReady, CLI, 'register', '--manifest', mf, '--json', '--repo-root', fx],
    { stdio: ['ignore', 'pipe', 'pipe'] });
  const pA = spawnCli('A', readyA, startA, mfA);
  const pB = spawnCli('B', readyB, startB, mfB);
  const waitReady = (f, maxMs) => new Promise((res) => {
    const s = Date.now();
    const iv = setInterval(() => {
      if (existsSync(f) || Date.now() - s > maxMs) { clearInterval(iv); res(); }
    }, 5);
  });
  await waitReady(readyA, 10000);
  await waitReady(readyB, 10000);
  assert.equal(existsSync(readyA), true, 'A 应在放行前 ready');
  assert.equal(existsSync(readyB), true, 'B 应在放行前 ready');
  writeFileSync(startA, 'go');
  await waitReady(lockReady, 10000);
  assert.equal(existsSync(lockReady), true, 'A 应在完整写锁后发 lock-ready');
  writeFileSync(startB, 'go');
  const collect = (p) => new Promise((res) => {
    let out = '';
    p.stdout.on('data', (d) => { out += String(d); });
    p.stderr.on('data', (d) => { out += String(d); });
    p.on('exit', (code) => res({ code, out }));
  });
  const [rA, rB] = await Promise.all([collect(pA), collect(pB)]);
  const parseJson = (r) => {
    const last = r.out.trim().split('\n').filter(Boolean).pop() || '';
    try { return JSON.parse(last); } catch { return null; }
  };
  const jA = parseJson(rA), jB = parseJson(rB);
  const okCount = [jA, jB].filter((j) => j && j.code === 'OK').length;
  assert.equal(okCount, 1, `期望恰一个 OK；A exit=${rA.code} code=${jA && jA.code} out=${rA.out.slice(0, 120)}; B exit=${rB.code} code=${jB && jB.code} out=${rB.out.slice(0, 120)}`);
  const loser = jA && jA.code === 'OK' ? jB : jA;
  assert.equal(loser && loser.code, 'LOCKED',
    `同帧竞争失败方应精确为 LOCKED，实际 ${loser && loser.code}`);
  // 账本收敛：两对象中恰一个落账，无半写/无重复
  const lines = logLines(fx);
  assert.equal(lines.length, 1, `账本应恰 1 行，实际 ${lines.length}`);
  assert.equal(runJson(fx, ['check', '--json']).json.code, 'CHECK_OK');
  assert.equal(existsSync(join(fx, 'docs', 'wiki', '.registrar.lock')), false, '锁应已释放');
});

// ───────────────────────────────────────────────────────────────────────────
// 13. stale-holder / stale fail-closed / old-holder release（gen3 A3#1/#3）
// ───────────────────────────────────────────────────────────────────────────
test('T13 stale-holder：锁未过期时第二写者不接管（LOCKED 且锁内容原样）', (t) => {
  const fx = makeFixture(t);
  const manifest = writePlan(fx, 'jijiebei/holder', '20260823-181000');
  const mf = join(fx, 'm.json');
  writeFileSync(mf, JSON.stringify(manifest));
  const wikiDir = join(fx, 'docs', 'wiki');
  mkdirSync(wikiDir, { recursive: true });
  writeFileSync(join(wikiDir, '.registrar.lock'), JSON.stringify({ pid: 99999, ts: new Date().toISOString(), token: 'deadbeef1234' }));
  const res = runJson(fx, ['register', '--manifest', mf, '--json']);
  assert.equal(res.status, 1);
  assert.equal(res.json.code, 'LOCKED');
  const cur = JSON.parse(readFileSync(join(wikiDir, '.registrar.lock'), 'utf8'));
  assert.equal(cur.token, 'deadbeef1234'); // 锁未被接管/覆盖
  assert.equal(logLines(fx).length, 0);    // 未产生任何写
});

test('T13b stale 锁 fail closed：超时锁不自动接管 → STALE_LOCK（含 holder 与恢复指引）', (t) => {
  const fx = makeFixture(t);
  const manifest = writePlan(fx, 'jijiebei/stale', '20260823-181100');
  const mf = join(fx, 'm.json');
  writeFileSync(mf, JSON.stringify(manifest));
  const wikiDir = join(fx, 'docs', 'wiki');
  mkdirSync(wikiDir, { recursive: true });
  const staleTs = new Date(Date.now() - 121000).toISOString();
  writeFileSync(join(wikiDir, '.registrar.lock'), JSON.stringify({ pid: 77777, ts: staleTs, token: 'stalef00d001' }));
  const res = runJson(fx, ['register', '--manifest', mf, '--json']);
  assert.equal(res.status, 1);
  assert.equal(res.json.code, 'STALE_LOCK');
  assert.ok(res.json.errors.some((e) => e.includes('pid=77777') || e.includes('stale')), res.json.errors.join('|'));
  assert.ok(res.json.errors.some((e) => e.includes('删除') || e.includes('STALE_LOCK')), '错误信息应含人工恢复指引');
  const cur = JSON.parse(readFileSync(join(wikiDir, '.registrar.lock'), 'utf8'));
  assert.equal(cur.token, 'stalef00d001'); // fail closed：锁未被覆盖
});

test('T13c old-holder release：持有者事务完成后锁释放，后续写者可正常获取', (t) => {
  const fx = makeFixture(t);
  const m1 = writePlan(fx, 'jijiebei/rel1', '20260823-182000');
  const m2 = writePlan(fx, 'jijiebei/rel2', '20260823-182001');
  const mf1 = join(fx, 'm1.json');
  const mf2 = join(fx, 'm2.json');
  writeFileSync(mf1, JSON.stringify(m1));
  writeFileSync(mf2, JSON.stringify(m2));
  assert.equal(runJson(fx, ['register', '--manifest', mf1, '--json']).json.code, 'OK');
  assert.equal(existsSync(join(fx, 'docs', 'wiki', '.registrar.lock')), false, '事务完成后锁应已释放');
  assert.equal(runJson(fx, ['register', '--manifest', mf2, '--json']).json.code, 'OK'); // 后续写者可复用锁
  assert.equal(logLines(fx).length, 2);
  assert.equal(runJson(fx, ['check', '--json']).json.code, 'CHECK_OK');
});

// ───────────────────────────────────────────────────────────────────────────
// 14. base-hash drift（gen3 A3#2/#3）：journal 记录后账本被外部改动 → BASE_STATE_CHANGED
//     中止且不半写
// ───────────────────────────────────────────────────────────────────────────
test('T14 base-hash drift：journal 记录后账被外部改动 → BASE_STATE_CHANGED 中止不半写', (t) => {
  const fx = makeFixture(t);
  const base = writePlan(fx, 'jijiebei/drift-base', '20260823-183000');
  const mf = join(fx, 'm.json');
  writeFileSync(mf, JSON.stringify(base));
  assert.equal(runJson(fx, ['register', '--manifest', mf, '--json']).json.code, 'OK');
  const wikiDir = join(fx, 'docs', 'wiki');
  const logP = join(wikiDir, 'log.jsonl');
  const lcP = join(wikiDir, 'lifecycle.jsonl');
  const sha = (s) => createHash('sha256').update(s).digest('hex');
  const baseLog = sha(readFileSync(logP, 'utf8'));
  const baseLc = sha(readFileSync(lcP, 'utf8'));
  // 伪造对第二对象的待提交事务：journal 记录 base = 当前实账
  const txn = writePlan(fx, 'jijiebei/drift-txn', '20260823-183001');
  const txnRow = {
    registration_id: 'reg-fakedrift', id: txn.id, path: txn.path, title: txn.title,
    type: 'plan', life: 'flow', topic: 't', owner: 'tester', close_policy: '',
    canonical_targets: [], source_refs: [],
    source_sha256: createHash('sha256').update(readFileSync(join(fx, txn.path), 'utf8')).digest('hex'),
    ts: '2026-08-23T00:00:00.000Z',
  };
  const txnEv = {
    event_id: 'lce-cccccccccccccccccccc-2', object: txn.id, from: null,
    to: { state: 'registered', life: 'flow' }, event: 'register-flow', actor: 'cli', authority: 'contract',
    evidence: [], actions: [], occurred_at: '2026-08-23T00:00:00.000Z',
  };
  const expLog = sha(`${stable(txnRow)}\n${readFileSync(logP, 'utf8')}`);
  const expLc = sha(`${stable(txnEv)}\n${readFileSync(lcP, 'utf8')}`);
  writeFileSync(join(wikiDir, '.registrar.journal.json'), JSON.stringify({
    txn_id: 'txn-drift', created_at: '2026-08-23T00:00:00.000Z',
    intent: {
      append_log_lines: [txnRow], append_lifecycle_events: [txnEv],
      base_log_sha256: baseLog, base_lifecycle_sha256: baseLc,
      expected_log_sha256: expLog, expected_lifecycle_sha256: expLc,
    },
  }));
  // 外部改动：绕过 registrar 直接往 log 追加一行（模拟外部写入）
  appendFileSync(logP, '{ "external": true, "n": 1 }\n');
  const res = runJson(fx, ['register', '--manifest', mf, '--json']);
  assert.equal(res.status, 1);
  assert.equal(res.json.code, 'BASE_STATE_CHANGED');
  // 账本未被半写：base 1 行 + 外部 1 行 = 2；lifecycle 未被动
  assert.equal(logLines(fx).length, 2);
  assert.equal(existsSync(join(wikiDir, '.registrar.lock')), false, '失败后锁应已释放');
  assert.equal(lcLines(fx).length, 1);
});

// ───────────────────────────────────────────────────────────────────────────
// 15. mode 矩阵（gen3 A3#5/#7）：mode 决定 type/life；矛盾 life INVALID_INPUT；
//     knowledge-current 指向既有 canonical path
// ───────────────────────────────────────────────────────────────────────────
test('T15 mode 矩阵：mode 决定 type/life；矛盾 life INVALID_INPUT；knowledge-current 既有 canonical 校验', (t) => {
  const fx = makeFixture(t);
  const wikiDir = join(fx, 'docs', 'wiki');
  mkdirSync(wikiDir, { recursive: true });
  mkdirSync(join(fx, 'docs'), { recursive: true });
  writeFileSync(join(fx, 'docs', 'potato.md'), '# 土豆 canonical 原稿\n'); // 既有 canonical 原稿（磁盘存在）

  const mkPath = (slug, ts, type) => {
    const d = join(wikiDir, 'jijiebei', slug);
    mkdirSync(d, { recursive: true });
    const rel = `docs/wiki/jijiebei/${slug}/r${ts}.${type}${type === 'plan' || type === 'decision' ? '.html' : '.md'}`;
    const abs = join(fx, rel);
    writeFileSync(abs, (type === 'plan' || type === 'decision') ? `<!--lm jijiebei/${slug}@r${ts}-->\n<!doctype html><html></html>\n` : `# ${slug}\n`);
    return rel;
  };
  const reg = (obj, name) => {
    const p = join(fx, name);
    writeFileSync(p, JSON.stringify(obj));
    return runJson(fx, ['register', '--manifest', p, '--json']);
  };

  // plan-active：type=plan / life=flow
  const p1 = mkPath('modes-plan', '20260823-190000', 'plan');
  const r1 = reg({ id: 'jijiebei/modes-plan@r20260823-190000', path: p1, title: '计划', mode: 'plan-active' }, 'm1.json');
  assert.equal(r1.status, 0, r1.stdout);
  assert.equal(r1.json.code, 'OK');
  assert.equal(logLines(fx)[0].life, 'flow');
  assert.equal(lcLines(fx)[0].event, 'register-flow');

  // report-validating：type=report / life=flow（report 默认 knowledge 但 mode 强制 flow）
  const p2 = mkPath('modes-report', '20260823-190001', 'report');
  const r2 = reg({ id: 'jijiebei/modes-report@r20260823-190001', path: p2, title: '报告', mode: 'report-validating' }, 'm2.json');
  assert.equal(r2.json.code, 'OK');
  const row2 = logLines(fx).find((r) => r.id === 'jijiebei/modes-report@r20260823-190001');
  assert.equal(row2.life, 'flow');

  // digest-active：type=digest / life=flow
  const p3 = mkPath('modes-digest', '20260823-190002', 'digest');
  const r3 = reg({ id: 'jijiebei/modes-digest@r20260823-190002', path: p3, title: '摘要', mode: 'digest-active' }, 'm3.json');
  assert.equal(r3.json.code, 'OK');
  assert.equal(logLines(fx).find((r) => r.id === 'jijiebei/modes-digest@r20260823-190002').life, 'flow');

  // 红例 1：mode=plan-active + 手设 life=knowledge → INVALID_INPUT（矛盾 life）
  const p4 = mkPath('modes-bad1', '20260823-190003', 'plan');
  const badLife = reg({ id: 'jijiebei/modes-bad1@r20260823-190003', path: p4, title: 'x', mode: 'plan-active', life: 'knowledge' }, 'm4.json');
  assert.equal(badLife.status, 1);
  assert.equal(badLife.json.code, 'INVALID_INPUT');

  // 红例 2：mode=decision-open + 显式 type=report → INVALID_INPUT（mode 决定 type）
  const p5 = mkPath('modes-bad2', '20260823-190004', 'report');
  const badType = reg({ id: 'jijiebei/modes-bad2@r20260823-190004', path: p5, title: 'x', mode: 'decision-open', type: 'report' }, 'm5.json');
  assert.equal(badType.status, 1);
  assert.equal(badType.json.code, 'INVALID_INPUT');

  // 红例 3：未知 mode → INVALID_INPUT
  const p6 = mkPath('modes-bad3', '20260823-190005', 'plan');
  const badMode = reg({ id: 'jijiebei/modes-bad3@r20260823-190005', path: p6, title: 'x', mode: 'nope-mode' }, 'm6.json');
  assert.equal(badMode.status, 1);
  assert.equal(badMode.json.code, 'INVALID_INPUT');

  // knowledge-current：type=report/life=knowledge，canonical_targets 指向磁盘既有 docs/potato.md → OK
  const p7 = mkPath('potato-current', '20260823-190006', 'report');
  const kcGood = reg({
    id: 'jijiebei/potato-current@r20260823-190006', path: p7, title: '土豆现行知识', mode: 'knowledge-current',
    canonical_targets: ['docs/potato.md'],
  }, 'm7.json');
  assert.equal(kcGood.status, 0, kcGood.stdout);
  const row7 = logLines(fx).find((r) => r.id === 'jijiebei/potato-current@r20260823-190006');
  assert.equal(row7.life, 'knowledge');
  assert.equal(lcLines(fx).find((e) => e.object === row7.id).event, 'register-knowledge');

  // 红例 4：knowledge-current 未指向既有 canonical（目标不存在、非磁盘、非被引用）→ INVALID_INPUT
  const p8 = mkPath('potato-bad', '20260823-190007', 'report');
  const kcBad = reg({
    id: 'jijiebei/potato-bad@r20260823-190007', path: p8, title: 'x', mode: 'knowledge-current',
    canonical_targets: ['docs/no-such-file.md'],
  }, 'm8.json');
  assert.equal(kcBad.status, 1);
  assert.equal(kcBad.json.code, 'INVALID_INPUT');

  // archive-import：type 不固定（由 manifest 提供），life 强制 archive；lifecycle 事件 register-archive
  const p9 = mkPath('legacy-plan', '20260823-190008', 'plan');
  const ar = reg({ id: 'jijiebei/legacy-plan@r20260823-190008', path: p9, title: '历史原稿', type: 'plan', mode: 'archive-import' }, 'm9.json');
  assert.equal(ar.status, 0, ar.stdout);
  const row9 = logLines(fx).find((r) => r.id === 'jijiebei/legacy-plan@r20260823-190008');
  assert.equal(row9.life, 'archive');
  assert.equal(lcLines(fx).find((e) => e.object === row9.id).event, 'register-archive');
  // 红例：archive-import + life=flow → INVALID_INPUT
  const p10 = mkPath('legacy-bad', '20260823-190009', 'digest');
  const arBad = reg({ id: 'jijiebei/legacy-bad@r20260823-190009', path: p10, title: 'x', mode: 'archive-import', life: 'flow' }, 'm10.json');
  assert.equal(arBad.status, 1);
  assert.equal(arBad.json.code, 'INVALID_INPUT');

  // 全程 check 绿（无非法 transition 混入）
  const chk = runJson(fx, ['check', '--json']);
  assert.equal(chk.status, 0, chk.stdout);
  assert.equal(chk.json.code, 'CHECK_OK');
});

// ───────────────────────────────────────────────────────────────────────────
// 16. transition（gen3 A3#6）：correct-life / archive 事务性修正 log.life；非法 fail closed
// ───────────────────────────────────────────────────────────────────────────
test('T16 transition：correct-life（knowledge→flow）+ archive 事务修正；非法 INVALID_TRANSITION', (t) => {
  const fx = makeFixture(t);
  const wikiDir = join(fx, 'docs', 'wiki');
  mkdirSync(wikiDir, { recursive: true });
  const mkMf = (slug, ts, type) => {
    const dir = join(wikiDir, 'jijiebei', slug);
    mkdirSync(dir, { recursive: true });
    const rel = `docs/wiki/jijiebei/${slug}/r${ts}.${type}${type === 'plan' || type === 'decision' ? '.html' : '.md'}`;
    const abs = join(fx, rel);
    writeFileSync(abs, type === 'plan' || type === 'decision' ? `<!--lm jijiebei/${slug}@r${ts}-->\n<html></html>\n` : `# ${slug}\n`);
    const mf = join(fx, `tm-${slug}.json`);
    writeFileSync(mf, JSON.stringify({ id: `jijiebei/${slug}@r${ts}`, path: rel, title: slug, type }));
    return mf;
  };
  const trans = (id, event, evidence, extra = {}) => {
    const p = join(fx, `tx-${event}-${extra.i || 'x'}.json`);
    writeFileSync(p, JSON.stringify({ id, event, evidence, ...extra }));
    return runJson(fx, ['transition', '--manifest', p, '--json']);
  };

  // digest 注册 → knowledge；correct-life → flow（log.life 同步 + lifecycle 事件 + check 绿）
  const digestMf = mkMf('digest-fix', '20260823-191000', 'digest');
  assert.equal(runJson(fx, ['register', '--manifest', digestMf, '--json']).json.code, 'OK');
  const digestId = 'jijiebei/digest-fix@r20260823-191000';
  assert.equal(logLines(fx).find((r) => r.id === digestId).life, 'knowledge');
  const r1 = trans(digestId, 'correct-life', ['digest 误记 knowledge，订正为 flow'], { actor: 'subhub', authority: 'correction-g3', i: 1 });
  assert.equal(r1.status, 0, r1.stdout);
  assert.equal(r1.json.code, 'OK');
  assert.equal(r1.json.counts.life, 'flow');
  const logRow = logLines(fx).find((r) => r.id === digestId);
  assert.equal(logRow.life, 'flow'); // log.life 已重算为折叠值
  const ev = lcLines(fx).filter((e) => e.object === digestId);
  assert.equal(ev.length, 2);
  assert.equal(ev[1].event, 'correct-life');
  assert.equal(ev[1].to.life, 'flow');
  assert.equal(runJson(fx, ['check', '--json']).json.code, 'CHECK_OK');

  // plan 注册 flow → archive（life=archive、state=archived）
  const planMf = mkMf('legacy-arch', '20260823-191001', 'plan');
  assert.equal(runJson(fx, ['register', '--manifest', planMf, '--json']).json.code, 'OK');
  const planId = 'jijiebei/legacy-arch@r20260823-191001';
  const r2 = trans(planId, 'archive', ['历史原稿 revision 归档'], { i: 2 });
  assert.equal(r2.status, 0, r2.stdout);
  assert.equal(logLines(fx).find((r) => r.id === planId).life, 'archive');
  assert.equal(lcLines(fx).filter((e) => e.object === planId).pop().to.state, 'archived');
  assert.equal(runJson(fx, ['check', '--json']).json.code, 'CHECK_OK');

  // 非法 1：correct-life 用于 flow 对象（非 knowledge）→ INVALID_TRANSITION
  const bad1 = trans(planId, 'correct-life', ['x'], { i: 3 });
  assert.equal(bad1.status, 1);
  assert.equal(bad1.json.code, 'INVALID_TRANSITION');
  // 非法 2：白名单外事件 → INVALID_TRANSITION
  const bad2 = trans(digestId, 'promote', ['x'], { i: 4 });
  assert.equal(bad2.status, 1);
  assert.equal(bad2.json.code, 'INVALID_TRANSITION');
  // 非法 3：不存在的对象 → NOT_FOUND
  const bad3 = trans('jijiebei/nope@r20260823-000000', 'archive', ['x'], { i: 5 });
  assert.equal(bad3.status, 1);
  assert.equal(bad3.json.code, 'NOT_FOUND');
  // 账本未被非法尝试污染
  assert.equal(runJson(fx, ['check', '--json']).json.code, 'CHECK_OK');
});

// ───────────────────────────────────────────────────────────────────────────
// 17. 源码零 NUL（gen3 A3#4）+ countTestCases 机械枚举
// ───────────────────────────────────────────────────────────────────────────
test('T17 三个治理脚本源码零 NUL 字节（文本转义）；countTestCases 机械枚举 ≥13', (t) => {
  for (const name of ['wiki-governance.mjs', 'wiki-governance.test.mjs', 'docs-drift-check.mjs']) {
    const src = readFileSync(join(HERE, name));
    assert.equal(Buffer.from(src).includes(0), false, `${name} 不得含实际 NUL 字节`);
  }
  assert.equal(countTestCases(join(HERE, 'wiki-governance.test.mjs')) >= 13, true, '测试用例数应 ≥ 既有 13');
  assert.equal(countTestCases(join(HERE, 'no-such-file.mjs')), 0);
});

// ───────────────────────────────────────────────────────────────────────────
// 18. README 投影单一模型（gen3 A3#8）：checkReadmeProjection 逐列对账与计数
// ───────────────────────────────────────────────────────────────────────────
test('T18 checkReadmeProjection：逐列对账 id/title/type/life/path 与 bootstrap/测试计数', (t) => {
  const fx = makeFixture(t);
  const cfg = loadConfig(fx);
  const wikiDir = cfg.wikiDir;
  mkdirSync(wikiDir, { recursive: true });
  const manifest = writePlan(fx, 'jijiebei/proj', '20260823-192000');
  const mf = join(fx, 'm.json');
  writeFileSync(mf, JSON.stringify(manifest));
  assert.equal(runJson(fx, ['register', '--manifest', mf, '--json']).json.code, 'OK');
  const readmeAbs = join(wikiDir, 'README.md');

  // 绿：五列表与账本逐列一致 + 计数声明一致
  writeFileSync(readmeAbs, [
    '# wiki',
    '',
    '| id | title | type | life | path |',
    '|---|---|---|---|---|',
    `| ${manifest.id} | ${manifest.title} | plan | flow | ${manifest.path} |`,
    '',
    '| `docs/wiki/bootstrap.json` | 当前 80 项 Markdown disposition 明细 |',
    'node --test web/scripts/wiki-governance.test.mjs    # 18 例',
  ].join('\n') + '\n');
  const ok = checkReadmeProjection(cfg, fx, { readmeAbs, bootstrapCount: 80, testCount: 18 });
  assert.equal(ok.ok, true, ok.problems.join('；'));
  assert.equal(ok.expectedRows, 1);
  assert.equal(ok.actualRows, 1);

  // 红：title 列漂移
  writeFileSync(readmeAbs, readFileSync(readmeAbs, 'utf8').replace(`| ${manifest.title} |`, '| 标题被改 |'));
  const badTitle = checkReadmeProjection(cfg, fx, { readmeAbs, bootstrapCount: 80, testCount: 18 });
  assert.equal(badTitle.ok, false);
  assert.ok(badTitle.problems.some((e) => e.includes('列 title 漂移')), badTitle.problems.join('；'));

  // 红：life 列漂移（账本 knowledge 但表写 flow 之类）
  writeFileSync(readmeAbs, readFileSync(readmeAbs, 'utf8').replace('| plan | flow |', '| plan | knowledge |'));
  const badLife = checkReadmeProjection(cfg, fx, { readmeAbs, bootstrapCount: 80, testCount: 18 });
  assert.equal(badLife.ok, false);
  assert.ok(badLife.problems.some((e) => e.includes('列 life 漂移')), badLife.problems.join('；'));

  // 红：bootstrap 计数声明不符（76 vs 传入 80）
  writeFileSync(readmeAbs, readFileSync(readmeAbs, 'utf8').replace('80 项 Markdown disposition', '76 项 Markdown disposition'));
  const badCount = checkReadmeProjection(cfg, fx, { readmeAbs, bootstrapCount: 80, testCount: 18 });
  assert.equal(badCount.ok, false);
  assert.ok(badCount.problems.some((e) => e.includes('bootstrap 篇数声明 76 ≠ 传入 80')), badCount.problems.join('；'));

  // 红：漏登（账本有该行但表删掉）
  writeFileSync(readmeAbs, ['# wiki', '', '| id | title | type | life | path |', '|---|---|---|---|---|', '|  |  |  |  |  |', ''].join('\n'));
  const badMissing = checkReadmeProjection(cfg, fx, { readmeAbs, bootstrapCount: 80, testCount: 18 });
  assert.equal(badMissing.ok, false);
  assert.ok(badMissing.problems.some((e) => e.includes('漏登账本注册行')), badMissing.problems.join('；'));
});
