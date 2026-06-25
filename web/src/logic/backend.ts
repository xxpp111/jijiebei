// web/src/logic/backend.ts
// P5 联调：前端 fetch /api 对接 PocketBase（同源 — dev 走 vite proxy、生产走 nginx /api 反代，免 CORS）。
// 与 codec.ts 配合：payload_code = encodePayload(当前局)。练习模式默认不落库（mode=practice 由调用方决定）。
// auth：host/admin 登录拿 token（登录界面 F 出稿前，联调用测试账号）；token 仅内存、不落盘。

const API = '/api';

export interface MatchPayload {
  mode: 'match' | 'practice';
  game_mode: string;        // SessionMode 字符串（std8/std12/doubles…）
  payload_code: string;     // codec.encodePayload 的自包含码
  payload_ver: number;
  players?: string[];       // players 记录 id
  host?: string;            // accounts 记录 id
  result?: number[];        // winLoseList [0|1|2,…]
  score_total?: number;     // getScore()
  bp_config?: unknown;
}

export interface PlayerRecord { id: string; nickname: string; player_code: string; race_pref?: string; avatar?: string }

let authToken: string | null = null;
let authAccount: { id: string; role: string; display_name?: string } | null = null;

export function getToken(): string | null { return authToken; }
export function getAccount() { return authAccount; }
export function setToken(t: string | null) { authToken = t; }
export function clearAuth() { authToken = null; authAccount = null; }

/** host/admin 登录 → token（内存态）。失败抛错。 */
export async function pbAuth(identity: string, password: string): Promise<{ id: string; role: string }> {
  const r = await fetch(`${API}/collections/accounts/auth-with-password`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity, password }),
  });
  if (!r.ok) throw new Error(`[backend] auth 失败 ${r.status}`);
  const d = await r.json();
  authToken = d.token;
  authAccount = { id: d.record?.id, role: d.record?.role, display_name: d.record?.display_name };
  return { id: authAccount.id, role: authAccount.role };
}

/** 落库一局（比赛模式）。需先 pbAuth（host/admin）。回 { id }。 */
export async function postMatch(p: MatchPayload): Promise<{ id: string }> {
  const r = await fetch(`${API}/collections/matches/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: authToken } : {}) },
    body: JSON.stringify(p),
  });
  if (!r.ok) throw new Error(`[backend] postMatch 失败 ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

/** 回读一局（确认落库）。 */
export async function getMatch(id: string): Promise<unknown> {
  const r = await fetch(`${API}/collections/matches/records/${id}`);
  if (!r.ok) throw new Error(`[backend] getMatch ${r.status}`);
  return r.json();
}

/** 全选手（直播展示 / 报名选择，公开读无需 auth）。 */
export async function getPlayers(): Promise<PlayerRecord[]> {
  const r = await fetch(`${API}/collections/players/records?perPage=200&sort=nickname`);
  if (!r.ok) throw new Error(`[backend] getPlayers ${r.status}`);
  return ((await r.json()).items || []) as PlayerRecord[];
}

/** 按稳定 player_code 取选手（直播横条锚定，昵称可改、code 不可改）。 */
export async function getPlayerByCode(code: string): Promise<PlayerRecord | null> {
  if (!code) return null;
  const r = await fetch(`${API}/collections/players/records?filter=(player_code='${encodeURIComponent(code)}')`);
  if (!r.ok) return null;
  return ((await r.json()).items?.[0] as PlayerRecord) || null;
}

/** 建一个新选手（需先 pbAuth host/admin）。player_code=name 作稳定锚；active=true 才入天梯。回 PlayerRecord。 */
export async function createPlayer(name: string): Promise<PlayerRecord> {
  const r = await fetch(`${API}/collections/players/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: authToken } : {}) },
    body: JSON.stringify({ nickname: name, player_code: name, active: true }),
  });
  if (!r.ok) throw new Error(`[backend] createPlayer 失败 ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

/**
 * 兜底取/建选手 — 让现场选手随便输名就能上天梯。
 *  ① 先按 player_code 精确匹配（已注册选手优先，不重复建 — 沿用 getPlayerByCode 的稳定锚语义）。
 *  ② 找不到则以 name 为 player_code 建一个 active:true 选手（入天梯）。
 *  幂等：同名多局命中①返回同一 player（player_code unique），自然累加到同一选手，不每局新建。
 *  并发：unique 索引冲突（另一端已建同名）时回查精确匹配返回，不抛错。
 *  注：兜底以"输入名"为身份锚 — 同名不同人会归并到同一选手（yb 拍板放宽，已知取舍，详见交付 caveat）。
 *  无 host token 时 createPlayer 会 4xx 抛错，由调用方 catch（练习/未登录本就不该走到这）。
 */
export async function ensurePlayer(name: string): Promise<PlayerRecord | null> {
  if (!name) return null;
  const existing = await getPlayerByCode(name);
  if (existing) return existing;
  try {
    return await createPlayer(name);
  } catch (e) {
    const retry = await getPlayerByCode(name); // unique 冲突 → 并发建成功的那条
    if (retry) return retry;
    throw e;
  }
}

/** 天梯（公开读）。board: all(全模式) / single(单刷) / double(双打)。 */
export async function getRankings(board: 'all' | 'single' | 'double' = 'all'): Promise<{ rankings: Array<Record<string, unknown>>; season: string; count: number; board?: string }> {
  const q = board && board !== 'all' ? `?board=${board}` : '';
  const r = await fetch(`${API}/rankings${q}`);
  if (!r.ok) throw new Error(`[backend] rankings ${r.status}`);
  return r.json();
}
