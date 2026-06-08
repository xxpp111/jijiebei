// 集结杯 × CM — 结算页。忠实还原 design/v1 Result + theme.css .result-banner/.result-score/.rs-num/.rcard/.rcard-badge。
// 大比分 = 获胜场数(winCount + winbCount) + 战绩卡列表，读 JijieData 记分。DEMO 预设 winLoseList。0 改 jijie2 源码。
import { Theme } from "./JJBTheme";
import { DEMO_MATCHES, MARK, EVENT, FONT_NUM, RESULT_LABEL, RESULT_VAL, VAL_RESULT } from "./JJBData";
import JJBView from "./JJBView";
import JijieData from "../jijie2/JijieData"; // 只读写 public static（goal 允许；不改源码）

const HA = cc.Label.HorizontalAlign;
const ON_STATE = cc.color(11, 18, 6); // --on-state #0b1206（win/bonus 徽章字色）

export default class JJBResult {

    static build(root: cc.Node, th: Theme): void {
        JJBView.bg(root, th);

        // ---------- TopBar（同对战页） ----------
        JJBView.sprite(root, 50, 30, 52, 42, MARK[th.style] || MARK["metal"]);
        const titleW = th.style === "sc2" ? 599 : th.style === "minimal" ? 666 : 585;
        const tH = 42, tWd = Math.round(tH * titleW / 200);
        JJBView.sprite(root, 116, 30, tWd, tH, "images/brand/jjb-title-" + th.style);
        JJBView.label(root, 760, 30, 470, 20, "当前选手  Potato_01", 15, th.muted, HA.RIGHT);
        JJBView.label(root, 760, 54, 470, 20, "比赛模式  8 因子 · 手选", 15, th.ink, HA.RIGHT);

        // ---------- 记分（DEMO winLoseList → 重算；读 JijieData public static） ----------
        JijieData.winLoseList = DEMO_MATCHES.map((m: any) => RESULT_VAL[m.result]);
        const wl = JijieData.winLoseList || [];
        JijieData.winCount = wl.filter((v) => v === 1).length;
        JijieData.winbCount = wl.filter((v) => v === 2).length;
        JijieData.totalCount = wl.filter((v) => v === 0 || v === 1 || v === 2).length;
        const wins = (JijieData.winCount || 0) + (JijieData.winbCount || 0); // 获胜场数 = 胜利 + 带奖励
        try {
            const w: any = window; w.__jjbDebug = w.__jjbDebug || {};
            w.__jjbDebug.result = { wins: wins, winLoseList: wl.slice(), winCount: JijieData.winCount, winbCount: JijieData.winbCount };
        } catch (e) { /* noop */ }

        // ---------- banner（kicker / 大比分 / tag） ----------
        JJBView.label(root, 340, 124, 600, 18, "MATCH COMPLETE · 比赛结束", 15, th.accent, HA.CENTER, 255, FONT_NUM);
        JJBView.label(root, 480, 148, 160, 116, String(wins), 108, th.accent, HA.RIGHT, 255, FONT_NUM); // rs-num，右边缘≈640（居中）
        JJBView.label(root, 654, 222, 320, 36, "/ 3 场获胜", 30, th.ink, HA.LEFT);                       // rs-unit
        JJBView.label(root, 440, 274, 400, 24, wins === 3 ? "完美通关" : "本局战绩", 17, th.muted, HA.CENTER);

        // ---------- 战绩卡列表（max-width 900 居中 → x[190,1090]） ----------
        const listX = 190, listW = 900, rH = 92, gap = 12, list0 = 318;
        DEMO_MATCHES.forEach((m: any, i: number) => {
            const top = list0 + i * (rH + gap);
            const res = VAL_RESULT[wl[i]] || m.result;
            JJBView.box(root, listX, top, listW, rH, th.panelBg, th.panelEdge, 1);

            // rcard-no
            JJBView.label(root, listX + 18, top + 37, 90, 22, m.slot, 19, th.ink, HA.LEFT);
            // mapthumb 200×36
            JJBView.coverSprite(root, listX + 126, top + 28, 200, 36, "images/maps/" + m.map);
            // rcard-mid：cmds(58×70) + facs(38×38)
            const mx = listX + 344;
            m.cmds.forEach((c: string, k: number) => JJBView.coverSprite(root, mx + k * 64, top + 11, 58, 70, "images/commander/" + c));
            const facX = mx + m.cmds.length * 58 + (m.cmds.length - 1) * 6 + 14;
            m.factors.forEach((f: string, k: number) => JJBView.sprite(root, facX + k * 45, top + 27, 38, 38, "images/factor/" + f));
            // rcard-badge（按 result 配色）
            const bw = res === "bonus" ? 84 : 68;
            let bfill = th.win, bcol: cc.Color = ON_STATE;
            if (res === "bonus") { bfill = th.bonus; bcol = ON_STATE; }
            else if (res === "lose") { bfill = th.lose; bcol = cc.Color.WHITE; }
            JJBView.box(root, listX + listW - 18 - bw, top + 30, bw, 32, bfill, null);
            JJBView.label(root, listX + listW - 18 - bw, top + 36, bw, 20, RESULT_LABEL[res], 16, bcol, HA.CENTER);
        });

        // ---------- 页脚 ----------
        JJBView.box(root, 50, 646, 1180, 2, th.panelEdge);
        JJBView.label(root, 50, 662, 700, 22, EVENT.org + "　·　主播「" + EVENT.host + "」", 15, th.ink, HA.LEFT);
        JJBView.label(root, 600, 662, 630, 22, EVENT.links[0].k + " " + EVENT.links[0].v + "　　B站主播 " + EVENT.host, 15, th.muted, HA.RIGHT);
    }
}
