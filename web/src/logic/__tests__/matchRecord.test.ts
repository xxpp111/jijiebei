// matchRecord 落库语义层单测（测试体系第①层，#94 落库触发链路修复）。
// 被测：web/src/logic/matchRecord.ts —— postMatchResult 双打分流修正 + 局指纹防重 + autoPostIfComplete 5s 缓冲。
// node env 无 window.fetch/sessionStorage → 本文件 mock（同 backend.test.ts 套路）：
//   - fetch：按 URL 分支路由（accounts 登录 / players 查建 / matches 落库）
//   - sessionStorage：Map-based mock 装到 window（setup.ts 已令 window=globalThis）
// jjbSession/jjbDoubles 走真实模块（startSession + setVerdict/setDoublesVerdict judge 出真实局面），不 mock 引擎。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { startSession, setVerdict, setRuleMode } from '../jjbSession';
import { setDoublesVerdict } from '../jjbDoubles';
import { currentMatches, currentScore } from '../jjbView';
import { pbAuthHost } from '../backend';
import { RESULT_VAL } from '../legacy/JJBData';
import JijieData from '../legacy/JijieData';
import {
  postMatchResult, autoPostIfComplete, retryRecordPost, getRecordState,
} from '../matchRecord';

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

/** matches 落库调用计数（fetch 打到 /collections/matches/records 的次数）。 */
function matchPostCalls(f: ReturnType<typeof vi.fn>): unknown[] {
  return f.mock.calls.filter((c) => String(c[0]).includes('/collections/matches/records'));
}

function routedFetch() {
  return vi.fn(async (url: string, opts?: any) => {
    const u = String(url);
    if (u.includes('/collections/accounts/auth-with-password')) {
      return { ok: true, json: async () => ({ token: 'host-tok', record: { id: 'h1', role: 'host' } }) };
    }
    if (u.includes('/collections/players/records?filter=')) {
      return { ok: true, json: async () => ({ items: [] }) }; // 首次查无 → 走建
    }
    if (u.includes('/collections/players/records') && opts?.method === 'POST') {
      return { ok: true, json: async () => ({ id: 'p1', nickname: '测试选手', player_code: '测试选手' }) };
    }
    if (u.includes('/collections/matches/records')) {
      return { ok: true, json: async () => ({ id: 'm1' }) };
    }
    return { ok: false, status: 404, text: async () => '' };
  });
}

beforeEach(async () => {
  g.window.sessionStorage = mockStorage();
  g.window.localStorage = mockStorage();
  g.__jjbDebug = undefined;
  g.fetch = routedFetch();
  setRuleMode('match');
  await pbAuthHost('host@jjb.test', 'pwd', false); // kind=host + token，match 态落库资格
});

describe('postMatchResult · 双打读错引擎修正（#94 done-when 3）', () => {
  it('单打 3 场全判：result 经 RESULT_VAL(m.result) 与 winLoseList 语义等价，score_total=currentScore()', async () => {
    startSession('std8');
    setVerdict(0, 'win');
    setVerdict(1, 'bonus');
    setVerdict(2, 'lose');
    const ms = currentMatches();
    const expectedResult = ms.map((m) => RESULT_VAL[m.result as string]);
    const expectedScore = currentScore();

    const f = g.fetch as ReturnType<typeof vi.fn>;
    const outcome = await postMatchResult();
    expect(outcome).toBe('posted');
    const call = matchPostCalls(f)[0] as [string, any];
    const body = JSON.parse(call[1].body);
    expect(body.result).toEqual(expectedResult);
    expect(body.result).toEqual([1, 2, 0]); // win=1/bonus=2/lose=0
    expect(body.score_total).toBe(expectedScore);
  });

  it('双打 3 场全判：result/score_total 取双打引擎真值，不读 JijieData.winLoseList（陈旧/错位值验证不误用）', async () => {
    startSession('doubles');
    // 故意把单打引擎 winLoseList 置成明显错误的哨兵值 —— 若实现仍误读旧引擎，断言会命中这份假数据而失败。
    (JijieData as unknown as { winLoseList: number[] }).winLoseList = [9, 9, 9];
    setDoublesVerdict(0, 'win');
    setDoublesVerdict(1, 'lose');
    setDoublesVerdict(2, 'bonus');
    const ms = currentMatches();
    const expectedResult = ms.map((m) => RESULT_VAL[m.result as string]);
    const expectedScore = currentScore();
    expect(expectedResult).toEqual([1, 0, 2]);

    const f = g.fetch as ReturnType<typeof vi.fn>;
    const outcome = await postMatchResult();
    expect(outcome).toBe('posted');
    const call = matchPostCalls(f)[0] as [string, any];
    const body = JSON.parse(call[1].body);
    expect(body.result).toEqual(expectedResult);
    expect(body.result).not.toEqual([9, 9, 9]);
    expect(body.score_total).toBe(expectedScore);
  });
});

describe('postMatchResult · 双打 ensurePlayer 失败负路径（#84 review 补测：热路径新增网络往返的失败面）', () => {
  it('双打两名解析失败 → 抛错不落库、防重 key 未置；后端恢复后重试成功落库（同局不被误挡 duplicate）', async () => {
    startSession('doubles');
    setDoublesVerdict(0, 'win');
    setDoublesVerdict(1, 'bonus');
    setDoublesVerdict(2, 'lose');

    // 后端抖动：players 查/建全 500 → ensurePlayer 抛错 → Promise.all reject（与守卫 throw 同一负路径出口）。
    const failingFetch = vi.fn(async (url: string, opts?: any) => {
      const u = String(url);
      if (u.includes('/collections/players/records')) {
        return { ok: false, status: 500, text: async () => 'transient' };
      }
      return (routedFetch() as any)(url, opts);
    });
    g.fetch = failingFetch;
    await expect(postMatchResult()).rejects.toThrow(); // 拒绝落库，不静默吞

    // 防重 key 未置（matchRecord.ts:65 成功后才置）→ 故障恢复后同一局重试必须能真落库
    g.fetch = routedFetch();
    const retry = await postMatchResult();
    expect(retry).toBe('posted');
    expect(matchPostCalls(g.fetch).length).toBe(1); // 失败那次没打到 matches，重试这次才落
  });
});

describe('postMatchResult · 局指纹防重（#94 done-when 2，改判不产生第二条 matches）', () => {
  it('同局改判后 fingerprint key 不变 → 第二次 POST 命中 duplicate，不二次落库', async () => {
    startSession('std8');
    setVerdict(0, 'win');
    setVerdict(1, 'bonus');
    setVerdict(2, 'lose');
    const first = await postMatchResult();
    expect(first).toBe('posted');

    // 改判：match0 从 win 改成 lose（真实 wl 变了，payload_code 会变，但局指纹应保持不变）
    setVerdict(0, 'lose');
    const second = await postMatchResult();
    expect(second).toBe('duplicate');

    const f = g.fetch as ReturnType<typeof vi.fn>;
    expect(matchPostCalls(f).length).toBe(1); // 只真正落了一次
  });

  it('单打局与双打局指纹不同 → 各自视为独立局，都能落库（回归：曾因指纹截断前缀共享而误判 duplicate）', async () => {
    startSession('std8');
    setVerdict(0, 'win');
    setVerdict(1, 'win');
    setVerdict(2, 'win');
    const singleOutcome = await postMatchResult();
    expect(singleOutcome).toBe('posted');

    startSession('doubles');
    setDoublesVerdict(0, 'win');
    setDoublesVerdict(1, 'win');
    setDoublesVerdict(2, 'win');
    const doublesOutcome = await postMatchResult();
    expect(doublesOutcome).toBe('posted'); // 不该被单打局的防重 key 误挡成 duplicate

    const f = g.fetch as ReturnType<typeof vi.fn>;
    expect(matchPostCalls(f).length).toBe(2);
  });
});

describe('autoPostIfComplete · 判定完成即后台自动落库 + 5 秒改判缓冲（#94 done-when 1）', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('未判完（仅 2 场）→ 不排计时，5s 后仍未 POST', async () => {
    startSession('std8');
    setVerdict(0, 'win');
    setVerdict(1, 'bonus');
    const p = autoPostIfComplete();
    await vi.advanceTimersByTimeAsync(6000);
    expect(await p).toBeNull();
    const f = g.fetch as ReturnType<typeof vi.fn>;
    expect(matchPostCalls(f).length).toBe(0);
  });

  it('3 场全判 + 有资格：5s 后自动 POST，chip 状态 posting→done', async () => {
    startSession('std8');
    setVerdict(0, 'win');
    setVerdict(1, 'bonus');
    setVerdict(2, 'lose');
    const p = autoPostIfComplete();
    await vi.advanceTimersByTimeAsync(4999);
    const f = g.fetch as ReturnType<typeof vi.fn>;
    expect(matchPostCalls(f).length).toBe(0); // 缓冲期内不发
    await vi.advanceTimersByTimeAsync(1);
    const outcome = await p;
    expect(outcome).toBe('posted');
    expect(matchPostCalls(f).length).toBe(1);
    expect(getRecordState()).toBe('done');
  });

  it('缓冲期内改判 → 重置计时器，从改判时刻起重新计满 5s 才发', async () => {
    startSession('std8');
    setVerdict(0, 'win');
    setVerdict(1, 'bonus');
    setVerdict(2, 'lose');
    const p1 = autoPostIfComplete();
    await vi.advanceTimersByTimeAsync(3000); // 原计时器已走 3s（还差 2s）
    setVerdict(0, 'lose'); // 改判：清旧计时器
    const p2 = autoPostIfComplete(); // 重新排 5s
    const f = g.fetch as ReturnType<typeof vi.fn>;

    await vi.advanceTimersByTimeAsync(2000); // 累计原计时器早该触发的时间点（若未重置会在此刻发出）
    expect(matchPostCalls(f).length).toBe(0); // 计时器已被重置，不应在此刻发

    await vi.advanceTimersByTimeAsync(3000); // 补满重排后的 5s
    const outcome = await p2;
    expect(outcome).toBe('posted');
    expect(matchPostCalls(f).length).toBe(1);
    expect(await p1).toBeNull(); // 被取代的旧调用：拿不到真实结果（预期，调用方不依赖它）
  });

  it('无资格（练习态非选手账号）→ 不排计时，立即返回 null', async () => {
    setRuleMode('practice');
    startSession('std10');
    setVerdict(0, 'win');
    setVerdict(1, 'win');
    setVerdict(2, 'win');
    const outcome = await autoPostIfComplete(); // canPostResult()=false → 同步短路，不进 setTimeout
    expect(outcome).toBeNull();
    const f = g.fetch as ReturnType<typeof vi.fn>;
    expect(matchPostCalls(f).length).toBe(0);
  });
});

describe('retryRecordPost · 失败重试跳过缓冲立即重跑', () => {
  it('POST 失败后调用 retryRecordPost 立即（不等 5s）重新发起', async () => {
    startSession('std8');
    setVerdict(0, 'win');
    setVerdict(1, 'win');
    setVerdict(2, 'win');
    // 先让第一次落库失败（matches 端点回 500）
    g.fetch = vi.fn(async (url: string, opts?: any) => {
      const u = String(url);
      if (u.includes('/collections/accounts/auth-with-password')) {
        return { ok: true, json: async () => ({ token: 'host-tok', record: { id: 'h1', role: 'host' } }) };
      }
      if (u.includes('/collections/players/records?filter=')) return { ok: true, json: async () => ({ items: [] }) };
      if (u.includes('/collections/players/records') && opts?.method === 'POST') {
        return { ok: true, json: async () => ({ id: 'p1', nickname: 'x', player_code: 'x' }) };
      }
      if (u.includes('/collections/matches/records')) return { ok: false, status: 500, text: async () => 'boom' };
      return { ok: false, status: 404, text: async () => '' };
    });
    await pbAuthHost('host@jjb.test', 'pwd', false);
    setRuleMode('match');

    await expect(postMatchResult()).rejects.toThrow();

    retryRecordPost(); // fire-and-forget：调用瞬间同步置 posting
    expect(getRecordState()).toBe('posting');
    await new Promise((resolve) => setTimeout(resolve, 0)); // 让 runAutoPost 内部 await 链落定
    expect(getRecordState()).toBe('error'); // matches 端点仍回 500，重试同样失败
  });
});
