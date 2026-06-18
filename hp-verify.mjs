// hp-verify.mjs — run harness-pro deterministic verify for a phase.
// Usage: node hp-verify.mjs <phase>
// Reads verify.checks from config/harness-pro-reviewers.json, runs them at repo cwd,
// writes verify-report-<phase>.json into the runtime dir, prints overall/blocked.
import { runVerify } from 'harness-pro-core';
import { readFileSync } from 'fs';

const phase = Number(process.argv[2] || 1);
// Runtime 可由 argv[3] 或 HP_RUNTIME 覆盖；默认 .harness-pro-react 保持向后兼容。
const RUNTIME = process.argv[3] || process.env.HP_RUNTIME || '.harness-pro-react';
// Reviewer config 可由 argv[4] 或 HP_REVIEWER_CONFIG 覆盖；默认向后兼容。
const REVIEWER_CONFIG = process.argv[4] || process.env.HP_REVIEWER_CONFIG || 'config/harness-pro-reviewers.json';
const registry = JSON.parse(readFileSync(REVIEWER_CONFIG, 'utf8'));
const manifest = JSON.parse(readFileSync(RUNTIME + '/phase-manifest.json', 'utf8'));

const result = runVerify(registry, {
  phase,
  runtimeDir: RUNTIME,
  sessionId: manifest.session_id,
  cwd: process.cwd(),
});

console.log('=== VERIFY phase ' + phase + ' ===');
console.log('overall=' + result.overall + ' blocked=' + result.blocked);
if (result.report && Array.isArray(result.report.checks)) {
  for (const c of result.report.checks) {
    console.log('  [' + c.status + '] ' + c.id + ' exit=' + c.exit_code + ' (' + c.duration_ms + 'ms) required=' + c.required);
  }
}
