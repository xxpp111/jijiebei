#!/usr/bin/env node
// drift-check — 配置漂移守护（测试体系第①层）。
// 重跑 web/scripts/gen-config.mjs，比对 committed web/src/config/*.ts 无 diff。
// 防：母表 docs/*.csv 改了但忘重跑 gen-config → committed config 与母表漂移 → 静默回归。
// 只读语义：跑完无论 pass/fail 都把 committed 原文写回（gen-config 会覆盖磁盘，故先快照后恢复），
//   保证本脚本不污染工作树（正常无漂移时 gen-config 输出 == committed，写回为同一内容）。
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, '..');
const configDir = join(webRoot, 'src', 'config');
const genScript = join(webRoot, 'scripts', 'gen-config.mjs');

if (!existsSync(genScript)) {
  console.error(`[drift-check] 找不到 gen-config: ${genScript}`);
  process.exit(1);
}

// 1. 快照 committed config（gen-config 覆盖前留底）
const files = readdirSync(configDir).filter((f) => f.endsWith('.ts'));
const before = Object.fromEntries(files.map((f) => [f, readFileSync(join(configDir, f), 'utf8')]));

// 2. 跑 gen-config（重生成，覆盖磁盘）
try {
  execSync(`node "${genScript}"`, { stdio: 'pipe' });
} catch (e) {
  console.error('[drift-check] gen-config 运行失败:\n', e.stderr ? e.stderr.toString() : e.message);
  for (const f of files) writeFileSync(join(configDir, f), before[f]); // 恢复 committed
  process.exit(1);
}

// 3. 逐文件比对 committed(快照) vs 重生成后(磁盘)
let drift = false;
for (const f of files) {
  const after = readFileSync(join(configDir, f), 'utf8');
  if (before[f] !== after) {
    console.error(`DRIFT: web/src/config/${f} 与 gen-config 重生成结果不一致（母表 csv 改了但未重跑 gen-config？）`);
    drift = true;
  } else {
    console.log(`OK: web/src/config/${f} 无漂移（committed = 最新生成）`);
  }
}

// 4. 恢复 committed（保持本脚本只读；漂移时不替用户决定是否提交新生成）
for (const f of files) writeFileSync(join(configDir, f), before[f]);

if (drift) {
  console.error('\n[drift-check] ❌ 配置漂移：重跑 `node web/scripts/gen-config.mjs` 并提交差异');
  process.exit(1);
}
console.log('\n[drift-check] ✅ 所有 config 与母表一致，无漂移');
