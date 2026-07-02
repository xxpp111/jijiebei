// 模式声明配置 —— 单一真相源（收敛前散在 HomeScreen.MODES / BpConfigScreen.BP_MODES / bpConfig.BP_MODE_DEFS 三处 + jjbView.currentModeLabel 的 label）。
// 只收敛「声明型特性」（展示名/标签/BP 默认态/文案），不碰引擎（toStartCore/toSelectCore/setModeFlags/codec flags 零改）。
// 手写 TS（非 csv 派生），故不进 gen-config，也不加 AUTO-GENERATED 头（避免 drift-check 误判）。
//
// 字段来源与语义：
//   no/name/tag        首页 8 格（HomeScreen）与 BP 面板（BpConfigScreen）共用的编号/展示名/标签。
//   bpName/bpTag       BP 面板对同一 key 的差异化展示（仅 std12/rescue/doubles 与首页不同时提供；缺省回落 name/tag）。
//   label              currentModeLabel（SelectScreen/ResultScreen「比赛模式」栏）逐模式文案。
//   bpDefault/bpLocked BP 开关默认态/锁死态（= 旧 bpConfig.enabledDefault/locked）。
//   def/defcls         BP 面板默认态徽标文案与样式类（声明字符串，非从 bpDefault/bpLocked 派生）。
//   fac/form/note      BP 面板展示的因子节奏/玩法/备注（fac/note 当前 BP 未渲染，保留结构）。

export interface ModeDef {
  no?: string;
  name?: string;
  tag?: string;
  bpName?: string;
  bpTag?: string;
  label?: string;
  bpDefault?: boolean;
  bpLocked?: boolean;
  def?: string;
  defcls?: string;
  fac?: string;
  form?: string;
  note?: string;
}

// key 对齐 SessionMode（jjbSession.ts）。feiqiu=BP 面板单打非酋行；feiqiu-doubles=首页 05 格非酋双打；
// one-a/hard1/hard2/suiji 不在任何屏渲染，仅 currentModeLabel 需其 label（BP 态走 getter 的 ?? false 兜底）。
export const MODE_DEFS: Record<string, ModeDef> = {
  std8: {
    no: '01', name: '8 因子', tag: '标准赛', label: '8 因子 · 手选',
    bpDefault: true, bpLocked: false,
    def: '默认开', defcls: 'd-on', fac: '2 / 3 / 3',
    form: '二选一 · Ban 1 因子 / 自选 1 指挥官', note: 'A弱/B强 · 降权 0.25 · selfShow=true',
  },
  std10: {
    no: '02', name: '10 因子', tag: '进阶', label: '10 因子 · 手选',
    bpDefault: true, bpLocked: false,
    def: '默认开', defcls: 'd-on', fac: '3 / 3 / 4',
    form: '二选一 · Ban 1 因子 / 自选 1 指挥官', note: 'selfShow=true · 自选指挥官时手选因子 −1',
  },
  std12: {
    no: '03', name: '极难模式', tag: '极难', bpName: '极难 · 12 因子', label: '极难模式',
    bpDefault: false, bpLocked: false,
    def: '默认关 · 可手动开', defcls: 'd-optin', fac: '4 / 4 / 4',
    form: '二选一 · Ban 1 因子 / 自选 1 指挥官 · 末场金框 ×2', note: '默认关但开关可点亮 · 非锁死',
  },
  rescue: {
    no: '04', name: '拯救模式', tag: '固定7人', bpName: '拯救', label: '10 因子 · 拯救',
    bpDefault: false, bpLocked: false,
    def: '默认关', defcls: 'd-off', fac: '3 / 3 / 4',
    form: '固定 7 人池 · 「自选指挥官」分支语义受限', note: '固定7人(含凯瑞甘·不吃ban) · selfShow=false',
  },
  feiqiu: {
    no: '05', name: '非酋', tag: '之轮', label: '1 因子 · 非酋',
    bpDefault: false, bpLocked: false,
    def: '默认关 · 可配', defcls: 'd-off', fac: '1 / 1 / 1',
    form: '二选一 · 自选分支受 selfShow 门控', note: '3 固定因子 · selfShow=false · 自选待门控',
  },
  'feiqiu-doubles': {
    no: '05', name: '非酋之轮', tag: '非酋双打',
    bpDefault: false, bpLocked: true,
  },
  doubles: {
    no: '06', name: '官突双打', tag: '双打', bpName: '双打', bpTag: '官突',
    bpDefault: false, bpLocked: true,
    def: '暂不可用', defcls: 'd-lock', fac: '5 / 场',
    form: 'BP 暂未启用 · 框架预留，下轮实装', note: '独立骨架旁路 XP · 锁死灰掉不可点',
  },
  // std15/cm 已改双打（Batch C · yb 2026-07-02 拍板）：jjbDoubles variant，格标/文案改双打语义；
  // BP 与双打其他格一致锁死（双打 BP 未实装，对齐 doubles/feiqiu-doubles 行）。
  std15: {
    no: '07', name: '15 因子', tag: '双打随机', label: '15 因子 · 双打',
    bpDefault: false, bpLocked: true,
    def: '暂不可用', defcls: 'd-lock', fac: '5 / 场',
    form: '双打 · 每场 2 指挥官 · 5 待选无锁定', note: '双打 variant=std15 · 4A2B + 自选区 · BP 不适用',
  },
  cm: {
    no: '08', name: 'CM 专属', tag: 'CM 双打', label: 'CM 专属 · 双打',
    bpDefault: false, bpLocked: true,
    def: '暂不可用', defcls: 'd-lock', fac: '2 锁 + 4 / 场',
    form: '双打 · 每场 2 指挥官 · 恒锁 风暴英雄/虚空裂隙', note: '双打 variant=cm · 3A3B（CM 入 B 升权）· 自选全量 22 · BP 不适用',
  },
  // 仅 currentModeLabel 用（不在任何屏渲染；BP 态走 getter ?? false 兜底）
  'one-a': { label: '10 因子 · 单指' },
  hard1: { label: '8 因子 · 极难' },
  hard2: { label: '8 因子 · 极难' },
  suiji: { label: '随机 · 随机' },
};
