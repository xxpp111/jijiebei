import { useEffect, useState } from 'react';
import { CommanderCard } from '../components/CommanderCard';
import { FactorFrame } from '../components/FactorFrame';
import { BrandLockup } from '../components/BrandLockup';
import { CaptureButtons } from '../components/CaptureButtons';
import { mapUrl, cmdUrl, facUrl } from '../lib/realAsset';
import { currentDifficulty, currentLockedFactors, currentLockTag, currentMatches, currentModeLabel, currentPlayerName, currentScore, currentSessionMode, ensureDoublesSessionFromUrl } from '../logic/jjbView';
import { encodePayload, capturePayload, PAYLOAD_VER } from '../logic/codec';
import { getRuleMode, getScore } from '../logic/jjbSession';
import { postMatch, getToken, getAccount, ensurePlayer } from '../logic/backend';
import JijieData from '../logic/legacy/JijieData';

const RESULT_LABEL: Record<string, string> = { win: '胜利', bonus: '带奖励', lose: '失败' };

type RecordOutcome = 'posted' | 'duplicate' | 'skipped';
let posting = false; // 模块级 in-flight 锁：防 useEffect 双触 / 自动落库与手点按钮并发重复落

// P5 联调 + 需求1：canRecord 按 account.kind 收紧（防选手登录误触发正式天梯落库）。
//   比赛模式（ruleMode=match）：只 host/admin token（account.kind=host）落库 → mode=match 进正式天梯（scores hook 派生积分）。
//   练习模式（ruleMode=practice）：选手（kind=player）token 可落库 → mode=practice，scores hook 按 mode 过滤跳过算分（练习战绩选手自己看，不进正式天梯）。
//   ⚠️ 阶段4 前端就绪 / 后端待联动：matches.CreateRule=host||admin（init_collections:83 红线），选手 token（player_accounts 无 role）现阶段会被 matches 挡 400。
//      故 practice+选手 组合的 postMatch 会静默失败（catch 不阻断结算）。落库身份联动（CreateRule 放开 practice 态 + player_accounts.player→players relation）= 蓝图阶段4 独立轮，不在本契约。
//   ensurePlayer：选手不存在则以输入名兜底建/关联（hook 派生 scores 仅 match 态）。返回 outcome 供按钮反馈；失败抛错由调用方 catch。防重 key 成功后才置。
async function postMatchResult(): Promise<RecordOutcome> {
  const ruleMode = getRuleMode();
  const kind = getAccount()?.kind;
  // 比赛态只 host 落库；练习态选手可落库（自存练习战绩，不计正式分）；其余 skipped。
  const canPost = ruleMode === 'match' ? kind === 'host' : ruleMode === 'practice' ? kind === 'player' : false;
  if (!canPost || !getToken()) return 'skipped';
  const ms = currentMatches();
  if (ms.length < 3 || ms.some((m) => !m.result)) return 'skipped';
  const code = encodePayload(capturePayload());
  const key = 'jjb_posted_' + code.slice(0, 40);
  if (sessionStorage.getItem(key)) return 'duplicate'; // 防重：同局码已落
  if (posting) return 'duplicate';                      // in-flight：避免并发双落
  posting = true;
  try {
    const player = await ensurePlayer(currentPlayerName()); // 兜底：找不到则建/关联，让现场选手随便输名上天梯
    await postMatch({
      // mode 按 ruleMode 落：match 进正式天梯（hook 算分），practice 仅自存（hook 跳过算分）。
      mode: ruleMode === 'match' ? 'match' : 'practice',
      game_mode: currentSessionMode(), payload_code: code, payload_ver: PAYLOAD_VER,
      players: player ? [player.id] : [], host: getAccount()?.id,
      result: (JijieData as unknown as { winLoseList?: number[] }).winLoseList || [], score_total: getScore(),
    });
    sessionStorage.setItem(key, '1'); // 成功后才置防重（失败可重试）
    // 落库成功审计由后端 logs(match.create) 记，前端不打 log（check-no-debug）。
    return 'posted';
  } finally {
    posting = false;
  }
}

// ResultScreen — 结算屏（段3③）。承接后端 JJBResult.build：TopBar + 大比分 banner + 战绩卡列表 + 页脚。
// 大比分 = getScore()（winCount，含带奖励不双计）；战绩卡 result 从 sessionMatches 反查。0 改 jijie2。
export function ResultScreen({ style, mode, onGenCode }: { style: string; mode: string; onGenCode: () => void }) {
  const [, setTick] = useState(0);
  const [recordState, setRecordState] = useState<'idle' | 'posting' | 'done' | 'error'>('idle');
  // canRecord 按账户种类收紧（与 postMatchResult 同口径）：比赛模式只 host 可录、练习模式选手可录自存战绩。其余不显示录入按钮。
  const acctKind = getAccount()?.kind;
  const canRecord = (getRuleMode() === 'match' ? acctKind === 'host' : getRuleMode() === 'practice' ? acctKind === 'player' : false) && !!getToken();

  async function runRecord() {
    setRecordState('posting');
    try {
      const outcome = await postMatchResult();
      setRecordState(outcome === 'skipped' ? 'idle' : 'done'); // posted/duplicate 均视为已录入
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[jjb] 落库失败（不阻断结算）:', (e as Error).message);
      setRecordState('error');
    }
  }

  useEffect(() => {
    if (ensureDoublesSessionFromUrl()) setTick((x) => x + 1);
    if (canRecord) void runRecord(); // 比赛局自动落库（沿用原自动落库；按钮给主播显式反馈/失败重试）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const matches = currentMatches();
  const wins = currentScore();
  const total = matches.length;
  const playerName = currentPlayerName();

  return (
    <div className={`jjb style-${style} mode-${mode}`} style={{ width: 1280, height: 720 }} data-capture="result" data-screen-label={`result-${style}-${mode}`}>
      <div className="jjb-bg">
        <div className="bg-grad"></div>
        <div className="bg-tex"></div>
        <div className="bg-vignette"></div>
      </div>
      <div className="jjb-inner result">
        {/* TopBar（同对战页） */}
        <div className="topbar">
          <BrandLockup styleName={style} modeName={mode} size="sm" />
          <div className="topbar-meta">
            <div className="meta-row">
              <span className="meta-k">当前选手</span>
              <span className="meta-v" data-meta-player>{playerName}</span>
            </div>
            <div className="meta-row">
              <span className="meta-k">比赛模式</span>
              <span className="meta-v" data-meta-mode>{currentModeLabel()}</span>
            </div>
          </div>
        </div>

        {/* banner：kicker + 大比分 + tag */}
        <div className="result-banner">
          <span className="block-kicker" style={{ letterSpacing: 3 }}>MATCH COMPLETE · 比赛结束</span>
          <div className="result-score">
            <span className="rs-num" data-result-wins>{wins}</span>
            <span className="rs-unit">/ {total} 场获胜</span>
          </div>
          <span style={{ fontSize: 17, color: 'var(--muted)' }}>{wins === total && total > 0 ? '完美通关' : '本局战绩'}</span>
        </div>

        {/* 战绩卡列表（左侧胜负色条 + 场号 + 地图 + 阵容 + 结果徽章） */}
        <div className="rcards" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {matches.map((m, i) => {
            const cls = 'rcard' + (m.result ? ' rcard-' + m.result : '');
            const mapSrc = mapUrl(m.map);
            const difficulty = currentDifficulty(i);
            const lockedFactors = currentLockedFactors(m);
            const difficultyAttrs = difficulty === undefined ? {} : { 'data-match-difficulty': difficulty, [`data-match-difficulty-${i}`]: difficulty };
            return (
              <div key={i} className={cls} data-rcard-idx={i} {...difficultyAttrs}>
                <div className="rcard-no">
                  <b>{m.slot}</b>
                  {difficulty !== undefined && (
                    <span
                      className="rcard-difficulty"
                      style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent, #e8b84b)', whiteSpace: 'nowrap' }}
                    >
                      难度 {difficulty}
                    </span>
                  )}
                </div>
                <div className="rcard-map">
                  <span className="mapthumb">
                    {mapSrc ? (
                      <img src={mapSrc} alt={m.map} />
                    ) : (
                      <span style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>
                        {m.map}
                      </span>
                    )}
                  </span>
                </div>
                <div className="rcard-mid">
                  <div className="rcard-cmds">
                    {m.cmds.map((c, k) => (
                      <CommanderCard key={k} src={cmdUrl(c)} name={c} w={54} h={64} />
                    ))}
                  </div>
                  <div className="rcard-facs">
                    {m.factors.map((f, k) => (
                      <FactorFrame key={k} src={facUrl(f)} size={46} tag={lockedFactors ? (lockedFactors.includes(f) ? currentLockTag() : null) : (f === m.lock ? '锁定' : null)} />
                    ))}
                  </div>
                </div>
                {m.result ? (
                  <div className={'rcard-badge b-' + m.result} data-rcard-badge>{RESULT_LABEL[m.result]}</div>
                ) : (
                  <div className="rcard-badge" style={{ background: 'var(--panel-edge)', color: 'var(--muted)' }}>待判</div>
                )}
              </div>
            );
          })}
        </div>

        {/* 页脚 */}
        <div className="foot">
          <span className="foot-org">CM × 集结杯</span>
          <span className="foot-links">
            <a className="foot-link" href="https://mcn1taa2k785.feishu.cn/wiki/WF0ZwD2QciFDqGkmHSMcRrdvnyd" target="_blank" rel="noreferrer" style={{ cursor: 'pointer', textDecoration: 'none' }}>
              <b>集结杯文档</b>飞书知识库
            </a>
          </span>
          <button type="button" className="btn-ghost" data-nav-gencode onClick={onGenCode} style={{ marginLeft: 'auto' }}>生成对局码 →</button>
          {canRecord && (
            <button
              type="button"
              className="btn-ghost"
              data-record-confirm
              data-record-state={recordState}
              disabled={recordState === 'posting' || recordState === 'done'}
              onClick={() => void runRecord()}
              title="把本局战绩录入天梯（练习态不显示）"
            >
              {recordState === 'done'
                ? '✓ 已录入天梯'
                : recordState === 'posting'
                  ? '录入中…'
                  : recordState === 'error'
                    ? '录入失败 · 重试'
                    : '比赛结束 · 确认录入'}
            </button>
          )}
          <CaptureButtons targetSelector='[data-capture="result"]' filename="jjb-result.png" />
        </div>
      </div>
    </div>
  );
}
