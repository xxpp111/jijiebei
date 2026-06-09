// 集结杯 × CM — 常驻浮层（全屏直播记分板）。忠实还原 design/v1 Overlay + theme.css .ovf-*。
// 真实游戏图标：地图横幅 / 指挥官头像 / 因子图标（resources/images/*）。数据暂用演示，后续接 XP。
import { Theme } from "./JJBTheme";
import { EVENT, DEMO_MATCHES, markFor, FONT_NUM } from "./JJBData";
import JJBView from "./JJBView";

const HA = cc.Label.HorizontalAlign;
const ST_LABEL: { [k: string]: string } = { win: "胜利", live: "进行中", wait: "待战", bonus: "带奖励", lose: "失败" };

export default class JJBOverlay {

    static build(root: cc.Node, th: Theme): void {
        JJBView.bg(root, th);
        const sc2 = th.style === "sc2";
        const L = 56, R = 1224, W = R - L; // 内容区

        // ---------- 头部 ----------
        JJBView.sprite(root, L, 38, 75, 60, markFor(th.style, th.mode));
        JJBView.box(root, L + 94, 46, 2, 46, th.accent);
        const tw = th.style === "sc2" ? 599 : th.style === "minimal" ? 666 : 585;
        const tH = 56, tWd = Math.round(tH * tw / 200);
        JJBView.sprite(root, L + 114, 36, tWd, tH, "images/brand/jjb-title-" + th.style + "-" + th.mode);
        JJBView.label(root, L + 116, 96, 320, 18, EVENT.en, 13, th.accent, HA.LEFT, 255, FONT_NUM);
        JJBView.label(root, 880, 30, 344, 66, "1 / 3", 58, th.accent, HA.RIGHT, 255, FONT_NUM);
        JJBView.label(root, 900, 100, 324, 20, "当前获胜", 14, th.muted, HA.RIGHT);
        JJBView.box(root, L, 150, W, 2, th.panelEdge);

        // ---------- 三场 ----------
        const top0 = 178, H = 120, gap = 14;
        DEMO_MATCHES.forEach((m, i) => {
            const Y = top0 + i * (H + gap);
            JJBView.panel(root, L, Y, W, H, th);
            if (m.status === "live") JJBView.box(root, L, Y, W, H, null, th.accent, 2);

            // 场次 + 双打标
            JJBView.label(root, L + 24, Y + 22, 160, 32, m.slot, 24, th.ink);
            if ((m as any).doubles) {
                JJBView.box(root, L + 24, Y + 64, 52, 24, null, th.accent, 1);
                JJBView.label(root, L + 24, Y + 68, 52, 18, "双打", 12, th.accent, HA.CENTER);
            }
            // 地图横幅（含烤进去的地图名艺术字）— cover 等比不压扁
            JJBView.coverSprite(root, 220, Y + (H - 64) / 2, 288, 64, "images/maps/" + m.map);
            // 指挥官头像
            let cx = 540;
            m.cmds.forEach((c) => { JJBView.sprite(root, cx, Y + (H - 78) / 2, 64, 78, "images/commander/" + c); cx += 72; });
            // 因子图标
            let fx = (m as any).doubles ? 700 : 624;
            const fy = Y + (H - 54) / 2;
            m.factors.forEach((f) => { JJBView.sprite(root, fx, fy, 54, 54, "images/factor/" + f); fx += 62; });
            // 状态徽章
            const bw = 130, bx = R - bw - 20, by = Y + (H - 46) / 2;
            let bg: cc.Color = null, edge: cc.Color = null, tcol = th.muted;
            if (m.status === "win") { bg = th.win; tcol = th.onAccent; }
            else if (m.status === "live") { bg = th.accent; tcol = th.onAccent; }
            else { edge = th.panelEdge; tcol = th.muted; }
            JJBView.box(root, bx, by, bw, 46, bg, edge, 1);
            JJBView.label(root, bx, by + 12, bw, 24, ST_LABEL[m.status] || m.status, 20, tcol, HA.CENTER);
        });

        // ---------- 页脚 ----------
        JJBView.box(root, L, 648, W, 2, th.panelEdge);
        JJBView.label(root, L, 664, 640, 22, EVENT.org + "　·　主播「" + EVENT.host + "」", 15, th.ink);
        JJBView.label(root, 700, 664, 524, 22,
            EVENT.links[0].k + " " + EVENT.links[0].v + "    B站主播 " + EVENT.host, 15, th.muted, HA.RIGHT);
    }
}
