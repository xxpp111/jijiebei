// jjbSession — React↔XP 接缝（段1 PoC + 段2 Phase 0 全模式开局）。
// 红线：jijie2 / data 零改，仅 import 调用。
// 数据真实：fetch-free 用 import.meta.glob 把真实 csv 编译期捆绑 → ConfigData.init（真实赛事母池）。
// 开局编排：复刻 JijieContro.toStart/toSelect 的「全 9 模式」真实分支（调真实 ConfigData
//   popMap/popFactor/getJijieFactor/commadnerGroupList/getFactorByScore）+ JJBDesignBoot.startManual
//   的 9 格契约固化（toSelect 预填的 mfc*3-2 个 null 被覆盖，3/9 格全 null 起始），写真实 JijieData。
//   —— 为何复刻而非 import JijieControl：JijieControl import JJUI(cc.Component) 链需完整 cc-shim 且
//   toStart 末尾调 this.jjUI.updateToStart/toSelect()(UI 副作用)，段1 PoC 用复刻最小开局打通数据接缝，
//   段2 cutover 再解耦 JijieControl→JJUI（Phase 1 审计已标 UI 副作用剥离工作）。
// 读：JJBData.sessionMatches()（真实桥，0 改）。写回：winLoseList[i]=RESULT_VAL（lose0/win1/bonus2）。
import JijieData from '@logic/JijieData';
import ConfigData from '@logic/data/JJConfigData';
import { facFlatIdx, manualSlots, sessionMatches, RESULT_VAL, jjbLive, GOLD_FACTORS, type MatchVM } from '@jjb/JJBData';

// jjbLive re-export（段2 Phase 1 BattleScreen/e2e 读当前局是否开局用；非 9 模式逻辑，仅透出）
export { jjbLive };

// 真实 csv（\r\n 分隔），编译期 raw 捆绑——无 fetch 时序、build 后亦可用。
const csv = import.meta.glob('../../../assets/resources/jjdata/*.txt', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
function csvText(name: string): string {
  for (const k in csv) if (k.endsWith('/' + name)) return csv[k];
  throw new Error('[jjbSession] csv not found: ' + name);
}

let configInited = false;
function initConfigOnce(): void {
  if (configInited) return;
  // ConfigData.init(rule, map, commander, factor, ban) —— 参数顺序见 JJConfigData.init 签名。
  ConfigData.init(
    csvText('规则参数配置.txt'),
    csvText('地图配置.txt'),
    csvText('指挥官配置.txt'),
    csvText('因子配置.txt'),
    csvText('ban指挥官.txt'),
  );
  configInited = true;
}

/** 重置 ConfigData 母池（重跑 init 重建 factorList/commanderList/mapGrid/commadnerGroupList）。
 *  镜像 JJBDesignBoot.restoreConfigData：每局必调，防 factorList 枯竭 + 地图累积。 */
function restoreConfig(): void {
  initConfigOnce();
  ConfigData.init(
    csvText('规则参数配置.txt'),
    csvText('地图配置.txt'),
    csvText('指挥官配置.txt'),
    csvText('因子配置.txt'),
    csvText('ban指挥官.txt'),
  );
}

const rand = (n: number) => Math.floor(Math.random() * n);

// ===== 9 模式入口（段2 Phase 0 全模式开局） =====
export type SessionMode = 'std8' | 'std10' | 'std12' | 'rescue' | 'one-a' | 'hard1' | 'hard2' | 'feiqiu' | 'suiji';

/** 设各 mode 的 JijieData flag 组合（参照 InitPanel.onClick* 真实 handler）。 */
function setModeFlags(mode: SessionMode): void {
  const d: any = JijieData;
  d.initStart();
  d.reset();
  d.modeIsRandom = false; // Phase 0 默认手选契约（与 startManual 一致）
  d.playerName = 'Phase0 选手';
  switch (mode) {
    case 'std8':
      d.modelFactorCount = 2; break;
    case 'std10':
      d.modelFactorCount = 3; break;
    case 'std12':
      d.modelFactorCount = 4; break;
    case 'rescue':
      d.modelFactorCount = 3; d.modeIsZhengjiu = true; break;
    case 'one-a':
      d.modelFactorCount = 3; d.modeIsOnePick = true; break;
    case 'hard1':
      d.modelFactorCount = 2; d.modeIsVeryHard = true; break;
    case 'hard2':
      d.modelFactorCount = 2; d.modeIsVeryHard = true; d.modeIsVeryHard2 = true; break;
    case 'feiqiu':
      d.modelFactorCount = 1; d.modeFeiqiu = true; break;
    case 'suiji':
      d.modelFactorCount = 0; d.modeSuiji = true; break;
  }
}

/** 复刻 JijieContro.toStart 真实分支（除 UI 副作用 this.jjUI.updateToStart 外）。
 *  含极难/拯救的「早 toSelect」（递归调 toSelectCore）；startSession 末尾按 status 决定是否再调。 */
function toStartCore(): void {
  const d: any = JijieData;
  d.status = 1;
  const mfc = d.modelFactorCount;

  // toStart 早 toSelect：极难/拯救（镜像 JijieContro.toStart 第 47-56 行）
  if (d.modeIsVeryHard) {
    toSelectCore(); // 极难：A/B 整组 + 因子 jinanArr 强抽+循环
    ConfigData.popMap('营救矿工');
  } else if (d.modeIsZhengjiu) {
    toSelectCore(); // 拯救：固定 7 人 + 因子走 mfc==3 default
  }

  // 3 地图随机（JijieContro.toStart 第 58-83 行）
  for (let i = 0; i < 3; i++) {
    let map = '';
    let guard = 0;
    while (guard++ < 200) {
      const ri = rand((ConfigData.mapGrid as any[]).length);
      map = (ConfigData.mapGrid as any[])[ri][0];
      const group = Number((ConfigData.mapGrid as any[])[ri][1]);
      if (mfc === 4 || group === 2 || Math.random() < 0.33) break;
    }
    ConfigData.popMap(map);
    d.mapList.push(map);
  }

  // mfc==2 popFactor 风暴/裂隙/部署（JijieContro.toStart 第 85-90 行）
  if (mfc === 2) {
    ConfigData.popFactor('风暴英雄');
    ConfigData.popFactor('虚空裂隙');
    ConfigData.popFactor('进攻部署');
  }

  // 3 锁定因子（JijieContro.toStart 第 92-105 行）
  for (let i = 0; i < 3; i++) {
    let lockFactor: string;
    if (d.modeZhenghuo) {
      lockFactor = '随机';
    } else if (d.modeFeiqiu) {
      lockFactor = '混乱工作室';
    } else if (i === 2 && mfc === 4) {
      lockFactor = ConfigData.getJijieFactor(d.modeIsVeryHard, 0);
    } else {
      lockFactor = ConfigData.getJijieFactor(d.modeIsVeryHard);
    }
    ConfigData.popFactor(lockFactor);
    d.lockFactorList.push(lockFactor);
  }
}

/** 复刻 JijieContro.toSelect 真实分支（除 UI 副作用 this.jjUI.updateToSelect + map*.spCommander.setCName 外）。 */
function toSelectCore(): void {
  const d: any = JijieData;
  d.status = 2;
  const mfc = d.modelFactorCount;

  // ===== 指挥官（JijieContro.toSelect 第 116-187 行） =====
  if (d.modeIsOnePick) {
    // UI 副作用：map1/2/3.spCommander.setCName("自选") —— 忽略；末尾 selectedCommanderList 推 3 null
  } else if (d.modeIsZhengjiu) {
    // 拯救 hardcode 7 人（不含 ban 过滤）—— 第 120-127 行
    d.randomCommanderPoorA.push('雷诺');
    d.randomCommanderPoorA.push('凯瑞甘');
    d.randomCommanderPoorA.push('阿塔尼斯');
    d.randomCommanderPoorA.push('斯旺');
    d.randomCommanderPoorA.push('沃拉尊');
    d.randomCommanderPoorA.push('斯图科夫');
    d.randomCommanderPoorA.push('米拉');
  } else {
    if (d.modeIsVeryHard && !d.modeIsVeryHard2) {
      // 极难① 整 A/B 组（第 129-132 行）—— slice() 防污染
      d.randomCommanderPoorA = (ConfigData.commadnerGroupList as any)['A'].slice();
      d.randomCommanderPoorB = (ConfigData.commadnerGroupList as any)['B'].slice();
    } else {
      // 默认抽 A4/B2；极难② A6/B3；modeSuiji countC=4（死代码未启用）—— 第 134-143 行
      let countA = 4;
      let countB = 2;
      if (d.modeIsVeryHard2) { countA = 6; countB = 3; }
      // modeSuiji countC=4 死代码省略（C 组未实现）

      // A 组抽取（第 145-159 行）
      let groupList: string[] = (ConfigData.commadnerGroupList as any)['A'].slice();
      if (d.modeFeiqiu) {
        const idx = groupList.indexOf('雷诺');
        if (idx >= 0) groupList.splice(idx, 1);
      }
      for (let i = 0; i < countA; i++) {
        const ri = rand(groupList.length);
        const cmder = groupList[ri];
        d.randomCommanderPoorA.push(cmder);
        groupList.splice(ri, 1);
      }

      // B 组抽取（第 161-171 行）
      groupList = (ConfigData.commadnerGroupList as any)['B'].slice();
      if (d.modeFeiqiu) {
        const idx = groupList.indexOf('斯台特曼');
        if (idx >= 0) groupList.splice(idx, 1);
      }
      for (let i = 0; i < countB; i++) {
        const ri = rand(groupList.length);
        const cmder = groupList[ri];
        d.randomCommanderPoorB.push(cmder);
        groupList.splice(ri, 1);
      }

      // 自选门控（第 181-183 行）—— modeSuiji/modeFeiqiu 不 push
      if (!d.modeSuiji && !d.modeFeiqiu) {
        d.randomCommanderPoorA.push('自选');
      }
    }
  }

  // ===== 因子（JijieContro.toSelect 第 190-264 行） =====
  // 进攻部署 popFactor（modeFeiqiu 不 pop）—— 第 192-194 行
  if (!d.modeFeiqiu) {
    ConfigData.popFactor('进攻部署');
  }

  let factorCount = 0;
  const pm: any = ConfigData.paramMap;

  if (d.modeIsVeryHard) {
    // 极难：factorCount=随机因子数极难 + jinanArr 4选2 强抽 + factorCount-=2 —— 第 199-210 行
    factorCount = pm['随机因子数极难'];
    const jinanArr: string[] = ['风暴英雄', '虚空裂隙', '给我死吧', '虚空重生者'];
    for (let i = 0; i < 2; i++) {
      const ra = rand(jinanArr.length);
      const f = jinanArr[ra];
      jinanArr.splice(ra, 1);
      ConfigData.popFactor(f);
      d.randomFactorPoor.push(f);
    }
    factorCount -= 2;
  } else if (mfc === 2) {
    // 8 因子 —— 第 211-220 行
    factorCount = pm['随机因子数7'];
    ConfigData.popFactor('风暴英雄');
    ConfigData.popFactor('虚空裂隙');
    ConfigData.popFactor('进攻部署');
    if (Math.random() < 0.3) ConfigData.popFactor('同化体');
  } else if (mfc === 4) {
    // 12 因子 —— 第 221-229 行
    factorCount = pm['随机因子数13'];
    if (d.modeIsZhengjiu) {
      // 12 因子 + 拯救（注：实际 mfc=4 走这里；拯救 mfc=3 走 default 分支，见下）
      ConfigData.popFactor('风暴英雄');
      ConfigData.popFactor('虚空裂隙');
      if (Math.random() < 0.3) ConfigData.popFactor('同化体');
    }
  } else if (d.modeSuiji) {
    // 随机模式 —— 第 230-231 行
    factorCount = 0;
  } else {
    // 10 因子 / 拯救（mfc=3） / 单指（mfc=3） —— 第 232-245 行
    factorCount = pm['随机因子数10'];
    if (d.modeIsOnePick) factorCount--;
    if (d.modeIsZhengjiu) {
      ConfigData.popFactor('风暴英雄');
      ConfigData.popFactor('虚空裂隙');
      if (Math.random() < 0.3) ConfigData.popFactor('同化体');
    }
  }

  // 因子填充（第 247-264 行）
  if (d.modeIsLanzi) {
    // 蓝字模式（InitPanel.onClickLanzi；未上 home，预留）—— 第 247-253 行
    factorCount = 3;
    for (let i = 0; i < factorCount; i++) {
      const f = ConfigData.getFactorByScore(i + 1);
      ConfigData.popFactor(f);
      d.randomFactorPoor.push(f);
    }
  } else if (d.modeFeiqiu) {
    // 非酋固定 3 因子（第 254-257 行）
    d.randomFactorPoor.push('风暴英雄');
    d.randomFactorPoor.push('虚空裂隙');
    d.randomFactorPoor.push('礼尚往来');
  } else {
    // 通用 getJijieFactor 循环（第 258-263 行）—— 真身 JijieContro.ts:260 单参，smallRate 在真身是
    // 死变量（算了不传）；此处对齐真身只传 1 参，不复刻 M3 误传 0.9 导致 group<4 常见因子被打折的分布偏移。
    for (let i = 0; i < factorCount; i++) {
      const f = ConfigData.getJijieFactor(d.modeIsVeryHard);
      ConfigData.popFactor(f);
      d.randomFactorPoor.push(f);
    }
  }

  // null 预填（第 267-277 行）—— 后被 startSession 9 格契约覆盖
  const nullFactorCount = mfc * 3 - 2;
  for (let i = 0; i < nullFactorCount; i++) d.selectedFactorList.push(null);
  d.selectedCommanderList.push(null, null, null);
}

/** 9 模式入口：InitPanel 9 handler → startSession(mode)。
 *  跑 toStartCore（内部按 status 决定是否已调过 toSelectCore；极难/拯救内部已调），
 *  末尾对非极难/非拯救再调 toSelectCore 一次，最后固化 9 格契约。
 *  opts 预留段2 BP 接口（banN/gold 暂未启用）。 */
export function startSession(mode: SessionMode, _opts?: { banN?: number; gold?: string[] }): void {
  restoreConfig(); // 每局重置 ConfigData 母池，防枯竭
  setModeFlags(mode);
  toStartCore();
  // 极难/拯救在 toStartCore 内部已调 toSelectCore，status=2；其他模式需补调
  if ((JijieData as any).status < 2) {
    toSelectCore();
  }
  // 9 格契约固化（覆盖 toSelect 预填的 mfc*3-2 个 null + 清上局残留）
  (JijieData as any).selectedCommanderList = [null, null, null];
  (JijieData as any).selectedFactorList = new Array(9).fill(null);
  (JijieData as any).winLoseList = [];
  exposeSelectDebug(mode);
}

/** 暴露 __jjbDebug.select 给 e2e 读恒等式断言。 */
export function exposeSelectDebug(mode: SessionMode): void {
  try {
    const d: any = JijieData;
    const slots = [manualSlots(0), manualSlots(1), manualSlots(2)];
    const sumSlots = slots[0] + slots[1] + slots[2];
    const poolLen = (d.randomFactorPoor || []).length;
    const selFacLen = (d.selectedFactorList || []).length;
    const selCmd = (d.selectedCommanderList || []).slice();
    const identityPass = poolLen === sumSlots;
    const w: any = window;
    w.__jjbDebug = w.__jjbDebug || {};
    w.__jjbDebug.screen = 'select';
    w.__jjbDebug.select = {
      mode,
      modeIsRandom: !!d.modeIsRandom,
      modeIsVeryHard: !!d.modeIsVeryHard,
      modeIsVeryHard2: !!d.modeIsVeryHard2,
      modeIsZhengjiu: !!d.modeIsZhengjiu,
      modeIsOnePick: !!d.modeIsOnePick,
      modeFeiqiu: !!d.modeFeiqiu,
      modeSuiji: !!d.modeSuiji,
      modelFactorCount: d.modelFactorCount,
      status: d.status,
      mapCount: (d.mapList || []).length,
      lockCount: (d.lockFactorList || []).length,
      randomFactorPoorLen: poolLen,
      randomCommanderPoorALen: (d.randomCommanderPoorA || []).length,
      randomCommanderPoorBLen: (d.randomCommanderPoorB || []).length,
      manualSlots: slots,
      sumSlots,
      selectedFactorListLen: selFacLen,
      selectedFactorList: (d.selectedFactorList || []).slice(),
      selectedCommanderList: selCmd,
      identityPass,
    };
  } catch (e) {
    /* noop */
  }
}

/** 暴露 startSession 到 window.__jjb，供 e2e 与 Phase 0 调试调用。 */
export function exposeStartSession(): void {
  const w: any = window;
  w.__jjb = w.__jjb || {};
  w.__jjb.startSession = startSession;
  w.__jjb.startRandomSession = startRandomSession;
  w.__jjb.exposeSelectDebug = exposeSelectDebug;
  w.__jjb.getSelectState = getSelectState;
  w.__jjb.randomFillAndStart = randomFillAndStart;
  w.__jjb.jjbLive = jjbLive;
}

// ===== 旧版 Battle 屏接缝（startRandomSession）—— 段1 PoC 兼容 =====
/** 一局随机开局（复刻 onClick{2,3,13} + toStart + startRandom 9 格填充）。modelFactorCount: 2=8因子/3=10/4=12。 */
export function startRandomSession(modelFactorCount = 2): void {
  restoreConfig();
  const d: any = JijieData;
  d.initStart();
  d.reset();
  d.modeIsVeryHard = false;
  d.modeIsOnePick = false;
  d.modeIsLanzi = false;
  d.modeSuiji = false;
  d.modeFeiqiu = false;
  d.modeIsZhengjiu = false;
  d.modelFactorCount = modelFactorCount;
  d.playerName = 'PoC 选手';
  d.modeIsRandom = false;
  toStartCore();
  d.modeIsRandom = true;
  if ((JijieData as any).status < 2) toSelectCore();
  // startRandom 9 格契约填充（JJBDesignBoot.startRandom）
  d.selectedCommanderList = [null, null, null];
  d.selectedFactorList = new Array(9).fill(null);
  const cmdA = (d.randomCommanderPoorA || []).filter((c: string) => c && c !== '自选');
  const cmdB = (d.randomCommanderPoorB || []).filter((c: string) => c && c !== '自选');
  const allCmds = cmdA.concat(cmdB);
  for (let i = 0; i < 3 && i < allCmds.length; i++) d.selectedCommanderList[i] = allCmds[i];
  const factors = (d.randomFactorPoor || []).slice();
  let fIdx = 0;
  for (let slot = 0; slot < 3; slot++) {
    const cap = manualSlots(slot);
    for (let k = 0; k < cap && fIdx < factors.length; k++) {
      d.selectedFactorList[facFlatIdx(slot, k)] = factors[fIdx++];
    }
  }
  d.winLoseList = [];
  d.status = 3;
  exposeBattleDebug();
}

export function getSessionMatches(): MatchVM[] {
  return sessionMatches();
}

/** 写判定 + 重算记分（winLoseList[i]=0失败/1胜利/2带奖励；win+bonus 计获胜场，对齐 jjbDesign 语义）。 */
export function setVerdict(matchIdx: number, verdict: 'win' | 'bonus' | 'lose'): void {
  const d: any = JijieData;
  if (!Array.isArray(d.winLoseList)) d.winLoseList = [];
  d.winLoseList[matchIdx] = RESULT_VAL[verdict];
  exposeBattleDebug();
}

export function getScore(): number {
  const d: any = JijieData;
  let win = 0;
  for (const v of d.winLoseList || []) if (v === 1 || v === 2) win++;
  return win;
}

/** __jjbDebug 同形透出（4 套 Playwright 回归读它；battle 子对象含 matches+score）。 */
export function exposeBattleDebug(): void {
  try {
    const d: any = JijieData;
    const w: any = window;
    w.__jjbDebug = w.__jjbDebug || {};
    w.__jjbDebug.screen = 'battle';
    w.__jjbDebug.player = d.playerName;
    w.__jjbDebug.factorCount = d.modelFactorCount;
    w.__jjbDebug.status = d.status;
    w.__jjbDebug.modeIsRandom = d.modeIsRandom;
    w.__jjbDebug.maps = (d.mapList || []).slice();
    w.__jjbDebug.lockFactors = (d.lockFactorList || []).slice();
    w.__jjbDebug.selectedCommanderList = (d.selectedCommanderList || []).slice();
    w.__jjbDebug.selectedFactorList = (d.selectedFactorList || []).slice();
    w.__jjbDebug.winLoseList = (d.winLoseList || []).slice();
    w.__jjbDebug.battle = { matches: sessionMatches(), score: getScore() };
  } catch (e) {
    /* noop */
  }
}

/** OBS 横条 debug 同形透出（jjb-verify obsbar 回归读 __jjbDebug.obsbar；screen 覆盖为 obsbar）。
 *  须在 startRandomSession（内部写 screen=battle）之后调用，以覆盖 screen 为 obsbar。 */
export function exposeObsbarDebug(rows: unknown[], wins: number, total: number): void {
  try {
    const w: any = window;
    w.__jjbDebug = w.__jjbDebug || {};
    w.__jjbDebug.screen = 'obsbar';
    w.__jjbDebug.obsbar = { matches: sessionMatches(), wins, total, rows };
  } catch (e) {
    /* noop */
  }
}

// ===== 段2 Phase 1：select 屏透出 + 随机填满进 battle（不动 startSession/9 模式逻辑） =====

/** select 屏给 React 屏绑真身数据用的视图模型（0 改 JijieData 内部）。
 *  mode 从 __jjbDebug.select.mode 读（exposeSelectDebug 已写；startSession 不动）。 */
export interface SelectState {
  mode: SessionMode;
  playerName: string;
  status: number;
  modeIsRandom: boolean;
  modeIsVeryHard: boolean;
  modeIsVeryHard2: boolean;
  modeIsZhengjiu: boolean;
  modeIsOnePick: boolean;
  modeFeiqiu: boolean;
  modeSuiji: boolean;
  modelFactorCount: number;
  mapList: string[];
  lockFactorList: string[];
  randomFactorPoor: string[];
  randomCommanderPoorA: string[];
  randomCommanderPoorB: string[];
  selectedFactorList: (string | null)[];
  selectedCommanderList: (string | null)[];
  manualSlots: [number, number, number];
  sumSlots: number;
  identityPass: boolean;
  jjbLive: boolean;
  selfPool: string[]; // 自选区真实全量池（ConfigData 全量 ban 后减已入 A/B 池；mode 门控）
  selfShow: boolean; // 是否显示自选区（拯救/随机/极难①/非酋 = false）
}

/** select 屏纯只读透出。React SelectScreen/HomeScreen 直接用本函数绑数据 + e2e 跑断言。
 *  startSession 内部零改：mode 字段从上次 exposeSelectDebug 残留读，无残留则回落 'std8'。 */
export function getSelectState(): SelectState {
  const d: any = JijieData;
  const slots: [number, number, number] = [manualSlots(0), manualSlots(1), manualSlots(2)];
  const sumSlots = slots[0] + slots[1] + slots[2];
  const poolLen = (d.randomFactorPoor || []).length;
  const w: any = (typeof window !== 'undefined' ? window : null);
  const lastMode = (w && w.__jjbDebug && w.__jjbDebug.select && w.__jjbDebug.select.mode) || 'std8';
  // 自选区真实全量池（镜像 JJBSelect.ts:373-394）：ConfigData.commanderList 全量(ban后) 减已入 A/B 池；
  // 拯救/随机/极难①/非酋 无自选区（selfShow=false）。
  const cmdInPool: Record<string, boolean> = {};
  (d.randomCommanderPoorA || []).forEach((c: string) => { if (c && c !== '自选') cmdInPool[c] = true; });
  (d.randomCommanderPoorB || []).forEach((c: string) => { if (c) cmdInPool[c] = true; });
  const selfShow = !d.modeSuiji && !d.modeIsZhengjiu && (!d.modeIsVeryHard || d.modeIsVeryHard2) && !d.modeFeiqiu;
  let selfPool: string[] = [];
  if (selfShow) {
    try {
      selfPool = ((ConfigData.commanderList as any[]) || [])
        .map((arr: any[]) => arr[0] as string)
        .filter((c: string) => c && !cmdInPool[c]);
    } catch (e) { selfPool = []; }
  }
  return {
    mode: lastMode,
    playerName: d.playerName || '',
    status: d.status || 0,
    modeIsRandom: !!d.modeIsRandom,
    modeIsVeryHard: !!d.modeIsVeryHard,
    modeIsVeryHard2: !!d.modeIsVeryHard2,
    modeIsZhengjiu: !!d.modeIsZhengjiu,
    modeIsOnePick: !!d.modeIsOnePick,
    modeFeiqiu: !!d.modeFeiqiu,
    modeSuiji: !!d.modeSuiji,
    modelFactorCount: d.modelFactorCount || 0,
    mapList: (d.mapList || []).slice(),
    lockFactorList: (d.lockFactorList || []).slice(),
    randomFactorPoor: (d.randomFactorPoor || []).slice(),
    randomCommanderPoorA: (d.randomCommanderPoorA || []).slice(),
    randomCommanderPoorB: (d.randomCommanderPoorB || []).slice(),
    selectedFactorList: ((d.selectedFactorList || []) as any[]).slice(),
    selectedCommanderList: ((d.selectedCommanderList || []) as any[]).slice(),
    manualSlots: slots,
    sumSlots,
    identityPass: poolLen === sumSlots,
    jjbLive: jjbLive(),
    selfPool,
    selfShow,
  };
}

/** Phase 1 开始按钮入口：把当前 select 局的 selectedCommanderList/selectedFactorList
 *  随机填满（pool+cmdPool → 9 格）后切 status=3、调 exposeBattleDebug()，让 BattleScreen 直接渲染本局。
 *  不重开 toStart/toSelect；不破坏 9 模式开局；与 startRandomSession 的 9 格契约填充同语义，
 *  但只在「当前 select 局已开局（jjbLive）」时执行；非 jjbLive 时 noop。 */
export function randomFillAndStart(): void {
  const d: any = JijieData;
  if (!jjbLive()) return;
  d.selectedCommanderList = [null, null, null];
  d.selectedFactorList = new Array(9).fill(null);
  // 指挥官池合并去 '自选'（对齐 startRandomSession 9 格契约填充）
  const cmdA = (d.randomCommanderPoorA || []).filter((c: string) => c && c !== '自选');
  const cmdB = (d.randomCommanderPoorB || []).filter((c: string) => c && c !== '自选');
  const allCmds = cmdA.concat(cmdB);
  for (let i = 0; i < 3 && i < allCmds.length; i++) d.selectedCommanderList[i] = allCmds[i];
  // 因子池按 manualSlots(i) 槽位填（与 JJBDesignBoot.startRandom 对齐）
  const factors = (d.randomFactorPoor || []).slice();
  let fIdx = 0;
  for (let slot = 0; slot < 3; slot++) {
    const cap = manualSlots(slot);
    for (let k = 0; k < cap && fIdx < factors.length; k++) {
      d.selectedFactorList[facFlatIdx(slot, k)] = factors[fIdx++];
    }
  }
  d.winLoseList = [];
  d.status = 3;
  exposeBattleDebug();
}

// ===== 段2 Phase 2：手选写回 + 校验三规则 + 手选进 battle =====
// 严格镜像真身 JJBSelect.fillTarget/clearTarget/validate（assets/Script/jjbDesign/JJBSelect.ts），
// 0 改 jijie2 / 0 改 9 模式开局逻辑；只新增对 JijieData.selectedCommanderList/selectedFactorList 的读写 + 校验。
// （ConfigData 已在文件顶部 import，此处不重复）

/** name → group（commadnerGroupList['B'].includes(name) 直查；A 池混入的 B 组也命中——commadnerGroupList
 *  按 commanderList 全量分组，与真身 groupMap 查表语义一致）。 */
function isGroupB(name: string): boolean {
  try {
    const g = (ConfigData.commadnerGroupList as any) || {};
    const arrB: string[] = g['B'] || [];
    return arrB.includes(name);
  } catch { return false; }
}

/** 写第 slot 场指挥官（idx=0 唯一；后续若接双打可扩 2）。jjbLive=false 时静默 noop（不破坏数据接缝）。 */
export function setSelectedCmd(slot: number, name: string): void {
  const d: any = JijieData;
  if (!jjbLive()) return;
  if (!Array.isArray(d.selectedCommanderList)) d.selectedCommanderList = [null, null, null];
  if (slot < 0 || slot > 2) return;
  d.selectedCommanderList[slot] = name;
}

/** 写第 slot 场第 k 槽因子（按 facFlatIdx(slot,k) 写扁平 9 格）。 */
export function setSelectedFac(slot: number, k: number, name: string): void {
  const d: any = JijieData;
  if (!jjbLive()) return;
  if (!Array.isArray(d.selectedFactorList)) d.selectedFactorList = new Array(9).fill(null);
  if (slot < 0 || slot > 2 || k < 0 || k > 2) return;
  d.selectedFactorList[facFlatIdx(slot, k)] = name;
}

/** 清第 slot 场指挥官（回填 null）。 */
export function clearCmdSlot(slot: number): void { setSelectedCmd(slot, null as any); }

/** 清第 slot 场第 k 槽因子。 */
export function clearFacSlot(slot: number, k: number): void { setSelectedFac(slot, k, null as any); }

/** 校验三规则（镜像真身 JJBSelect.validate）。
 *  ① 每场指挥官未选→err
 *  ② 按 manualSlots(i) 槽数逐格判因子未选→err（禁按 length/null 计数）
 *  ③ B 组指挥官 ≤1：仅 !modeIsOnePick && modelFactorCount > 2 生效；A 池混入的 B 组也计（commadnerGroupList['B'] 查表）
 *  返回 { ok, errors, firstError }：ok=true 校验通过；firstError 给 toast 用第一条。 */
export interface ValidationResult { ok: boolean; errors: string[]; firstError: string; }
export function validate(): ValidationResult {
  const d: any = JijieData;
  const errs: string[] = [];
  if (!jjbLive()) {
    return { ok: false, errors: ['本局未开局（请先 home 选模式）'], firstError: '本局未开局（请先 home 选模式）' };
  }
  const selCmd = (d.selectedCommanderList || []) as (string | null)[];
  const selFac = (d.selectedFactorList || []) as (string | null)[];
  for (let i = 0; i < 3; i++) {
    if (!selCmd[i]) errs.push('第' + (i + 1) + '场指挥官未选择');
  }
  for (let i = 0; i < 3; i++) {
    const cap = manualSlots(i);
    for (let k = 0; k < cap; k++) {
      const v = selFac[facFlatIdx(i, k)];
      if (!v) errs.push('第' + (i + 1) + '场因子' + (k + 1) + '未选择');
    }
  }
  if (!d.modeIsOnePick && d.modelFactorCount > 2) {
    let b = 0;
    for (let i = 0; i < 3; i++) {
      const c = selCmd[i];
      if (c && isGroupB(c)) b++;
    }
    if (b > 1) errs.push('B组指挥官只能选1个');
  }
  return { ok: errs.length === 0, errors: errs, firstError: errs[0] || '' };
}

/** 手选进 battle：校验通过→保留 selected*、status=3、exposeBattleDebug。
 *  校验失败→no-op（让 UI 走 toast 路径）。
 *  替换 Phase 1 的 randomFillAndStart（用户手选而非随机）。 */
export function startFromSelection(): ValidationResult {
  const r = validate();
  if (!r.ok) {
    exposeSelectError(r.firstError, r.errors.length);
    return r;
  }
  const d: any = JijieData;
  d.winLoseList = [];
  d.status = 3;
  exposeBattleDebug();
  return r;
}

/** 校验失败时把错误写到 __jjbDebug.select.error（真身 updateDebug 同样字段语义），并保留错误条数。 */
export function exposeSelectError(msg: string, count: number): void {
  try {
    const w: any = window;
    w.__jjbDebug = w.__jjbDebug || {};
    w.__jjbDebug.select = w.__jjbDebug.select || {};
    w.__jjbDebug.select.error = msg;
    w.__jjbDebug.select.errorCount = count;
  } catch { /* noop */ }
}

// ===== 段3 点金（select 屏运行时 toggle 因子金/非金；后端无此逻辑，纯 React 视觉态，不入计分） =====
const goldRuntime = new Set<string>();

/** toggle 某因子的运行时点金态（点金 / 取消金）。 */
export function toggleGold(name: string): void {
  if (!name) return;
  if (goldRuntime.has(name)) goldRuntime.delete(name);
  else goldRuntime.add(name);
}

/** 因子最终金态 = 后端 GOLD_FACTORS 名单 ∪ 运行时点金（拖进槽/池内渲染金框依据）。 */
export function getGoldFor(name: string): boolean {
  return !!name && (GOLD_FACTORS.includes(name) || goldRuntime.has(name));
}

/** 清运行时点金（开新局时调，避免跨局残留）。 */
export function clearGoldRuntime(): void { goldRuntime.clear(); }

// ===== 段3 结算/浮窗记分透出（镜像 JJBResult 的 winCount/winbCount/totalCount 语义） =====
/** 带奖励场数（winLoseList===2）。 */
export function getBonusCount(): number {
  const d: any = JijieData;
  return (d.winLoseList || []).filter((v: number) => v === 2).length;
}
/** 已判定场数（winLoseList 含 0/1/2）；结算门控 total>=3 用。 */
export function getTotalCount(): number {
  const d: any = JijieData;
  return (d.winLoseList || []).filter((v: number) => v === 0 || v === 1 || v === 2).length;
}
/** winLoseList 快照（Overlay/结算屏读）。 */
export function getWinLoseList(): number[] {
  const d: any = JijieData;
  return (d.winLoseList || []).slice();
}
