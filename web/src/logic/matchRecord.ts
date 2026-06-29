// web/src/logic/matchRecord.ts
// 落库语义层（瘦身 Batch4）：从 ResultScreen 下沉 postMatchResult + 落库资格谓词。
// screen 只调语义函数；资格谓词 canPostResult() 单点导出，消除 ResultScreen 内双写（自动落库判定 + 录入按钮可见性）漂移。
import { currentMatches, currentPlayerName, currentSessionMode } from './jjbView';
import { encodePayload, capturePayload, PAYLOAD_VER } from './codec';
import { getRuleMode, getScore } from './jjbSession';
import { postMatch, getToken, getAccount, ensurePlayer } from './backend';
import JijieData from './legacy/JijieData';

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

// ⚠️ 阶段4 前端就绪 / 后端待联动：matches.CreateRule=host||admin（init_collections:83 红线），选手 token（player_accounts 无 role）现阶段会被 matches 挡 400。
//    故 practice+选手 组合的 postMatch 会静默失败（catch 不阻断结算）。落库身份联动（CreateRule 放开 practice 态 + player_accounts.player→players relation）= 蓝图阶段4 独立轮，不在本契约。
//    ensurePlayer：选手不存在则以输入名兜底建/关联（hook 派生 scores 仅 match 态）。返回 outcome 供按钮反馈；失败抛错由调用方 catch。防重 key 成功后才置。
export async function postMatchResult(): Promise<RecordOutcome> {
  if (!canPostResult()) return 'skipped';
  const ms = currentMatches();
  if (ms.length < 3 || ms.some((m) => !m.result)) return 'skipped';
  const code = encodePayload(capturePayload());
  const key = 'jjb_posted_' + code.slice(0, 40);
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
      result: (JijieData as unknown as { winLoseList?: number[] }).winLoseList || [], score_total: getScore(),
    });
    sessionStorage.setItem(key, '1'); // 成功后才置防重（失败可重试）
    // 落库成功审计由后端 logs(match.create) 记，前端不打 log（check-no-debug）。
    return 'posted';
  } finally {
    posting = false;
  }
}
