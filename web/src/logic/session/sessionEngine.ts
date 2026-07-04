import JijieData from '../legacy/JijieData';
import ConfigData from '../legacy/JJConfigData';
import { facFlatIdx, manualSlots } from '../legacy/JJBData';
import { weightedSampleNoReplace } from '../commanderWeight';
import { doublesStart, doublesReset } from '../jjbDoubles';
import { rollEnemiesForSession } from '../aiEnemySelector';
import { getBanMaps, getBanFactors } from '../eventBan';
import { rand, restoreConfig, type SessionMode } from './sessionConfig';
import { exposeSelectDebug } from './sessionDebug';
import { clearBpRuntime, clearGoldRuntime, clearRerollRuntime } from './sessionRuntime';

// ===== 9 模式入口（段2 Phase 0 全模式开局）+ doubles 双打（段3④ 独立引擎接通） =====
/** 设各 mode 的 JijieData flag 组合（参照 InitPanel.onClick* 真实 handler）。 */
function setModeFlags(mode: SessionMode): void {
  const d: any = JijieData;
  d.initStart();
  d.reset();
  d.modeIsRandom = false; // 段2 Phase 0 时代定下的默认手选契约（与 startManual 一致）
  d.playerName = '集结杯选手'; // 未填选手名时的占位（与 jjbView.currentPlayerLabel 兜底一致）
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
    // std15/cm 已改双打（Batch C）：startSession 早分支进 jjbDoubles，不再走单打管线（modeStd15/modeCm flag 保留在 JijieData，不再置位）
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
      if (getBanMaps().has(map)) continue; // event ban: skip banned map; guard prevents infinite loop
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

  // event ban: pre-pop 被 ban 的非豁免因子（同 mfc==2 预删范式）
  // 豁免 XP 锁定项（非酋固定因子）：hardcoded 选取不经随机池，ban 无需影响
  const _evtBanFactorExempt = new Set(['混乱工作室', '礼尚往来', '风暴英雄', '虚空裂隙']);
  for (const f of getBanFactors()) {
    if (!_evtBanFactorExempt.has(f)) ConfigData.popFactor(f);
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

  rollEnemiesForSession(3); // 随机敌方：单打 3 场，开关 ON 时每场 roll 种族+AI（双打走 doublesStart 内 roll）
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

      // B 组抽取（第 161-171 行）—— 德哈卡/泰凯斯降权 0.25 加权无放回（yb 拍板）
      groupList = (ConfigData.commadnerGroupList as any)['B'].slice();
      if (d.modeFeiqiu) {
        const idx = groupList.indexOf('斯台特曼');
        if (idx >= 0) groupList.splice(idx, 1);
      }
      for (const cmder of weightedSampleNoReplace(groupList, countB)) {
        d.randomCommanderPoorB.push(cmder);
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
    // ⚠️ 不可达分支：modeIsLanzi 全仓恒 false（startSession L417 与 legacy JijieData.clear 都只写 false，
    // 无任何置 true 的入口）。保留原因 = 本函数与 XP 真身逐段对照的可审计性（AGENTS.md 红线：toSelectCore
    // 结构不重排）；若未来上蓝字模式，入口在 home 加 setter 即可激活。
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

function fillSelectionSlots(d: any): void {
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
}

export const sessionEngineCore = { toStartCore, toSelectCore, fillSelectionSlots };

/** 9 模式入口：InitPanel 9 handler → startSession(mode)。
 *  跑 toStartCore（内部按 status 决定是否已调过 toSelectCore；极难/拯救内部已调），
 *  末尾对非极难/非拯救再调 toSelectCore 一次，最后固化 9 格契约。
 *  opts 预留段2 BP 接口（banN/gold 暂未启用）。 */
export function startSession(mode: SessionMode, _opts?: { banN?: number; gold?: string[] }): void {
  // 双打=独立引擎：JJBDoubles 自管池/槽/洗牌/计分，不读写 JijieData 单打管线。
  // 早分支启动后即返——绕开 restoreConfig/setModeFlags/toStart/toSelect/9格固化；调试镜像走 __jjbDebug.doubles。
  clearBpRuntime(); // 任何开局都重置 BP ban（含双打早分支，避免跨局残留）
  clearGoldRuntime(); // 同步重置点金（修跨局泄漏 bug：上局点金因子带进下局经 weightedFactorScore 让 difficulty×2 污染记分）
  clearRerollRuntime(); // 同步重置重揉次数（比赛态每局限次不跨局残留）
  if (mode === 'doubles') { doublesStart('guantu'); return; }
  if (mode === 'feiqiu-doubles') { doublesStart('feiqiu'); return; }
  // std15/cm 双打（Batch C · yb 2026-07-02 拍板）：先 restoreConfig 让 jjbDoubles 能读 ConfigData.mapGrid 官方地图池
  if (mode === 'std15' || mode === 'cm') { restoreConfig(); doublesStart(mode); return; }
  doublesReset(); // 非 doubles 模式开局时重置双打引擎（防跨局 doublesLive 残留，影响 navigate 模式判断）
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
