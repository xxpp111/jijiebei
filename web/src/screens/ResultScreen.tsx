import { CommanderCard } from '../components/CommanderCard';
import { FactorFrame } from '../components/FactorFrame';
import { BrandLockup } from '../components/BrandLockup';
import { mapUrl, cmdUrl, facUrl } from '../lib/realAsset';
import { getSessionMatches, getScore, getSelectState } from '../logic/jjbSession';

const RESULT_LABEL: Record<string, string> = { win: '胜利', bonus: '带奖励', lose: '失败' };

// ResultScreen — 结算屏（段3③）。承接后端 JJBResult.build：TopBar + 大比分 banner + 战绩卡列表 + 页脚。
// 大比分 = getScore()（winCount，含带奖励不双计）；战绩卡 result 从 sessionMatches 反查。0 改 jijie2。
export function ResultScreen({ style, mode }: { style: string; mode: string }) {
  const matches = getSessionMatches();
  const wins = getScore();
  const total = matches.length;
  const s = getSelectState();
  const playerName = s.playerName || '集结杯选手';

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
              <span className="meta-v" data-meta-mode>{modeLabel(s)}</span>
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
            return (
              <div key={i} className={cls} data-rcard-idx={i}>
                <div className="rcard-no">
                  <b>{m.slot}</b>
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
                      <FactorFrame key={k} src={facUrl(f)} size={46} tag={f === m.lock ? '锁定' : null} />
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

function modeLabel(s: ReturnType<typeof getSelectState>): string {
  if (s.modelFactorCount === 4) return '极难模式';
  const fc = s.modelFactorCount === 0 ? '随机'
    : s.modelFactorCount === 2 ? '8 因子'
    : s.modelFactorCount === 3 ? '10 因子'
    : `${s.modelFactorCount} 因子`;
  const ml = s.modeIsZhengjiu ? '拯救'
    : s.modeIsOnePick ? '单指'
    : s.modeIsVeryHard2 || s.modeIsVeryHard ? '极难'
    : s.modeFeiqiu ? '非酋'
    : s.modeSuiji ? '随机'
    : '手选';
  return `${fc} · ${ml}`;
}
