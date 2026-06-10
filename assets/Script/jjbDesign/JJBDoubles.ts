// 集结杯 × CM — 双打（官突）占位规则骨架。
// 双打完全由 jjbDesign 自管，不写 JijieData、不依赖 XP status；玩法参数集中在 DOUBLES_CONFIG。
import { MatchVM, VAL_RESULT } from "./JJBData";

export const DOUBLES_CONFIG = {
    matches: 3,                         // 场数（用户定：三轮，与 XP 双打原型一致[非酋模式残骸：3场×2指挥官]）
    maps: ["湮灭快车", "克哈裂痕", "往日神庙"], // 预选地图（长度>=matches；赛前按当期官突改）
    mutators: ["风暴英雄", "虚空裂隙"], // 官方突变打底因子，按锁定样式渲染但标「官突」（赛前按当期官突改）
    cmdsPerMatch: 2,                    // 每场指挥官数（两位玩家各 1）
    extraFactors: 3,                    // 每场额外随机因子槽数
    factorPoolSize: 9,                  // 额外因子池大小 = matches*extraFactors（池=槽恒等式，对齐 XP 设计哲学：拖完正好用光）
    cmdPoolSize: 6,                     // 指挥官池大小 = matches*cmdsPerMatch（同上恒等式；XP 原型即 A4+B2=6 精确匹配）
    scoring: "per-match",
};

const FACTOR_SOURCE = [
    "暴风雪", "核弹打击", "丧尸大战", "岩浆爆发", "相互摧毁", "伤害散射",
    "黑死病", "强磁雷场", "力量蜕变", "光子过载", "扫雷专家", "异形寄生",
    "坚强意志", "震荡攻击", "无边恐惧", "激光钻机", "复仇战士", "自毁程序",
    "生命吸取", "速度狂魔", "给我死吧", "虚空重生者", "进攻部署", "减伤屏障",
];

const COMMANDER_SOURCE = [
    "雷诺", "凯瑞甘", "阿塔尼斯", "斯旺", "沃拉尊", "扎加拉", "斯图科夫", "菲尼克斯",
    "德哈卡", "诺娃", "阿巴瑟", "阿纳拉克", "泰凯斯", "泽拉图", "斯台特曼", "蒙斯克",
];

export interface DoublesSlotSelection {
    cmds: string[];
    factors: string[];
}

export interface DoublesSelection {
    slots: DoublesSlotSelection[];
}

function shuffle(arr: string[]): string[] {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
}

function matchCount(): number {
    return Math.max(1, Math.floor(Number(DOUBLES_CONFIG.matches) || 1));
}

function filled<T>(arr: T[], len: number, value: T): T[] {
    const out = new Array(len);
    for (let i = 0; i < len; i++) out[i] = arr && arr[i] !== undefined ? arr[i] : value;
    return out;
}

export default class JJBDoubles {
    private static liveFlag: boolean = false;
    public static factorPool: string[] = [];
    public static commanderPool: string[] = [];
    public static selection: DoublesSelection = { slots: [] };
    public static winLoseList: number[] = [];

    static start(): void {
        const m = matchCount();
        const mut: string[] = (DOUBLES_CONFIG.mutators || []).slice();
        const facSource = FACTOR_SOURCE.filter((f) => mut.indexOf(f) < 0);
        JJBDoubles.factorPool = shuffle(facSource).slice(0, Math.max(0, DOUBLES_CONFIG.factorPoolSize));
        JJBDoubles.commanderPool = shuffle(COMMANDER_SOURCE).slice(0, Math.max(0, DOUBLES_CONFIG.cmdPoolSize));
        JJBDoubles.selection = { slots: [] };
        for (let i = 0; i < m; i++) {
            JJBDoubles.selection.slots.push({
                cmds: filled([], Math.max(1, DOUBLES_CONFIG.cmdsPerMatch), null),
                factors: filled([], Math.max(0, DOUBLES_CONFIG.extraFactors), null),
            });
        }
        JJBDoubles.winLoseList = new Array(m);
        JJBDoubles.liveFlag = true;
        JJBDoubles.exposeDebug();
    }

    static reset(): void {
        JJBDoubles.liveFlag = false;
        JJBDoubles.factorPool = [];
        JJBDoubles.commanderPool = [];
        JJBDoubles.selection = { slots: [] };
        JJBDoubles.winLoseList = [];
        JJBDoubles.exposeDebug();
    }

    static live(): boolean {
        return JJBDoubles.liveFlag;
    }

    static setCommander(slot: number, idx: number, name: string): void {
        JJBDoubles.ensureSlot(slot);
        JJBDoubles.selection.slots[slot].cmds[idx] = name;
        JJBDoubles.exposeDebug();
    }

    static clearCommander(slot: number, idx: number): void {
        JJBDoubles.ensureSlot(slot);
        JJBDoubles.selection.slots[slot].cmds[idx] = null;
        JJBDoubles.exposeDebug();
    }

    static setFactor(slot: number, idx: number, name: string): void {
        JJBDoubles.ensureSlot(slot);
        JJBDoubles.selection.slots[slot].factors[idx] = name;
        JJBDoubles.exposeDebug();
    }

    static clearFactor(slot: number, idx: number): void {
        JJBDoubles.ensureSlot(slot);
        JJBDoubles.selection.slots[slot].factors[idx] = null;
        JJBDoubles.exposeDebug();
    }

    static setVerdict(slot: number, val: number): void {
        if (!Array.isArray(JJBDoubles.winLoseList)) JJBDoubles.winLoseList = new Array(matchCount());
        JJBDoubles.winLoseList[slot] = val;
        JJBDoubles.exposeDebug();
    }

    static winCount(): number {
        return (JJBDoubles.winLoseList || []).filter((v) => v === 1 || v === 2).length;
    }

    static bonusCount(): number {
        return (JJBDoubles.winLoseList || []).filter((v) => v === 2).length;
    }

    static totalCount(): number {
        return (JJBDoubles.winLoseList || []).filter((v) => v === 0 || v === 1 || v === 2).length;
    }

    static matches(): Array<MatchVM & { mutators?: string[] }> {
        const out: Array<MatchVM & { mutators?: string[] }> = [];
        const cfg = DOUBLES_CONFIG;
        const m = matchCount();
        for (let i = 0; i < m; i++) {
            JJBDoubles.ensureSlot(i);
            const slot = JJBDoubles.selection.slots[i];
            const factors = (cfg.mutators || []).slice();
            (slot.factors || []).forEach((f) => { if (f) factors.push(f); });
            const wl = JJBDoubles.winLoseList || [];
            out.push({
                slot: m === 1 ? "官突战" : (i < m - 1 ? "第 " + (i + 1) + " 场" : "BOSS 战"),
                map: (cfg.maps && cfg.maps[i]) || (cfg.maps && cfg.maps[0]) || "湮灭快车",
                cmds: (slot.cmds || []).filter((c) => !!c),
                factors: factors,
                result: (typeof wl[i] === "number") ? VAL_RESULT[wl[i]] : undefined,
                doubles: true,
                lock: (cfg.mutators || [])[0],
                mutators: (cfg.mutators || []).slice(),
            });
        }
        return out;
    }

    static debugSnapshot(): any {
        const cfg: any = {};
        Object.keys(DOUBLES_CONFIG).forEach((k) => {
            const v = (DOUBLES_CONFIG as any)[k];
            cfg[k] = Array.isArray(v) ? v.slice() : v;
        });
        return {
            config: cfg,
            live: JJBDoubles.liveFlag,
            factorPool: JJBDoubles.factorPool.slice(),
            commanderPool: JJBDoubles.commanderPool.slice(),
            selection: {
                slots: (JJBDoubles.selection.slots || []).map((s) => ({
                    cmds: (s.cmds || []).slice(),
                    factors: (s.factors || []).slice(),
                })),
            },
            winLoseList: (JJBDoubles.winLoseList || []).slice(),
            winCount: JJBDoubles.winCount(),
            winbCount: JJBDoubles.bonusCount(),
            totalCount: JJBDoubles.totalCount(),
        };
    }

    static exposeDebug(): void {
        try {
            const w: any = window;
            w.__jjbDebug = w.__jjbDebug || {};
            w.__jjbDebug.doubles = JJBDoubles.debugSnapshot();
        } catch (e) { /* noop */ }
    }

    private static ensureSlot(slot: number): void {
        const m = matchCount();
        if (!JJBDoubles.selection || !Array.isArray(JJBDoubles.selection.slots) || JJBDoubles.selection.slots.length !== m) {
            JJBDoubles.selection = { slots: [] };
        }
        while (JJBDoubles.selection.slots.length < m) {
            JJBDoubles.selection.slots.push({
                cmds: filled([], Math.max(1, DOUBLES_CONFIG.cmdsPerMatch), null),
                factors: filled([], Math.max(0, DOUBLES_CONFIG.extraFactors), null),
            });
        }
        const s = JJBDoubles.selection.slots[slot];
        if (!s) return;
        s.cmds = filled(s.cmds || [], Math.max(1, DOUBLES_CONFIG.cmdsPerMatch), null);
        s.factors = filled(s.factors || [], Math.max(0, DOUBLES_CONFIG.extraFactors), null);
    }
}

export function doublesLive(): boolean { return JJBDoubles.live(); }
export function doublesMatches(): Array<MatchVM & { mutators?: string[] }> { return JJBDoubles.matches(); }
export function doublesModeLabel(): string { return "双打模式 · 官突"; }
