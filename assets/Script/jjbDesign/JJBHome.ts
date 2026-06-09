// 集结杯 × CM — 首页（程序化还原 design/v1 首页；token 驱动可切风格/明暗）
// onMode(i): 点击第 i 个模式按钮的回调（由 JJBDesignBoot 接到 XP 真实逻辑）。
import { Theme } from "./JJBTheme";
import { EVENT, MODES, markFor, FONT_NUM } from "./JJBData";
import JJBView from "./JJBView";

const HAlign = cc.Label.HorizontalAlign;

export default class JJBHome {

    static build(root: cc.Node, th: Theme, onMode?: (i: number) => void): void {
        JJBView.bg(root, th);

        // ---------- 联名 lockup（lg） ----------
        const markPath = markFor(th.style, th.mode);
        JJBView.sprite(root, 50, 34, 110, 88, markPath);
        JJBView.box(root, 178, 46, 3, 64, th.accent);
        // 标题艺术字整图（PIL 预渲染，含金属渐变/衬线/字距，替代 Label）
        const titleW = th.style === "sc2" ? 599 : th.style === "minimal" ? 666 : 585;
        const tH = 72, tW = Math.round(tH * titleW / 200);
        JJBView.sprite(root, 196, 26, tW, tH, "images/brand/jjb-title-" + th.style + "-" + th.mode);
        JJBView.label(root, 201, 102, 260, 18, EVENT.en, 13, th.accent, HAlign.LEFT, 255, FONT_NUM);

        // ---------- 副标 / 主办 ----------
        JJBView.label(root, 50, 134, 700, 26, EVENT.sub, 19, th.muted);
        JJBView.label(root, 50, 162, 900, 24, EVENT.org + "　·　B站主播「" + EVENT.host + "」", 16, th.muted);

        // ---------- 选手输入 ----------
        JJBView.label(root, 50, 205, 100, 26, "参赛选手", 19, th.ink);
        JJBView.box(root, 160, 198, 460, 50, th.panelBg, th.panelEdge, 1);
        JJBView.label(root, 178, 214, 300, 22, "请输入选手 ID", 17, th.muted);
        JJBView.box(root, 300, 211, 2, 24, th.accent); // caret

        // ---------- 比赛模式 ----------
        JJBView.label(root, 50, 306, 120, 18, "SELECT MODE", 13, th.accent, HAlign.LEFT, 255, FONT_NUM);
        JJBView.label(root, 156, 298, 200, 32, "比赛模式", 25, th.ink);

        const gridLeft = 50, gridTop = 348, colW = 381, rowH = 88, gapX = 18, gapY = 18;
        MODES.forEach((m, i) => {
            const col = i % 3, rowi = Math.floor(i / 3);
            const bx = gridLeft + col * (colW + gapX);
            const by = gridTop + rowi * (rowH + gapY);
            JJBHome.modeBtn(root, th, bx, by, colW, rowH, m.no, m.name, m.tag, i, () => { if (onMode) onMode(i); });
        });

        // ---------- 页脚 ----------
        JJBView.label(root, 50, 674, 360, 22, EVENT.org, 15, th.ink);
        const linkStr = EVENT.links[0].k + " " + EVENT.links[0].v + "      开黑群 " + EVENT.qq;
        JJBView.label(root, 700, 674, 540, 22, linkStr, 15, th.muted, HAlign.RIGHT);
    }

    private static modeBtn(root: cc.Node, th: Theme, bx: number, by: number, w: number, h: number,
                           no: string, name: string, tag: string, idx: number, onClick: () => void): void {
        if (th.style === "metal") {
            JJBView.cutBox(root, bx, by, w, h, th.panelBg, th.panelEdge, 1, 15);
            JJBView.box(root, bx, by, 4, h, th.accent); // 左侧金条
        } else {
            JJBView.box(root, bx, by, w, h, th.panelBg, th.panelEdge, 1);
        }
        JJBView.label(root, bx + 22, by + 28, 50, 34, no, 30, th.accent, HAlign.LEFT, 255, FONT_NUM);
        JJBView.label(root, bx + 74, by + 31, 220, 30, name, 23, th.ink);
        // 标签
        const tagW = 56;
        JJBView.box(root, bx + w - tagW - 22, by + 30, tagW, 26, null, th.panelEdge, 1);
        JJBView.label(root, bx + w - tagW - 22, by + 35, tagW, 18, tag, 13, th.muted, HAlign.CENTER);
        // 点击热区（盖在最上层）
        const hit = JJBView.hit(root, bx, by, w, h, onClick);
        hit.name = "jjbMode_" + idx; // 便于自动化点击断言定位
    }
}
