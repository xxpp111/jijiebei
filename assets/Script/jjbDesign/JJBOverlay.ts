// 集结杯 × CM — 常驻浮层（全屏直播记分板）。忠实还原 design/v1 Overlay + theme.css .ovf-*。
// GAP-17 动态化（OBS 浏览器源 + Interact 单窗口方案）：真实会话渲染 sessionMatches() 三场，
// 状态推导=已判定场→win/bonus/lose 徽章、首个未判定→live「进行中」高亮、其余→wait「待战」；
// 比分=winCount/3。standalone(?design=overlay)=DEMO 不变。onBack：「返回判定」切回 battle。
import { Theme } from "./JJBTheme";
import { EVENT, DEMO_MATCHES, markFor, FONT_NUM, jjbLive, sessionMatches, VAL_RESULT } from "./JJBData";
import JJBDoubles, { DOUBLES_CONFIG, doublesLive, doublesMatches } from "./JJBDoubles";
import JJBView from "./JJBView";
import JijieData from "../jijie2/JijieData"; // 只读 public static（比分/判定）

const HA = cc.Label.HorizontalAlign;
const ST_LABEL: { [k: string]: string } = { win: "胜利", live: "进行中", wait: "待战", bonus: "带奖励", lose: "失败" };

export default class JJBOverlay {

    static build(root: cc.Node, th: Theme, onBack?: () => void): void {
        JJBView.bg(root, th);
        const L = 56, R = 1224, W = R - L; // 内容区

        const doubles = doublesLive();
        const live = !doubles && jjbLive();
        const matches: any[] = doubles ? doublesMatches() : (live ? sessionMatches() : DEMO_MATCHES);
        const wl: number[] = doubles ? (JJBDoubles.winLoseList || []) : (live ? (JijieData.winLoseList || []) : []);
        // 状态推导（live）：已判定→对应徽章；首个未判定→进行中；其余→待战
        let liveAssigned = false;
        const statusOf = (i: number): string => {
            if (!live && !doubles) return matches[i].status;
            if (typeof wl[i] === "number") return VAL_RESULT[wl[i]];
            if (!liveAssigned) { liveAssigned = true; return "live"; }
            return "wait";
        };
        const sts: string[] = matches.map((m: any, i: number) => statusOf(i));
        const winCount = (live || doubles) ? wl.filter((v) => v === 1 || v === 2).length : 1;
        const totalMatches = doubles ? DOUBLES_CONFIG.matches : 3;
        try {
            const w: any = window; w.__jjbDebug = w.__jjbDebug || {};
            w.__jjbDebug.overlay = { live: live, doubles: doubles, score: winCount + " / " + totalMatches, statuses: sts.slice(), maps: matches.map((m: any) => m.map) };
            if (doubles) JJBDoubles.exposeDebug();
        } catch (e) { /* noop */ }

        // ---------- 头部 ----------
        JJBView.sprite(root, L, 38, 75, 60, markFor(th.style, th.mode));
        JJBView.box(root, L + 94, 46, 2, 46, th.accent);
        const tw = th.style === "sc2" ? 599 : th.style === "minimal" ? 666 : 585;
        const tH = 56, tWd = Math.round(tH * tw / 200);
        JJBView.sprite(root, L + 114, 36, tWd, tH, "images/brand/jjb-title-" + th.style + "-" + th.mode);
        JJBView.label(root, L + 116, 96, 320, 18, EVENT.en, 13, th.accent, HA.LEFT, 255, FONT_NUM);
        JJBView.label(root, 880, 30, 344, 66, winCount + " / " + totalMatches, 58, th.accent, HA.RIGHT, 255, FONT_NUM);
        JJBView.label(root, 900, 100, 324, 20, "当前获胜", 14, th.muted, HA.RIGHT);
        JJBView.box(root, L, 150, W, 2, th.panelEdge);

        // ---------- 三场 ----------
        const top0 = 178, H = 120, gap = 14;
        matches.forEach((m: any, i: number) => {
            const Y = top0 + i * (H + gap);
            const st = sts[i];
            JJBView.panel(root, L, Y, W, H, th);
            if (st === "live") JJBView.box(root, L, Y, W, H, null, th.accent, 2);

            // 场次 + 双打标
            JJBView.label(root, L + 24, Y + 22, 160, 32, m.slot, 24, th.ink);
            if (m.doubles) {
                JJBView.box(root, L + 24, Y + 64, 52, 24, null, th.accent, 1);
                JJBView.label(root, L + 24, Y + 68, 52, 18, "双打", 12, th.accent, HA.CENTER);
            }
            // 地图横幅（含烤进去的地图名艺术字）— cover 等比不压扁
            JJBView.coverSprite(root, 220, Y + (H - 51) / 2, 288, 51, "images/maps/" + m.map);
            // 指挥官头像
            let cx = 540;
            (m.cmds || []).forEach((c: string) => { JJBView.sprite(root, cx, Y + (H - 78) / 2, 64, 78, "images/commander/" + c); cx += 72; });
            // 因子图标
            let fx = m.doubles ? 700 : 624;
            (m.factors || []).forEach((f: string, k: number) => {
                const wrap = doubles;
                const size = wrap ? 43 : 54;
                const gapF = wrap ? 49 : 62;
                const x = fx + (wrap ? (k % 5) * gapF : k * gapF);
                const y = Y + (wrap ? (k < 5 ? 22 : 67) : (H - 54) / 2);
                JJBView.sprite(root, x, y, size, size, "images/factor/" + f);
                if (doubles && m.mutators && k < m.mutators.length) {
                    JJBView.box(root, x, y + size - 13, 34, 14, th.accent, null);
                    JJBView.label(root, x, y + size - 11, 34, 12, "官突", 9, th.onAccent, HA.CENTER);
                }
            });
            // 状态徽章
            const bw = 130, bxx = R - bw - 20, by = Y + (H - 46) / 2;
            let bg: cc.Color = null, edge: cc.Color = null, tcol = th.muted;
            if (st === "win") { bg = th.win; tcol = th.onAccent; }
            else if (st === "bonus") { bg = th.bonus; tcol = th.onAccent; }
            else if (st === "lose") { bg = th.lose; tcol = cc.Color.WHITE; }
            else if (st === "live") { bg = th.accent; tcol = th.onAccent; }
            else { edge = th.panelEdge; tcol = th.muted; }
            JJBView.box(root, bxx, by, bw, 46, bg, edge, 1);
            JJBView.label(root, bxx, by + 12, bw, 24, ST_LABEL[st] || st, 20, tcol, HA.CENTER);
        });

        // ---------- 页脚 ----------
        JJBView.box(root, L, 648, W, 2, th.panelEdge);
        JJBView.label(root, L, 664, 640, 22, EVENT.org + "　·　主播「" + EVENT.host + "」", 15, th.ink);
        JJBView.label(root, 700, 664, 524, 22,
            EVENT.links[0].k + " " + EVENT.links[0].v + "    B站主播 " + EVENT.host, 15, th.muted, HA.RIGHT);

        // ---------- 返回判定（右下角，经 JJBDesignBoot 切回 battle）----------
        if (onBack) {
            JJBView.box(root, 1078, 612, 146, 30, null, th.panelEdge, 1);
            JJBView.label(root, 1078, 618, 146, 18, "返回判定 ↩", 13, th.muted, HA.CENTER);
            const hit = JJBView.hit(root, 1078, 612, 146, 30, onBack);
            hit.name = "jjbToBattle";
        }
    }
}
