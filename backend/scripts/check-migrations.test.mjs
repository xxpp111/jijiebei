#!/usr/bin/env node
import assert from 'node:assert/strict';
import { findMissingMigrations } from './check-migrations.mjs';

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

if (failed) {
  console.error('\n[check-migrations-test] FAIL');
  process.exit(1);
}

console.log('\n[check-migrations-test] PASS');
