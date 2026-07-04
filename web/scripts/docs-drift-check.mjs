#!/usr/bin/env node
// docs-drift-check — 文档=真相 机器护栏（测试体系第①层 · 2026-07-05 R8 新增）。
// 把「文档漂移靠人肉记忆」变成机器门：静态断言四类文档正文引用的路径/清单与磁盘一致。
//
// 设计红线：期望值一律【从文档正文解析】（regex 提取），绝不把期望硬编码成第三份真相
//   ——否则本脚本自己就成了会漂的第四处副本。磁盘是唯一被对照的事实源。
// 只读语义：本脚本零写入工作树（只 read + stat）。
//
// 断言四项：
//   A. docs/architecture.md §1.2「核心逻辑模块」表引用的 web/src/logic/*.ts 全部真实存在
//   B. 根 README.md §2 目录地图列出的目录/文件路径全部真实存在
//   C. .claude/skills/jjb-deploy/SKILL.md 无 jjb-live-dock 残留（部署取码分支已收敛 jjb-platform）
//   D. docs/testing.md §3 声称的 e2e 脚本清单与磁盘 web/e2e|flows + admin/e2e 实际逐一对上（数量/名称双向）
//
// 用法：node web/scripts/docs-drift-check.mjs   （repo 根或任意 cwd 均可，路径自锚定）
// 退出码：0 全绿 / 1 有漂移或缺失 / 2 脚本自身错误（找不到应存在的文档）
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

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
console.log('');
if (failed > 0) {
  console.error(`[docs-drift-check] ❌ ${failed}/${checks} 项漂移 —— 文档与代码已脱节，修文档（或代码）使其重新一致`);
  process.exit(1);
}
console.log(`[docs-drift-check] ✅ ${checks}/${checks} 项全绿：文档引用的路径/清单与磁盘一致`);
