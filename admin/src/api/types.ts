// admin/src/api/types.ts
// P5 PocketBase 5 集合 schema 的 TS 类型（字段对齐 backend/pb_migrations/1782000001_init_collections.go）。
// 与展示层 web/ 物理隔离：admin 独立定义类型，不 import web/。

export type Role = 'admin' | 'host' | 'viewer';
export type MatchMode = 'practice' | 'match';
export type RacePref = 't' | 'z' | 'p';

/** accounts（auth 集合）—— 后台登录主体 + 账号管理对象。 */
export interface Account {
  id: string;
  email: string;
  role: Role;
  display_name: string;
  verified: boolean;
  created: string;
  updated: string;
}

/** players —— 选手实体（player_code 稳定锚，昵称可改）。 */
export interface Player {
  id: string;
  nickname: string;
  player_code: string;
  race_pref?: RacePref;
  avatar?: string;
  active?: boolean;
  notes?: string;
  created: string;
  updated: string;
}

/** matches —— 对局（practice/match 分流，game_mode 直存 live SessionMode）。 */
export interface Match {
  id: string;
  mode: MatchMode;
  game_mode: string;
  payload_code: string;
  payload_ver: number;
  players?: string[];      // relation → players.id
  host?: string;           // relation → accounts.id
  result?: number[];       // winLoseList [0|1|2,…]
  score_total?: number;
  bp_config?: unknown;
  started_at?: string;
  ended_at?: string;
  created: string;
  updated: string;
}

/** scores —— 积分（hook 派生 / admin 手动调分）。 */
export interface Score {
  id: string;
  player: string;          // relation → players.id
  match?: string;          // relation → matches.id（手动调分可空）
  delta: number;
  reason?: string;
  season: string;
  created: string;
  updated: string;
}

/** logs —— 审计（admin only 读，不可改删）。 */
export interface LogEntry {
  id: string;
  actor?: string;          // relation → accounts.id（系统事件可空）
  action: string;
  target_type?: string;
  target_id?: string;
  detail?: unknown;
  ip?: string;
  created: string;
  updated: string;
}

/** /api/rankings 返回行（routes.go rankingsHandler）。 */
export interface RankingRow {
  player_id: string;
  nickname: string;
  player_code: string;
  race_pref?: RacePref;
  total_delta: number;
  match_count: number;
}

export interface RankingsResp {
  season: string;
  count: number;
  rankings: RankingRow[];
}

/** /api/scoring 返回（routes.go scoringHandler）。 */
export interface ScoringResp {
  current_season: string;
  coefficients: Record<string, number>;
  default_coefficient: number;
  formula: string;
  note?: string;
}

/** PocketBase list records 标准响应壳。 */
export interface PBList<T> {
  items: T[];
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
}

/** auth-with-password 响应。 */
export interface AuthResp {
  token: string;
  record: Account;
}
