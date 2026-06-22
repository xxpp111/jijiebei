import { useEffect, useState } from 'react';
import { CommanderCard } from '../components/CommanderCard';
import { FactorFrame } from '../components/FactorFrame';
import { BrandLockup } from '../components/BrandLockup';
import { mapUrl, cmdUrl, facUrl } from '../lib/realAsset';
import { currentDifficulty, currentLockedFactors, currentLockTag, currentMatches, currentModeLabel, currentPlayerName, currentScore, currentSessionMode, ensureDoublesSessionFromUrl } from '../logic/jjbView';
import { encodePayload, capturePayload, PAYLOAD_VER } from '../logic/codec';
import { getRuleMode, getScore } from '../logic/jjbSession';
import { postMatch, getToken, getAccount, getPlayerByCode } from '../logic/backend';
import JijieData from '../logic/legacy/JijieData';

const RESULT_LABEL: Record<string, string> = { win: '胜利', bonus: '带奖励', lose: '失败' };

// P5 联调：比赛模式一局判定满 3 场 → 落库（codec 编码 + postMatch + 防重 + 选手关联尽力）。
// 练习 / 未登录(无 host token) / 未判满 不落；选手 ID 匹配 player_code 则关联(hook 派生 scores)。落库失败不阻断结算。
async function maybePostMatch(): Promise<void> {
  try {
    if (getRuleMode() !== 'match' || !getToken()) return;
    const ms = currentMatches();
    if (ms.length < 3 || ms.some((m) => !m.result)) return;
    const code = encodePayload(capturePayload());
    const key = 'jjb_posted_' + code.slice(0, 40);
    if (sessionStorage.getItem(key)) return; // 防重：同局码不重复落
    sessionStorage.setItem(key, '1');
    const player = await getPlayerByCode(currentPlayerName());
    await postMatch({
      mode: 'match', game_mode: currentSessionMode(), payload_code: code, payload_ver: PAYLOAD_VER,
      players: player ? [player.id] : [], host: getAccount()?.id,
      result: (JijieData as unknown as { winLoseList?: number[] }).winLoseList || [], score_total: getScore(),
    });
    // eslint-disable-next-line no-console
    console.log('[jjb] 比赛局已落库');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[jjb] 落库失败（不阻断结算）:', (e as Error).message);
  }
}

// ResultScreen — 结算屏（段3③）。承接后端 JJBResult.build：TopBar + 大比分 banner + 战绩卡列表 + 页脚。
// 大比分 = getScore()（winCount，含带奖励不双计）；战绩卡 result 从 sessionMatches 反查。0 改 jijie2。
export function ResultScreen({ style, mode }: { style: string; mode: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (ensureDoublesSessionFromUrl()) setTick((x) => x + 1);
    void maybePostMatch(); // P5 联调：比赛局落库（仅 match 态 + 已登录 + 判满，幂等）
  }, []);

  const matches = currentMatches();
  const wins = currentScore();
  const total = matches.length;
  const playerName = currentPlayerName();

  return (
    <div className={`jjb style-${style} mode-${mode}`} style={{ width: 1280, height: 720 }} data-screen-label={`result-${style}-${mode}`}>
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
        </div>
      </div>
    </div>
  );
}
