// CodeScreen — 集结杯「码方案」一对屏（承接 Claude Design 19b54387 的 code-scheme.css）。
//   variant='gen'   屏 C 生成码：固化当前局 → 自包含码 + 复制 + 元信息 + 摘要 3 场
//   variant='paste' 屏 D 贴码开局：粘贴码 → 解析（合法→摘要预览 / 非法·版本不符→.toastv.soft banner）→ 按此码开局
// 摘要卡复用 FactorFrame / CommanderCard + realAsset 真图（mapUrl/cmdUrl/facUrl，不用占位图）。
// 码 = encodePayload(capturePayload()) 的自包含 base64url（进 URL #hash）；引用式短码留 P5 占位。
// 「按此码开局」本 round 做到 decode 成功 + 写 URL #hash + 导航 select 接通；applySnapshot 还原留后续 round
//   （单打可直写 JijieData + 已有 setter，双打需 applyDoublesSnapshot 直写 jjbDoubles 闭包，超本 round scope，统一留后续）。
import { useEffect, useState } from 'react';
import { BrandLockup } from '../components/BrandLockup';
import { CommanderCard } from '../components/CommanderCard';
import { FactorFrame } from '../components/FactorFrame';
import { mapUrl, cmdUrl, facUrl } from '../lib/realAsset';
import { FACTORS } from '../config/factors';
import {
  capturePayload, encodePayload, decodeResult, PAYLOAD_VER,
  type PayloadSnapshot, type SingleSnapshot,
} from '../logic/codec';
import { difficultyTotal, factorScore, startSession } from '../logic/jjbSession';
import { currentSessionMode } from '../logic/jjbView';

export interface CodeScreenProps {
  style: string;
  mode: string;
  variant: 'gen' | 'paste';
  onBack: () => void;
  onStart: () => void; // 按此码开局：写 URL #hash + 导航 select（applySnapshot 还原留后续 round）
}

interface MatchSummary {
  slot: string; map: string; lock: string | null;
  cmds: string[]; factors: string[]; doubles: boolean;
}

const SLOT_LABELS = ['第 1 场', '第 2 场', 'BOSS 战'];
const facName = (idx: number): string => (idx >= 0 && idx < FACTORS.length ? FACTORS[idx].name : '');

/** snapshot → 3 场摘要（gen 展示当前局、paste 展示码还原的局，统一渲染）。 */
function snapshotToMatches(snap: PayloadSnapshot): MatchSummary[] {
  if (snap.kind === 's') {
    return [0, 1, 2].map((i) => {
      const lock = snap.locks[i] || null;
      const selFac = snap.selFac.slice(i * 3, i * 3 + 3).map(facName).filter(Boolean);
      return {
        slot: SLOT_LABELS[i],
        map: snap.maps[i] || '—',
        lock,
        cmds: snap.selCmd[i] ? [snap.selCmd[i] as string] : [],
        factors: [...(lock ? [lock] : []), ...selFac],
        doubles: false,
      };
    });
  }
  return [0, 1, 2].map((i) => {
    const me = snap.mutEntries[i];
    const sl = snap.slots[i];
    const extra = sl.facs.map(facName).filter(Boolean);
    return {
      slot: SLOT_LABELS[i],
      map: me.map || '—',
      lock: me.factors[0] || null,
      cmds: sl.cmds.filter((c): c is string => !!c),
      factors: [...me.factors, ...extra],
      doubles: true,
    };
  });
}

function snapshotModeLabel(snap: PayloadSnapshot): string {
  if (snap.kind === 'd') return snap.variant === 'feiqiu' ? '双打 · 非酋' : '双打 · 官突';
  const fc = snap.mfc === 0 ? '随机' : snap.mfc === 2 ? '8 因子' : snap.mfc === 3 ? '10 因子' : snap.mfc === 4 ? '12 因子' : `${snap.mfc} 因子`;
  const ml = snap.flags.zj ? '拯救' : snap.flags.op ? '单指' : (snap.flags.vh2 || snap.flags.vh) ? '极难' : snap.flags.fq ? '非酋' : snap.flags.sj ? '随机' : '手选';
  return `${fc} · ${ml}`;
}

/** 单打 snapshot 难度总分重算（paste 屏从码还原的局无模块态，需从 snap 重算）。双打无难度分。 */
function snapshotDifficultyTotal(snap: PayloadSnapshot): number | undefined {
  if (snap.kind !== 's') return undefined;
  const goldNames = new Set(snap.gold.map((idx) => facName(idx)));
  let sum = 0;
  for (let i = 0; i < 3; i++) {
    const lock = snap.locks[i];
    if (lock) sum += factorScore(lock) * (goldNames.has(lock) ? 2 : 1);
    for (let k = 0; k < 3; k++) {
      const idx = snap.selFac[i * 3 + k];
      const name = facName(idx);
      if (name) sum += factorScore(name) * (goldNames.has(name) ? 2 : 1);
    }
  }
  return sum;
}

/** 码展示截断（完整码 600-900 字符放不下 44px 大字区；截断展示，完整码在复制内容 + URL hash）。 */
function truncateCode(code: string): string {
  if (code.length <= 28) return code;
  return code.slice(0, 18) + '…' + code.slice(-9);
}

export function CodeScreen({ style, mode, variant, onBack, onStart }: CodeScreenProps) {
  return (
    <div
      className={`jjb style-${style} mode-${mode}`}
      style={{ width: 1280, height: 720, overflow: 'hidden' }}
      data-screen-label={`code-${variant}-${style}-${mode}`}
    >
      <div className="jjb-bg">
        <div className="bg-grad"></div>
        <div className="bg-tex"></div>
        <div className="bg-vignette"></div>
      </div>
      <div className="jjb-inner code-screen">
        <div className="topbar">
          <BrandLockup styleName={style} modeName={mode} size="sm" />
          <div className="topbar-meta">
            <div className="meta-row">
              <span className="meta-k">码方案</span>
              <span className="meta-v" data-code-variant>{variant === 'gen' ? '生成码 · 非实时' : '贴码开局 · 非实时'}</span>
            </div>
          </div>
        </div>
        {variant === 'gen' ? <GenPanel onBack={onBack} /> : <PastePanel onBack={onBack} onStart={onStart} />}
      </div>
    </div>
  );
}

// ===== 屏 C：生成码 =====

function GenPanel({ onBack }: { onBack: () => void }) {
  const [, setTick] = useState(0);
  const [copied, setCopied] = useState(false);

  const snap = capturePayload();
  const code = encodePayload(snap);
  const matches = snapshotToMatches(snap);
  const modeLabel = snapshotModeLabel(snap);
  const diffTotal = snap.kind === 's' ? difficultyTotal() : undefined;

  const handleCopy = async () => {
    // 复制完整码 + 把码写进 URL #hash（生成分享链接；对端打开同 hash → 后续 round applySnapshot 还原同盘）
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(code);
    } catch { /* 剪贴板被拒：URL #hash 仍是分享途径 */ }
    if (typeof window !== 'undefined') window.location.hash = `c=${code}`;
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleRegen = () => {
    // 重新生成 = 开新局再固化（码方案固化"当前局"，换局换码）
    try { startSession(currentSessionMode()); } catch { /* noop */ }
    setTick((x) => x + 1);
  };

  return (
    <>
      <div className="block-head">
        <span className="block-kicker">GENERATE CODE</span>
        <span className="block-title">生成对局码</span>
        <span className="block-note">把本局选因子结果固化 · 发给选手离线对照</span>
      </div>

      <SummaryCards matches={matches} />

      <div className="code-box">
        <span className="code-box-lbl">对局码</span>
        <span className="code-val" title={code} data-code-val>
          {truncateCode(code).split('…').map((seg, i, arr) => (
            <span key={i}>{seg}{i < arr.length - 1 && <span className="seg-dash">…</span>}</span>
          ))}
        </span>
        <button
          className={'code-copy' + (copied ? ' done' : '')}
          data-code-copy
          onClick={handleCopy}
        >
          {copied ? (
            <span className="code-copied">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              已复制
            </span>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"></rect><path d="M5 15V5a2 2 0 0 1 2-2h10"></path></svg>
              复制对局码
            </>
          )}
        </button>
      </div>

      <div className="code-meta">
        <div className="meta-cell"><span className="meta-k">模式</span><span className="meta-v" data-meta-mode>{modeLabel}</span></div>
        <div className="meta-cell"><span className="meta-k">难度总分</span><span className="meta-v big" data-meta-diff>{diffTotal ?? '—'}</span></div>
        <div className="meta-cell"><span className="meta-k">码长度</span><span className="meta-v">{code.length} 字符</span></div>
        <div className="meta-cell"><span className="meta-k">码版本</span><span className="meta-v">v{PAYLOAD_VER}</span></div>
      </div>

      <div className="code-actions">
        <button className="startbtn" data-code-copy-btn onClick={handleCopy}>复制对局码 <span className="startbtn-arrow">▶</span></button>
        <button className="btn-ghost" data-code-regen onClick={handleRegen}>重新生成</button>
        <span className="spacer" />
        <button className="btn-ghost" data-code-back onClick={onBack}>返回</button>
      </div>
    </>
  );
}

// ===== 屏 D：贴码开局 =====

type PasteStatus = null | 'ok' | 'invalid' | 'version' | 'pool';
const BAD_MSG: Record<'invalid' | 'version' | 'pool', { tx: string; rule: string }> = {
  invalid: { tx: '对局码无效，请核对后重新粘贴', rule: '无法开局' },
  version: { tx: '对局码版本不符 · 该码为旧版本，请更新工具后重试', rule: '需更新工具' },
  pool: { tx: '对局码版本不符 · 池已更新，请用新工具重新生成', rule: '需更新工具' },
};

function PastePanel({ onBack, onStart }: { onBack: () => void; onStart: () => void }) {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<PasteStatus>(null);
  const [snap, setSnap] = useState<PayloadSnapshot | null>(null);

  const doParse = () => {
    const r = decodeResult(code);
    if (r.ok === true) { setStatus('ok'); setSnap(r.snap); }
    else { setStatus(r.reason); setSnap(null); }
  };

  const matches = snap ? snapshotToMatches(snap) : [];
  const modeLabel = snap ? snapshotModeLabel(snap) : '';
  const diffTotal = snap ? snapshotDifficultyTotal(snap) : undefined;
  const bad = status === 'invalid' || status === 'version' || status === 'pool' ? BAD_MSG[status] : null;
  const ok = status === 'ok';

  return (
    <>
      <div className="block-head">
        <span className="block-kicker">PASTE CODE</span>
        <span className="block-title">贴码开局</span>
        <span className="block-note">粘贴主播 · 裁判发来的对局码 · 离线对照开局</span>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div className={'code-field' + (code ? ' focus' : '')}>
          <input
            value={code}
            onChange={(e) => { setCode(e.target.value); setStatus(null); setSnap(null); }}
            onPaste={(e) => { /* 粘贴后自动解析 */ const v = e.clipboardData.getData('text'); setTimeout(() => { const r = decodeResult(v); if (r.ok === true) { setStatus('ok'); setSnap(r.snap); } else { setStatus(r.reason); setSnap(null); } }, 0); }}
            placeholder="粘贴对局码… 例 JJB-8F-3K9Q-2M7X"
            data-code-input
            spellCheck={false}
          />
        </div>
        <button className="code-parse" data-code-parse onClick={doParse}>解析</button>
        {ok && (
          <span className="parse-ok">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            解析成功 · v{PAYLOAD_VER}
          </span>
        )}
      </div>

      {ok && snap && (
        <>
          <SummaryCards matches={matches} />
          <div className="code-meta">
            <div className="meta-cell"><span className="meta-k">模式</span><span className="meta-v" data-meta-mode>{modeLabel}</span></div>
            <div className="meta-cell"><span className="meta-k">难度总分</span><span className="meta-v big" data-meta-diff>{diffTotal ?? '—'}</span></div>
            <div className="meta-cell"><span className="meta-k">来源码</span><span className="meta-v">{truncateCode(code)}</span></div>
            <div className="meta-cell"><span className="meta-k">码版本</span><span className="meta-v">v{PAYLOAD_VER}</span></div>
          </div>
        </>
      )}

      {bad && (
        <div className="toastv soft" data-code-toast data-code-toast-kind={status}>
          <span className="toastv-ico">!</span>
          <span className="toastv-tx">{bad.tx}</span>
          <span className="toastv-rule">{bad.rule}</span>
        </div>
      )}

      <div className="code-actions">
        <button
          className={'startbtn' + (ok ? '' : ' blocked')}
          data-code-start
          disabled={!ok}
          onClick={onStart}
        >
          按此码开局 <span className="startbtn-arrow">▶</span>
        </button>
        <button className="btn-ghost" data-code-back onClick={onBack}>返回</button>
        <span className="spacer" />
        <span className="parse-wait">码方案 · 非实时 · 离线对照</span>
      </div>
    </>
  );
}

// ===== 共享：摘要 3 场卡（复用 FactorFrame / CommanderCard + realAsset 真图）=====

function SummaryCards({ matches }: { matches: MatchSummary[] }) {
  return (
    <div className="csum">
      {matches.map((m, i) => (
        <div className="csum-card" key={i} data-csum-card={i}>
          <div className="csum-head">
            <span className="csum-no">{m.slot}</span>
            {m.doubles && <span className="csum-dbl">双倍</span>}
          </div>
          <div className="csum-map">
            {mapUrl(m.map) ? (
              <img src={mapUrl(m.map)} alt={m.map} style={{ width: '100%', height: 64, objectFit: 'cover', display: 'block' }} />
            ) : (
              <div style={{ width: '100%', height: 64, background: 'var(--panel-bg)', border: '1px solid var(--panel-edge)' }} />
            )}
            <span className="csum-map-name">{m.map}</span>
          </div>
          <div className="csum-line">
            <div className="csum-cmds">
              {m.cmds.map((c, k) => (
                <CommanderCard key={k} src={cmdUrl(c)} name={c} w={56} h={67} fill check />
              ))}
            </div>
            <div className="csum-facs">
              {m.factors.map((f, k) => (
                <FactorFrame key={k} src={facUrl(f)} size={52} tag={k === 0 && m.lock ? (m.doubles ? '官突' : '锁定') : null} />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
