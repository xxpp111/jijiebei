// jjbSession — React↔XP 接缝（段1 PoC）。
// 红线：jijie2 / data 零改，仅 import 调用。
// 数据真实：fetch-free 用 import.meta.glob 把真实 csv 编译期捆绑 → ConfigData.init（真实赛事母池）。
// 开局编排：复刻 JijieContro.toStart/toSelect 的「8/10/12 因子标准随机」分支（调真实 ConfigData
//   popMap/getJijieFactor/commadnerGroupList）+ JJBDesignBoot.startRandom 的 9 格填充，写真实 JijieData。
//   —— 为何复刻而非 import JijieControl：JijieControl import JJUI(cc.Component) 链需完整 cc-shim 且
//   toStart 末尾调 this.jjUI.updateToStart()(UI 副作用)，段1 PoC 用复刻最小开局打通数据接缝，
//   段2 cutover 再解耦 JijieControl→JJUI（Phase 1 审计已标 UI 副作用剥离工作）。
// 读：JJBData.sessionMatches()（真实桥，0 改）。写回：winLoseList[i]=RESULT_VAL（lose0/win1/bonus2）。
import JijieData from '@logic/JijieData';
import ConfigData from '@logic/data/JJConfigData';
import { facFlatIdx, manualSlots, sessionMatches, RESULT_VAL, type MatchVM } from '@jjb/JJBData';

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

const rand = (n: number) => Math.floor(Math.random() * n);

/** 复刻 JijieContro.toStart 标准分支：随机 3 地图 + 3 锁定因子（调真实 ConfigData）。 */
function toStartCore(): void {
  const d: any = JijieData;
  d.status = 1;
  const mfc = d.modelFactorCount;
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
  if (mfc === 2) {
    ConfigData.popFactor('风暴英雄');
    ConfigData.popFactor('虚空裂隙');
    ConfigData.popFactor('进攻部署');
  }
  for (let i = 0; i < 3; i++) {
    const lockFactor = i === 2 && mfc === 4 ? ConfigData.getJijieFactor(false, 0) : ConfigData.getJijieFactor(false);
    ConfigData.popFactor(lockFactor);
    d.lockFactorList.push(lockFactor);
  }
}

/** 复刻 JijieContro.toSelect 标准分支：随机指挥官 A4/B2 + 随机因子池 + null 槽位预填。 */
function toSelectCore(): void {
  const d: any = JijieData;
  d.status = 2;
  const mfc = d.modelFactorCount;
  let groupList = (ConfigData.commadnerGroupList as any)['A'].slice();
  for (let i = 0; i < 4; i++) {
    const ri = rand(groupList.length);
    d.randomCommanderPoorA.push(groupList[ri]);
    groupList.splice(ri, 1);
  }
  groupList = (ConfigData.commadnerGroupList as any)['B'].slice();
  for (let i = 0; i < 2; i++) {
    const ri = rand(groupList.length);
    d.randomCommanderPoorB.push(groupList[ri]);
    groupList.splice(ri, 1);
  }
  d.randomCommanderPoorA.push('自选');
  ConfigData.popFactor('进攻部署');
  let factorCount = 0;
  let smallRate = 1;
  const pm: any = ConfigData.paramMap;
  if (mfc === 2) {
    factorCount = pm['随机因子数7'];
    ConfigData.popFactor('风暴英雄');
    ConfigData.popFactor('虚空裂隙');
    ConfigData.popFactor('进攻部署');
    if (Math.random() < 0.3) ConfigData.popFactor('同化体');
    smallRate = 0.9;
  } else if (mfc === 4) {
    factorCount = pm['随机因子数13'];
  } else {
    factorCount = pm['随机因子数10'];
    smallRate = 0.9;
  }
  for (let i = 0; i < factorCount; i++) {
    const f = ConfigData.getJijieFactor(false, smallRate);
    ConfigData.popFactor(f);
    d.randomFactorPoor.push(f);
  }
  const nullFactorCount = mfc * 3 - 2;
  for (let i = 0; i < nullFactorCount; i++) d.selectedFactorList.push(null);
  d.selectedCommanderList.push(null, null, null);
}

/** 一局随机开局（复刻 onClick{2,3,13} + toStart + startRandom 9 格填充）。modelFactorCount: 2=8因子/3=10/4=12。 */
export function startRandomSession(modelFactorCount = 2): void {
  initConfigOnce();
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
  toSelectCore();
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
