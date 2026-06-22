// admin/src/api/client.ts
// P5 /api 对接层（复用 web/src/logic/backend.ts 的 fetch 模式：auth token 内存 + /api 封装）。
// token 仅内存、不落盘（对齐 web/backend.ts 与契约「密钥仅临时 env、不落盘」红线）。

import type {
  Account, AuthResp, LogEntry, Match, PBList, Player,
  RankingsResp, Score, ScoringResp,
} from './types';

const API = '/api';

let authToken: string | null = null;
let authAccount: Account | null = null;

export function getToken(): string | null { return authToken; }
export function getAccount(): Account | null { return authAccount; }
export function setAuth(token: string | null, account: Account | null) {
  authToken = token;
  authAccount = account;
}
export function clearAuth() { authToken = null; authAccount = null; }

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) h['Authorization'] = authToken; // PocketBase 接受 raw token（对齐 web/backend.ts）
  return h;
}

async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { ...authHeaders(), ...(init?.headers || {}) } });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new ApiError(r.status, body || url);
  }
  if (r.status === 204) return undefined as T;
  return r.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(public status: number, public body: string) {
    super(`[api] ${status}: ${body.slice(0, 160)}`);
    this.name = 'ApiError';
  }
}

/** 邮箱+密码登录 → token（内存态）。 */
export async function pbAuth(identity: string, password: string): Promise<AuthResp> {
  const r = await fetch(`${API}/collections/accounts/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity, password }),
  });
  if (!r.ok) throw new ApiError(r.status, await r.text().catch(() => ''));
  const d = (await r.json()) as AuthResp;
  setAuth(d.token, d.record);
  return d;
}

/** 通用 list（PocketBase /api/collections/<col>/records）。 */
export async function listRecords<T>(col: string, query: Record<string, string | number> = {}): Promise<PBList<T>> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) qs.set(k, String(v));
  const q = qs.toString();
  return http<PBList<T>>(`${API}/collections/${col}/records${q ? `?${q}` : ''}`);
}

export async function getRecord<T>(col: string, id: string): Promise<T> {
  return http<T>(`${API}/collections/${col}/records/${id}`);
}

export async function createRecord<T>(col: string, body: Record<string, unknown>): Promise<T> {
  return http<T>(`${API}/collections/${col}/records`, {
    method: 'POST', body: JSON.stringify(body),
  });
}

export async function updateRecord<T>(col: string, id: string, body: Record<string, unknown>): Promise<T> {
  return http<T>(`${API}/collections/${col}/records/${id}`, {
    method: 'PATCH', body: JSON.stringify(body),
  });
}

export async function deleteRecord(col: string, id: string): Promise<void> {
  await http<void>(`${API}/collections/${col}/records/${id}`, { method: 'DELETE' });
}

// —— 领域便捷方法 ——
export const listPlayers = (query: Record<string, string | number> = {}) => listRecords<Player>('players', query);
export const listMatches  = (query: Record<string, string | number> = {}) => listRecords<Match>('matches', query);
export const listScores   = (query: Record<string, string | number> = {}) => listRecords<Score>('scores', query);
export const listLogs     = (query: Record<string, string | number> = {}) => listRecords<LogEntry>('logs', query);
export const listAccounts = (query: Record<string, string | number> = {}) => listRecords<Account>('accounts', query);

export function getRankings(season?: string): Promise<RankingsResp> {
  const q = season ? `?season=${encodeURIComponent(season)}` : '';
  return http<RankingsResp>(`${API}/rankings${q}`);
}

export function getScoring(): Promise<ScoringResp> {
  return http<ScoringResp>(`${API}/scoring`);
}
