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

// P5 联调：比赛模式一局判定满 3 场 → ensurePlayer 兜底关联选手 + postMatch（codec 编码 + 防重幂等）。
// 练习 / 未登录(无 host token) / 未判满 → 'skipped' 不落。ensurePlayer：选手不存在则以输入名兜底建/关联(hook 派生 scores)。
// 返回 outcome 供按钮反馈；失败抛错由调用方 catch（不阻断结算）。防重 key 成功后才置（失败可重试）。
async function postMatchResult(): Promise<RecordOutcome> {
  if (getRuleMode() !== 'match' || !getToken()) return 'skipped';
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
      mode: 'match', game_mode: currentSessionMode(), payload_code: code, payload_ver: PAYLOAD_VER,
      players: player ? [player.id] : [], host: getAccount()?.id,
      result: (JijieData as unknown as { winLoseList?: number[] }).winLoseList || [], score_total: getScore(),
    });
    sessionStorage.setItem(key, '1'); // 成功后才置防重（失败可重试）
    // eslint-disable-next-line no-console
    console.log('[jjb] 比赛局已落库（含选手兜底关联）');
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
  const canRecord = getRuleMode() === 'match' && !!getToken(); // 练习/未登录不显示录入按钮（沿用落库门控）

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
