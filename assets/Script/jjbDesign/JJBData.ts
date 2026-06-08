// 集结杯 × CM — 设计预览用数据（移植自 design/v1/data.jsx）
// 注：游戏真实数据在 resources/jjdata/*.txt；此处仅首页文案/模式，后续屏接入真实数据。

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
    { no: "05", name: "极难模式", tag: "残局" },
    { no: "06", name: "随机模式", tag: "抽取" },
];

// 选择面板用（真实资源名）。因子池 / 指挥官 A·B 组 / 自选 18 格（6 真 + 12 占位）。
export const FACTORS = ["暴风雪", "核弹打击", "丧尸大战", "虚空裂隙", "岩浆爆发", "相互摧毁"];
export const GROUP_A = ["阿塔尼斯", "德哈卡", "凯瑞甘"];
export const GROUP_B = ["雷诺", "诺娃", "泰凯斯"];
export const POOL: (string | null)[] = [
    "阿塔尼斯", "德哈卡", "凯瑞甘", "雷诺", "诺娃", "泰凯斯",
    null, null, null, null, null, null, null, null, null, null, null, null,
];

// 拉丁/数字字体（设计 --font-num）。中文不用它（走系统字）。需 JJBDesignBoot 注入 Google Fonts。
export const FONT_NUM = "Oswald";

// CM 联名字标（已导入 resources/images/brand/）。按风格取色版本。
export const MARK: { [k: string]: string } = {
    metal: "images/brand/logo-cm-gold",
    sc2: "images/brand/logo-cm-silver",
    minimal: "images/brand/logo-cm-vector",
};

// 演示对局（真实游戏图标名，resources 里均存在）——后续接 XP 真实 JijieData。
// status: win 胜利 / live 进行中 / wait 待战（浮层用）。result: win/bonus/lose（对战/结算三态判定，对齐 design MATCHES）。
export const DEMO_MATCHES = [
    { slot: "第 1 场", map: "克哈裂痕", cmds: ["凯瑞甘"], factors: ["岩浆爆发", "虚空裂隙", "丧尸大战"], status: "win", result: "win" },
    { slot: "第 2 场", map: "黑暗杀星", cmds: ["雷诺"], factors: ["核弹打击", "暴风雪", "相互摧毁"], status: "live", result: "bonus" },
    { slot: "BOSS 战", map: "往日神庙", cmds: ["阿塔尼斯", "凯瑞甘"], factors: ["虚空裂隙", "岩浆爆发", "核弹打击", "丧尸大战", "净化光束"], status: "wait", doubles: true, result: "win" },
];

// 三态判定（对战页 Verdict / 结算页 战绩）。设计顺序 win/bonus/lose；编码对齐 JijieData.winLoseList。
export const VERDICTS = ["win", "bonus", "lose"];
export const RESULT_LABEL: { [k: string]: string } = { win: "胜利", bonus: "带奖励", lose: "失败" };
export const RESULT_VAL: { [k: string]: number } = { lose: 0, win: 1, bonus: 2 }; // winLoseList 编码：0失败/1胜利/2带奖励
export const VAL_RESULT = ["lose", "win", "bonus"]; // 反查：index = winLoseList 值

