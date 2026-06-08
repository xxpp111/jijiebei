// 集结杯 × CM — 对战页（操作位）。忠实还原 design/v1 Battle + Verdict + theme.css .match/.verdict/.v-btn。
// 3 场比赛，每场 Verdict 三态判定(胜利/带奖励/失败)；点击写回 JijieData.winLoseList[i]、实时重算比分、
// 切换 active 高亮、写 window.__jjbDebug.battle。用 DEMO_MATCHES 渲染 + DEMO result 初始化记分。0 改 jijie2 源码。
import { Theme } from "./JJBTheme";
import { DEMO_MATCHES, MARK, EVENT, RESULT_LABEL, RESULT_VAL } from "./JJBData";
import JJBView from "./JJBView";
import JijieData from "../jijie2/JijieData"; // 只读写 public static（goal 允许；不改源码）

const HA = cc.Label.HorizontalAlign;
const ON_STATE = cc.color(11, 18, 6);        // --on-state #0b1206（win/bonus 激活字色）
const VBTN_BG = cc.color(255, 255, 255, 10); // --vbtn-bg rgba(255,255,255,.04)（未激活按钮底）
const H = 116;                                // match 行高
const ROW_TOPS = [172, 304, 436];
const V_RIGHT = 1210;                         // verdict 右边界
const V_DEFS = [{ res: "win", w: 70 }, { res: "bonus", w: 87 }, { res: "lose", w: 70 }]; // 设计顺序 win/bonus/lose

export default class JJBBattle {

    static build(root: cc.Node, th: Theme): void {
        JJBView.bg(root, th);

        // ---------- TopBar（与选择面板同款） ----------
        JJBView.sprite(root, 50, 30, 52, 42, MARK[th.style] || MARK["metal"]);
        const titleW = th.style === "sc2" ? 599 : th.style === "minimal" ? 666 : 585;
        const tH = 42, tWd = Math.round(tH * titleW / 200);
        JJBView.sprite(root, 116, 30, tWd, tH, "images/brand/jjb-title-" + th.style);
        JJBView.label(root, 760, 30, 470, 20, "当前选手  Potato_01", 15, th.muted, HA.RIGHT);
        JJBView.label(root, 760, 54, 470, 20, "比赛模式  8 因子 · 手选", 15, th.ink, HA.RIGHT);

        // ---------- 记分（DEMO result → winLoseList；直接读写 JijieData public static） ----------
        JijieData.winLoseList = DEMO_MATCHES.map((m: any) => RESULT_VAL[m.result]);
        const recompute = () => {
            const wl = JijieData.winLoseList || [];
            JijieData.winCount = wl.filter((v) => v === 1).length;   // 值1=胜利 计数
            JijieData.winbCount = wl.filter((v) => v === 2).length;  // 值2=带奖励 计数
            JijieData.totalCount = wl.filter((v) => v === 0 || v === 1 || v === 2).length; // 已判定场数
        };
        const updateDebug = () => {
            try {
                const w: any = window; w.__jjbDebug = w.__jjbDebug || {};
                w.__jjbDebug.battle = {
                    winLoseList: (JijieData.winLoseList || []).slice(),
                    winCount: JijieData.winCount, winbCount: JijieData.winbCount, totalCount: JijieData.totalCount,
                };
            } catch (e) { /* noop */ }
        };

        // 单场 Verdict 三按钮（重绘式：destroy 旧节点 + 重建，反映当前 active 高亮）
        const vNodes: cc.Node[][] = [[], [], []];
        const drawVerdict = (i: number) => {
            const rowTop = ROW_TOPS[i];
            vNodes[i].forEach((n) => { if (cc.isValid(n)) n.destroy(); });
            vNodes[i] = [];
            const active = (JijieData.winLoseList || [])[i];
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
                    if (!JijieData.winLoseList) JijieData.winLoseList = [];
                    JijieData.winLoseList[i] = val;
                    recompute(); drawVerdict(i); updateDebug();
                });
                hit.name = "jjbV_" + i + "_" + val; // 便于自动化点击断言定位
                vNodes[i].push(box, lbl, hit);
                bx += d.w + 10;
            });
        };

        // ---------- 3 场 ----------
        DEMO_MATCHES.forEach((m: any, i: number) => {
            const rowTop = ROW_TOPS[i];
            const boss = !!m.doubles;
            JJBView.box(root, 50, rowTop, 1180, H, th.panelBg, boss ? th.accent : th.panelEdge, boss ? 2 : 1);

            // match-no（+ 双打标）
            if (boss) {
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
            m.cmds.forEach((c: string, k: number) => JJBView.coverSprite(root, 480 + k * 78, rowTop + 16, 70, 84, "images/commander/" + c));

            // match-factors（50×50）
            const facX = 480 + m.cmds.length * 70 + (m.cmds.length - 1) * 8 + 20;
            m.factors.forEach((f: string, k: number) => JJBView.sprite(root, facX + k * 60, rowTop + 33, 50, 50, "images/factor/" + f));

            // verdict
            drawVerdict(i);
        });

        // ---------- 页脚 ----------
        JJBView.box(root, 50, 646, 1180, 2, th.panelEdge);
        JJBView.label(root, 50, 662, 700, 22, EVENT.org + "　·　主播「" + EVENT.host + "」", 15, th.ink, HA.LEFT);
        JJBView.label(root, 600, 662, 630, 22, EVENT.links[0].k + " " + EVENT.links[0].v + "　　B站主播 " + EVENT.host, 15, th.muted, HA.RIGHT);

        recompute();
        updateDebug(); // 初始（DEMO result）即暴露记分
    }
}
