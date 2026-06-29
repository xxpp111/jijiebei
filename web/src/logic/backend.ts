// web/src/logic/backend.ts
// P5 联调：前端 fetch /api 对接 PocketBase（同源 — dev 走 vite proxy、生产走 nginx /api 反代，免 CORS）。
// 与 codec.ts 配合：payload_code = encodePayload(当前局)。练习模式默认不落库（mode=practice 由调用方决定）。
// auth：host/admin 登录拿 token；token + account 持久化到 sessionStorage（刷新 / 直接访问不掉线；关标签即清）。

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

// auth：双集合认证 + 记住我分流。
//   host/admin → accounts 集合（role=admin/host/viewer）；选手 → player_accounts 集合（phone 登录）。
//   token + account 持久化：remember=true → localStorage（跨会话自动登录）；remember=false → sessionStorage（关标签即清）。
//   区分存储层：两个 storage 各持一份 jjb_auth（同一 key），clearAuth 两边都清；loadAuth 优先 localStorage（记住我优先级高于会话）。
const AUTH_KEY = 'jjb_auth';
type AccountKind = 'host' | 'player';
type AuthAccount = { id: string; kind: AccountKind; role?: string; display_name?: string; nickname?: string };

// 记住我分流：localStorage（跨会话）/ sessionStorage（关标签清）。两个 storage 各自读写，clearAuth 双清。
function authStorage(remember: boolean): Storage | null {
  if (typeof window === 'undefined') return null;
  return remember ? window.localStorage : window.sessionStorage;
}
function loadAuth(): { token: string | null; account: AuthAccount | null } {
  if (typeof window === 'undefined') return { token: null, account: null };
  // 优先 localStorage（记住我），其次 sessionStorage（会话内）。
  for (const s of [window.localStorage, window.sessionStorage]) {
    try {
      const raw = s.getItem(AUTH_KEY);
      if (raw) { const d = JSON.parse(raw); if (d.token) return { token: d.token, account: d.account || null }; }
    } catch { /* noop */ }
  }
  return { token: null, account: null };
}
const _initAuth = typeof window !== 'undefined' ? loadAuth() : { token: null, account: null };
let authToken: string | null = _initAuth.token;
let authAccount: AuthAccount | null = _initAuth.account;
let authRemember = false; // 记当前登录态写到哪个 storage（默认 sessionStorage）
function persistAuth() {
  if (typeof window === 'undefined') return;
  // 写入 remember 指定的 storage，并清掉另一边（避免两份漂移）。
  const target = authStorage(authRemember);
  const other = authStorage(!authRemember);
  try {
    other?.removeItem(AUTH_KEY);
    if (authToken && target) target.setItem(AUTH_KEY, JSON.stringify({ token: authToken, account: authAccount }));
    else target?.removeItem(AUTH_KEY);
  } catch { /* noop */ }
}

export function getToken(): string | null { return authToken; }
export function getAccount(): AuthAccount | null { return authAccount; }
export function clearAuth() { authToken = null; authAccount = null; authRemember = false; if (typeof window !== 'undefined') { try { window.localStorage.removeItem(AUTH_KEY); window.sessionStorage.removeItem(AUTH_KEY); } catch { /* noop */ } } }

/** host/admin 登录 → token（accounts 集合，identity=email）。失败抛错。remember 控制持久化存储层。 */
export async function pbAuthHost(identity: string, password: string, remember = false): Promise<{ id: string; role: string }> {
  const r = await fetch(`${API}/collections/accounts/auth-with-password`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity, password }),
  });
  if (!r.ok) throw new Error(`[backend] host auth 失败 ${r.status}`);
  const d = await r.json();
  authRemember = remember;
  authToken = d.token;
  authAccount = { id: d.record?.id, kind: 'host', role: d.record?.role, display_name: d.record?.display_name };
  persistAuth();
  return { id: authAccount.id, role: authAccount.role || '' };
}

/**
 * 兼容别名：pbAuth = pbAuthHost（remember=false，会话内）。
 * 保留现有 LoginScreen.tsx / App dev 登录调用点不被破坏（UI 四屏由 hub 改，spoke 只动 backend.ts auth 函数）。
 * hub 接选手登录 tab 时改用 pbAuthHost，此别名可在 hub 收口后移除。
 */
export async function pbAuth(identity: string, password: string): Promise<{ id: string; role: string }> {
  return pbAuthHost(identity, password, false);
}

/** 选手登录 → token（player_accounts 集合，phone 兼写 email 作 PB identity）。失败抛错。 */
export async function pbAuthPlayer(phone: string, password: string, remember = false): Promise<{ id: string; nickname: string }> {
  const identity = phoneEmail(phone); // phone → {phone}@phone.jjb 兜底 identity 容器（migration 约定）
  const r = await fetch(`${API}/collections/player_accounts/auth-with-password`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity, password }),
  });
  if (!r.ok) throw new Error(`[backend] 选手登录失败 ${r.status}`);
  const d = await r.json();
  authRemember = remember;
  authToken = d.token;
  authAccount = { id: d.record?.id, kind: 'player', nickname: d.record?.nickname };
  persistAuth();
  return { id: authAccount.id, nickname: authAccount.nickname || '' };
}

/** 选手自助注册（player_accounts 集合，createRule="" 无需 auth）。phone 兼写 email 作 PB identity。回 { id }。 */
export async function registerPlayer(fields: { nickname: string; phone: string; password: string; social?: string; fav_commanders?: string[] }): Promise<{ id: string }> {
  const r = await fetch(`${API}/collections/player_accounts/records`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: phoneEmail(fields.phone),             // PB identity 容器（phone 真值存 phone 字段，靠 idx_pa_phone unique）
      password: fields.password,
      passwordConfirm: fields.password,
      nickname: fields.nickname,
      phone: fields.phone,
      social: fields.social ?? null,
      fav_commanders: fields.fav_commanders ?? null,
    }),
  });
  if (!r.ok) throw new Error(`[backend] 选手注册失败 ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  return { id: d.id };
}

/**
 * 启动静默续期：用当前 token 调 PB authRefresh，成功更新内存态+持久化、返 true；401/失败 clearAuth、返 false。
 * App mount 调一次（记忆我场景：关标签再开仍登录）。token 缺失直接返 false（不抛错）。
 * kind 区分刷新路径：host→accounts refresh、player→player_accounts refresh。
 */
export async function pbRefresh(): Promise<boolean> {
  if (!authToken || !authAccount) return false;
  const col = authAccount.kind === 'host' ? 'accounts' : 'player_accounts';
  const r = await fetch(`${API}/collections/${col}/auth-refresh`, {
    method: 'POST', headers: { Authorization: authToken },
  });
  if (!r.ok) { clearAuth(); return false; } // 401/失效 → 清登录态
  const d = await r.json();
  authToken = d.token; // 续期后的新 token（PB auth-refresh 返新 token + record）
  persistAuth();
  return true;
}

/** phone → PB identity 容器邮箱（{phone}@phone.jjb）。phone 非原生 identity，兼写 email 兜底（migration stop_when 兜底方案）。 */
function phoneEmail(phone: string): string {
  return `${phone}@phone.jjb`;
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
