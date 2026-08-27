#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findMigrationDrift, findMissingMigrations } from './check-migrations.mjs';

const fixtures = [
  {
    name: '有缺口：远端少 event_rules',
    local: ['1782000001_init_collections', '1782000004_event_rules', '1782000005_player_accounts'],
    applied: ['1782000001_init_collections.go', '1782000005_player_accounts.go'],
    expected: ['1782000004_event_rules'],
  },
  {
    name: '无缺口：远端已应用全部迁移',
    local: ['1782000001_init_collections', '1782000002_lock_default_users'],
    applied: ['1782000001_init_collections.go', '1782000002_lock_default_users.go'],
    expected: [],
  },
  {
    name: '远端为空：全新环境缺全部本地迁移',
    local: ['1782000001_init_collections', '1782000002_lock_default_users', '1782000003_scores_wins_games'],
    applied: [],
    expected: ['1782000001_init_collections', '1782000002_lock_default_users', '1782000003_scores_wins_games'],
  },
];

const driftFixtures = [
  {
    name: '目标 ref 过旧：源库含本地未知的 JJB 迁移',
    local: ['1782000001_init_collections', '1782000002_lock_default_users'],
    applied: ['1782000001_init_collections.go', '1782000002_lock_default_users.go', '1782000011_future_schema.go'],
    expected: { missing: [], unexpected: ['1782000011_future_schema'] },
  },
  {
    name: 'PocketBase 内部迁移不算 JJB 版本倒退',
    local: ['1782000001_init_collections'],
    applied: ['1687801090_initial.go', '1782000001_init_collections.go'],
    expected: { missing: [], unexpected: [] },
  },
  {
    name: '双向漂移同时报告缺失与未知 JJB 迁移',
    local: ['1782000001_init_collections', '1782000002_lock_default_users'],
    applied: ['1782000001_init_collections.go', '1782000011_future_schema.go'],
    expected: {
      missing: ['1782000002_lock_default_users'],
      unexpected: ['1782000011_future_schema'],
    },
  },
];

let failed = false;

for (const fixture of fixtures) {
  try {
    assert.deepEqual(findMissingMigrations(fixture.local, fixture.applied), fixture.expected);
    console.log(`PASS: ${fixture.name}`);
  } catch (error) {
    failed = true;
    console.error(`FAIL: ${fixture.name}`);
    console.error(error instanceof Error ? error.message : String(error));
  }
}

for (const fixture of driftFixtures) {
  try {
    assert.deepEqual(findMigrationDrift(fixture.local, fixture.applied), fixture.expected);
    console.log(`PASS: ${fixture.name}`);
  } catch (error) {
    failed = true;
    console.error(`FAIL: ${fixture.name}`);
    console.error(error instanceof Error ? error.message : String(error));
  }
}

try {
  const checkerSource = readFileSync(new URL('./check-migrations.mjs', import.meta.url), 'utf8');
  assert.ok(checkerSource.includes('?mode=ro'));
  assert.ok(!checkerSource.includes('mode=ro&immutable=1'));
  console.log('PASS: 远端 Python fallback 保持 WAL 感知并在只读失败时 fail closed');
} catch (error) {
  failed = true;
  console.error('FAIL: 远端 Python fallback 保持 WAL 感知并在只读失败时 fail closed');
  console.error(error instanceof Error ? error.message : String(error));
}

if (failed) {
  console.error('\n[check-migrations-test] FAIL');
  process.exit(1);
}

console.log('\n[check-migrations-test] PASS');
