// 集结杯 × CM — 设计 token（移植自 design/v1/styles.css）
// 3 风格 (metal/sc2/minimal) × 明暗 (dark/light)。结构层 JJBView 用这些 token 渲染。

export interface Theme {
    style: string;
    mode: string;
    serifTitle: boolean;
    bgA: cc.Color;
    bgB: cc.Color;
    ink: cc.Color;
    muted: cc.Color;
    accent: cc.Color;
    onAccent: cc.Color;
    panelBg: cc.Color;
    panelEdge: cc.Color;
    dropEdge: cc.Color;
    dropBg: cc.Color;
    win: cc.Color;
    bonus: cc.Color;
    lose: cc.Color;
    onState: cc.Color;
}

function c(hex: string, a: number = 255): cc.Color {
    const h = hex.replace("#", "");
    return cc.color(
        parseInt(h.substr(0, 2), 16),
        parseInt(h.substr(2, 2), 16),
        parseInt(h.substr(4, 2), 16),
        a
    );
}

// 每个组合的原始值。panel* 是 [hex, alpha255]（移植 rgba 透明度）。
// onState 精确值源 design/v4-r2/styles.css：暗色为深字、亮色为白字（胜利/带奖励徽章字色）。
const T: { [k: string]: any } = {
    "metal-dark": {
        bgA: "#16273f", bgB: "#05090f", ink: "#e9eef4", muted: "#93a3b8",
        accent: "#D8B15A", onAccent: "#1a1206",
        panelBg: ["#1c2a3e", 158], panelEdge: ["#c7d1de", 61], dropEdge: ["#d8b15a", 107], dropBg: ["#ffffff", 6],
        win: "#4f9d72", bonus: "#6f86bd", lose: "#a3434a", onState: "#0b1206", serif: true,
    },
    "metal-light": {
        bgA: "#e2e9f1", bgB: "#bcc7d6", ink: "#15233a", muted: "#5d6b80",
        accent: "#a9761f", onAccent: "#ffffff",
        panelBg: ["#ffffff", 199], panelEdge: ["#15233a", 69], dropEdge: ["#a9761f", 128], dropBg: ["#15233a", 10],
        win: "#2f8d5c", bonus: "#3f63b8", lose: "#b23b3b", onState: "#ffffff", serif: true,
    },
    "sc2-dark": {
        bgA: "#101c20", bgB: "#05090b", ink: "#dfeae6", muted: "#7f9389",
        accent: "#56cf8c", onAccent: "#062013",
        panelBg: ["#1e302e", 164], panelEdge: ["#78968c", 76], dropEdge: ["#56cf8c", 102], dropBg: ["#56cf8c", 13],
        win: "#56cf8c", bonus: "#52a7c4", lose: "#d06b6b", onState: "#062013", serif: false,
    },
    "sc2-light": {
        bgA: "#dde8e4", bgB: "#b4c5bf", ink: "#14241f", muted: "#54665d",
        accent: "#1f8a55", onAccent: "#ffffff",
        panelBg: ["#f8fbf9", 209], panelEdge: ["#14241f", 69], dropEdge: ["#1f8a55", 128], dropBg: ["#1f8a55", 15],
        win: "#1f8a55", bonus: "#2f7fa0", lose: "#b23b3b", onState: "#ffffff", serif: false,
    },
    "minimal-dark": {
        bgA: "#16181d", bgB: "#0a0b0e", ink: "#f1f3f6", muted: "#888e9a",
        accent: "#4f8ff5", onAccent: "#04101f",
        panelBg: ["#ffffff", 9], panelEdge: ["#ffffff", 36], dropEdge: ["#ffffff", 51], dropBg: ["#ffffff", 5],
        win: "#3fae74", bonus: "#4f8ff5", lose: "#e0606e", onState: "#04101f", serif: false,
    },
    "minimal-light": {
        bgA: "#ffffff", bgB: "#edeff2", ink: "#14171c", muted: "#69707c",
        accent: "#2f6fd6", onAccent: "#ffffff",
        panelBg: ["#ffffff", 255], panelEdge: ["#14171c", 36], dropEdge: ["#14171c", 56], dropBg: ["#14171c", 8],
        win: "#1f9d63", bonus: "#2f6fd6", lose: "#d34a58", onState: "#ffffff", serif: false,
    },
};

export function getTheme(style: string, mode: string): Theme {
    const key = style + "-" + mode;
    const d = T[key] || T["metal-dark"];
    return {
        style: style,
        mode: mode,
        serifTitle: !!d.serif,
        bgA: c(d.bgA), bgB: c(d.bgB), ink: c(d.ink), muted: c(d.muted),
        accent: c(d.accent), onAccent: c(d.onAccent),
        panelBg: c(d.panelBg[0], d.panelBg[1]),
        panelEdge: c(d.panelEdge[0], d.panelEdge[1]),
        dropEdge: c(d.dropEdge[0], d.dropEdge[1]),
        dropBg: c(d.dropBg[0], d.dropBg[1]),
        win: c(d.win), bonus: c(d.bonus), lose: c(d.lose), onState: c(d.onState),
    };
}
