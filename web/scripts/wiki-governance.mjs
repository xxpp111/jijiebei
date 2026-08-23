#!/usr/bin/env node
// wiki-governance — JJB Alioth v2 账本 registrar（2026-08-23 · Spoke A 交付）。
// 文件面：docs/wiki/{log,lifecycle}.jsonl 双账 + config.json + schemas/ +（Phase 3）bootstrap.json。
//
// 设计红线（对齐 docs-drift-check.mjs 的「文档=真相」哲学）：
//   1. log.life 永不手改：只由 lifecycle 事件折叠派生，check 负责对账，冲突即 fail closed。
//   2. 不虚称 OS 级单次原子写：两文件【顺序 rename】（先 lifecycle 后 log）配 write-ahead journal
//      提供中断恢复——任一时刻账本要么旧态、要么新态、要么由恢复流程收敛；README 同步声明此边界。
//   3. 期望值一律从磁盘/账本解析，不硬编码第三份真相（bootstrap coverage 走 bootstrap.json 声明）。
//   4. 全部路径自锚定 repo root；--repo-root 用于测试隔离（fixture 镜像 repo 结构，绝不碰真实账）。
//   5. 零 npm 依赖，Node ≥ 18；退出码 0=ok / 1=业务失败（fail）/ 2=fatal（脚本自身/用法错）。
//   6. 所有子命令支持 --json：--json 时唯一 stdout 输出为单行 JSON（含错误），非 --json 错误走 stderr。
//
// 用法：
//   node web/scripts/wiki-governance.mjs bootstrap  --manifest <bootstrap.json> [--repo-root <d>] [--json]
//   node web/scripts/wiki-governance.mjs register   --manifest <artifact-manifest.json> [--repo-root <d>] [--json]
//   node web/scripts/wiki-governance.mjs transition --manifest <transition-manifest.json> [--repo-root <d>] [--json]
//   node web/scripts/wiki-governance.mjs check      [--json]
//   node web/scripts/wiki-governance.mjs query      <id|path|slug> [--json]
//   node web/scripts/wiki-governance.mjs build-context [--out <path>] [--json]
//
// 错误码（稳定）：OK / REPLAYED / LOCKED / STALE_LOCK / BASE_STATE_CHANGED / RECOVERED_ABORTED / RECOVERED_RESUMED /
//   INVALID_TRANSITION / REGISTRATION_CONFLICT / PATH_ESCAPE / PATH_MISMATCH / FILE_NOT_FOUND /
//   LM_MARKER_MISSING / SOURCE_SHA_DRIFT / MISSING_DISPOSITION / INVALID_INPUT / MANIFEST_NOT_FOUND /
//   NOT_FOUND / CHECK_FAILED / CORRUPT_LEDGER / NEEDS_RECOVERY（详见 docs/wiki/README.md 错误码表）
// STALE_LOCK：发现 stale 锁一律 fail closed，绝不自动接管覆盖他人锁（gen3 修正：原「>120s 可抢占」不具原子性）。
// BASE_STATE_CHANGED：commit rename 前 / journal 恢复时校验实账哈希与记录 base（或期望 half/final 态）一致，不一致即中止且不半写。
import { readFileSync, writeFileSync, existsSync, renameSync, unlinkSync, mkdirSync, realpathSync, readdirSync } from 'fs';
import { createHash } from 'crypto';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join, resolve, isAbsolute, relative, basename, extname, sep } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const AUTO_REPO_ROOT = resolve(here, '..', '..'); // web/scripts/ -> repo 根

// ───────────────────────────────────────────────────────────────────────────
// 常量：默认配置（docs/wiki/config.json 缺失时的内建等价值；路径相对【账本根】或 repo root）
// ───────────────────────────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  types: ['plan', 'decision', 'report', 'digest'],
  lifeValues: ['flow', 'archive', 'knowledge'],
  idPattern: '^jijiebei/[a-z0-9]+(?:-[a-z0-9]+)*@r\\d{8}-\\d{6}$',
  pathTemplate: 'docs/wiki/jijiebei/<slug>/r<ts>.<type>.<ext>',
  log: 'log.jsonl',
  lifecycle: 'lifecycle.jsonl',
  bootstrap: 'bootstrap.json',
  lock: '.registrar.lock',
  journal: '.registrar.journal.json',
  stagedLog: 'log.jsonl.new',
  stagedLifecycle: 'lifecycle.jsonl.new',
  lockStaleMs: 120000,
  contextManifest: 'docs/.context-manifest.json',
};

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TS_RE = /^r\d{8}-\d{6}$/;
const RFC3339_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const SHA_RE = /^[0-9a-f]{64}$/;
const EXT_BY_TYPE = { plan: 'html', decision: 'html', report: null, digest: null }; // null=md|html 均可

// ───────────────────────────────────────────────────────────────────────────
// mode 矩阵（gen3 修正）：mode 决定 type 与 life；author 不能手设与 mode 矛盾的
// life（矛盾即 INVALID_INPUT）。不带 mode 的既有调用路径保持向后兼容（沿用现行为：
// plan/decision ⇒ flow、report/digest ⇒ knowledge）。archive-import 不固定 type
// （历史原稿可为四种 type 之一），仅强制 life=archive。
// ───────────────────────────────────────────────────────────────────────────
const MODES = {
  'plan-active': { type: 'plan', life: 'flow' },
  'decision-open': { type: 'decision', life: 'flow' },
  'report-validating': { type: 'report', life: 'flow' },
  'digest-active': { type: 'digest', life: 'flow' },
  'knowledge-current': { type: 'report', life: 'knowledge' },
  'archive-import': { type: null, life: 'archive' },
};

// ───────────────────────────────────────────────────────────────────────────
// 工具函数
// ───────────────────────────────────────────────────────────────────────────
function sha256Text(text) {
  return createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
}
function sha256File(abs) {
  if (!existsSync(abs)) return null;
  return sha256Text(readFileSync(abs, 'utf8'));
}
// 去掉 prepare 阶段附加的 __ 元字段（比较/组装前必须剥离）
function stripMeta(o) {
  const out = {};
  for (const k of Object.keys(o)) if (!k.startsWith('__')) out[k] = o[k];
  return out;
}
// stable 序列化：递归按键排序，保证逐字节可复现（幂等判定/哈希可靠）
function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const keys = Object.keys(v).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`;
}
function readJsonOrNull(abs) {
  if (!existsSync(abs)) return null;
  try { return JSON.parse(readFileSync(abs, 'utf8')); } catch (e) { return { __parse_error: String(e && e.message || e) }; }
}
// 以 \n 结尾的账本文本上追加若干 JSON 行（每行 stableStringify + \n）
function appendLinesText(baseText, lines) {
  const base = baseText === '' || baseText === null ? '' : (baseText.endsWith('\n') ? baseText : `${baseText}\n`);
  return base + lines.map((l) => `${stableStringify(l)}\n`).join('');
}

// CLI 错误：带稳定 code 与 exit 码
class CliError extends Error {
  constructor(code, message, exitCode = 1) { super(message); this.code = code; this.exitCode = exitCode; }
}

// ───────────────────────────────────────────────────────────────────────────
// 配置与账本访问
// ───────────────────────────────────────────────────────────────────────────
function loadConfig(repoRoot) {
  const wikiDir = join(repoRoot, 'docs', 'wiki');
  const cfgPath = join(wikiDir, 'config.json');
  const disk = readJsonOrNull(cfgPath);
  if (disk && disk.__parse_error) {
    throw new CliError('FATAL_CONFIG', `docs/wiki/config.json 解析失败: ${disk.__parse_error}`, 2);
  }
  return { ...DEFAULT_CONFIG, ...(disk || {}), wikiDir };
}
function cfgPath(cfg, key) { return join(cfg.wikiDir, cfg[key]); }

// 读账本行（文件缺失/空 → []；坏行不在此报——check 负责）
function readLines(abs) {
  if (!existsSync(abs)) return [];
  const text = readFileSync(abs, 'utf8');
  if (text.trim() === '') return [];
  return text.split('\n').filter((l) => l.trim() !== '');
}

// ───────────────────────────────────────────────────────────────────────────
// lifecycle 折叠器：事件 → 每对象最终 {state, life, lastSeq}
// 唯一合法转换表（fail closed：未列出的转换一律 INVALID_TRANSITION）
// ───────────────────────────────────────────────────────────────────────────
const LIFE_VALUES = ['flow', 'archive', 'knowledge'];
const STATES = ['registered', 'imported', 'archived', 'superseded'];
// event → 合法 (fromState, fromLife) → (toState, toLife)；from=null 用 null 键
const TRANSITIONS = {
  'bootstrap-import':   [{ from: null, to: (s, l) => s === 'imported' && LIFE_VALUES.includes(l) }],
  'register-flow':      [{ from: null, to: (s, l) => s === 'registered' && l === 'flow' }],
  'register-knowledge': [{ from: null, to: (s, l) => s === 'registered' && l === 'knowledge' }],
  // archive-import（mode=archive-import）：历史原稿注册即归档（life=archive）
  'register-archive':   [{ from: null, to: (s, l) => s === 'registered' && l === 'archive' }],
  // correct-life（transition 命令）：life-only 修正，state 保持不变、仅 knowledge→flow
  // （digest 误记 knowledge 的订正；禁止 flow→knowledge 等回退方向，fail closed）
  'correct-life': [
    { from: (s, l) => s === 'registered' && l === 'knowledge', to: (s, l) => s === 'registered' && l === 'flow' },
    { from: (s, l) => s === 'imported' && l === 'knowledge', to: (s, l) => s === 'imported' && l === 'flow' },
  ],
  // promote：流文档沉淀为知识；归档重新激活为流（不许可 knowledge→flow 回退）
  promote: [
    { from: ['registered', 'flow'], to: (s, l) => s === 'registered' && l === 'knowledge' },
    { from: ['imported', 'flow'], to: (s, l) => s === 'imported' && l === 'knowledge' },
    { from: ['archived', 'archive'], to: (s, l) => s === 'registered' && l === 'flow' },
  ],
  archive: [
    { from: (s, l) => s !== 'archived' && s !== 'superseded', to: (s, l) => s === 'archived' && l === 'archive' },
  ],
  supersede: [
    { from: (s, l) => true, to: (s, l) => s === 'superseded' && l === 'archive' },
  ],
};
function isLegalTransition(event, fromState, fromLife, toState, toLife) {
  const rules = TRANSITIONS[event];
  if (!rules) return { ok: false, why: `未知事件 ${event}` };
  for (const r of rules) {
    let fromOk;
    if (r.from === null) fromOk = fromState === null;
    else if (typeof r.from === 'function') fromOk = r.from(fromState, fromLife);
    else fromOk = r.from[0] === fromState && r.from[1] === fromLife;
    if (!fromOk) continue;
    if (r.to(toState, toLife)) return { ok: true };
  }
  return { ok: false, why: `非法 transition: ${JSON.stringify({ from: { state: fromState, life: fromLife }, to: { state: toState, life: toLife }, event })}` };
}
// 折叠：返回 Map<object, {state, life, lastSeq}>；抛 CliError(INVALID_TRANSITION)
function foldLifecycle(events) {
  const folded = new Map();
  for (const ev of events) {
    const { event, object, from, to } = ev;
    const prev = folded.get(object);
    const fromState = prev ? prev.state : from ? from.state : null;
    const fromLife = prev ? prev.life : from ? from.life : null;
    if (prev === undefined && from !== null) {
      // 首事件必须 from=null（账本对象从零开始）
      throw new CliError('INVALID_TRANSITION', `${object} 首事件 ${event} 的 from 非空（对象没有注册起点）`);
    }
    if (!STATES.includes(to.state) || !LIFE_VALUES.includes(to.life)) {
      throw new CliError('INVALID_TRANSITION', `${object} 事件 ${event} 的 to 含未知 state/life: ${JSON.stringify(to)}`);
    }
    const chk = isLegalTransition(event, fromState, fromLife, to.state, to.life);
    if (!chk.ok) throw new CliError('INVALID_TRANSITION', `${object}: ${chk.why}`);
    // 事件须与折叠起点一致（from 字段是审计位，折叠起点才是权威）
    folded.set(object, { state: to.state, life: to.life, lastSeq: ev.__seq });
  }
  return folded;
}

// ───────────────────────────────────────────────────────────────────────────
// 行校验器（CLI runtime shape 子集；不声称等价于完整 JSON Schema）。
// event/type/life 枚举 parity 与当前 ledger 兼容性由测试机械对照 schema；其余 schema 形状仍以 schema 文件为准。
// ───────────────────────────────────────────────────────────────────────────
function parseId(id) {
  if (typeof id !== 'string') return null;
  const m = id.match(/^(jijiebei\/[a-z0-9]+(?:-[a-z0-9]+)*)@(r\d{8}-\d{6})$/);
  if (!m) return null;
  return { slug: m[1], name: m[1].replace(/^jijiebei\//, ''), ts: m[2] };
}
function validateLogRow(row, lineNo) {
  const p = (ok, why) => { if (!ok) throw new CliError('CORRUPT_LEDGER', `log.jsonl 第 ${lineNo} 行: ${why}`); };
  p(row && typeof row === 'object', '非对象');
  p(typeof row.registration_id === 'string' && row.registration_id.length > 0, 'registration_id 缺失');
  p(parseId(row.id), `id 缺失/非法: ${JSON.stringify(row.id)}`);
  p(typeof row.path === 'string' && row.path.length > 0, 'path 缺失/为空');
  p(typeof row.title === 'string' && row.title.length > 0, 'title 缺失/为空');
  p(DEFAULT_CONFIG.types.includes(row.type), `type 非法: ${JSON.stringify(row.type)}`);
  p(LIFE_VALUES.includes(row.life), `life 非法: ${JSON.stringify(row.life)}`);
  p(typeof row.topic === 'string', 'topic 缺失');
  p(typeof row.owner === 'string', 'owner 缺失');
  p(typeof row.close_policy === 'string', 'close_policy 缺失');
  p(Array.isArray(row.canonical_targets) && row.canonical_targets.every((x) => typeof x === 'string'), 'canonical_targets 非法');
  p(Array.isArray(row.source_refs) && row.source_refs.every((x) => typeof x === 'string'), 'source_refs 非法');
  p(SHA_RE.test(String(row.source_sha256)), `source_sha256 非法: ${JSON.stringify(row.source_sha256)}`);
  p(RFC3339_RE.test(String(row.ts)), `ts 非法: ${JSON.stringify(row.ts)}`);
}
function parseLifecycleRow(row, lineNo) {
  const p = (ok, why) => { if (!ok) throw new CliError('CORRUPT_LEDGER', `lifecycle.jsonl 第 ${lineNo} 行: ${why}`); };
  p(row && typeof row === 'object', '非对象');
  p(typeof row.event_id === 'string' && /^lce-[0-9a-f]{20}-\d+$/.test(row.event_id), `event_id 非法: ${JSON.stringify(row.event_id)}`);
  p(parseId(row.object), `object 非法: ${JSON.stringify(row.object)}`);
  p(row.from === null || (row.from && STATES.includes(row.from.state) && LIFE_VALUES.includes(row.from.life)), `from 非法: ${JSON.stringify(row.from)}`);
  p(row.to && STATES.includes(row.to.state) && LIFE_VALUES.includes(row.to.life), `to 非法: ${JSON.stringify(row.to)}`);
  p(['bootstrap-import', 'register-flow', 'register-knowledge', 'register-archive', 'correct-life', 'promote', 'archive', 'supersede'].includes(row.event), `event 非法: ${JSON.stringify(row.event)}`);
  p(typeof row.actor === 'string', 'actor 缺失');
  p(typeof row.authority === 'string', 'authority 缺失');
  p(Array.isArray(row.evidence), 'evidence 缺失');
  p(Array.isArray(row.actions), 'actions 缺失');
  p(RFC3339_RE.test(String(row.occurred_at)), `occurred_at 非法: ${JSON.stringify(row.occurred_at)}`);
  const seq = Number(row.event_id.match(/lce-[0-9a-f]{20}-(\d+)$/)[1]);
  row.__seq = seq;
  return row;
}

// ───────────────────────────────────────────────────────────────────────────
// 锁（O_EXCL 创建；发现 stale 锁一律 fail closed 报 STALE_LOCK，绝不自动接管覆盖他人
// 锁——gen3 修正：原「> lockStaleMs 视为 stale 可抢占」非原子 CAS，两竞争者可同时都
// 判 stale 并双双「持锁成功」，故改为人工恢复指引；token 匹配的正常释放保留。）
// ───────────────────────────────────────────────────────────────────────────
function acquireLock(cfg) {
  const lockPath = cfgPath(cfg, 'lock');
  mkdirSync(cfg.wikiDir, { recursive: true }); // 空起步：确保账本目录存在（锁文件才可 O_EXCL 创建）
  const payload = { pid: process.pid, ts: new Date().toISOString(), token: createHash('sha256').update(String(process.pid) + Date.now() + Math.random()).digest('hex').slice(0, 12) };
  try {
    writeFileSync(lockPath, stableStringify(payload), { flag: 'wx' });
    return { owned: true, token: payload.token };
  } catch (e) {
    if (e.code !== 'EEXIST') throw new CliError('LOCKED', `锁创建失败: ${e.message}`);
    const cur = readJsonOrNull(lockPath);
    const stale = !cur || !cur.ts || (Date.now() - Date.parse(cur.ts) > cfg.lockStaleMs);
    if (!stale) {
      // 锁可能属于一个正在跑的写事务：不抢，等它（若进程已死但锁新鲜，120s 后自动 stale）
      throw new CliError('LOCKED', `登记锁被占用（pid=${cur && cur.pid || '?'} ${cur && cur.ts || ''}），等待或 <${cfg.lockStaleMs}ms 后重试`);
    }
    // fail closed：stale 锁不自动接管——既不覆盖他人锁也不允许双写者同时「接管成功」
    throw new CliError('STALE_LOCK',
      `检测到 stale 登记锁（holder pid=${cur && cur.pid || '?'} ts=${cur && cur.ts || '?'}，超过 ${cfg.lockStaleMs}ms）。` +
      `请人工确认无活动登记进程后删除 ${lockPath} 再重试；不得覆盖其他持有者的锁。`);
  }
}
function releaseLock(cfg, token) {
  const lockPath = cfgPath(cfg, 'lock');
  try {
    const cur = readJsonOrNull(lockPath);
    if (cur && cur.token === token) unlinkSync(lockPath); // 只删自己持有的锁
  } catch { /* 锁不存在即已完成释放 */ }
}
function assertNoPendingTransaction(cfg) {
  if (existsSync(cfgPath(cfg, 'journal'))) {
    throw new CliError('NEEDS_RECOVERY', '存在未恢复的 write-ahead journal：先执行一次 register/bootstrap 触发恢复，再跑只读命令');
  }
}

// ───────────────────────────────────────────────────────────────────────────
// write-ahead journal + 中断恢复
// 语义：进入锁后先写 journal（意图），再写两份 staged，再【顺序 rename：先 lifecycle 后 log】。
// 恢复判定以「当前实账哈希是否已等于期望终态」为准，绝不猜测中断点。
// ───────────────────────────────────────────────────────────────────────────
function writeJournal(cfg, intent) {
  writeFileSync(cfgPath(cfg, 'journal'), stableStringify({
    txn_id: `txn-${createHash('sha256').update(String(Date.now()) + Math.random()).digest('hex').slice(0, 12)}`,
    created_at: new Date().toISOString(),
    intent,
  }));
}
function clearJournal(cfg) {
  const p = cfgPath(cfg, 'journal');
  try { if (existsSync(p)) unlinkSync(p); } catch { /* 忽略 */ }
}
// 恢复：返回 { action: 'clean'|'resumed'|'completed'|'aborted' }；aborted 时已回滚到事务前一致态。
// gen3 修正：恢复前先校验「当前实账哈希 ∈ {base, final, half} 期望态」——journal 记录的 base 是
// 事务起点的账本指纹；账本在中断期间被外部改动（既非 base 也非 expected 的任意组合）即
// BASE_STATE_CHANGED fail closed，绝不猜测中断点或半写覆盖。
function recoverJournal(cfg) {
  const journalPath = cfgPath(cfg, 'journal');
  if (!existsSync(journalPath)) return { action: 'clean' };
  const j = readJsonOrNull(journalPath);
  if (!j || !j.intent) { clearJournal(cfg); return { action: 'aborted', why: 'journal 损坏（无 intent），已清空' }; }
  const intent = j.intent;
  const logPath = cfgPath(cfg, 'log');
  const lcPath = cfgPath(cfg, 'lifecycle');
  const stagedLog = cfgPath(cfg, 'stagedLog');
  const stagedLc = cfgPath(cfg, 'stagedLifecycle');
  const curLog = sha256File(logPath);
  const curLc = sha256File(lcPath);
  const baseLog = intent.base_log_sha256 ?? null;
  const baseLc = intent.base_lifecycle_sha256 ?? null;
  const expLog = intent.expected_log_sha256 ?? null;
  const expLc = intent.expected_lifecycle_sha256 ?? null;
  // 期望态集合：`base,base`（事务未开始）/ `exp,exp`（事务完成）/ `base,exp`（half：lifecycle 已落地、log 未）
  const legit = new Set([`${baseLog}|${baseLc}`, `${expLog}|${expLc}`, `${baseLog}|${expLc}`]);
  if (!legit.has(`${curLog}|${curLc}`)) {
    const fmt = (h) => (h === null ? 'null' : `${String(h).slice(0, 12)}…`);
    throw new CliError('BASE_STATE_CHANGED',
      `恢复检测到账本与 journal 记录 base 不符：log=${fmt(curLog)} lifecycle=${fmt(curLc)} 不在 {base/final/half} 任一` +
      `期望态（base=${fmt(baseLog)}/${fmt(baseLc)}, final=${fmt(expLog)}/${fmt(expLc)}）——疑似外部改动或旧事务残留。` +
      `已中止本次事务且不改写账本，请人工核查 ${logPath} 与 ${lcPath} 后手工清除 ${journalPath} 再重试。`);
  }
  const logDone = curLog === expLog;
  const lcDone = curLc === expLc;
  const stagedLogOk = sha256File(stagedLog) === intent.expected_log_sha256;
  const stagedLcOk = sha256File(stagedLc) === intent.expected_lifecycle_sha256;
  const dropStaged = () => {
    for (const p of [stagedLog, stagedLc]) { try { if (existsSync(p)) unlinkSync(p); } catch { /* 忽略 */ } }
  };
  // 事务回滚（依据 journal 意图逐类回退：append 行移除 + replaced 行换回）
  const rollbackTxn = () => {
    if (Array.isArray(intent.replaced_log_rows) && intent.replaced_log_rows.length) rollbackByReplacingRows(logPath, intent.replaced_log_rows);
    if (Array.isArray(intent.append_log_lines) && intent.append_log_lines.length) rollbackByRemovingAppend(logPath, intent.append_log_lines, 'log');
    if (Array.isArray(intent.append_lifecycle_events) && intent.append_lifecycle_events.length) rollbackByRemovingAppend(lcPath, intent.append_lifecycle_events, 'lifecycle');
  };
  try {
    if (logDone && lcDone) {
      // rename 已完成、journal 未来得及清：补清理即可
      dropStaged(); clearJournal(cfg);
      return { action: 'completed' };
    }
    if (!logDone && !lcDone) {
      if (stagedLogOk && stagedLcOk) {
        renameSync(stagedLc, lcPath);   // 顺序：先 lifecycle
        renameSync(stagedLog, logPath); // 再 log
        clearJournal(cfg);
        return { action: 'resumed' };
      }
      rollbackTxn(); dropStaged(); clearJournal(cfg);
      return { action: 'aborted', why: 'staged 缺失/损坏，已回滚事务现场（append/replace）并清空 journal' };
    }
    if (lcDone && !logDone) {
      // lifecycle 已落地、log 未落地：若 log staged 完整则补 rename，否则把整个事务回滚（含 log replaced 行）
      if (stagedLogOk) {
        renameSync(stagedLog, logPath);
        clearJournal(cfg);
        return { action: 'resumed' };
      }
      rollbackTxn(); dropStaged(); clearJournal(cfg);
      return { action: 'aborted', why: 'log staged 损坏且 lifecycle 已半落地，已将事务回滚到 base 态' };
    }
    // logDone && !lcDone：违背「先 lifecycle 后 log」顺序，防御性回滚 log 侧（append + replace）
    if (Array.isArray(intent.replaced_log_rows) && intent.replaced_log_rows.length) rollbackByReplacingRows(logPath, intent.replaced_log_rows);
    if (Array.isArray(intent.append_log_lines) && intent.append_log_lines.length) rollbackByRemovingAppend(logPath, intent.append_log_lines, 'log');
    dropStaged(); clearJournal(cfg);
    return { action: 'aborted', why: '检测到 log 先于 lifecycle 落地的异常半态，已将 log 回滚' };
  } finally {
    dropStaged();
  }
}
// 从当前账去 append 行（行级回滚：过滤与 append 对象 stable 等值的行）
function rollbackByRemovingAppend(abs, appended, name) {
  if (!existsSync(abs)) return;
  const keep = new Set(appended.map((l) => stableStringify(l)));
  const lines = readLines(abs).filter((l) => {
    try { return !keep.has(stableStringify(JSON.parse(l))); } catch { return true; }
  });
  writeFileSync(abs, lines.length ? `${lines.join('\n')}\n` : '');
}
// 事务内对 log 行的替换回滚（transition 场景）：把 after 行换回 before 行（按 id 匹配）
function rollbackByReplacingRows(abs, replacedRows) {
  if (!existsSync(abs)) return;
  const byId = new Map(replacedRows.map((r) => [r.id, r.before]));
  const lines = readLines(abs).map((l) => {
    try {
      const o = JSON.parse(l);
      if (o && o.id && byId.has(o.id)) return stableStringify(byId.get(o.id));
    } catch { /* 坏行保留，check 自会报 */ }
    return l;
  });
  writeFileSync(abs, lines.length ? `${lines.join('\n')}\n` : '');
}
// 在 base 文本上按 id 替换若干行，并（可选）追加行；返回新全文（stable 序列化逐字节一致）
function replaceRowsInText(baseText, replaceRows, appendRows) {
  const byId = new Map(replaceRows.map((r) => [r.id, r.after]));
  const lines = baseText === '' ? [] : baseText.split('\n').filter((l) => l.trim() !== '');
  const out = lines.map((l) => {
    try {
      const o = JSON.parse(l);
      if (o && o.id && byId.has(o.id)) return stableStringify(byId.get(o.id));
    } catch { /* 保留原文 */ }
    return l;
  });
  return (out.length ? `${out.join('\n')}\n` : '') + (appendRows || []).map((l) => `${stableStringify(l)}\n`).join('');
}

function maxLifecycleSeq(events) {
  let max = 0;
  for (const ev of events) {
    const m = String(ev.event_id || '').match(/lce-[0-9a-f]{20}-(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
}

// ───────────────────────────────────────────────────────────────────────────
// 提交事务：journal(意图) → staged×2 → 顺序 rename（先 lifecycle 后 log）→ 清 journal
// gen3 修正：commit rename 前校验当前实账哈希与事务 base 一致（BASE_STATE_CHANGED 中止，
// 不得半写）；并支持 transition 的「log 行替换」（replaced_log_rows，事务性回滚依据）。
// ───────────────────────────────────────────────────────────────────────────
function commitAppend(cfg, logLines, lcEvents, replaceLogRows = []) {
  const logPath = cfgPath(cfg, 'log');
  const lcPath = cfgPath(cfg, 'lifecycle');
  const stagedLog = cfgPath(cfg, 'stagedLog');
  const stagedLc = cfgPath(cfg, 'stagedLifecycle');
  const baseLogText = existsSync(logPath) ? readFileSync(logPath, 'utf8') : '';
  const baseLcText = existsSync(lcPath) ? readFileSync(lcPath, 'utf8') : '';
  const baseLogSha = baseLogText === '' ? null : sha256Text(baseLogText);
  const baseLcSha = baseLcText === '' ? null : sha256Text(baseLcText);
  const expectedLogText = replaceLogRows.length ? replaceRowsInText(baseLogText, replaceLogRows, logLines) : appendLinesText(baseLogText, logLines);
  const expectedLcText = appendLinesText(baseLcText, lcEvents);
  const intent = {
    append_log_lines: logLines,
    append_lifecycle_events: lcEvents,
    replaced_log_rows: replaceLogRows,
    base_log_sha256: baseLogSha,
    base_lifecycle_sha256: baseLcSha,
    expected_log_sha256: sha256Text(expectedLogText),
    expected_lifecycle_sha256: sha256Text(expectedLcText),
  };
  // BASE_STATE_CHANGED 门（进入时）：本事务组装基于的 base 必须仍是当前实账（外部写入防御）
  const assertBaseIntact = () => {
    if (sha256File(logPath) !== baseLogSha || sha256File(lcPath) !== baseLcSha) {
      throw new CliError('BASE_STATE_CHANGED',
        '提交前 log/lifecycle 实账哈希与事务 base 不一致（账本被外部改动），事务中止且不写任何中间态');
    }
  };
  assertBaseIntact();
  writeJournal(cfg, intent);
  writeFileSync(stagedLog, expectedLogText);
  writeFileSync(stagedLc, expectedLcText);
  // BASE_STATE_CHANGED 门（rename 前最后一道）：避免 journal↔rename 窗口内的外部写入被覆盖
  try {
    assertBaseIntact();
  } catch (e) {
    clearJournal(cfg); // 账本未动，丢弃本次 staged 即回到事务前一致态
    for (const p of [stagedLog, stagedLc]) { try { if (existsSync(p)) unlinkSync(p); } catch { /* 忽略 */ } }
    throw e;
  }
  renameSync(stagedLc, lcPath);   // 顺序：先 lifecycle
  renameSync(stagedLog, logPath); // 再 log
  clearJournal(cfg);
}

// ───────────────────────────────────────────────────────────────────────────
// register 的 manifest 校验与候选行组装
// ───────────────────────────────────────────────────────────────────────────
function prepareRegister(cfg, repoRoot, manifest, nowIso) {
  const req = (v, why) => { if (v === undefined || v === null || v === '') throw new CliError('INVALID_INPUT', `artifact manifest 缺字段 ${why}`); };
  req(manifest.id, 'id');
  req(manifest.path, 'path');
  req(manifest.title, 'title');
  // mode 矩阵（gen3 A3#5）：mode 决定 type/life；author 不能手设与 mode 矛盾的 life（INVALID_INPUT）。
  // 带 mode 且 mode 固定 type（非 archive-import）时 type 可由 mode 推导（省略）；提供则须一致。
  let mode = null;
  if (manifest.mode !== undefined && manifest.mode !== null && manifest.mode !== '') {
    mode = manifest.mode;
    const m = MODES[mode];
    if (!m) throw new CliError('INVALID_INPUT', `mode 非法: ${JSON.stringify(mode)}（可用: ${Object.keys(MODES).join(' | ')}）`);
    if (manifest.life !== undefined && manifest.life !== m.life) {
      throw new CliError('INVALID_INPUT', `author 不能手设与 mode 矛盾的 life：mode=${mode} ⇒ ${m.life}，实际 ${JSON.stringify(manifest.life)}`);
    }
    if (m.type !== null && manifest.type !== undefined && manifest.type !== m.type) {
      throw new CliError('INVALID_INPUT', `mode=${mode} ⇒ type=${m.type}，实际 ${JSON.stringify(manifest.type)}`);
    }
  }
  const effType = mode && MODES[mode].type ? MODES[mode].type : manifest.type;
  if (!mode || MODES[mode].type === null) req(manifest.type, 'type'); // 无 mode / archive-import：type 必填
  if (manifest.type !== undefined && !DEFAULT_CONFIG.types.includes(manifest.type)) {
    throw new CliError('INVALID_INPUT', `type 非法: ${JSON.stringify(manifest.type)}`);
  }
  if (!DEFAULT_CONFIG.types.includes(effType)) throw new CliError('INVALID_INPUT', `type 非法: ${JSON.stringify(effType)}`);
  const parsed = parseId(manifest.id);
  if (!parsed) throw new CliError('INVALID_INPUT', `id 非法（应 jijiebei/<slug>@r<YYYYMMDD-HHMMSS>）: ${JSON.stringify(manifest.id)}`);
  const { slug, ts } = parsed;

  // 路径安全：绝对路径 / .. 逃逸 / 模板不符 → 分层报错
  if (isAbsolute(manifest.path)) throw new CliError('PATH_ESCAPE', `path 为绝对路径: ${manifest.path}`);
  if (manifest.path.split(/[\\/]/).includes('..')) throw new CliError('PATH_ESCAPE', `path 含 .. 逃逸: ${manifest.path}`);
  const absPath = resolve(repoRoot, manifest.path);
  if (relative(repoRoot, absPath).startsWith('..')) throw new CliError('PATH_ESCAPE', `path 解析后越出 repo root: ${manifest.path}`);
  // symlink 逃逸：realpath 不得落出 realpath(repoRoot)
  if (existsSync(absPath)) {
    try {
      const realAbs = realpathSync(absPath);
      const realRoot = realpathSync(repoRoot);
      const off = relative(realRoot, realAbs);
      if (off.startsWith('..') || isAbsolute(off)) throw new CliError('PATH_ESCAPE', `path 经 symlink 逃逸出 repo root: ${manifest.path}`);
    } catch (e) {
      if (e instanceof CliError) throw e;
      // realpathSync 失败（文件被 concurrent 删）→ 留给 FILE_NOT_FOUND 判
    }
  }
  // 路径模板：docs/wiki/jijiebei/<slug>/r<ts>.<type>.<ext>，slug/ts/type/ext 须与 id/type 一致
  const ext = extname(manifest.path).replace(/^\./, '');
  const base = basename(manifest.path);
  const expectedBase = `r${ts.slice(1)}.${effType}.${ext}`;
  const expectedDir = join('docs', 'wiki', 'jijiebei', parsed.name);
  const dirOfPath = dirname(manifest.path).split(sep).join('/');
  const errs = [];
  if (dirOfPath !== expectedDir) errs.push(`目录应为 ${expectedDir}，实际 ${dirOfPath}`);
  if (base !== expectedBase) errs.push(`文件名应为 ${expectedBase}，实际 ${base}`);
  if (EXT_BY_TYPE[effType] && EXT_BY_TYPE[effType] !== ext) errs.push(`type=${effType} 必须为 .${EXT_BY_TYPE[effType]}，实际 .${ext}`);
  if (!['html', 'md'].includes(ext)) errs.push(`扩展名非法: .${ext}`);
  if (errs.length) throw new CliError('PATH_MISMATCH', `path 与 id/type 模板不符: ${errs.join('；')}`);
  if (manifest.path !== join(expectedDir, expectedBase).split(sep).join('/')) {
    throw new CliError('PATH_MISMATCH', `path 与模板不一致: ${manifest.path} ≠ ${join(expectedDir, expectedBase)}`);
  }
  if (!existsSync(absPath)) throw new CliError('FILE_NOT_FOUND', `登记目标文件不存在: ${manifest.path}`);

  // lm 标记（plan/decision 强制 html 首行）
  if (EXT_BY_TYPE[effType]) {
    const first = readFileSync(absPath, 'utf8').replace(/^﻿/, '').split('\n')[0].trim();
    const expect = `<!--lm ${manifest.id}-->`;
    if (first !== expect) throw new CliError('LM_MARKER_MISSING', `文件首行应为 ${expect}，实际: ${first.slice(0, 60) || '(空)'}`);
  }

  // source_sha256：manifest 提供则校验，缺省现场计算（Phase 2「不提前锁死」语义）
  const actualSha = sha256Text(readFileSync(absPath, 'utf8'));
  let sourceSha;
  if (manifest.source_sha256 !== undefined) {
    if (!SHA_RE.test(String(manifest.source_sha256))) throw new CliError('INVALID_INPUT', `source_sha256 非法: ${JSON.stringify(manifest.source_sha256)}`);
    if (manifest.source_sha256 !== actualSha) {
      throw new CliError('SOURCE_SHA_DRIFT', `登记前文件 SHA 漂移：manifest=${manifest.source_sha256} 实际=${actualSha}`);
    }
    sourceSha = manifest.source_sha256;
  } else {
    sourceSha = actualSha;
  }

  // life 不由 manifest 直填：按 mode（若有）或 type 推导（mode 分支的矛盾已在头部校验）
  const derivedLife = mode ? MODES[mode].life : ((manifest.type === 'plan' || manifest.type === 'decision') ? 'flow' : 'knowledge');
  if (!mode && manifest.life !== undefined && manifest.life !== derivedLife) {
    throw new CliError('INVALID_INPUT', `life 不由 manifest 直填：type=${manifest.type} ⇒ ${derivedLife}，实际 ${JSON.stringify(manifest.life)}`);
  }
  // knowledge-current（gen3 A3#7）：仅 type=report，且 canonical_targets 必须包含一条「既有 canonical path」
  if (mode === 'knowledge-current') {
    const targets = Array.isArray(manifest.canonical_targets) ? manifest.canonical_targets : [];
    if (targets.length === 0) throw new CliError('INVALID_INPUT', 'knowledge-current 必须提供 canonical_targets（指向既有 canonical path）');
    const existingRows = readLines(cfgPath(cfg, 'log')).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const referenced = new Set();
    for (const r of existingRows) for (const t of (r.canonical_targets || [])) referenced.add(t);
    const okay = targets.some((t) => {
      if (typeof t !== 'string' || t === manifest.path) return false; // 不能指向自己/非字符串
      if (referenced.has(t)) return true;                            // 被既有账行引用为 canonical target（「既有」语义）
      if (isAbsolute(t) || t.split(/[\\/]/).includes('..')) return false;
      return existsSync(resolve(repoRoot, t));                       // canonical 原稿（repo 内相对路径）磁盘存在
    });
    if (!okay) throw new CliError('INVALID_INPUT', `knowledge-current 的 canonical_targets 未指向既有 canonical path: ${JSON.stringify(targets)}`);
  }

  const canonical_targets = Array.isArray(manifest.canonical_targets) && manifest.canonical_targets.every((x) => typeof x === 'string') ? manifest.canonical_targets : [];
  const source_refs = Array.isArray(manifest.source_refs) && manifest.source_refs.every((x) => typeof x === 'string') ? manifest.source_refs : [];
  const row = {
    id: manifest.id, path: manifest.path, title: String(manifest.title),
    type: effType, life: derivedLife,
    topic: String(manifest.topic || ''), owner: String(manifest.owner || ''),
    close_policy: String(manifest.close_policy || ''),
    canonical_targets, source_refs, source_sha256: sourceSha,
  };
  // 幂等比较基准：同一 id 已有行时，除 registration_id/ts（每次执行必然不同）外全字段一致 → REPLAYED
  row.__compare = { ...row };
  delete row.__compare.source_sha256; // source_sha256 是登记时快照，后续 file 变更不构成 conflict
  row.__event = {
    event: derivedLife === 'flow' ? 'register-flow' : derivedLife === 'archive' ? 'register-archive' : 'register-knowledge',
    actor: String(manifest.actor || 'cli'), authority: String(manifest.authority || 'contract'),
    evidence: (manifest.evidence || []).map(String), actions: [{ type: 'register', path: manifest.path }],
  };
  return { row, event: row.__event, nowIso };
}

// ───────────────────────────────────────────────────────────────────────────
// bootstrap：整份 bootstrap.json 一次性导入（coverage/items；life 与 id 由 manifest 显式给出）
// ───────────────────────────────────────────────────────────────────────────
function prepareBootstrap(cfg, repoRoot, manifest, nowIso) {
  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.items)) {
    throw new CliError('INVALID_INPUT', 'bootstrap manifest 缺 items 数组');
  }
  const existing = readLines(cfgPath(cfg, 'log')).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const maxBootSeq = existing.reduce((m, r) => {
    const mm = String(r.registration_id || '').match(/^boot-(\d+)$/);
    return mm ? Math.max(m, Number(mm[1])) : m;
  }, 0);
  const events = readLines(cfgPath(cfg, 'lifecycle')).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  let seq = maxLifecycleSeq(events);
  const inserted = [];
  const replayed = [];
  let bootSeq = maxBootSeq;
  for (const item of manifest.items) {
    const req = (v, why) => { if (v === undefined || v === null || v === '') throw new CliError('INVALID_INPUT', `bootstrap item 缺字段 ${why}: ${JSON.stringify(item.path)}`); };
    req(item.path, 'path');
    req(item.id, 'id');
    req(item.type, 'type');
    req(item.life, 'life');
    if (!DEFAULT_CONFIG.types.includes(item.type)) throw new CliError('INVALID_INPUT', `bootstrap item type 非法: ${JSON.stringify(item.type)}`);
    if (!LIFE_VALUES.includes(item.life)) throw new CliError('INVALID_INPUT', `bootstrap item life 非法: ${JSON.stringify(item.life)}`);
    const parsed = parseId(item.id);
    if (!parsed) throw new CliError('INVALID_INPUT', `bootstrap item id 非法: ${JSON.stringify(item.id)}`);
    if (isAbsolute(item.path) || item.path.split(/[\\/]/).includes('..')) {
      throw new CliError('PATH_ESCAPE', `bootstrap path 非法: ${item.path}`);
    }
    const absPath = resolve(repoRoot, item.path);
    if (!existsSync(absPath)) throw new CliError('FILE_NOT_FOUND', `bootstrap 目标不存在: ${item.path}`);
    // title：front matter 优先 → manifest.title → 文件名
    let title = item.title || '';
    if (!title) {
      const text = readFileSync(absPath, 'utf8').replace(/^﻿/, '');
      const fm = text.match(/^---\n([\s\S]*?)\n---\n/);
      if (fm) {
        const t = fm[1].split('\n').map((l) => l.match(/^title:\s*(.*)$/)).filter(Boolean).map((m) => m[1].trim())[0];
        if (t) title = t;
      }
    }
    if (!title) title = basename(item.path, extname(item.path));
    const row = {
      id: item.id, path: item.path, title, type: item.type, life: item.life,
      topic: String(item.topic || ''), owner: String(item.owner || 'legacy'),
      close_policy: String(item.close_policy || ''),
      canonical_targets: (item.canonical_targets || []).map(String),
      source_refs: (item.source_refs || []).map(String),
      source_sha256: sha256Text(readFileSync(absPath, 'utf8')),
    };
    const prev = existing.find((r) => r.id === item.id);
    if (prev) {
      const cmp = (o) => { const c = { ...o }; delete c.registration_id; delete c.ts; return c; };
      if (stableStringify(cmp(row)) === stableStringify(cmp(prev))) { replayed.push(item.path); continue; }
      throw new CliError('REGISTRATION_CONFLICT', `bootstrap 与既有账冲突（id=${item.id}）：字段不一致`);
    }
    bootSeq += 1;
    const regRow = { registration_id: `boot-${bootSeq}`, ts: nowIso, ...row };
    inserted.push(regRow);
    seq += 1;
    const event = {
      event_id: `lce-${createHash('sha256').update(item.id).digest('hex').slice(0, 20)}-${seq}`,
      object: item.id, from: null,
      to: { state: 'imported', life: item.life },
      event: 'bootstrap-import',
      actor: String(item.actor || 'cli'), authority: String(item.authority || 'contract'),
      evidence: [String(item.disposition || ''), String(item.reason || '')].filter(Boolean),
      actions: [{ type: 'bootstrap-import', path: item.path, disposition: item.disposition || '' }],
      occurred_at: nowIso,
    };
    inserted.push({ __lifecycle: event });
  }
  return { rows: inserted.filter((x) => !x.__lifecycle), events: inserted.filter((x) => x.__lifecycle).map((x) => x.__lifecycle), replayed };
}

// ───────────────────────────────────────────────────────────────────────────
// check：双账一致 + 投影重建 + bootstrap 对账（期望值全部从账本/磁盘解析）
// ───────────────────────────────────────────────────────────────────────────
function runCheck(cfg, repoRoot) {
  assertNoPendingTransaction(cfg);
  const errors = [];
  const logAbs = cfgPath(cfg, 'log');
  const lcAbs = cfgPath(cfg, 'lifecycle');
  const logRows = [];
  const lcEvents = [];
  readLines(logAbs).forEach((l, i) => {
    try { const row = JSON.parse(l); validateLogRow(row, i + 1); logRows.push(row); }
    catch (e) { errors.push(e instanceof CliError ? e.message : `log.jsonl 第 ${i + 1} 行: ${e.message}`); }
  });
  readLines(lcAbs).forEach((l, i) => {
    try { lcEvents.push(parseLifecycleRow(JSON.parse(l), i + 1)); }
    catch (e) { errors.push(e instanceof CliError ? e.message : `lifecycle.jsonl 第 ${i + 1} 行: ${e.message}`); }
  });
  // id / event_id / seq 唯一性
  const idSeen = new Set();
  for (const r of logRows) {
    if (idSeen.has(r.id)) errors.push(`log.jsonl id 重复: ${r.id}`);
    idSeen.add(r.id);
  }
  const evtSeen = new Set();
  for (const ev of lcEvents) {
    const k = String(ev.event_id);
    if (evtSeen.has(k)) errors.push(`lifecycle.jsonl event_id 重复: ${k}`);
    evtSeen.add(k);
  }
  const seqSeen = new Set();
  for (const ev of lcEvents) {
    if (seqSeen.has(ev.__seq)) errors.push(`lifecycle.jsonl seq 重复: ${ev.__seq}`);
    seqSeen.add(ev.__seq);
  }
  // 折叠（非法 transition → 记入 errors，不中断后续统计）
  let folded;
  try {
    folded = foldLifecycle([...lcEvents].sort((a, b) => a.__seq - b.__seq));
  } catch (e) {
    errors.push(e.message);
    folded = new Map();
  }
  // 双账双向对账 + life 折叠一致
  const logIds = new Set(logRows.map((r) => r.id));
  for (const r of logRows) if (!folded.has(r.id)) errors.push(`log 行无 lifecycle 事件: ${r.id}`);
  for (const obj of folded.keys()) if (!logIds.has(obj)) errors.push(`lifecycle 事件对象无 log 行: ${obj}`);
  for (const r of logRows) {
    const f = folded.get(r.id);
    if (f && f.life !== r.life) errors.push(`life 对账失败（fail closed）: ${r.id} log.life=${r.life} 折叠=${f.life}`);
  }
  // 投影重建：path 存在 + 模板（register 行）/ 安全（boot- 行）
  for (const r of logRows) {
    if (isAbsolute(r.path) || r.path.split(/[\\/]/).includes('..')) { errors.push(`path 不安全: ${r.path}`); continue; }
    if (!existsSync(resolve(repoRoot, r.path))) { errors.push(`log 登记的 path 磁盘缺失: ${r.path}`); continue; }
    if (!String(r.registration_id).startsWith('boot-')) {
      const parsed = parseId(r.id);
      const base = basename(r.path);
      const dirOf = dirname(r.path).split(sep).join('/');
      if (dirOf !== join('docs', 'wiki', 'jijiebei', parsed.name) || !base.startsWith(`r${parsed.ts.slice(1)}.`)) {
        errors.push(`非 bootstrap 行 path 不符合模板: ${r.path}（id=${r.id}）`);
      }
    }
  }
  // bootstrap 对账：仅当 bootstrap.json 存在；coverage 语义（Alioth v2 blocker 修复）：
  // 基线 = git tracked Markdown（git ls-files '*.md' '*.mdx'）∩ coverage globs，
  // ∪ bootstrap items 显式声明的本轮 governed path（如 untracked 新页）∩ globs。
  // disposition 可由 bootstrap item 或任一已落账 log/register path 提供；后者避免
  // 已注册 Markdown 在提交后被误报 MISSING_DISPOSITION。
  // ignored（node_modules/design inputs/poster/.harness* runtime）与未声明 untracked 一律不进 coverage。
  const bootAbs = cfgPath(cfg, 'bootstrap');
  let bootstrap = null;
  let coverageFiles = 0;
  if (existsSync(bootAbs)) {
    bootstrap = readJsonOrNull(bootAbs);
    if (bootstrap && !bootstrap.__parse_error) {
      const coverage = Array.isArray(bootstrap.coverage) ? bootstrap.coverage : [];
      if (coverage.length === 0) errors.push('bootstrap.json coverage 为空（无法界定覆盖范围）');
      const itemPaths = new Set(bootstrap.items.map((i) => i.path));
      const ledgerPaths = new Set(logRows.map((r) => r.path));
      const dispositionPaths = new Set([...itemPaths, ...ledgerPaths]);
      const coveredFiles = new Set(scanCoverage(repoRoot, coverage, itemPaths));
      coverageFiles = coveredFiles.size;
      for (const p of coveredFiles) if (!dispositionPaths.has(p)) errors.push(`MISSING_DISPOSITION: 磁盘有 ${p} 但 bootstrap/log 未登记（缺 disposition）`);
      for (const p of itemPaths) if (!coveredFiles.has(p)) errors.push(`bootstrap 登记的 ${p} 不在 coverage 覆盖内/磁盘缺失`);
      const bootRows = logRows.filter((r) => String(r.registration_id).startsWith('boot-'));
      const bootPaths = new Set(bootRows.map((r) => r.path));
      for (const i of bootstrap.items) if (!ledgerPaths.has(i.path)) errors.push(`bootstrap.json 的 ${i.path} 未在 log 落账`);
      for (const p of bootPaths) if (!itemPaths.has(p)) errors.push(`log 有 bootstrap 行 ${p} 但 bootstrap.json 未声明`);
      // SHA 对账只对「当前 bootstrap.json 中的 item」强制（gen3 A3#7：历史 boot 快照的
      // id 已不在 bootstrap.json 的，只验存在性与格式——存在性由上方 path 检查覆盖、行格式
      // 由 validateLogRow 覆盖——不因文件演进报红，历史快照是锁定时刻的引用）。
      const currentBootIds = new Set(bootstrap.items.map((i) => i.id));
      for (const r of bootRows) {
        if (!currentBootIds.has(r.id)) continue; // 历史快照：跳过 SHA 对账
        const abs = resolve(repoRoot, r.path);
        if (existsSync(abs) && sha256Text(readFileSync(abs, 'utf8')) !== r.source_sha256) {
          errors.push(`SOURCE_SHA_DRIFT: ${r.path} 磁盘 SHA 与 bootstrap 快照不一致`);
        }
      }
    } else if (bootstrap && bootstrap.__parse_error) {
      errors.push(`bootstrap.json 解析失败: ${bootstrap.__parse_error}`);
    }
  }
  const counts = {
    log_lines: logRows.length,
    lifecycle_events: lcEvents.length,
    objects: folded.size,
    by_type: Object.fromEntries(DEFAULT_CONFIG.types.map((t) => [t, logRows.filter((r) => r.type === t).length])),
    by_life: Object.fromEntries(LIFE_VALUES.map((l) => [l, logRows.filter((r) => r.life === l).length])),
    bootstrap_items: bootstrap ? bootstrap.items.length : 0,
    coverage_files: coverageFiles,
  };
  if (errors.length) return { status: 'fail', code: 'CHECK_FAILED', counts, errors, folded };
  return { status: 'ok', code: 'CHECK_OK', counts, errors: [], folded };
}

// ───────────────────────────────────────────────────────────────────────────
// README 投影单一模型（gen3 A3#8）：log 行 → §8 表期望行（id/title/type/life/path 逐列）。
// docs-drift-check §H 只消费本模型（projectReadmeTable / checkReadmeProjection），
// 消除第二套投影算法；bootstrap 数 / 测试数以参数传入，不硬编码第三份真相。
// ───────────────────────────────────────────────────────────────────────────
export function projectReadmeTable(cfg, repoRoot) {
  const rows = readLines(cfgPath(cfg, 'log')).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  // §8 表语义 = 注册行（register-*）；boot 导入存量文档由 bootstrap.json 管理、不进表
  return rows.filter((r) => !String(r.registration_id || '').startsWith('boot-'))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((r) => ({ id: r.id, title: r.title, type: r.type, life: r.life, path: r.path }));
}

export function checkReadmeProjection(cfg, repoRoot, { readmeAbs = null, bootstrapCount = null, testCount = null } = {}) {
  const problems = [];
  const expected = projectReadmeTable(cfg, repoRoot);
  const readmePath = readmeAbs || join(cfg.wikiDir, 'README.md');
  if (!existsSync(readmePath)) {
    problems.push('README.md 缺失（§8 投影表无从对账）');
    return { ok: false, problems, expectedRows: expected.length, actualRows: 0 };
  }
  const text = readFileSync(readmePath, 'utf8');
  const lines = text.split('\n');
  // 表头定位：任一含 id 且含 title/type/life/path 之一的表头行；按列名解析列位（自适应列序）
  let headerIdx = -1, cells = null;
  for (let i = 0; i < lines.length; i++) {
    const c = lines[i].split('|').map((x) => x.trim());
    if (c.includes('id') && ['title', 'type', 'life', 'path'].some((n) => c.includes(n))) { headerIdx = i; cells = c; break; }
  }
  if (cells === null) {
    problems.push('README §8 表头未找到（应含 id/title/type/life/path 列中的至少两者）');
    return { ok: false, problems, expectedRows: expected.length, actualRows: 0 };
  }
  const col = (name) => cells.indexOf(name);
  const iId = col('id'), iT = col('title'), iTy = col('type'), iL = col('life'), iP = col('path');
  if (iT === -1) problems.push('README §8 表缺 title 列');
  if (iTy === -1) problems.push('README §8 表缺 type 列');
  if (iL === -1) problems.push('README §8 表缺 life 列');
  if (iP === -1) problems.push('README §8 表缺 path 列');
  const actual = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) continue; // 表结束（§8 表是连续表行）
    const cc = line.split('|').map((x) => x.trim());
    if (iId === -1 || !cc[iId]) continue; // 空行片段
    if (!parseId(cc[iId])) continue;      // 只认 jijiebei/<slug>@r<ts> 形式的 id 行（跳过其他容器表）
    // 跳过分隔行（|--|--|）
    if (cc.every((x) => x === '' || /^-{1,}$/.test(x))) continue;
    actual.push({
      id: cc[iId] ?? '', title: iT >= 0 ? (cc[iT] ?? '') : '', type: iTy >= 0 ? (cc[iTy] ?? '') : '',
      life: iL >= 0 ? (cc[iL] ?? '') : '', path: iP >= 0 ? (cc[iP] ?? '') : '',
    });
  }
  // 逐列对账：README 每行 ↔ 账本期望（id 唯一锚定）；多出/漏登/列值漂移均红
  const expById = new Map(expected.map((r) => [r.id, r]));
  for (const a of actual) {
    const e = expById.get(a.id);
    if (!e) { problems.push(`README §8 表多出账本无注册行: ${a.id}`); continue; }
    for (const [k, v] of [['title', iT], ['type', iTy], ['life', iL], ['path', iP]]) {
      if (v >= 0 && a[k] !== e[k]) {
        problems.push(`README §8 表 ${a.id} 列 ${k} 漂移：README=${JSON.stringify(a[k])} 账本=${JSON.stringify(e[k])}`);
      }
    }
    expById.delete(a.id);
  }
  for (const miss of expById.keys()) problems.push(`README §8 表漏登账本注册行: ${miss}`);
  // 计数对账（参数传入，非硬编码）：README 声明的 bootstrap 篇数与测试例数
  if (bootstrapCount !== null) {
    const mb = text.match(/(\d+)\s*篇既有\s*tracked\s*Markdown/)
      || text.match(/(\d+)\s*项\s*Markdown\s*disposition/)
      || text.match(/bootstrap(?:（|\(|\s)?(\d+)\s*(?:篇|项)/);
    if (!mb) problems.push(`README 未找到 bootstrap 条目数声明（应声明 ${bootstrapCount} 项）`);
    else if (Number(mb[1]) !== Number(bootstrapCount)) problems.push(`README bootstrap 篇数声明 ${mb[1]} ≠ 传入 ${bootstrapCount}`);
  }
  if (testCount !== null) {
    const mt = text.match(/#\s*(\d+)\s*例/) || text.match(/(\d+)\s*例，覆盖/);
    if (!mt) problems.push(`README 未找到测试例数声明（应声明 ${testCount} 例）`);
    else if (Number(mt[1]) !== Number(testCount)) problems.push(`README 测试例数声明 ${mt[1]} ≠ 传入 ${testCount}`);
  }
  return { ok: problems.length === 0, problems, expectedRows: expected.length, actualRows: actual.length };
}

// 机械枚举测试文件顶层 test(...) 用例数（docs-drift §H 以参数传入 README 投影对账）
export function countTestCases(testFileAbs) {
  if (!existsSync(testFileAbs)) return 0;
  return (readFileSync(testFileAbs, 'utf8').match(/^test\(/gm) || []).length;
}

// coverage globs → governed Markdown 集合：支持 **（跨目录）/ *（段内）/ ?（单字符）。
// 基线 = git tracked（git ls-files '*.md' '*.mdx'）∩ globs，∪ 显式声明（declared，本轮 governed untracked）∩ globs。
// 不 walk 磁盘树——ignored（node_modules/.harness*/design inputs）与未声明 untracked 天然排除（blocker 修复语义）。
function scanCoverage(repoRoot, globs, declared = new Set()) {
  const arr = Array.isArray(globs) ? globs : [globs];
  // 整串转换（避免段级 join('/') 与段内斜杠叠加）；`**/` 必须走占位符——注入串含 * 和 ?，
  // 会被后续 replace 二次处理（gen2 修复时踩过：(?:[^/]+/)* 被改写成 ([^/]:/[^/]+)[^/]*）
  const res = arr.map((glob) => new RegExp(`^${glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '\u0000D\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\u0000D\u0000/g, '(?:[^/]+/)*')}$`));
  let tracked = [];
  try {
    const out = execFileSync('git', ['-C', repoRoot, 'ls-files', '-z', '--', '*.md', '*.mdx'], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
    tracked = out.toString('utf8').split('\0').filter(Boolean);
  } catch (e) {
    const stderr = Buffer.isBuffer(e?.stderr) ? e.stderr.toString('utf8').trim() : String(e?.stderr || '').trim();
    const detail = stderr.split('\n').filter(Boolean)[0] || String(e?.message || 'unknown error').slice(0, 200);
    throw new CliError('FATAL_CONFIG', `git ls-files 枚举 coverage 失败（fail closed）: ${detail}`, 2);
  }
  const candidates = new Set([...tracked, ...declared]);
  return [...candidates].filter((p) => res.some((re) => re.test(p))).sort();
}

// ───────────────────────────────────────────────────────────────────────────
// 子命令实现
// ───────────────────────────────────────────────────────────────────────────
function cmdRegister(cfg, repoRoot, argv) {
  const manifestPath = argValue(argv, '--manifest');
  if (!manifestPath) throw new CliError('INVALID_INPUT', 'register 需要 --manifest <file>');
  const manifest = readManifest(manifestPath);
  const nowIso = new Date().toISOString();
  const prep = prepareRegister(cfg, repoRoot, manifest, nowIso);
  const { lock, recovered } = withLock(cfg);
  try {
    const existing = readLines(cfgPath(cfg, 'log')).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const prev = existing.find((r) => r.id === prep.row.id);
    if (prev) {
      const cmp = (o) => { const c = { ...stripMeta(o) }; delete c.registration_id; delete c.ts; return c; };
      if (stableStringify(cmp(prep.row)) === stableStringify(cmp(prev))) {
        return { status: 'ok', code: 'REPLAYED', recovered, counts: { log_lines: existing.length }, errors: [], message: `已注册（幂等 REPLAYED）: ${prep.row.id}` };
      }
      throw new CliError('REGISTRATION_CONFLICT', `id 已存在且字段不一致: ${prep.row.id}`);
    }
    const events = readLines(cfgPath(cfg, 'lifecycle')).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const seq = maxLifecycleSeq(events) + 1;
    const regRow = {
      registration_id: `reg-${createHash('sha256').update(prep.row.id + nowIso).digest('hex').slice(0, 12)}`,
      ts: nowIso, ...stripMeta(prep.row),
    };
    const event = {
      event_id: `lce-${createHash('sha256').update(prep.row.id).digest('hex').slice(0, 20)}-${seq}`,
      object: prep.row.id, from: null,
      to: { state: 'registered', life: prep.row.life },
      event: prep.event.event, actor: prep.event.actor, authority: prep.event.authority,
      evidence: prep.event.evidence || [], actions: prep.event.actions || [],
      occurred_at: nowIso,
    };
    commitAppend(cfg, [regRow], [event]);
    return { status: 'ok', code: 'OK', recovered, counts: { log_lines: existing.length + 1, lifecycle_events: events.length + 1 }, errors: [], message: `已注册: ${prep.row.id}` };
  } finally {
    releaseLock(cfg, lock.token);
  }
}

function cmdBootstrap(cfg, repoRoot, argv) {
  const manifestPath = argValue(argv, '--manifest');
  if (!manifestPath) throw new CliError('INVALID_INPUT', 'bootstrap 需要 --manifest <file>');
  const manifest = readManifest(manifestPath);
  const nowIso = new Date().toISOString();
  const { lock, recovered } = withLock(cfg);
  try {
    const prep = prepareBootstrap(cfg, repoRoot, manifest, nowIso);
    if (prep.events.length === 0) {
      return { status: 'ok', code: 'REPLAYED', recovered, counts: { inserted: 0, replayed: prep.replayed.length }, errors: [], message: 'bootstrap 全部幂等（REPLAYED），无新增' };
    }
    commitAppend(cfg, prep.rows, prep.events);
    return {
      status: 'ok', code: 'OK', recovered,
      counts: { inserted: prep.rows.length, replayed: prep.replayed.length, lifecycle_events: prep.events.length },
      errors: [], message: `bootstrap 导入 ${prep.rows.length} 篇（${prep.replayed.length} 篇幂等跳过）`,
    };
  } finally {
    releaseLock(cfg, lock.token);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// transition：事务性 lifecycle 修正（gen3 A3#6）。同一 lock+journal 事务内
// append lifecycle 事件 + 把对应 log 行 life 重算为折叠值（复用 commitAppend 的
// replaced_log_rows 事务替换 + base 校验）。仅支持经显式 manifest（对象 id、目标
// 事件、evidence 列表）的修正，不提供任意 shell 改账通道；非法转换 INVALID_TRANSITION
// fail closed。本轮可达：correct-life（digest 误记 knowledge → flow）、archive（历史原稿归档）。
// ───────────────────────────────────────────────────────────────────────────
function cmdTransition(cfg, repoRoot, argv) {
  const manifestPath = argValue(argv, '--manifest');
  if (!manifestPath) throw new CliError('INVALID_INPUT', 'transition 需要 --manifest <file>');
  const manifest = readManifest(manifestPath);
  const req = (v, why) => { if (v === undefined || v === null || v === '') throw new CliError('INVALID_INPUT', `transition manifest 缺字段 ${why}`); };
  req(manifest.id, 'id');
  req(manifest.event, 'event');
  if (!Array.isArray(manifest.evidence)) throw new CliError('INVALID_INPUT', 'transition manifest 的 evidence 必须为数组');
  if (!parseId(manifest.id)) throw new CliError('INVALID_INPUT', `transition id 非法: ${JSON.stringify(manifest.id)}`);
  const nowIso = new Date().toISOString();
  const { lock, recovered } = withLock(cfg);
  try {
    const rows = readLines(cfgPath(cfg, 'log')).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const row = rows.find((r) => r.id === manifest.id);
    if (!row) throw new CliError('NOT_FOUND', `transition 目标 id 未在 log: ${manifest.id}`);
    const events = readLines(cfgPath(cfg, 'lifecycle')).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)
      .map((ev, i) => parseLifecycleRow(ev, i + 1)).sort((a, b) => a.__seq - b.__seq);
    const folded = foldLifecycle(events);
    const cur = folded.get(manifest.id);
    if (!cur) throw new CliError('NEEDS_RECOVERY', `transition 目标无折叠态: ${manifest.id}`);
    // 目标事件 → 语义化修正（本轮白名单，非法即 fail closed）
    let to;
    if (manifest.event === 'correct-life') {
      if (cur.life !== 'knowledge') throw new CliError('INVALID_TRANSITION', `correct-life 仅用于 knowledge 误记修正，当前 life=${cur.life}`);
      to = { state: cur.state, life: 'flow' };
    } else if (manifest.event === 'archive') {
      if (cur.state === 'archived' || cur.state === 'superseded') throw new CliError('INVALID_TRANSITION', `archive 不能用于已 ${cur.state} 对象`);
      to = { state: 'archived', life: 'archive' };
    } else {
      throw new CliError('INVALID_TRANSITION', `本轮 transition 仅支持 correct-life | archive，收到 ${JSON.stringify(manifest.event)}`);
    }
    const chk = isLegalTransition(manifest.event, cur.state, cur.life, to.state, to.life);
    if (!chk.ok) throw new CliError('INVALID_TRANSITION', `${manifest.id}: ${chk.why}`);
    const seq = maxLifecycleSeq(events) + 1;
    const event = {
      event_id: `lce-${createHash('sha256').update(`${manifest.id}|${manifest.event}`).digest('hex').slice(0, 20)}-${seq}`,
      object: manifest.id,
      from: { state: cur.state, life: cur.life }, // 审计位：折叠起点快照
      to,
      event: manifest.event,
      actor: String(manifest.actor || 'cli'), authority: String(manifest.authority || 'contract'),
      evidence: manifest.evidence.map(String),
      actions: [{ type: 'transition', event: manifest.event, id: manifest.id }],
      occurred_at: nowIso,
    };
    // log 行 life 重算为折叠值（append 事件后 foldLifecycle 的权威结果）
    const newEvents = [...events, { ...event, __seq: seq }];
    const newFolded = foldLifecycle(newEvents);
    const newLife = newFolded.get(manifest.id).life;
    const newRow = { ...row, life: newLife };
    commitAppend(cfg, [], [event], [{ id: manifest.id, before: row, after: newRow }]);
    return {
      status: 'ok', code: 'OK', recovered,
      counts: { log_lines: rows.length, lifecycle_events: events.length + 1, object: manifest.id, life: newLife },
      errors: [], message: `transition ${manifest.event} ${manifest.id} → life=${newLife}`,
    };
  } finally {
    releaseLock(cfg, lock.token);
  }
}

// 锁 + 恢复的公共包裹：进入锁后先恢复中断事务，返回 {lock, recovered}
function withLock(cfg) {
  const lock = acquireLock(cfg);
  let recovered;
  try {
    const r = recoverJournal(cfg);
    recovered = r.action === 'clean' ? null : r.action;
    if (r.action === 'aborted') {
      // 回滚已把账本收敛到事务前一致态，本次操作可安全继续；恢复信息随本次结果上报
      recovered = 'aborted';
    }
  } catch (e) {
    releaseLock(cfg, lock.token);
    throw e;
  }
  return { lock, recovered };
}

function cmdCheck(cfg, repoRoot, argv) {
  const res = runCheck(cfg, repoRoot);
  return { status: res.status, code: res.code, counts: res.counts, errors: res.errors, recovered: null };
}

function cmdQuery(cfg, repoRoot, argv) {
  assertNoPendingTransaction(cfg);
  const param = argv.find((a) => !a.startsWith('-'));
  if (!param) throw new CliError('INVALID_INPUT', 'query 需要 <id|path|slug>');
  const rows = readLines(cfgPath(cfg, 'log')).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const events = readLines(cfgPath(cfg, 'lifecycle')).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)
    .map((ev, i) => parseLifecycleRow(ev, i + 1)).sort((a, b) => a.__seq - b.__seq);
  const folded = foldLifecycle(events);
  let match;
  if (parseId(param)) match = rows.filter((r) => r.id === param);
  else if (/^jijiebei\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(param)) match = rows.filter((r) => r.id.startsWith(`${param}@`));
  else match = rows.filter((r) => r.path === param || r.path.includes(param));
  if (!match.length) throw new CliError('NOT_FOUND', `未找到: ${param}`);
  const out = match.map((r) => ({ ...r, folded: folded.get(r.id) || null }));
  return { status: 'ok', code: 'OK', counts: { matches: out.length }, errors: [], result: out.length === 1 ? out[0] : out };
}

function cmdBuildContext(cfg, repoRoot, argv) {
  assertNoPendingTransaction(cfg);
  const outArg = argValue(argv, '--out');
  const rows = readLines(cfgPath(cfg, 'log')).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const events = readLines(cfgPath(cfg, 'lifecycle')).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const folded = foldLifecycle(events.map((ev, i) => parseLifecycleRow(ev, i + 1)));
  const bySlug = new Map();
  for (const r of rows) {
    const { slug } = parseId(r.id);
    const cur = bySlug.get(slug);
    if (!cur || r.id > cur.id) bySlug.set(slug, r); // rev r<ts> 字典序 = 时间序，取最新为 head
  }
  const entries = [...bySlug.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([slug, r]) => ({
    slug, id: r.id, rev: r.id.split('@')[1], type: r.type,
    life: (folded.get(r.id) || {}).life || r.life, title: r.title, path: r.path,
  }));
  const payload = { generated_at: new Date().toISOString(), source: 'docs/wiki/{log,lifecycle}', entries };
  const outPath = outArg || join(repoRoot, cfg.contextManifest);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${stableStringify(payload)}\n`);
  return { status: 'ok', code: 'OK', counts: { slugs: entries.length, entries: entries.length }, errors: [], out: outPath };
}

// ───────────────────────────────────────────────────────────────────────────
// CLI 面
// ───────────────────────────────────────────────────────────────────────────
function argValue(argv, name) {
  const i = argv.indexOf(name);
  return i === -1 ? null : argv[i + 1];
}
function readManifest(path) {
  const abs = isAbsolute(path) ? path : resolve(process.cwd(), path);
  if (!existsSync(abs)) throw new CliError('MANIFEST_NOT_FOUND', `manifest 文件不存在: ${path}`);
  const obj = readJsonOrNull(abs);
  if (!obj || typeof obj !== 'object') throw new CliError('INVALID_INPUT', `manifest 不是 JSON 对象: ${path}`);
  if (obj.__parse_error) throw new CliError('INVALID_INPUT', `manifest JSON 解析失败: ${obj.__parse_error}`);
  return obj;
}
function emit(res, jsonMode) {
  if (jsonMode) {
    console.log(JSON.stringify({ status: res.status, code: res.code, recovered: res.recovered || null, counts: res.counts || {}, errors: res.errors || [], message: res.message || '', ...(res.result !== undefined ? { result: res.result } : {}), ...(res.out !== undefined ? { out: res.out } : {}) }));
    process.exit(res.status === 'fail' ? 1 : 0);
  }
  if (res.status === 'fail') {
    console.error(`[wiki-governance] ✗ ${res.code}: ${(res.errors || []).join('；')}`);
    process.exit(1);
  }
  if (res.recovered) console.log(`[wiki-governance] 恢复: ${res.recovered}`);
  console.log(`[wiki-governance] ✓ ${res.code} — ${res.message || ''}`);
  if (res.counts && Object.keys(res.counts).length) console.log(`[wiki-governance] ${JSON.stringify(res.counts)}`);
  if (res.errors && res.errors.length) process.stderr.write(res.errors.join('\n') + '\n');
}

function main() {
  const argv = process.argv.slice(2);
  const jsonMode = argv.includes('--json');
  const repoRootArg = argValue(argv, '--repo-root');
  const repoRoot = repoRootArg && !argv.includes('--help') ? resolve(process.cwd(), repoRootArg) : AUTO_REPO_ROOT;
  const cmd = argv.find((a) => !a.startsWith('-'));
  if (!cmd || argv.includes('--help')) {
    console.log('wiki-governance — JJB Alioth v2 账本 registrar\n' +
      '用法:\n  bootstrap --manifest <bootstrap.json> [--json] [--repo-root <d>]\n  register --manifest <manifest.json> [--json] [--repo-root <d>]\n  transition --manifest <transition.json> [--json] [--repo-root <d>]\n  check [--json]\n  query <id|path|slug> [--json]\n  build-context [--out <path>] [--json]');
    process.exit(cmd ? 0 : 2);
  }
  try {
    const cfg = loadConfig(repoRoot);
    const rest = argv.slice(1); // 子命令名之后才是参数（query 的 positional 从此取）
    let res;
    switch (cmd) {
      case 'register': res = cmdRegister(cfg, repoRoot, rest); break;
      case 'bootstrap': res = cmdBootstrap(cfg, repoRoot, rest); break;
      case 'transition': res = cmdTransition(cfg, repoRoot, rest); break;
      case 'check': res = cmdCheck(cfg, repoRoot, rest); break;
      case 'query': res = cmdQuery(cfg, repoRoot, rest); break;
      case 'build-context': res = cmdBuildContext(cfg, repoRoot, rest); break;
      default: throw new CliError('INVALID_INPUT', `未知子命令: ${cmd}`, 2);
    }
    emit(res, jsonMode);
  } catch (e) {
    const code = e.code || 'FATAL';
    const exit = e.exitCode === undefined ? (code === 'FATAL' ? 2 : 1) : e.exitCode;
    const status = exit === 2 ? 'fatal' : 'fail';
    if (jsonMode) {
      console.log(JSON.stringify({ status, code, recovered: null, counts: {}, errors: [e.message || String(e)], message: '' }));
    } else {
      console.error(`[wiki-governance] ✗ ${code}: ${e.message}`);
    }
    process.exit(exit);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();

export { main, runCheck, loadConfig, prepareRegister, prepareBootstrap, foldLifecycle, commitAppend, recoverJournal, stableStringify, sha256Text, parseId, DEFAULT_CONFIG, MODES, TRANSITIONS, CliError };
