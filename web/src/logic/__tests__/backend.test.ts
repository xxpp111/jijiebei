// backend.ts auth 链路单测（测试体系第①层）。
// 被测：选手/主播登录 + 注册 + 记住我 storage 分流 + 静默续期 pbRefresh + kind 区分。
// node env 无 window.localStorage/sessionStorage/fetch → 本文件 mock：
//   - Storage：Map-based mock 装到 window（setup.ts 已令 window=globalThis）
//   - fetch：vi.fn 按用例返回，断言请求体（phone→{phone}@phone.jjb 兜底、fav_commanders 透传）+ 响应映射（kind）
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { pbAuthPlayer, pbAuthHost, registerPlayer, pbRefresh, getAccount, getToken, clearAuth, ensurePlayer } from '../backend';

const g = globalThis as any;
function mockStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  } as Storage;
}
function okFetch(record: unknown, token = 'tok') {
  return vi.fn(async (_u: string, _o: any) => ({ ok: true, json: async () => ({ token, record }) }));
}

beforeEach(() => {
  g.window.localStorage = mockStorage();
  g.window.sessionStorage = mockStorage();
  g.fetch = okFetch({ id: 'x' });
  clearAuth(); // 重置模块级内存态 + 清两边 storage
});

describe('backend auth · 登录身份映射 + phone→email 兜底', () => {
  it('pbAuthPlayer：phone 兜底 {phone}@phone.jjb identity + kind=player', async () => {
    const f = okFetch({ id: 'p1', nickname: '小明' });
    g.fetch = f;
    const r = await pbAuthPlayer('13800138000', 'pwd12345', false);
    expect(JSON.parse(f.mock.calls[0][1].body).identity).toBe('13800138000@phone.jjb');
    expect(f.mock.calls[0][0]).toContain('player_accounts/auth-with-password');
    expect(r).toEqual({ id: 'p1', nickname: '小明' });
    expect(getAccount()).toMatchObject({ id: 'p1', kind: 'player', nickname: '小明' });
  });

  it('pbAuthHost：identity 原样 + kind=host + role', async () => {
    g.fetch = okFetch({ id: 'h1', role: 'host' });
    const r = await pbAuthHost('host@jjb.test', 'pwd', false);
    expect(r).toEqual({ id: 'h1', role: 'host' });
    expect(getAccount()).toMatchObject({ id: 'h1', kind: 'host', role: 'host' });
  });

  it('登录失败（非 200）→ 抛错、内存态不变', async () => {
    g.fetch = vi.fn(async () => ({ ok: false, status: 400 }));
    await expect(pbAuthPlayer('138', 'bad', false)).rejects.toThrow();
    expect(getToken()).toBeNull();
    expect(getAccount()).toBeNull();
  });
});

describe('backend auth · 记住我 storage 分流（自动登录核心）', () => {
  it('remember=true → localStorage 持久、sessionStorage 清（跨会话自动登录）', async () => {
    g.fetch = okFetch({ id: 'p1', nickname: 'A' });
    await pbAuthPlayer('138', 'pwd', true);
    expect(g.window.localStorage.getItem('jjb_auth')).not.toBeNull();
    expect(g.window.sessionStorage.getItem('jjb_auth')).toBeNull();
  });

  it('remember=false → sessionStorage 持久、localStorage 清（关标签即清）', async () => {
    g.fetch = okFetch({ id: 'p1', nickname: 'A' });
    await pbAuthPlayer('138', 'pwd', false);
    expect(g.window.sessionStorage.getItem('jjb_auth')).not.toBeNull();
    expect(g.window.localStorage.getItem('jjb_auth')).toBeNull();
  });

  it('clearAuth → 双 storage + 内存态全清', async () => {
    g.fetch = okFetch({ id: 'p1', nickname: 'A' });
    await pbAuthPlayer('138', 'pwd', true);
    clearAuth();
    expect(getToken()).toBeNull();
    expect(getAccount()).toBeNull();
    expect(g.window.localStorage.getItem('jjb_auth')).toBeNull();
    expect(g.window.sessionStorage.getItem('jjb_auth')).toBeNull();
  });
});

describe('backend auth · 静默续期 pbRefresh', () => {
  it('无 token → false（不抛）', async () => {
    clearAuth();
    expect(await pbRefresh()).toBe(false);
  });

  it('401 → clearAuth + false', async () => {
    g.fetch = okFetch({ id: 'p1', nickname: 'A' });
    await pbAuthPlayer('138', 'pwd', true);
    g.fetch = vi.fn(async () => ({ ok: false, status: 401 }));
    expect(await pbRefresh()).toBe(false);
    expect(getToken()).toBeNull();
  });

  it('5xx → 保留会话 + false（瞬时错误不误登出，回访选手不被后端抖动踢下线）', async () => {
    g.fetch = okFetch({ id: 'p1', nickname: 'A' });
    await pbAuthPlayer('138', 'pwd', true);
    g.fetch = vi.fn(async () => ({ ok: false, status: 500 }));
    expect(await pbRefresh()).toBe(false);
    expect(getToken()).not.toBeNull(); // 会话保留，不被 5xx 误清
  });

  it('200 → true + 续期新 token', async () => {
    g.fetch = okFetch({ id: 'p1', nickname: 'A' }, 'old');
    await pbAuthPlayer('138', 'pwd', true);
    g.fetch = okFetch({ id: 'p1' }, 'new');
    expect(await pbRefresh()).toBe(true);
    expect(getToken()).toBe('new');
  });

  it('按 kind 选集合：player → player_accounts/auth-refresh', async () => {
    g.fetch = okFetch({ id: 'p1', nickname: 'A' });
    await pbAuthPlayer('138', 'pwd', true);
    const ref = okFetch({ id: 'p1' });
    g.fetch = ref;
    await pbRefresh();
    expect(ref.mock.calls[0][0]).toContain('player_accounts/auth-refresh');
  });
});

describe('backend auth · 选手注册 registerPlayer', () => {
  it('body 含 email 兜底 + phone 真值 + nickname + fav_commanders + passwordConfirm', async () => {
    const f = vi.fn(async (_u: string, _o: any) => ({ ok: true, json: async () => ({ id: 'np1' }) }));
    g.fetch = f;
    const r = await registerPlayer({ nickname: '小红', phone: '13900139000', password: 'pwd12345', fav_commanders: ['雷诺', '诺温'] });
    const body = JSON.parse(f.mock.calls[0][1].body);
    expect(body.email).toBe('13900139000@phone.jjb');
    expect(body.phone).toBe('13900139000');
    expect(body.nickname).toBe('小红');
    expect(body.fav_commanders).toEqual(['雷诺', '诺温']);
    expect(body.passwordConfirm).toBe('pwd12345');
    expect(r).toEqual({ id: 'np1' });
  });

  it('选填缺省 → social/fav_commanders 落 null', async () => {
    const f = vi.fn(async (_u: string, _o: any) => ({ ok: true, json: async () => ({ id: 'np2' }) }));
    g.fetch = f;
    await registerPlayer({ nickname: '无选填', phone: '13700137000', password: 'pwd12345' });
    const body = JSON.parse(f.mock.calls[0][1].body);
    expect(body.social).toBeNull();
    expect(body.fav_commanders).toBeNull();
  });
});

describe('backend · ensurePlayer 口径修复（#89/#94：player_accounts.player relation 优先）', () => {
  it('kind=player 且账号带 player relation → 精确取该 players 记录，不走昵称查建', async () => {
    g.fetch = okFetch({ id: 'p1', nickname: '登录选手' });
    await pbAuthPlayer('13800138000', 'pwd12345', false); // 建立 kind=player 登录态（account.id=p1）
    const f = vi.fn(async (u: string) => {
      const url = String(u);
      if (url.includes('player_accounts/records/p1') && url.includes('expand=player')) {
        return { ok: true, json: async () => ({ id: 'p1', player: 'pl1', expand: { player: { id: 'pl1', nickname: '小明', player_code: 'pa-p1' } } }) };
      }
      throw new Error('不应查/建 players（relation 命中就该短路返回）: ' + url);
    });
    g.fetch = f;
    const r = await ensurePlayer('随便输的名字');
    expect(r).toEqual({ id: 'pl1', nickname: '小明', player_code: 'pa-p1' });
    expect(f.mock.calls.length).toBe(1); // 只发了一次 relation 查询，没有走 getPlayerByCode/createPlayer
  });

  it('kind=player 但 relation 查询失败（404/网络错误）→ 兜底走昵称查建', async () => {
    g.fetch = okFetch({ id: 'p2', nickname: '登录选手2' });
    await pbAuthPlayer('13800138001', 'pwd12345', false);
    const f = vi.fn(async (u: string, o?: any) => {
      const url = String(u);
      if (url.includes('player_accounts/records/')) return { ok: false, status: 404 };
      if (url.includes('players/records?filter=')) return { ok: true, json: async () => ({ items: [] }) };
      if (url.includes('players/records') && o?.method === 'POST') {
        return { ok: true, json: async () => ({ id: 'newp', nickname: '随便输的名字', player_code: '随便输的名字' }) };
      }
      throw new Error('unexpected url: ' + url);
    });
    g.fetch = f;
    const r = await ensurePlayer('随便输的名字');
    expect(r).toEqual({ id: 'newp', nickname: '随便输的名字', player_code: '随便输的名字' });
  });

  it('kind=host（非选手账号）→ 跳过 relation 分支，走原昵称查建（行为不变）', async () => {
    await pbAuthHost('host@jjb.test', 'pwd', false);
    const f = vi.fn(async (u: string, o?: any) => {
      const url = String(u);
      if (url.includes('player_accounts/records/')) throw new Error('host 账号不该查 player_accounts relation: ' + url);
      if (url.includes('players/records?filter=')) return { ok: true, json: async () => ({ items: [{ id: 'existing', nickname: '老选手', player_code: '老选手' }] }) };
      throw new Error('unexpected url: ' + url);
    });
    g.fetch = f;
    const r = await ensurePlayer('老选手');
    expect(r).toEqual({ id: 'existing', nickname: '老选手', player_code: '老选手' });
  });
});
