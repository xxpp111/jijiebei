#!/usr/bin/env node
// docs-drift-check — 文档=真相 机器护栏（测试体系第①层 · 2026-07-05 R8 新增）。
// 把「文档漂移靠人肉记忆」变成机器门：静态断言四类文档正文引用的路径/清单与磁盘一致。
//
// 设计红线：期望值一律【从文档正文解析】（regex 提取），绝不把期望硬编码成第三份真相
//   ——否则本脚本自己就成了会漂的第四处副本。磁盘是唯一被对照的事实源。
// 只读语义：本脚本零写入工作树（只 read + stat）。
//
// 断言七项：
//   A. docs/architecture.md §1.2「核心逻辑模块」表引用的 web/src/logic/*.ts 全部真实存在
//   B. 根 README.md §2 目录地图列出的目录/文件路径全部真实存在
//   C. .claude/skills/jjb-deploy/SKILL.md 无 jjb-live-dock 残留（部署取码分支已收敛 jjb-platform）
//   D. docs/testing.md §3 声称的 e2e 脚本清单与磁盘 web/e2e|flows + admin/e2e 实际逐一对上（数量/名称双向）
//   E. governed 活文档 front matter 齐备且合规（docs/ 顶层 *.md + docs/archive/README.md +
//      design/README.md + diagrams/README.md；title/id/status/owner/updated/applies_to/replaces/evidence
//      /review_after 必填且值非空，id 唯一且 jijiebei/<小写kebab-case>，title 含中文，
//      status ∈ current|superseded|draft；current/draft 的 review_after 须 YYYY-MM-DD，
//      superseded 兼容页为纯指针、无复审周期，豁免 review_after 必填）
//   F. docs/README.md 导航内全部本地链接目标存在，且须为真相对路径（拒绝 `/` 等绝对路径）、
//      resolve 后不越出 repo 根目录（允许 ../design/ 等跨目录登记）；current/draft id 全部登记进
//      docs/README id 表；superseded 兼容指针页 ≤30 行、正文恰为三行：一个 `# ` H1、一个空行、
//      单条含相对链接的 `> ` 指针行且 blockquote 内容不得以 Markdown 块级标记开头（严格拒绝 `>>`
//      嵌套引用与 quoted-H2/列表/表格/代码围栏伪装；禁额外空行/多 blockquote/无链接 blockquote/
//      顺序变化）；指针目标须留在 docs 根目录内且存在（R6：拒绝对路径与 `../` 越出 docs）
//   G. docs/testing.md 摘要三计数与磁盘机械枚举一致（根级 e2e 数 / flows 数 / vitest 单测文件数）
//
// 用法：node web/scripts/docs-drift-check.mjs   （repo 根或任意 cwd 均可，路径自锚定）
// 退出码：0 全绿 / 1 有漂移或缺失 / 2 脚本自身错误（找不到应存在的文档）
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve, isAbsolute, relative } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..'); // web/scripts/ -> repo 根
const R = (...p) => resolve(repoRoot, ...p);

let failed = 0;
let checks = 0;
const fail = (msg) => { console.error(`DRIFT: ${msg}`); failed++; };
const ok = (msg) => { console.log(`OK: ${msg}`); };

function readDoc(rel) {
  const abs = R(rel);
  if (!existsSync(abs)) {
    console.error(`FATAL: 应存在的文档缺失 ${rel}（脚本无法断言，非漂移而是环境错）`);
    process.exit(2);
  }
  return readFileSync(abs, 'utf8');
}

// markdown 链接目标分类 + 目录 containment（2026-08-22 R6，Codex R5 final blocker 修复）：
//   external = `scheme://` 外链（跳过，不适用本地存在性语义）；
//   absolute = `/`、`//host/…` 等文件系统绝对路径 —— 直接拒。此前 `R('docs', '/')` 会 resolve 到
//              文件系统根目录且 exists=true，被误计作「相对链接」绕过兼容指针门，故绝对路径必须在
//              存在性检查之前单独分类，绝不靠「目标恰好 exists」放过；
//   escape   = 真相对路径但 resolve 后越出 containment 根（`../` 逃逸）；
//   relative = 合法相对链接（返回 resolved 绝对路径供存在性检查）。
// 调用方文案必须区分「绝对路径」与「越出目录」两类失败，供红例证明失败原因唯一。
const EXTERNAL_LINK_RE = /^[a-z]+:\/\//;
function classifyLink(target, baseDir, containmentRoot) {
  if (EXTERNAL_LINK_RE.test(target)) return { kind: 'external' };
  if (isAbsolute(target)) return { kind: 'absolute' };
  const resolved = resolve(baseDir, target);
  const off = relative(containmentRoot, resolved);
  if (off.startsWith('..') || isAbsolute(off)) return { kind: 'escape', resolved };
  return { kind: 'relative', resolved };
}

// 取某个 markdown 标题（^#{1,6} ...pattern...）之后、下一个【同级或更高级】标题之前的正文块。
function sliceSection(text, headingRegex) {
  const lines = text.split(/\r?\n/);
  let start = -1;
  let startLevel = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+(.*)$/);
    if (m && headingRegex.test(lines[i])) { start = i + 1; startLevel = m[1].length; break; }
  }
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+/);
    if (m && m[1].length <= startLevel) { end = i; break; }
  }
  return lines.slice(start, end).join('\n');
}

// ───────────────────────────────────────────────────────────────────────────
// A. architecture.md §1.2 核心逻辑模块 → web/src/logic/*.ts 存在性
// ───────────────────────────────────────────────────────────────────────────
checks++;
{
  const arch = readDoc('docs/architecture.md');
  const sec = sliceSection(arch, /核心逻辑模块/);
  if (!sec) {
    fail('architecture.md 找不到「核心逻辑模块」小节（§1.2 标题漂移？）');
  } else {
    // 表格首列形如 `jjbSession.ts` —— 取所有 `xxx.ts` 反引号内联码
    const names = [...sec.matchAll(/`([A-Za-z0-9_]+\.ts)`/g)].map((m) => m[1]);
    const uniq = [...new Set(names)];
    if (uniq.length === 0) {
      fail('architecture.md §1.2 未解析出任何 `*.ts` 模块名（表格格式漂移？）');
    } else {
      const missing = uniq.filter((n) => !existsSync(R('web/src/logic', n)));
      if (missing.length) fail(`architecture.md §1.2 引用的 logic 模块在磁盘缺失: ${missing.join(', ')}（web/src/logic/ 下）`);
      else ok(`A. architecture.md §1.2 ${uniq.length} 个 logic 模块全部存在于 web/src/logic/`);
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// B. README.md §2 目录地图 → 路径存在性
// ───────────────────────────────────────────────────────────────────────────
checks++;
{
  const readme = readDoc('README.md');
  const sec = sliceSection(readme, /目录地图/);
  if (!sec) {
    fail('README.md 找不到「目录地图」小节（§2 标题漂移？）');
  } else {
    // §2 目录地图是【缩进树】：`│   ` / 4 空格 = 一级；`├──`/`└──` 后是本级条目。
    // 期望值全部从树解析：按缩进深度维护父栈 → 重建完整相对路径 → 逐一 stat。
    // 这比只验顶级更强（连 web/src/logic/legacy、backend/config/scoring.json 等嵌套项也校验）。
    const rawLines = sec.split(/\r?\n/);
    const paths = new Set();
    const stack = []; // stack[d] = 该深度的目录名（去尾斜杠）
    for (const line of rawLines) {
      // 跳过代码围栏 / 根节点 `jijiebei/` / 空行
      if (/^\s*```/.test(line) || /^\s*$/.test(line)) continue;
      const branchIdx = line.search(/[├└]──/);
      if (branchIdx === -1) continue; // 无树枝的行（根 or 说明）跳过
      // 深度 = 树枝前的缩进宽度 / 4（`│   ` 或 4 空格为一级）。用可视列宽估计：
      // 把树枝前缀里的 │ 与空格都算进宽度，每 4 列一级。
      const prefix = line.slice(0, branchIdx);
      const depth = Math.round(prefix.replace(/\t/g, '    ').length / 4);
      // 本级条目文本：树枝后到 ← 注释 / 行尾
      const afterBranch = line.slice(branchIdx).replace(/^[├└]──\s*/, '');
      const entry = afterBranch.split('←')[0].trim();
      if (!entry) continue;

      // 收窄父栈到当前深度
      stack.length = depth;

      // 单行多文件形式（`main.go / hooks.go / routes.go / scoring.go`）：逐个挂当前父目录
      if (/\s\/\s/.test(entry) && !entry.endsWith('/')) {
        const parent = stack.slice(0, depth).join('/');
        for (const tok of entry.split(/\s\/\s/)) {
          const name = tok.trim();
          if (!/^[A-Za-z0-9_.][A-Za-z0-9_.-]*$/.test(name)) continue;
          paths.add(parent ? `${parent}/${name}` : name);
        }
        continue;
      }

      // 取本级 token（首个路径样 token；结尾可带 /）。排除含 + 、通配、省略的示意条目。
      const m = entry.match(/^([A-Za-z0-9_.][A-Za-z0-9_./-]*\/?)/);
      if (!m) continue;
      const nameRaw = m[1].replace(/\/$/, '');
      if (/[*…+]/.test(entry.split(/\s/)[0]) || /[*…]/.test(nameRaw)) continue;
      // 记入父栈（供子级拼接）；本条目本身可能是目录或文件，均加入待验集
      stack[depth] = nameRaw.includes('/') ? nameRaw.split('/').pop() : nameRaw;
      // nameRaw 自身可能已含 /（如 logic/legacy），拼上父栈后仍是正确相对路径
      const normalized = stack.slice(0, depth).length
        ? `${stack.slice(0, depth).join('/')}/${nameRaw}`
        : nameRaw;
      paths.add(normalized);
    }
    if (paths.size === 0) {
      fail('README.md §2 目录地图未解析出任何路径（树格式漂移？）');
    } else {
      const missing = [...paths].filter((p) => !existsSync(R(p)));
      if (missing.length) fail(`README.md §2 目录地图列出但磁盘不存在: ${missing.sort().join(', ')}`);
      else ok(`B. README.md §2 目录地图 ${paths.size} 个路径全部真实存在（含嵌套项）`);
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// C. jjb-deploy SKILL.md 无 jjb-live-dock 残留
// ───────────────────────────────────────────────────────────────────────────
checks++;
{
  const skillRel = '.claude/skills/jjb-deploy/SKILL.md';
  const skill = readDoc(skillRel);
  const hits = (skill.match(/jjb-live-dock/g) || []).length;
  if (hits > 0) fail(`${skillRel} 含 ${hits} 处 jjb-live-dock 残留（部署取码分支应为 jjb-platform）`);
  else ok(`C. ${skillRel} 无 jjb-live-dock 残留`);
}

// ───────────────────────────────────────────────────────────────────────────
// D. testing.md §3 e2e 脚本清单 ↔ 磁盘实际（双向逐一对上）
// ───────────────────────────────────────────────────────────────────────────
checks++;
{
  const testing = readDoc('docs/testing.md');
  // §3「... e2e 脚本覆盖矩阵」主表 + 「flows 覆盖矩阵」子表，均在 §3 下。
  // 取 §3 整块（到下一个 ## 前），从中解析所有加粗脚本名 **xxx.mjs** / **xxx.flow.mjs**。
  const sec = sliceSection(testing, /e2e 脚本覆盖矩阵/);
  if (!sec) {
    fail('testing.md 找不到「e2e 脚本覆盖矩阵」小节（§3 标题漂移？）');
  } else {
    const docNames = new Set(
      [...sec.matchAll(/\*\*([A-Za-z0-9_.-]+\.mjs)\*\*/g)].map((m) => m[1])
    );
    if (docNames.size === 0) {
      fail('testing.md §3 未解析出任何 **脚本名.mjs**（表格加粗格式漂移？）');
    } else {
      // 磁盘事实：§3 文档描述的三棵树 —— web/e2e/*.mjs + web/e2e/flows/*.mjs + admin/e2e/*.mjs
      // （admin-smoke.mjs 住 admin/e2e/，被 §3 主表收录并在 §2/§1.5 交叉引用，故纳入对照范围）
      const listMjs = (relDir) => {
        const abs = R(relDir);
        if (!existsSync(abs)) return [];
        return readdirSync(abs).filter((f) => f.endsWith('.mjs') && statSync(join(abs, f)).isFile());
      };
      const diskNames = new Set([
        ...listMjs('web/e2e'),
        ...listMjs('web/e2e/flows'),
        ...listMjs('admin/e2e'),
      ]);
      const inDocNotDisk = [...docNames].filter((n) => !diskNames.has(n));
      const inDiskNotDoc = [...diskNames].filter((n) => !docNames.has(n));
      if (inDocNotDisk.length || inDiskNotDoc.length) {
        if (inDocNotDisk.length) fail(`testing.md §3 列出但磁盘无此 e2e 脚本: ${inDocNotDisk.sort().join(', ')}`);
        if (inDiskNotDoc.length) fail(`磁盘存在但 testing.md §3 未记录的 e2e 脚本: ${inDiskNotDoc.sort().join(', ')}`);
      } else {
        ok(`D. testing.md §3 e2e 清单与磁盘一致（${docNames.size} 个脚本，web/e2e + flows + admin/e2e 双向对齐）`);
      }
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// E. governed 活文档 front matter 齐备且合规（文档治理 v1 · 2026-08-22 新增）
// ───────────────────────────────────────────────────────────────────────────
const FRONT_MATTER_REQUIRED = ['title', 'id', 'status', 'owner', 'updated', 'applies_to', 'replaces', 'evidence', 'review_after'];
const STATUS_ENUM = new Set(['current', 'superseded', 'draft']);
const KEBAB_ID_RE = /^jijiebei\/[a-z0-9]+(-[a-z0-9]+)*$/;
const CJK_RE = /[一-鿿]/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseFrontMatter(text, rel) {
  if (!text.startsWith('---\n')) return { fm: null, err: `${rel} 不以 YAML front matter（--- 开头）起始` };
  const end = text.indexOf('\n---\n', 4);
  if (end === -1) return { fm: null, err: `${rel} front matter 未闭合（缺行首 --- 结束线）` };
  const fm = {};
  for (const line of text.slice(4, end).split('\n')) {
    const m = line.match(/^([a-z_]+):\s*(.*)$/);
    if (m) fm[m[1]] = m[2].trim();
  }
  return { fm };
}

// status=current|draft 的 governed id 集合（供 F 检查对账 docs/README 登记完整性）
const activeIds = new Set();

{
  checks++;
  const governedDirs = [
    { relDir: 'docs', extra: ['docs/archive/README.md', 'design/README.md', 'diagrams/README.md'] },
  ];
  const files = [
    ...readdirSync(R('docs'))
      .filter((f) => f.endsWith('.md') && statSync(join(R('docs'), f)).isFile())
      .map((f) => `docs/${f}`),
    ...governedDirs[0].extra,
  ];
  const problems = [];
  const ids = new Map();
  for (const rel of files) {
    const { fm, err } = parseFrontMatter(readDoc(rel), rel);
    if (!fm) { problems.push(err); continue; }
    const isCompat = fm.status === 'superseded';
    for (const key of FRONT_MATTER_REQUIRED) {
      // superseded 兼容页是纯指针（无事实正文、无复审周期），豁免 review_after 必填
      if (key === 'review_after' && isCompat) continue;
      if (!(key in fm)) problems.push(`${rel} front matter 缺字段 ${key}`);
      else if (String(fm[key]).trim() === '') problems.push(`${rel} front matter 字段 ${key} 值为空`);
    }
    // id/title/status 无条件校验：缺字段或值空/非法都打红，不因假值静默跳过（2026-08-22 R2 加固）
    if (!KEBAB_ID_RE.test(fm.id ?? '')) {
      problems.push(`${rel} id 缺失或非法（应 jijiebei/<小写kebab-case>）: ${JSON.stringify(fm.id ?? '')}`);
    } else if (ids.has(fm.id)) {
      problems.push(`${rel} id 重复: ${fm.id}（先见于 ${ids.get(fm.id)}）`);
    } else {
      ids.set(fm.id, rel);
    }
    if (!CJK_RE.test(fm.title ?? '')) problems.push(`${rel} title 缺失或不含中文: ${fm.title ?? ''}`);
    if (!STATUS_ENUM.has(fm.status ?? '')) problems.push(`${rel} status 缺失或非法（current|superseded|draft）: ${fm.status ?? ''}`);
    if (!isCompat && !DATE_RE.test(fm.review_after ?? '')) {
      problems.push(`${rel} review_after 缺失或非 YYYY-MM-DD: ${fm.review_after ?? ''}`);
    }
    if (!isCompat && KEBAB_ID_RE.test(fm.id ?? '')) activeIds.add(fm.id);
  }
  if (problems.length) fail(`E. front matter 治理违规 ${problems.length} 处: ${problems.slice(0, 8).join('；')}${problems.length > 8 ? ' …' : ''}`);
  else ok(`E. ${files.length} 个 governed 文档 front matter 全部合规（${ids.size} 个 id 唯一、kebab、非空、中文 title；${activeIds.size} 个 current/draft 带 review_after）`);
}

// ───────────────────────────────────────────────────────────────────────────
// F. docs/README.md 导航相对链接 + superseded 兼容指针页（文档治理 v1 · 2026-08-22 新增）
// ───────────────────────────────────────────────────────────────────────────
{
  checks++;
  const readme = readDoc('docs/README.md');
  const problems = [];
  // 1) docs/README.md 内全部 markdown 本地链接：必须是真相对路径（拒绝对路径），resolve 后
  //    不得越出 repo 根目录（允许 ../design/README.md 等跨目录登记），且目标存在（锚点/外链跳过）
  const links = [...readme.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)].map((m) => m[1]);
  const relLinks = new Set();
  for (const target of new Set(links)) {
    const c = classifyLink(target, R('docs'), repoRoot);
    if (c.kind === 'external') continue;
    if (c.kind === 'absolute') { problems.push(`docs/README.md 链接不得使用绝对路径: ${target}`); continue; }
    if (c.kind === 'escape') { problems.push(`docs/README.md 链接解析后越出 repo 根目录: ${target}`); continue; }
    if (!existsSync(c.resolved)) problems.push(`docs/README.md 链接目标缺失: ${target}`);
    else relLinks.add(target);
  }
  // 2) current/draft id 全部登记进 docs/README 的 id 表（表格行首 |id| 形式；superseded 不要求注册）
  const registered = new Set(
    [...readme.matchAll(/^\|\s*(jijiebei\/[a-z0-9]+(?:-[a-z0-9]+)*)\s*\|/gm)].map((m) => m[1])
  );
  const unregistered = [...activeIds].filter((id) => !registered.has(id));
  if (unregistered.length) {
    problems.push(`docs/README.md id 表漏登 ${unregistered.length} 个 current/draft id: ${unregistered.sort().join(', ')}`);
  }
  // 3) superseded 兼容指针页：≤30 行；正文为精确 canonical 结构 —— 恰三行（2026-08-22 R3 收紧）：
  //    行1 = `# ` H1；行2 = 空行；行3 = 单条 `> ` 指针行且行内含 ≥1 个存在的相对链接。
  //    行3 双内容门（2026-08-22 R5 收紧，Codex final blocker 修复）：
  //    a. 严格 `> ` 开头 —— `>>`（嵌套引用）、`>无空格` 一律拒；
  //    b. blockquote 内容不得以 Markdown 块级标记开头（quoted-H2 / 无序 / 有序列表 / 嵌套引用 /
  //       表格 / 代码围栏伪装全部打红）；合法形态 = 普通段落 + 内联 code/粗体/普通中文 + 有效相对链接。
  //    额外空行、多条 blockquote、无链接 blockquote、顺序变化、H2/段落/列表/表格/代码围栏一律打红。
  //    （文件末尾恰一个换行符视为行尾而非第四行，按 POSIX 惯例豁免）
  const QUOTE_BLOCK_MARKER_RE = /^(#{1,6}(\s|$)|[-*+](\s|$)|\d+[.)](\s|$)|>|\||(`{3,}|~{3,}))/;
  for (const f of readdirSync(R('docs'))) {
    if (!f.endsWith('.md') || !statSync(join(R('docs'), f)).isFile()) continue;
    const rel = `docs/${f}`;
    const text = readDoc(rel);
    const { fm } = parseFrontMatter(text, rel);
    if (!fm || fm.status !== 'superseded') continue;
    if (text.split('\n').length > 30) problems.push(`${rel} 是 superseded 兼容页但超 30 行（应纯指针）`);
    const body = text.replace(/^---\n[\s\S]*?\n---\n/, '');
    // 只剥掉恰一个文件末尾换行符：末尾多余空行（额外空行红例）必须保留到行数里被拒
    const raw = body.endsWith('\n') ? body.slice(0, -1) : body;
    const lines = raw.split('\n');
    if (lines.length !== 3) {
      problems.push(`${rel} 兼容页正文应恰为三行（H1 + 空行 + 单条 blockquote 指针），实际 ${lines.length} 行`);
    } else {
      if (!/^#\s/.test(lines[0])) {
        problems.push(`${rel} 兼容页正文第 1 行应为 \`# \` H1，实际: ${lines[0].slice(0, 40)}`);
      }
      if (!/^\s*$/.test(lines[1])) {
        problems.push(`${rel} 兼容页正文第 2 行应为空行，实际: ${lines[1].slice(0, 40)}`);
      }
      if (!/^> /.test(lines[2])) {
        problems.push(`${rel} 兼容页正文第 3 行应为 \`> \` 指针行（严格拒绝 \`>>\` 嵌套引用），实际: ${lines[2].slice(0, 40)}`);
      } else if (QUOTE_BLOCK_MARKER_RE.test(lines[2].replace(/^>\s*/, ''))) {
        problems.push(`${rel} 兼容页指针 blockquote 内容不得以 Markdown 块级标记开头（标题/列表/引用/表格/代码围栏），实际: ${lines[2].slice(0, 40)}`);
      }
    }
    // 指针链接只认 blockquote 行：H1 行/空行里的链接不再计入（行数错位时链接断言仍可叠加定位）。
    // R6：目标必须是真相对路径且 resolve 后留在 <repo>/docs 根目录内 —— `/`（resolve 落文件系统
    // 根目录且 exists=true）与 `../README.md`（目标真实存在但在 docs 外）都不能靠「恰好存在」
    // 蒙混过存在性门，分类/containment 先拒，文案区分绝对路径与越出 docs 两类失败。
    const quoteLinks = lines
      .filter((l) => /^>/.test(l))
      .flatMap((l) => [...l.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)].map((m) => m[1]))
      .filter((t) => !EXTERNAL_LINK_RE.test(t));
    if (quoteLinks.length === 0) {
      problems.push(`${rel} 兼容页 blockquote 指针行无相对链接（应指向 canonical home）`);
    }
    for (const t of quoteLinks) {
      const c = classifyLink(t, R('docs'), R('docs'));
      if (c.kind === 'absolute') { problems.push(`${rel} 兼容指针不得使用绝对路径: ${t}`); continue; }
      if (c.kind === 'escape') { problems.push(`${rel} 兼容指针解析后越出 docs 根目录: ${t}`); continue; }
      if (!existsSync(c.resolved)) problems.push(`${rel} 兼容指针目标缺失: ${t}`);
    }
  }
  if (problems.length) fail(`F. 导航链接/登记对账/兼容指针违规 ${problems.length} 处: ${problems.join('；')}`);
  else ok(`F. docs/README.md ${relLinks.size} 个本地链接均为真相对路径、未越出 repo 根且目标存在；${activeIds.size} 个 current/draft id 全部登记；superseded 兼容页均为恰三行纯指针（H1+空行+单条含链接 blockquote，内容非块级标记）且指针为未越出 docs 根的真相对链接、目标存在`);
}

// ───────────────────────────────────────────────────────────────────────────
// G. testing.md 摘要三计数 ↔ 磁盘机械枚举（文档治理 v1 · 2026-08-22 新增）
// ───────────────────────────────────────────────────────────────────────────
{
  checks++;
  const testing = readDoc('docs/testing.md');
  const problems = [];
  const head = testing; // 全文匹配（front matter 使摘要行号后移；三个 pattern 仅摘要行命中）
  const e2eClaim = head.match(/（(\d+)\s*个前端\s*e2e[^）]*）/) || head.match(/(\d+)\s*个前端\s*e2e/);
  const flowClaim = head.match(/（(\d+)\s*条\s*AI-E2E\s*flow[^）]*）/) || head.match(/(\d+)\s*条\s*AI-E2E\s*flow/);
  const vitClaim = head.match(/（(\d+)\s*个\s*vitest\s*单测文件/) || head.match(/(\d+)\s*个\s*vitest\s*单测文件/);
  if (!e2eClaim || !flowClaim || !vitClaim) {
    problems.push('testing.md 头部摘要未解析出三计数（口径声明格式漂移？）');
  } else {
    const listMjs = (relDir) =>
      readdirSync(R(relDir)).filter((f) => f.endsWith('.mjs') && statSync(join(R(relDir), f)).isFile());
    const diskE2e = listMjs('web/e2e').length; // 顶层（flows/、lib/ 是目录不计）
    const diskFlow = listMjs('web/e2e/flows').length;
    const diskVitest = readdirSync(R('web/src/logic/__tests__')).filter((f) => f.endsWith('.test.ts')).length;
    if (Number(e2eClaim[1]) !== diskE2e) problems.push(`摘要 e2e 计数 ${e2eClaim[1]} ≠ 磁盘 ${diskE2e}（web/e2e 顶层 .mjs）`);
    if (Number(flowClaim[1]) !== diskFlow) problems.push(`摘要 flow 计数 ${flowClaim[1]} ≠ 磁盘 ${diskFlow}（web/e2e/flows .mjs）`);
    if (Number(vitClaim[1]) !== diskVitest) problems.push(`摘要 vitest 文件计数 ${vitClaim[1]} ≠ 磁盘 ${diskVitest}（web/src/logic/__tests__ .test.ts）`);
    if (!problems.length) ok(`G. testing.md 摘要计数 = 磁盘机械枚举（e2e ${diskE2e} / flows ${diskFlow} / vitest 文件 ${diskVitest}）`);
  }
  if (problems.length) fail(`G. testing.md 计数漂移: ${problems.join('；')}`);
}

// ───────────────────────────────────────────────────────────────────────────
if (failed > 0) {
  console.error(`[docs-drift-check] ❌ ${failed}/${checks} 项漂移 —— 文档与代码已脱节，修文档（或代码）使其重新一致`);
  process.exit(1);
}
console.log(`[docs-drift-check] ✅ ${checks}/${checks} 项全绿：文档引用的路径/清单与磁盘一致`);
