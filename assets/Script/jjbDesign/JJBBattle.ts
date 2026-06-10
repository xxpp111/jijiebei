// 集结杯 × CM — 对战页（操作位）。忠实还原 design/v1 Battle + Verdict + theme.css .match/.verdict/.v-btn。
// 双源（方案 A）：
//   · standalone(?design=battle)=DEMO_MATCHES 渲染 + DEMO result 预置三态(showcase，可自由切换不导航)。
//   · 真实会话=渲染真实抽取的 match；Verdict 从未判定开始，点击按 XP 语义累加真实记分，3 场判定完调 showResultEnd()+导航结算。
// XP 语义（jijie2/LMatchItem 权威）：胜利 winCount++/totalCount++；带奖励 winCount++/winbCount++/totalCount++；失败 totalCount++。
//   即 winCount 已含带奖励=总获胜场数。0 改 jijie2 源码（只读写 public static + 调 public showResultEnd）。
import { Theme } from "./JJBTheme";
import { DEMO_MATCHES, markFor, EVENT, RESULT_LABEL, RESULT_VAL, jjbLive, sessionMatches, modeLabel } from "./JJBData";
import JJBDoubles, { DOUBLES_CONFIG, doublesLive, doublesMatches, doublesModeLabel } from "./JJBDoubles";
import JJBView from "./JJBView";
import JijieData from "../jijie2/JijieData";       // 只读写 public static（goal 允许；不改源码）
import JijieControl from "../jijie2/JijieContro";   // 调 public showResultEnd（XP 比赛结束钩子）

const HA = cc.Label.HorizontalAlign;
const ON_STATE = cc.color(11, 18, 6);        // --on-state #0b1206（win/bonus 激活字色）
const VBTN_BG = cc.color(255, 255, 255, 10); // --vbtn-bg rgba(255,255,255,.04)（未激活按钮底）
const H = 116;                                // match 行高
const ROW_TOPS = [172, 304, 436];
const V_RIGHT = 1210;                         // verdict 右边界
const V_DEFS = [{ res: "win", w: 70 }, { res: "bonus", w: 87 }, { res: "lose", w: 70 }]; // 设计顺序 win/bonus/lose

export default class JJBBattle {

    static build(root: cc.Node, th: Theme, onDone?: () => void, onOverlay?: () => void): void {
        JJBView.bg(root, th);

        const doubles = doublesLive();
        const live = !doubles && jjbLive();
        const dAny: any = JijieData;
        const matches: any[] = doubles ? doublesMatches() : (live ? sessionMatches() : DEMO_MATCHES);

        // ---------- TopBar（与选择面板同款） ----------
        JJBView.sprite(root, 50, 30, 52, 42, markFor(th.style, th.mode));
        const titleW = th.style === "sc2" ? 599 : th.style === "minimal" ? 666 : 585;
        const tH = 42, tWd = Math.round(tH * titleW / 200);
        JJBView.sprite(root, 116, 30, tWd, tH, "images/brand/jjb-title-" + th.style + "-" + th.mode);
        JJBView.label(root, 760, 30, 470, 20, live ? ("当前选手  " + (dAny.playerName || "选手")) : (doubles ? "当前选手  双打队伍" : "当前选手  Potato_01"), 15, th.muted, HA.RIGHT);
        JJBView.label(root, 760, 54, 470, 20, doubles ? ("比赛模式  " + doublesModeLabel()) : (live ? ("比赛模式  " + modeLabel()) : "比赛模式  8 因子 · 手选"), 15, th.ink, HA.RIGHT);

        // ---------- 记分初始化（直接读写 JijieData public static） ----------
        // 真实会话：仅首次进入（未初始化）才置空——主题切换 reRenderCurrent 重建本屏时保留已判定记分；
        // 新一局的重置由 JJBDesignBoot.onMode 统一负责。standalone：DEMO result 预置三态 showcase。
        if (doubles) { if (!Array.isArray(JJBDoubles.winLoseList)) JJBDoubles.winLoseList = []; }
        else if (live) { if (!Array.isArray(JijieData.winLoseList)) JijieData.winLoseList = []; }
        else JijieData.winLoseList = DEMO_MATCHES.map((m: any) => RESULT_VAL[m.result]);
        const recompute = () => {
            if (doubles) return;
            const wl = JijieData.winLoseList || [];
            JijieData.winCount = wl.filter((v) => v === 1 || v === 2).length;  // XP：胜利+带奖励=总获胜场数
            JijieData.winbCount = wl.filter((v) => v === 2).length;             // 带奖励 计数
            JijieData.totalCount = wl.filter((v) => v === 0 || v === 1 || v === 2).length; // 已判定场数
        };
        const updateDebug = () => {
            try {
                const w: any = window; w.__jjbDebug = w.__jjbDebug || {};
                w.__jjbDebug.battle = {
                    live: live,
                    doubles: doubles,
                    winLoseList: doubles ? (JJBDoubles.winLoseList || []).slice() : (JijieData.winLoseList || []).slice(),
                    winCount: doubles ? JJBDoubles.winCount() : JijieData.winCount,
                    winbCount: doubles ? JJBDoubles.bonusCount() : JijieData.winbCount,
                    totalCount: doubles ? JJBDoubles.totalCount() : JijieData.totalCount,
                    matchCount: doubles ? DOUBLES_CONFIG.matches : 3,
                };
                if (doubles) JJBDoubles.exposeDebug();
            } catch (e) { /* noop */ }
        };

        // 单场 Verdict 三按钮（重绘式：destroy 旧节点 + 重建，反映当前 active 高亮）
        const vNodes: cc.Node[][] = [[], [], []];
        const drawVerdict = (i: number) => {
            const rowTop = ROW_TOPS[i];
            vNodes[i].forEach((n) => { if (cc.isValid(n)) n.destroy(); });
            vNodes[i] = [];
            const active = doubles ? (JJBDoubles.winLoseList || [])[i] : (JijieData.winLoseList || [])[i];
            const btnTop = rowTop + (H - 40) / 2;
            let bx = V_RIGHT - V_DEFS.reduce((s, d) => s + d.w, 0) - 10 * (V_DEFS.length - 1);
            V_DEFS.forEach((d) => {
                const val = RESULT_VAL[d.res];
                const on = active === val;
                let fill = VBTN_BG, edge = th.panelEdge, col = th.muted;
                if (on) {
                    if (d.res === "win") { fill = th.win; edge = th.win; col = ON_STATE; }
                    else if (d.res === "bonus") { fill = th.bonus; edge = th.bonus; col = ON_STATE; }
                    else { fill = th.lose; edge = th.lose; col = cc.Color.WHITE; }
                }
                const box = JJBView.box(root, bx, btnTop, d.w, 40, fill, edge, 1);
                const lbl = JJBView.label(root, bx, btnTop + 11, d.w, 20, RESULT_LABEL[d.res], 17, col, HA.CENTER);
                const hit = JJBView.hit(root, bx, btnTop, d.w, 40, () => {
                    if (doubles) JJBDoubles.setVerdict(i, val);
                    else {
                        if (!JijieData.winLoseList) JijieData.winLoseList = [];
                        JijieData.winLoseList[i] = val;
                    }
                    recompute(); updateDebug();
                    // 真实会话：判定完 → 导航结算（单刷同时调 XP 比赛结束钩子；双打不走 XP）
                    if (doubles && JJBDoubles.totalCount() >= DOUBLES_CONFIG.matches) {
                        if (onDone) { onDone(); return; }
                    }
                    if (live && JijieData.totalCount >= 3) {
                        try { JijieControl.showResultEnd(); } catch (e) { cc.warn("[JJBBattle] showResultEnd: " + e); }
                        if (onDone) { onDone(); return; }
                    }
                    drawVerdict(i);
                });
                hit.name = "jjbV_" + i + "_" + val; // 便于自动化点击断言定位
                vNodes[i].push(box, lbl, hit);
                bx += d.w + 10;
            });
        };

        // ---------- 3 场 ----------
        matches.forEach((m: any, i: number) => {
            const rowTop = ROW_TOPS[i];
            const doubles = !!m.doubles;
            const isBoss = doubles || (typeof m.slot === "string" && m.slot.indexOf("BOSS") >= 0);
            JJBView.panel(root, 50, rowTop, 1180, H, th, undefined, isBoss ? th.accent : undefined);

            // match-no（+ 双打标）
            if (doubles) {
                JJBView.label(root, 70, rowTop + 35, 100, 26, m.slot, 22, th.accent, HA.LEFT);
                JJBView.box(root, 70, rowTop + 64, 44, 20, null, th.panelEdge, 1);
                JJBView.label(root, 70, rowTop + 67, 44, 16, "双打", 11, th.ink, HA.CENTER);
            } else {
                JJBView.label(root, 70, rowTop + 47, 100, 26, m.slot, 22, th.accent, HA.LEFT);
            }

            // match-map（横幅 + 名）
            JJBView.coverSprite(root, 190, rowTop + 24, 270, 48, "images/maps/" + m.map);
            JJBView.label(root, 190, rowTop + 78, 270, 18, m.map, 14, th.muted, HA.LEFT);

            // match-cmds（avatar big 70×84）
            (m.cmds || []).forEach((c: string, k: number) => JJBView.coverSprite(root, 480 + k * 78, rowTop + 16, 70, 84, "images/commander/" + c));

            // match-factors；live 首位是锁定因子，doubles 前 N 个是官突 mutator。
            const cmdCount = (m.cmds || []).length || 1;
            const facX = 480 + cmdCount * 70 + (cmdCount - 1) * 8 + 20;
            (m.factors || []).forEach((f: string, k: number) => {
                const wrap = doubles;
                const size = wrap ? 42 : 56;
                const gap = wrap ? 48 : 62;
                const x = facX + (wrap ? (k % 5) * gap : k * gap);
                const y = rowTop + (wrap ? (k < 5 ? 22 : 66) : 30);
                JJBView.sprite(root, x, y, size, size, "images/factor/" + f);
                if (doubles && m.mutators && k < m.mutators.length) {
                    JJBView.box(root, x, y + size - 14, 34, 14, th.accent, null);
                    JJBView.label(root, x, y + size - 12, 34, 12, "官突", 9, ON_STATE, HA.CENTER);
                } else if (live && m.lock && k === 0) {
                    JJBView.box(root, x, rowTop + 72, 34, 14, th.accent, null);
                    JJBView.label(root, x, rowTop + 74, 34, 12, "锁定", 9, ON_STATE, HA.CENTER);
                }
            });

            // verdict
            drawVerdict(i);
        });

        // ---------- 页脚 ----------
        JJBView.box(root, 50, 646, 1180, 2, th.panelEdge);
        JJBView.label(root, 50, 662, 700, 22, EVENT.org + "　·　主播「" + EVENT.host + "」", 15, th.ink, HA.LEFT);
        JJBView.label(root, 600, 662, 630, 22, EVENT.links[0].k + " " + EVENT.links[0].v + "　　B站主播 " + EVENT.host, 15, th.muted, HA.RIGHT);

        // ---------- 直播浮层入口（右上角，经 JJBDesignBoot 切 overlay，GAP-17）----------
        if (onOverlay) {
            JJBView.box(root, 1078, 110, 146, 30, null, th.panelEdge, 1);
            JJBView.label(root, 1078, 116, 146, 18, "直播浮层 ▣", 13, th.muted, HA.CENTER);
            const ovHit = JJBView.hit(root, 1078, 110, 146, 30, onOverlay);
            ovHit.name = "jjbToOverlay";
        }

        recompute();
        updateDebug(); // 初始即暴露记分（standalone=DEMO 三态；真实会话=全 0）
    }
}
