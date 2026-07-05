// web/src/logic/matchRecord.ts
// 落库语义层（瘦身 Batch4 + #94 落库触发链路修复）：从 ResultScreen 下沉 postMatchResult + 落库资格谓词，
// 新增 autoPostIfComplete（判定完成即后台自动落库，5 秒改判缓冲）+ 模块级 recordState（BattleScreen 常驻状态 chip）。
// screen 只调语义函数；资格谓词 canPostResult() 单点导出，消除 ResultScreen 内双写（自动落库判定 + 录入按钮可见性）漂移。
import { currentMatches, currentPlayerName, currentScore, currentSessionMode } from './jjbView';
import { encodePayload, capturePayload, PAYLOAD_VER, type PayloadSnapshot } from './codec';
import { getRuleMode } from './jjbSession';
import { postMatch, getToken, getAccount, ensurePlayer } from './backend';
import { RESULT_VAL } from './legacy/JJBData';

export type RecordOutcome = 'posted' | 'duplicate' | 'skipped';

let posting = false; // 模块级 in-flight 锁：防 useEffect 双触 / 自动落库与手点按钮并发重复落

/**
 * 落库资格谓词（单点真相）。按 account.kind 收紧（防选手登录误触发正式天梯落库）：
 *   比赛模式（ruleMode=match）：只 host/admin token（kind=host）落库 → mode=match 进正式天梯（scores hook 派生积分）。
 *   练习模式（ruleMode=practice）：选手（kind=player）token 可落库 → mode=practice，scores hook 按 mode 过滤跳过算分（练习战绩选手自己看，不进正式天梯）。
 *   其余组合不可落。须有 token。
 */
export function canPostResult(): boolean {
  const ruleMode = getRuleMode();
  const kind = getAccount()?.kind;
  const canPost = ruleMode === 'match' ? kind === 'host' : ruleMode === 'practice' ? kind === 'player' : false;
  return canPost && !!getToken();
}

// matches.CreateRule=host||admin||practice 分支已放开（migration 006 · commit 848dff3）+ player_accounts→players
// 自动建 hook 已落（c5f853d）：practice+选手 组合可正常落库，不再被 400 挡。ensurePlayer：选手不存在则以输入名
// 兜底建/关联（hook 派生 scores 仅 match 态）。返回 outcome 供按钮反馈；失败抛错由调用方 catch。防重 key 成功后才置。
export async function postMatchResult(): Promise<RecordOutcome> {
  if (!canPostResult()) return 'skipped';
  const ms = currentMatches();
  if (ms.length < 3 || ms.some((m) => !m.result)) return 'skipped';
  // 落库 payload：真实 wl（当前判定结果），落 payload_code 供回放；
  // 防重 key 另走「局指纹」（wl 置空的拷贝，见 fingerprintKey），改判不漂移。
  const code = encodePayload(capturePayload());
  const key = 'jjb_posted_' + fingerprintKey();
  if (sessionStorage.getItem(key)) return 'duplicate'; // 防重：同局码已落
  if (posting) return 'duplicate';                      // in-flight：避免并发双落
  posting = true;
  try {
    const ruleMode = getRuleMode();
    const player = await ensurePlayer(currentPlayerName()); // 兜底：找不到则建/关联，让现场选手随便输名上天梯
    await postMatch({
      // mode 按 ruleMode 落：match 进正式天梯（hook 算分），practice 仅自存（hook 跳过算分）。
      mode: ruleMode === 'match' ? 'match' : 'practice',
      game_mode: currentSessionMode(), payload_code: code, payload_ver: PAYLOAD_VER,
      players: player ? [player.id] : [], host: ruleMode === 'match' ? getAccount()?.id : undefined,
      // result/score_total 经 jjbView 分流（currentMatches/currentScore）：单打→XP 引擎，双打→jjbDoubles 引擎，
      // 不再直读 JijieData.winLoseList（双打判定写在 jjbDoubles 闭包，直读会拿单打陈旧/空值 — #94 落库读错引擎）。
      result: ms.map((m) => RESULT_VAL[m.result as string]), score_total: currentScore(),
    });
    sessionStorage.setItem(key, '1'); // 成功后才置防重（失败可重试）
    // 落库成功审计由后端 logs(match.create) 记，前端不打 log（check-no-debug）。
    return 'posted';
  } finally {
    posting = false;
  }
}

/** 局指纹：capturePayload() 拷贝把 wl（判定结果，改判会变）置空后编码 —— 改判只变 wl，指纹不变，
 *  防重 key 因此不随改判漂移（同局第二次 POST 仍命中 duplicate，不产生第二条 matches）。
 *  用编码全串而非截断前缀：poolFingerprint() 是跨单/双打恒定的全局常量，snapshot 的 kind/mode/variant
 *  等区分字段排在 JSON 靠后位置——早前版本截断前 N 字符会把不同局（尤其单打 vs 双打）误判成同一指纹。 */
function fingerprintKey(): string {
  const snap = capturePayload();
  return encodePayload({ ...snap, wl: [] } as PayloadSnapshot);
}

export type RecordState = 'idle' | 'posting' | 'done' | 'error';

let recordState: RecordState = 'idle';
const recordListeners = new Set<() => void>();
function setRecordState(s: RecordState): void {
  recordState = s;
  recordListeners.forEach((fn) => fn());
}
/** BattleScreen 常驻状态 chip 读这个（模块级，跨屏不丢）。 */
export function getRecordState(): RecordState { return recordState; }
/** 订阅 recordState 变化（返回取消订阅函数）。BattleScreen 用它驱动 chip 重渲。 */
export function subscribeRecordState(fn: () => void): () => void {
  recordListeners.add(fn);
  return () => { recordListeners.delete(fn); };
}

const AUTO_POST_DELAY_MS = 5000;
let autoPostTimer: ReturnType<typeof setTimeout> | null = null;
let pendingResolve: ((v: RecordOutcome | null) => void) | null = null;

async function runAutoPost(): Promise<RecordOutcome | null> {
  setRecordState('posting');
  try {
    const outcome = await postMatchResult();
    setRecordState(outcome === 'skipped' ? 'idle' : 'done'); // posted/duplicate 均视为已录入
    return outcome;
  } catch {
    setRecordState('error');
    return null;
  }
}

/** 清掉在途计时器；若有旧调用挂着等结果，喂它 null（被新判定/新请求取代，不代表失败）。 */
function clearAutoPostTimer(): void {
  if (autoPostTimer) { clearTimeout(autoPostTimer); autoPostTimer = null; }
  if (pendingResolve) { const resolve = pendingResolve; pendingResolve = null; resolve(null); }
}

/**
 * 判定完成即后台自动落库，带 5 秒改判缓冲：3 场全判定 + canPostResult() 才排计时；
 * 计时期间再次调用（改判）会清掉旧计时器重排，计时到点才真正 POST。timer 挂模块级，
 * 组件卸载 / 切屏不丢、不重开（主播判完第 3 场不开结算屏也会落库，修 #94 核心缺口）。
 * 条件不满足（未判完 / 无资格）→ 清掉在途计时器、返回 null。
 */
export function autoPostIfComplete(): Promise<RecordOutcome | null> {
  const ms = currentMatches();
  const complete = ms.length >= 3 && ms.every((m) => !!m.result);
  clearAutoPostTimer();
  if (!complete || !canPostResult()) return Promise.resolve(null);
  return new Promise((resolve) => {
    pendingResolve = resolve;
    autoPostTimer = setTimeout(() => {
      autoPostTimer = null;
      pendingResolve = null;
      void runAutoPost().then(resolve);
    }, AUTO_POST_DELAY_MS);
  });
}

/** 录入失败后手动重试：跳过 5 秒缓冲立即重跑（用户已主动点击，无需再等）。 */
export function retryRecordPost(): void {
  clearAutoPostTimer();
  void runAutoPost();
}
