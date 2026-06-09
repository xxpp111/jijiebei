// 集结杯 × CM — 结算页。忠实还原 design/v1 Result + theme.css .result-banner/.result-score/.rs-num/.rcard/.rcard-badge。
// 大比分 = 获胜场数 = JijieData.winCount（XP 语义：winCount 已含带奖励胜，不再 +winbCount，避免双计）+ 战绩卡列表。
// 双源（方案 A）：standalone(?design=result)=DEMO winLoseList 预置；真实会话=读 battle 累加的真实记分与抽取阵容。0 改 jijie2 源码。
import { Theme } from "./JJBTheme";
import { DEMO_MATCHES, markFor, EVENT, FONT_NUM, RESULT_LABEL, RESULT_VAL, VAL_RESULT, jjbLive, sessionMatches } from "./JJBData";
import JJBView from "./JJBView";
import JijieData from "../jijie2/JijieData"; // 只读写 public static（goal 允许；不改源码）

const HA = cc.Label.HorizontalAlign;
const ON_STATE = cc.color(11, 18, 6); // --on-state #0b1206（win/bonus 徽章字色）

export default class JJBResult {

    static build(root: cc.Node, th: Theme): void {
        JJBView.bg(root, th);

        const live = jjbLive();
        const dAny: any = JijieData;
        const matches: any[] = live ? sessionMatches() : DEMO_MATCHES;

        // ---------- TopBar（同对战页） ----------
        JJBView.sprite(root, 50, 30, 52, 42, markFor(th.style, th.mode));
        const titleW = th.style === "sc2" ? 599 : th.style === "minimal" ? 666 : 585;
        const tH = 42, tWd = Math.round(tH * titleW / 200);
        JJBView.sprite(root, 116, 30, tWd, tH, "images/brand/jjb-title-" + th.style + "-" + th.mode);
        const fcount = dAny.modelFactorCount === 2 ? 8 : (dAny.modelFactorCount === 4 ? 12 : 10);
        JJBView.label(root, 760, 30, 470, 20, live ? ("当前选手  " + (dAny.playerName || "选手")) : "当前选手  Potato_01", 15, th.muted, HA.RIGHT);
        JJBView.label(root, 760, 54, 470, 20, live ? ("比赛模式  " + fcount + " 因子 · 手选") : "比赛模式  8 因子 · 手选", 15, th.ink, HA.RIGHT);

        // ---------- 记分（standalone 用 DEMO 预置；真实会话沿用 battle 累加的 winLoseList） ----------
        if (!live) JijieData.winLoseList = DEMO_MATCHES.map((m: any) => RESULT_VAL[m.result]);
        const wl = JijieData.winLoseList || [];
        JijieData.winCount = wl.filter((v) => v === 1 || v === 2).length;  // XP：胜利+带奖励=总获胜
        JijieData.winbCount = wl.filter((v) => v === 2).length;
        JijieData.totalCount = wl.filter((v) => v === 0 || v === 1 || v === 2).length;
        const wins = JijieData.winCount || 0; // 获胜场数 = winCount（已含带奖励，不再 +winbCount）
        try {
            const w: any = window; w.__jjbDebug = w.__jjbDebug || {};
            w.__jjbDebug.result = { live: live, wins: wins, winLoseList: wl.slice(), winCount: JijieData.winCount, winbCount: JijieData.winbCount };
        } catch (e) { /* noop */ }

        // ---------- banner（kicker / 大比分 / tag） ----------
        JJBView.label(root, 340, 124, 600, 18, "MATCH COMPLETE · 比赛结束", 15, th.accent, HA.CENTER, 255, FONT_NUM);
        JJBView.label(root, 480, 148, 160, 116, String(wins), 108, th.accent, HA.RIGHT, 255, FONT_NUM); // rs-num，右边缘≈640（居中）
        JJBView.label(root, 654, 222, 320, 36, "/ 3 场获胜", 30, th.ink, HA.LEFT);                       // rs-unit
        JJBView.label(root, 440, 274, 400, 24, wins === 3 ? "完美通关" : "本局战绩", 17, th.muted, HA.CENTER);

        // ---------- 战绩卡列表（v2：max-width 1040 居中 → x[120,1160]，卡 96px + 左侧胜负色条 + 放大）----------
        const listX = 120, listW = 1040, rH = 96, gap = 14, list0 = 314;
        matches.forEach((m: any, i: number) => {
            const top = list0 + i * (rH + gap);
            const res = VAL_RESULT[wl[i]] || m.result || "win";
            JJBView.panel(root, listX, top, listW, rH, th);
            // 左侧胜负色条（v2 .rcard::before width 6：胜绿/带奖励蓝/失败红）
            const barCol = res === "bonus" ? th.bonus : (res === "lose" ? th.lose : th.win);
            JJBView.box(root, listX, top, 6, rH, barCol, null);
            const padL = listX + 30;
            // rcard-no（slot 24px + 双打标）
            JJBView.label(root, padL, top + (m.doubles ? 24 : 36), 116, 30, m.slot, 24, th.ink, HA.LEFT);
            if (m.doubles) { JJBView.box(root, padL, top + 58, 44, 20, null, th.accent, 1); JJBView.label(root, padL, top + 61, 44, 16, "双打", 12, th.accent, HA.CENTER); }
            // rcard-map（thumb 248×64）
            const mapX = padL + 116 + 16;
            JJBView.coverSprite(root, mapX, top + 16, 248, 64, "images/maps/" + m.map);
            // rcard-mid（cmds 58×70 + facs 46×46）
            const midX = mapX + 248 + 22;
            (m.cmds || []).forEach((c: string, k: number) => JJBView.coverSprite(root, midX + k * 64, top + 13, 58, 70, "images/commander/" + c));
            const cmdCount = (m.cmds || []).length || 1;
            const facX = midX + cmdCount * 58 + (cmdCount - 1) * 8 + 16;
            (m.factors || []).forEach((f: string, k: number) => JJBView.sprite(root, facX + k * 52, top + 25, 46, 46, "images/factor/" + f));
            // rcard-badge（v2：22px/900 放大）
            const bw = res === "bonus" ? 108 : 92;
            let bfill = th.win, bcol: cc.Color = ON_STATE;
            if (res === "bonus") { bfill = th.bonus; bcol = ON_STATE; }
            else if (res === "lose") { bfill = th.lose; bcol = cc.Color.WHITE; }
            JJBView.box(root, listX + listW - 24 - bw, top + 30, bw, 38, bfill, null);
            JJBView.label(root, listX + listW - 24 - bw, top + 37, bw, 26, RESULT_LABEL[res], 22, bcol, HA.CENTER);
        });

        // ---------- 页脚 ----------
        JJBView.box(root, 50, 646, 1180, 2, th.panelEdge);
        JJBView.label(root, 50, 662, 700, 22, EVENT.org + "　·　主播「" + EVENT.host + "」", 15, th.ink, HA.LEFT);
        JJBView.label(root, 600, 662, 630, 22, EVENT.links[0].k + " " + EVENT.links[0].v + "　　B站主播 " + EVENT.host, 15, th.muted, HA.RIGHT);
    }
}
