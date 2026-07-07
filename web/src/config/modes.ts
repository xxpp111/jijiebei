// 模式声明配置 —— 单一真相源（收敛前散在 HomeScreen.MODES / BpConfigScreen.BP_MODES / bpConfig.BP_MODE_DEFS 三处 + jjbView.currentModeLabel 的 label）。
// 只收敛「声明型特性」（展示名/标签/BP 默认态/文案），不碰引擎（toStartCore/toSelectCore/setModeFlags/codec flags 零改）。
// 手写 TS（非 csv 派生），故不进 gen-config，也不加 AUTO-GENERATED 头（避免 drift-check 误判）。
//
// 字段来源与语义：
//   no/name/tag        首页 8 格（HomeScreen）与 BP 面板（BpConfigScreen）共用的编号/展示名/标签。
//   bpName/bpTag       BP 面板对同一 key 的差异化展示（仅 std12/rescue/doubles 与首页不同时提供；缺省回落 name/tag）。
//   label              currentModeLabel（SelectScreen/ResultScreen「比赛模式」栏）逐模式文案。
//   doublesLabel       双打变体短文案（由 UI 包装为「双打 · X」或「双打模式 · X」）。
//   lockTag            双打锁定位/待选位角标文案。
//   urlEnabled         URL ?sessionMode= 白名单；suiji 保留内部模式但 URL 不开放。
//   homeVisible        首页 8 格可见项。
//   bpVisible          BP 面板可见项。
//   bpDefault/bpLocked BP 开关默认态/锁死态（= 旧 bpConfig.enabledDefault/locked）。
//   def/defcls         BP 面板默认态徽标文案与样式类（声明字符串，非从 bpDefault/bpLocked 派生）。
//   fac/form/note      BP 面板展示的因子节奏/玩法/备注（fac/note 当前 BP 未渲染，保留结构）。
import type { SessionMode } from '../logic/session/sessionConfig';

export interface ModeDef {
  no?: string;
  name?: string;
  tag?: string;
  bpName?: string;
  bpTag?: string;
  label?: string;
  doublesLabel?: string;
  lockTag?: string;
  urlEnabled: boolean;
  homeVisible: boolean;
  bpVisible: boolean;
  bpDefault?: boolean;
  bpLocked?: boolean;
  def?: string;
  defcls?: string;
  fac?: string;
  form?: string;
  note?: string;
}

// key 对齐 SessionMode（jjbSession.ts）。对象声明顺序用于 URL 白名单旧顺序；
// Home/BP 屏按 no 字段排序后过滤，分别保留各自旧顺序。
// feiqiu=BP 面板单打非酋行；feiqiu-doubles=首页 05 格非酋双打；
// one-a/hard1/hard2/suiji 不在任何屏渲染，仅 currentModeLabel 需其 label（BP 态走 getter 的 ?? false 兜底）。
const MODE_DEFS_DATA = {
  std8: {
    no: '01', name: '8 因子', tag: '标准赛', label: '8 因子 · 手选',
    urlEnabled: true, homeVisible: true, bpVisible: true,
    bpDefault: true, bpLocked: false,
    def: '默认开', defcls: 'd-on', fac: '2 / 3 / 3',
    form: '二选一 · Ban 1 因子 / 自选 1 指挥官', note: 'A弱/B强 · 降权 0.25 · selfShow=true',
  },
  std10: {
    no: '02', name: '10 因子', tag: '进阶', label: '10 因子 · 手选',
    urlEnabled: true, homeVisible: true, bpVisible: true,
    bpDefault: true, bpLocked: false,
    def: '默认开', defcls: 'd-on', fac: '3 / 3 / 4',
    form: '二选一 · Ban 1 因子 / 自选 1 指挥官', note: 'selfShow=true · 自选指挥官时手选因子 −1',
  },
  std12: {
    no: '03', name: '极难模式', tag: '极难', bpName: '极难 · 12 因子', label: '极难模式',
    urlEnabled: true, homeVisible: true, bpVisible: true,
    bpDefault: false, bpLocked: false,
    def: '默认关 · 可手动开', defcls: 'd-optin', fac: '4 / 4 / 4',
    form: '二选一 · Ban 1 因子 / 自选 1 指挥官 · 末场金框 ×2', note: '默认关但开关可点亮 · 非锁死',
  },
  rescue: {
    no: '04', name: '拯救模式', tag: '固定7人', bpName: '拯救', label: '10 因子 · 拯救',
    urlEnabled: true, homeVisible: true, bpVisible: true,
    bpDefault: false, bpLocked: false,
    def: '默认关', defcls: 'd-off', fac: '3 / 3 / 4',
    form: '固定 7 人池 · 「自选指挥官」分支语义受限', note: '固定7人(含凯瑞甘·不吃ban) · selfShow=false',
  },
  // 仅 URL / currentModeLabel 用（不在首页/BP渲染）
  'one-a': { label: '10 因子 · 单指', urlEnabled: true, homeVisible: false, bpVisible: false },
  hard1: { label: '8 因子 · 极难', urlEnabled: true, homeVisible: false, bpVisible: false },
  hard2: { label: '8 因子 · 极难', urlEnabled: true, homeVisible: false, bpVisible: false },
  feiqiu: {
    no: '05', name: '非酋', tag: '之轮', label: '1 因子 · 非酋',
    urlEnabled: true, homeVisible: false, bpVisible: true,
    bpDefault: false, bpLocked: false,
    def: '默认关 · 可配', defcls: 'd-off', fac: '1 / 1 / 1',
    form: '二选一 · 自选分支受 selfShow 门控', note: '3 固定因子 · selfShow=false · 自选待门控',
  },
  // std15/cm 已改双打（Batch C · yb 2026-07-02 拍板）：jjbDoubles variant，格标/文案改双打语义；
  // BP 与双打其他格一致锁死（双打 BP 未实装，对齐 doubles/feiqiu-doubles 行）。
  std15: {
    no: '07', name: '15 因子', tag: '双打随机', label: '15 因子 · 双打',
    doublesLabel: '15因子', lockTag: '待选',
    urlEnabled: true, homeVisible: true, bpVisible: true,
    bpDefault: false, bpLocked: true,
    def: '暂不可用', defcls: 'd-lock', fac: '5 / 场',
    form: '双打 · 每场 2 指挥官 · 5 待选无锁定', note: '双打 variant=std15 · 4A2B + 自选区 · BP 不适用',
  },
  cm: {
    no: '08', name: 'CM 专属', tag: 'CM 双打', label: 'CM 专属 · 双打',
    doublesLabel: 'CM', lockTag: '锁定',
    urlEnabled: true, homeVisible: true, bpVisible: true,
    bpDefault: false, bpLocked: true,
    def: '暂不可用', defcls: 'd-lock', fac: '2 锁 + 4 / 场',
    form: '双打 · 每场 2 指挥官 · 恒锁 风暴英雄/虚空裂隙', note: '双打 variant=cm · 3A3B（CM 入 B 升权）· 自选全量 22 · BP 不适用',
  },
  doubles: {
    no: '06', name: '官突双打', tag: '双打', bpName: '双打', bpTag: '官突',
    doublesLabel: '官突', lockTag: '官突',
    urlEnabled: true, homeVisible: true, bpVisible: true,
    bpDefault: false, bpLocked: true,
    def: '暂不可用', defcls: 'd-lock', fac: '5 / 场',
    form: 'BP 暂未启用 · 框架预留，下轮实装', note: '独立骨架旁路 XP · 锁死灰掉不可点',
  },
  'feiqiu-doubles': {
    no: '05', name: '非酋之轮', tag: '非酋双打',
    doublesLabel: '非酋', lockTag: '非酋',
    urlEnabled: true, homeVisible: true, bpVisible: false,
    bpDefault: false, bpLocked: true,
  },
  suiji: { label: '随机 · 随机', urlEnabled: false, homeVisible: false, bpVisible: false },
} satisfies Record<SessionMode, ModeDef>;

export const MODE_DEFS: Record<SessionMode, ModeDef> = MODE_DEFS_DATA;

type ModeFlag = 'urlEnabled' | 'homeVisible' | 'bpVisible';
type DoublesModeKey = 'doubles' | 'feiqiu-doubles' | 'std15' | 'cm';
type DoublesVariantKey = DoublesModeKey | 'guantu' | 'feiqiu';

const modeKeys = Object.keys(MODE_DEFS) as SessionMode[];

function visibleBy(flag: ModeFlag): SessionMode[] {
  return modeKeys.filter((key) => MODE_DEFS[key][flag]);
}

function visibleByNo(flag: ModeFlag): SessionMode[] {
  return visibleBy(flag).slice().sort((a, b) => Number(MODE_DEFS[a].no ?? 99) - Number(MODE_DEFS[b].no ?? 99));
}

function doublesModeKey(key: DoublesVariantKey): DoublesModeKey {
  if (key === 'guantu') return 'doubles';
  if (key === 'feiqiu') return 'feiqiu-doubles';
  return key;
}

export const URL_MODE_KEYS = visibleBy('urlEnabled');
export const HOME_MODE_KEYS = visibleByNo('homeVisible');
export const BP_MODE_KEYS = visibleByNo('bpVisible');

export function doublesLabelFor(key: DoublesVariantKey): string {
  return `双打 · ${MODE_DEFS[doublesModeKey(key)].doublesLabel ?? ''}`;
}

export function doublesModeLabelFor(key: DoublesVariantKey): string {
  return `双打模式 · ${MODE_DEFS[doublesModeKey(key)].doublesLabel ?? ''}`;
}

export function lockTagFor(key: DoublesVariantKey): string {
  return MODE_DEFS[doublesModeKey(key)].lockTag ?? '官突';
}

export function slotTagFor(
  key: DoublesVariantKey,
  opts: { extraFactors?: number; mutatorName?: string } = {},
): string {
  const tag = lockTagFor(key);
  const mode = doublesModeKey(key);
  if (mode === 'std15') return `${tag} ${opts.extraFactors ?? ''}`.trim();
  if (mode === 'cm') return `${tag} 2 + 待选 ${opts.extraFactors ?? ''}`.trim();
  if (mode === 'feiqiu-doubles') return tag;
  return `${tag} ${opts.mutatorName ?? ''}`.trim();
}
