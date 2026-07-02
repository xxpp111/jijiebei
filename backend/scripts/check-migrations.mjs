#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(here, '..');
const repoRoot = resolve(backendRoot, '..');

export const DEFAULT_HOST = 'devbox-tianlang';
export const DEFAULT_DB_PATH = '/opt/jjb-backend/pb_data/data.db';
export const DEFAULT_MIGRATIONS_DIR = resolve(backendRoot, 'pb_migrations');

// Verified against github.com/pocketbase/pocketbase v0.39.4 core/migrations_runner.go:
// DefaultMigrationsTable = "_migrations"; columns are "file" and "applied".
const MIGRATIONS_TABLE = '_migrations';
const MIGRATION_FILE_COLUMN = 'file';

export function normalizeMigrationId(value) {
  return basename(String(value).trim()).replace(/\.(go|js|ts)$/i, '');
}

export function findMissingMigrations(localIds, appliedIds) {
  const applied = new Set(appliedIds.map(normalizeMigrationId).filter(Boolean));
  const seen = new Set();
  const missing = [];

  for (const rawId of localIds) {
    const id = normalizeMigrationId(rawId);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (!applied.has(id)) missing.push(id);
  }

  return missing;
}

export async function readLocalMigrationIds(migrationsDir = DEFAULT_MIGRATIONS_DIR) {
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.go'))
    .map((entry) => normalizeMigrationId(entry.name))
    .sort();
}

function shellSingleQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function remoteMigrationQuery(dbPath) {
  const quotedDbPath = shellSingleQuote(dbPath);
  return `set -e
DB_PATH=${quotedDbPath}
if command -v sqlite3 >/dev/null 2>&1; then
  if sqlite3 -readonly "$DB_PATH" "SELECT ${MIGRATION_FILE_COLUMN} FROM ${MIGRATIONS_TABLE} ORDER BY ${MIGRATION_FILE_COLUMN};"; then
    exit 0
  fi
  echo "sqlite3 query failed (exit $?), falling back to python3" >&2
fi
if command -v python3 >/dev/null 2>&1; then
  python3 - "$DB_PATH" <<'PY'
import sqlite3
import sys

db_path = sys.argv[1]
uris = [
    "file:" + db_path + "?mode=ro",
    "file:" + db_path + "?mode=ro&immutable=1",
]
last_error = None
for uri in uris:
    try:
        con = sqlite3.connect(uri, uri=True)
        for (file_name,) in con.execute("SELECT file FROM _migrations ORDER BY file"):
            print(file_name)
        con.close()
        sys.exit(0)
    except Exception as exc:
        last_error = exc
sys.stderr.write("python sqlite readonly query failed: " + str(last_error) + "\\n")
sys.exit(1)
PY
  exit $?
fi
echo "Neither sqlite3 nor python3 is available on remote host; cannot query ${MIGRATIONS_TABLE} read-only." >&2
exit 127`;
}

export async function readAppliedMigrationIds({ host = DEFAULT_HOST, dbPath = DEFAULT_DB_PATH } = {}) {
  if (host.startsWith('-')) {
    throw new Error(`refusing to treat "${host}" as an ssh host (looks like an option flag, not a hostname)`);
  }
  const remoteCommand = remoteMigrationQuery(dbPath);
  const result = await runProcess('ssh', ['--', host, remoteCommand]);

  if (result.code !== 0) {
    throw new Error([
      `remote migration query failed on ${host}:${dbPath} (exit ${result.code})`,
      result.stderr.trim(),
      result.stdout.trim(),
    ].filter(Boolean).join('\n'));
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(normalizeMigrationId);
}

function runProcess(command, args) {
  return new Promise((resolveProcess) => {
    const child = spawn(command, args, { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => {
      resolveProcess({ code: 127, stdout, stderr: `${stderr}${error.message}` });
    });
    child.on('close', (code) => {
      resolveProcess({ code: code ?? 1, stdout, stderr });
    });
  });
}

function usage() {
  console.log(`Usage: node backend/scripts/check-migrations.mjs [ssh-host] [db-path]

Defaults:
  ssh-host: ${DEFAULT_HOST}
  db-path:  ${DEFAULT_DB_PATH}
`);
}

async function main(argv = process.argv.slice(2)) {
  if (argv.includes('-h') || argv.includes('--help')) {
    usage();
    return 0;
  }

  const [host = DEFAULT_HOST, dbPath = DEFAULT_DB_PATH] = argv;
  const localIds = await readLocalMigrationIds();
  const appliedIds = await readAppliedMigrationIds({ host, dbPath });
  const missing = findMissingMigrations(localIds, appliedIds);

  console.log('[jjb migration check]');
  console.log(`local migrations: ${localIds.length} (${resolve(repoRoot, 'backend/pb_migrations')})`);
  console.log(`remote applied:   ${appliedIds.length} (${host}:${dbPath}, 含 PocketBase 内部系统迁移，非本项目专属数)`);

  if (missing.length === 0) {
    console.log('OK: remote backend has all local migrations applied.');
    return 0;
  }

  console.error(`ERROR: remote backend is missing ${missing.length} migration(s):`);
  for (const id of missing) {
    console.error(`  - ${id}`);
  }
  console.error('Action: deploy the backend binary containing these migrations and run migrate up before updating web.');
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  });
}
