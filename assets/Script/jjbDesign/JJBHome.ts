// 集结杯 × CM — 首页（程序化还原 design/v1 首页；token 驱动可切风格/明暗）
// onMode(i): 点击第 i 个模式按钮的回调（由 JJBDesignBoot 接到 XP 真实逻辑）。
import { Theme } from "./JJBTheme";
import { EVENT, MODES, markFor, FONT_NUM } from "./JJBData";
import JJBView from "./JJBView";

const HAlign = cc.Label.HorizontalAlign;

export default class JJBHome {

    static build(root: cc.Node, th: Theme, onMode?: (i: number) => void): void {
        JJBView.bg(root, th);

        // ---------- 联名 lockup（lg，放大强化 CM×集结杯）----------
        const markPath = markFor(th.style, th.mode);
        JJBView.sprite(root, 46, 30, 125, 100, markPath);          // 金 logo 100高(超 v3 88，联名更突出)
        JJBView.box(root, 189, 43, 3, 74, th.accent);              // 竖线 3×74
        // 标题艺术字整图（PIL 预渲染，放大）
        const titleW = th.style === "sc2" ? 599 : th.style === "minimal" ? 666 : 585;
        const tH = 84, tW = Math.round(tH * titleW / 200);
        JJBView.sprite(root, 212, 30, tW, tH, "images/brand/jjb-title-" + th.style + "-" + th.mode);
        JJBView.label(root, 216, 120, 300, 22, EVENT.en, 16, th.accent, HAlign.LEFT, 255, FONT_NUM);

        // ---------- 副标 / 主办 ----------
        JJBView.label(root, 46, 152, 700, 28, EVENT.sub, 20, th.muted);
        JJBView.label(root, 46, 182, 900, 24, EVENT.org + "　·　B站主播「" + EVENT.host + "」", 16, th.muted);

        // ---------- 选手输入 ----------
        JJBView.label(root, 46, 226, 100, 28, "参赛选手", 20, th.ink);
        JJBView.box(root, 158, 218, 470, 54, th.panelBg, th.panelEdge, 1);
        JJBView.label(root, 176, 235, 300, 24, "请输入选手 ID", 17, th.muted);
        JJBView.box(root, 298, 232, 2, 26, th.accent); // caret

        // ---------- 比赛模式 ----------
        JJBView.label(root, 46, 300, 120, 18, "SELECT MODE", 13, th.accent, HAlign.LEFT, 255, FONT_NUM);
        JJBView.label(root, 152, 292, 200, 32, "比赛模式", 25, th.ink);

        const gridLeft = 46, gridTop = 338, colW = 384, rowH = 104, gapX = 18, gapY = 18;
        MODES.forEach((m, i) => {
            const col = i % 3, rowi = Math.floor(i / 3);
            const bx = gridLeft + col * (colW + gapX);
            const by = gridTop + rowi * (rowH + gapY);
            JJBHome.modeBtn(root, th, bx, by, colW, rowH, m.no, m.name, m.tag, i, () => { if (onMode) onMode(i); });
        });

        // ---------- 页脚 ----------
        JJBView.label(root, 46, 676, 360, 22, EVENT.org, 15, th.ink);
        const linkStr = EVENT.links[0].k + " " + EVENT.links[0].v + "      开黑群 " + EVENT.qq;
        JJBView.label(root, 700, 676, 534, 22, linkStr, 15, th.muted, HAlign.RIGHT);
    }

    private static modeBtn(root: cc.Node, th: Theme, bx: number, by: number, w: number, h: number,
                           no: string, name: string, tag: string, idx: number, onClick: () => void): void {
        JJBView.panel(root, bx, by, w, h, th); // 切角(metal)/四角刻线(sc2)/直角(minimal)
        if (th.style === "metal") JJBView.box(root, bx, by, 4, h, th.accent); // 左侧金条
        JJBView.label(root, bx + 26, by + 35, 56, 40, no, 33, th.accent, HAlign.LEFT, 255, FONT_NUM);
        JJBView.label(root, bx + 84, by + 39, 210, 32, name, 25, th.ink);
        // 标签
        const tagW = 60;
        JJBView.box(root, bx + w - tagW - 24, by + 39, tagW, 28, null, th.panelEdge, 1);
        JJBView.label(root, bx + w - tagW - 24, by + 44, tagW, 18, tag, 13, th.muted, HAlign.CENTER);
        // 点击热区（盖在最上层）
        const hit = JJBView.hit(root, bx, by, w, h, onClick);
        hit.name = "jjbMode_" + idx; // 便于自动化点击断言定位
    }
}
