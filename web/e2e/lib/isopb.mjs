// e2e/lib/isopb.mjs — 隔离 PocketBase 启停 helper（auth.flow.mjs / auth-perm.mjs 共用）。
//
// 起 pocketbase serve 到【临时 --dir】（/tmp/jjb-iso-pb-XXX），先 migrate up 建全 5 集合
// （含 player_accounts + players relation 依赖），建 superuser admin@jjb.test，再后台 serve。
// 端口固定 8090，对齐 vite.config 的 preview.proxy（/api→127.0.0.1:8090），让 auth.flow.mjs 的
// 前端经同源 proxy 落到隔离 PB（registerPlayer/pbAuthPlayer 真调落库）。
//
// 红线（契约 scope）：临时 dir，stop 时 rm -rf；【绝不】指向 backend/pb_data（现网数据，比赛进行中）。
import { spawn, spawnSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const webRoot = resolve(fileURLToPath(new URL('..', import.meta.url)), '..'); // lib → e2e → web
const backendRoot = resolve(webRoot, '..', 'backend'); // pocketbase 二进制 + cwd（loadScoring 相对路径 config/）
const PB_BIN = resolve(backendRoot, 'pocketbase');
export const ISO_PB_BASE = 'http://127.0.0.1:8090';
export const ISO_SU_EMAIL = 'admin@jjb.test';
export const ISO_SU_PWD = 'Admin123456!';

async function waitHealth(maxMs = 12000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    try {
      const r = await fetch(`${ISO_PB_BASE}/api/health`);
      if (r.ok) return;
    } catch { /* serve 未就绪，重试 */ }
    await new Promise((x) => setTimeout(x, 200));
  }
  throw new Error('隔离 PB health 超时（migrate/serve 失败？）');
}

/** 起隔离 PB：临时 dir → migrate up → superuser upsert → serve 后台。回 { dir, serve, base }。 */
export async function startIsoPb() {
  const dir = mkdtempSync(resolve(tmpdir(), 'jjb-iso-pb-'));
  const cli = (args) => spawnSync(PB_BIN, args, { cwd: backendRoot, stdio: ['ignore', 'pipe', 'pipe'] });
  const mig = cli(['migrate', 'up', '--dir', dir]);
  if (mig.status !== 0) {
    rmSync(dir, { recursive: true, force: true });
    throw new Error(`migrate up 失败: ${String(mig.stderr || '').slice(0, 200)}`);
  }
  cli(['superuser', 'upsert', ISO_SU_EMAIL, ISO_SU_PWD, '--dir', dir]);
  const serve = spawn(PB_BIN, ['serve', '--http=127.0.0.1:8090', '--dir', dir], { cwd: backendRoot, stdio: 'ignore' });
  try {
    await waitHealth();
  } catch (e) {
    serve.kill('SIGTERM');
    rmSync(dir, { recursive: true, force: true });
    throw e;
  }
  return { dir, serve, base: ISO_PB_BASE };
}

/** 停隔离 PB：kill serve + rm -rf 临时 dir（绝不留垃圾、绝不碰现网 pb_data）。 */
export async function stopIsoPb(pb) {
  if (!pb) return;
  try { pb.serve?.kill('SIGTERM'); } catch { /* noop */ }
  try { rmSync(pb.dir, { recursive: true, force: true }); } catch { /* noop */ }
}
