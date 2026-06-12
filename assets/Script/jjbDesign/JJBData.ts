// 集结杯 × CM — 设计预览用数据（移植自 design/v1/data.jsx）
// 注：游戏真实数据在 resources/jjdata/*.txt；首页文案/模式仍用此处常量；
//     select/battle/result 三屏在「真实会话」(home→select 跑过 XP toStart+toSelect)下读真实 JijieData，否则回落 DEMO_*。
import JijieData from "../jijie2/JijieData";

export const EVENT = {
    cn: "集结杯",
    en: "REGROUP CUP",
    sub: "星际争霸二 · 合作任务比赛",
    org: "CM × 集结杯 联合主办",
    host: "儒雅随和の土豆",
    links: [
        { k: "CM 玩法说明", v: "cm-coop.cc/how" },
        { k: "B站主播", v: "儒雅随和の土豆" },
    ],
    qq: "879559913",
};

export const MODES = [
    { no: "01", name: "8 因子模式", tag: "标准" },
    { no: "02", name: "10 因子模式", tag: "进阶" },
    { no: "03", name: "12 因子模式", tag: "高难" },
    { no: "04", name: "拯救模式", tag: "限时" },
    { no: "05", name: "随机模式", tag: "抽取" },
    { no: "06", name: "双打模式", tag: "官突" },
    // 极难挑战（XP onClickHard）暂不上 home（土豆决策保留后上）；上线前需先修指挥官池 16 人横排溢出。
];

/** live 模式文案：按 XP flags 推导（拯救/随机等非标准模式 modelFactorCount 推不出正确名字）。 */
export function modeLabel(): string {
    const d: any = JijieData;
    if (d.modeSuiji) return "随机模式 · 抽取";
    if (d.modeIsZhengjiu) return "拯救模式 · 10 因子";
    if (d.modeIsVeryHard) return "极难挑战";
    if (d.modeFeiqiu) return "非酋模式";
    if (d.modeIsOnePick) return "单指挥官挑战";
    const f = d.modelFactorCount === 2 ? 8 : (d.modelFactorCount === 4 ? 12 : 10);
    return f + " 因子 · " + (d.modeIsRandom ? "随机" : "手选");
}

// 选择面板用（真实资源名）。因子池 / 指挥官 A·B 组 / 自选 18 格（6 真 + 12 占位）。
export const FACTORS = ["暴风雪", "核弹打击", "丧尸大战", "虚空裂隙", "岩浆爆发", "相互摧毁"];
export const GROUP_A = ["阿塔尼斯", "德哈卡", "凯瑞甘"];
export const GROUP_B = ["雷诺", "诺娃", "泰凯斯"];
export const POOL: (string | null)[] = [
    "阿塔尼斯", "德哈卡", "凯瑞甘", "雷诺", "诺娃", "泰凯斯",
    null, null, null, null, null, null, null, null, null, null, null, null,
];

// v4 金色强化因子名单。默认空数组=全部普通绿框；赛事启用金色强化因子时只改这里。
export const GOLD_FACTORS: string[] = [];

// 拉丁/数字字体（设计 --font-num）。中文不用它（走系统字）。需 JJBDesignBoot 注入 Google Fonts。
export const FONT_NUM = "Oswald";

// CM 联名字标（已导入 resources/images/brand/）。用户决策：所有皮肤×明暗统一用金色浮雕 dM（金色联名是品牌核心）。
export const MARK: { [k: string]: string } = {
    metal: "images/brand/logo-cm-gold",
    sc2: "images/brand/logo-cm-gold",
    minimal: "images/brand/logo-cm-gold",
};
export function markFor(style: string, mode: string): string {
    // 所有主题（含亮版）统一金色浮雕 logo；mode 参数保留兼容调用方但不再分流。
    return MARK[style] || MARK["metal"];
}

// 演示对局（真实游戏图标名，resources 里均存在）——后续接 XP 真实 JijieData。
// status: win 胜利 / live 进行中 / wait 待战（浮层用）。result: win/bonus/lose（对战/结算三态判定，对齐 design MATCHES）。
export const DEMO_MATCHES = [
    { slot: "第 1 场", map: "克哈裂痕", cmds: ["凯瑞甘"], factors: ["岩浆爆发", "虚空裂隙", "丧尸大战"], status: "win", result: "win" },
    { slot: "第 2 场", map: "黑暗杀星", cmds: ["雷诺"], factors: ["核弹打击", "暴风雪", "相互摧毁"], status: "live", result: "bonus" },
    { slot: "BOSS 战", map: "往日神庙", cmds: ["阿塔尼斯"], factors: ["虚空裂隙", "岩浆爆发", "核弹打击"], status: "wait", doubles: false, result: "win" },
];

// 三态判定（对战页 Verdict / 结算页 战绩）。设计顺序 win/bonus/lose；编码对齐 JijieData.winLoseList。
export const VERDICTS = ["win", "bonus", "lose"];
export const RESULT_LABEL: { [k: string]: string } = { win: "胜利", bonus: "带奖励", lose: "失败" };
export const RESULT_VAL: { [k: string]: number } = { lose: 0, win: 1, bonus: 2 }; // winLoseList 编码：0失败/1胜利/2带奖励
export const VAL_RESULT = ["lose", "win", "bonus"]; // 反查：index = winLoseList 值

// ===== 真实会话桥（方案 A：jjbDesign 自驱读写 JijieData public static；0 改 jijie2） =====
// jjbDesign 自有扁平因子布局：每场 1 指挥官 + FAC_PER_MATCH 因子槽。
// selectedCommanderList[场idx]、selectedFactorList[场idx*FAC_PER_MATCH+槽idx]。
// 契约（调研确认）：这两个数组在 XP(jijie2) 全目录零读取（vestigial），语义归 jjbDesign 所有；
// 由 JJBDesignBoot.onMode 固化为 3/9 格全 null 起始（覆盖 XP toSelect 预填的 mfc*3-2 个 null——8因子=4 与实际槽数不符）。
// 红线：禁止按这两个数组的 length 或 null 计数判断"选满"——按槽位表逐格判断（见 GAP-01 槽数动态化）。
// 这两个数组在 XP TS 代码中是 vestigial(无任何读取/真实写入)，jjbDesign 写入不损坏 XP 结构。
export const FAC_PER_MATCH = 3;
export function facFlatIdx(slot: number, idx: number): number { return slot * FAC_PER_MATCH + idx; }

/** GAP-01 槽数动态化：每场「手选」因子槽数（不含锁定因子）。
 *  纯函数镜像 XP LMatchItem.updateStart 的 fcount 规则（fcount 含锁定因子，手选 = min(fcount-1, 3)；
 *  12因子场3 fcount=5 的 factor4 是幽灵槽——场景 active=false 且激活代码被注释，物理上限 3 = 9 格契约）。
 *  对账表：8因子=1/2/2、10因子=2/2/3、12因子=3/3/3、拯救=2/2/3、随机=0/0/0、非酋=1/1/1。
 *  恒等式（交叉断言用）：因子池数（随机因子数7/10/13 = 5/7/9）= 三场手选槽数之和。 */
export function manualSlots(slotIdx: number): number {
    const d: any = JijieData;
    if (d.modeSuiji) return 0;   // 随机模式：因子槽全隐藏（连锁定因子都不显示）
    if (d.modeFeiqiu) return 1;  // 非酋：仅 factor1
    let f = d.modelFactorCount;
    if (slotIdx === 2) {
        f++;
        if (d.modeIsVeryHard) f = 4;
        if (d.modeIsOnePick && d.modelFactorCount === 3) f = 3;
    } else if (slotIdx === 1) {
        if (d.modelFactorCount === 2) f++;
        if (d.modeIsVeryHard) f = 3;
    } else {
        if (d.modeIsVeryHard) f = 3;
    }
    return Math.min(f - 1, 3);
}

// 屏用 match 视图模型（与 DEMO_MATCHES 同形：slot/map/cmds/factors/result，可选 doubles/lock）。
export interface MatchVM {
    slot: string; map: string; cmds: string[]; factors: string[];
    result?: string; doubles?: boolean; lock?: string;
}

/** 是否处于真实会话：home→select 跑过 XP toStart+toSelect（status>=2 且抽出 3 张地图）。 */
export function jjbLive(): boolean {
    const d: any = JijieData;
    return !!(d && d.status >= 2 && Array.isArray(d.mapList) && d.mapList.length >= 3);
}

/** 把真实 JijieData 整理成 3 场视图模型：map/lock 来自抽取结果，cmds/factors 来自已写入的 selected*。
 *  GAP-02：lock 单独透出（battle/result 给首因子加锁定标识）；随机模式 XP 隐藏锁定因子，此处同样不混入。 */
export function sessionMatches(): MatchVM[] {
    const d: any = JijieData;
    const out: MatchVM[] = [];
    for (let i = 0; i < 3; i++) {
        const cmd: string = (d.selectedCommanderList || [])[i];
        const lock: string = d.modeSuiji ? null : (d.lockFactorList || [])[i]; // 随机模式：锁定因子不显示（对齐 XP updateStart）
        const fac: string[] = lock ? [lock] : []; // 锁定因子(自动) 打头
        for (let k = 0; k < FAC_PER_MATCH; k++) {
            const v = (d.selectedFactorList || [])[facFlatIdx(i, k)];
            if (v) fac.push(v);
        }
        const wl = (d.winLoseList || [])[i];
        out.push({
            slot: i < 2 ? "第 " + (i + 1) + " 场" : "BOSS 战",
            map: (d.mapList || [])[i] || "—",
            cmds: cmd ? [cmd] : [],
            factors: fac,
            result: (typeof wl === "number") ? VAL_RESULT[wl] : undefined,
            doubles: false,
            lock: lock || undefined,
        });
    }
    return out;
}
