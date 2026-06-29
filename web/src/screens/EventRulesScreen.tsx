import { useEffect, useState } from 'react';
import { BrandLockup } from '../components/BrandLockup';
import { FACTORS } from '../config/factors';
import { MUTATOR_POOL, type MutatorEntry } from '../data/mutatorPool';
import { getToken } from '../logic/backend';

// EventRulesScreen — 需求2「比赛规则临时 ban」配置面（主播后台）。对齐 BpConfigScreen 视觉语言。
// 三分区多选：禁用地图 / 禁用因子(带双打命中数) / 禁用官突(A/B/C分组+搜索)。
// ★数据源自包含：直接 import FACTORS(71母表)+MUTATOR_POOL(官突+地图)，命中数本地算——不依赖 spoke 的 eventBan.ts。
// ★后端读写 /api/event-rules + event_rules 已接真（本屏 onClick 内联 fetch；瘦身 Batch4 待下沉 backend.ts）。

const ALL_MUTATORS: MutatorEntry[] = [...MUTATOR_POOL.A, ...MUTATOR_POOL.B, ...MUTATOR_POOL.C];
const ALL_MAPS = [...new Set(ALL_MUTATORS.map((e) => e.map))].sort();
// 某因子命中几个官突（双打 ban 该因子会一并排除这些官突；命中 0 = 双打 ban 无关联，提示主播）
function mutatorHitCount(factorName: string): number {
  return ALL_MUTATORS.filter((e) => e.factors.includes(factorName)).length;
}

// 真后端：/api/event-rules 公开读当前 ruleset；保存走 POST event_rules（host token，触发单活跃 hook）。
const API = '/api';

export function EventRulesScreen({ style, mode }: { style: string; mode: string }) {
  const [season, setSeason] = useState('2026-W26');
  const [banMaps, setBanMaps] = useState<Set<string>>(new Set());
  const [banFactors, setBanFactors] = useState<Set<string>>(new Set());
  const [banMutators, setBanMutators] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');

  // 初始加载当前赛事 ruleset（/api/event-rules 公开读，无 active 行返空）
  useEffect(() => {
    fetch(`${API}/event-rules`).then((r) => r.json()).then((d) => {
      if (d.season) setSeason(d.season);
      setBanMaps(new Set(d.ban_maps ?? []));
      setBanFactors(new Set(d.ban_factors ?? []));
      setBanMutators(new Set(d.ban_mutators ?? []));
    }).catch(() => { /* 后端不可达 → 空 ban */ });
  }, []);

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, key: string) => {
    const next = new Set(set); if (next.has(key)) next.delete(key); else next.add(key); setter(next);
  };

  const mapsLeft = ALL_MAPS.length - banMaps.size;
  const guardMap = mapsLeft < 3; // 守卫：单打每局抽 3 张地图，可抽 < 3 阻止保存

  return (
    <div className={`jjb bpc evr style-${style} mode-${mode}`} style={{ width: 1280, height: 720 }} data-screen-label={`eventrules-${style}-${mode}`}>
      <div className="jjb-bg"><div className="bg-grad"></div><div className="bg-tex"></div><div className="bg-vignette"></div></div>
      <div className="jjb-inner">
        <div className="topbar">
          <BrandLockup styleName={style} modeName={mode} size="sm" />
          <div className="topbar-meta"><div className="meta-row"><span className="meta-k">赛事规则</span><span className="meta-v">{season}</span></div></div>
        </div>
        <div className="bpc-head">
          <span className="bpc-kicker">EVENT BAN</span>
          <span className="bpc-title">本周赛事规则</span>
          <span className="bpc-headnote">主播配本周临时 ban，对单打 + 双打抽取统一生效（下一局起）。禁用因子时，双打里含该因子的官突一并排除。</span>
        </div>

        <div className="evr-cols">
          {/* ① 禁用地图 */}
          <div className="evr-col">
            <div className="evr-col-head"><span className="evr-col-t">① 禁用地图<small style={{ fontWeight: 400, color: 'var(--muted)', marginLeft: 6 }}>仅单刷</small></span><span className="evr-col-n">{banMaps.size}/{ALL_MAPS.length}</span></div>
            <div className="evr-chips">
              {ALL_MAPS.map((m) => (
                <button key={m} type="button" className={'evr-chip' + (banMaps.has(m) ? ' on' : '')} data-evr-map={m} onClick={() => toggle(banMaps, setBanMaps, m)}>{m}</button>
              ))}
            </div>
            {guardMap && <span className="evr-guard">⚠ 可抽地图仅剩 {mapsLeft} 张（&lt; 3），请少 ban 几张</span>}
          </div>

          {/* ② 禁用因子（带双打命中数） */}
          <div className="evr-col evr-col-fac">
            <div className="evr-col-head"><span className="evr-col-t">② 禁用因子</span><span className="evr-col-n">{banFactors.size}/{FACTORS.length}</span></div>
            <div className="evr-chips evr-chips-fac">
              {FACTORS.map((f) => {
                const hit = mutatorHitCount(f.name);
                return (
                  <button key={f.name} type="button" className={'evr-chip evr-chip-fac' + (banFactors.has(f.name) ? ' on' : '')} data-evr-factor={f.name} onClick={() => toggle(banFactors, setBanFactors, f.name)} title={`双打命中 ${hit} 个官突`}>
                    <span className="evr-chip-nm">{f.name}</span>
                    <span className={'evr-chip-hit' + (hit === 0 ? ' zero' : '')}>双打 {hit}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ③ 禁用官突（A/B/C 分组 + 搜索） */}
          <div className="evr-col evr-col-mut">
            <div className="evr-col-head"><span className="evr-col-t">③ 禁用官突</span><span className="evr-col-n">{banMutators.size}/{ALL_MUTATORS.length}</span></div>
            <input className="evr-search" placeholder="搜索官突名 / 因子…" value={search} onChange={(e) => setSearch(e.target.value)} data-evr-search />
            <div className="evr-chips evr-chips-mut">
              {(['A', 'B', 'C'] as const).map((t) => {
                const list = MUTATOR_POOL[t].filter((e) => !search || e.name.includes(search) || e.factors.some((f) => f.includes(search)));
                if (!list.length) return null;
                return (
                  <div key={t} className="evr-mut-tier">
                    <span className="evr-mut-tier-t">{t} 档 · {t === 'A' ? '易' : t === 'B' ? '中' : '难'}</span>
                    {list.map((e) => (
                      <button key={e.name} type="button" className={'evr-chip evr-chip-mut' + (banMutators.has(e.name) ? ' on' : '')} data-evr-mutator={e.name} onClick={() => toggle(banMutators, setBanMutators, e.name)} title={e.factors.join(' / ')}>{e.name.split(' ')[0]}</button>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="evr-foot">
          <button type="button" className="evr-btn-clear" data-evr-clear onClick={() => { setBanMaps(new Set()); setBanFactors(new Set()); setBanMutators(new Set()); }}>清空恢复无 ban</button>
          <span className="evr-foot-note">{saveState === 'done' ? '✓ 已保存，下一局生效' : saveState === 'error' ? '保存失败（需主播登录）' : '保存后写入 /api/event-rules，下一局生效'}</span>
          <button type="button" className="evr-btn-save" data-evr-save disabled={guardMap || saveState === 'saving'} onClick={async () => {
            const token = getToken();
            if (!token) { setSaveState('error'); window.alert('请先用主播账号登录再保存'); return; }
            setSaveState('saving');
            try {
              const r = await fetch(`${API}/collections/event_rules/records`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token },
                body: JSON.stringify({ season, ban_maps: [...banMaps], ban_factors: [...banFactors], ban_mutators: [...banMutators], active: true }),
              });
              setSaveState(r.ok ? 'done' : 'error');
            } catch { setSaveState('error'); }
          }}>{saveState === 'saving' ? '保存中…' : saveState === 'done' ? '✓ 已保存' : '保存并生效（下一局起）'}</button>
        </div>
      </div>
    </div>
  );
}
