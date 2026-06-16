// hp-verify.mjs — run harness-pro deterministic verify for a phase.
// Usage: node hp-verify.mjs <phase>
// Reads verify.checks from config/harness-pro-reviewers.json, runs them at repo cwd,
// writes verify-report-<phase>.json into the runtime dir, prints overall/blocked.
import { runVerify } from 'harness-pro-core';
import { readFileSync } from 'fs';

const phase = Number(process.argv[2] || 1);
const RUNTIME = '.harness-pro-react';
const registry = JSON.parse(readFileSync('config/harness-pro-reviewers.json', 'utf8'));
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
