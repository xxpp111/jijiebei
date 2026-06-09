// 集结杯 × CM — 首页（程序化还原 design/v1 首页；token 驱动可切风格/明暗）
// onMode(i): 点击第 i 个模式按钮的回调（由 JJBDesignBoot 接到 XP 真实逻辑）。
import { Theme } from "./JJBTheme";
import { EVENT, MODES, markFor, FONT_NUM } from "./JJBData";
import JJBView from "./JJBView";

const HAlign = cc.Label.HorizontalAlign;

export default class JJBHome {

    static build(root: cc.Node, th: Theme, onMode?: (i: number) => void,
                 nameInit?: string, onName?: (s: string) => void): void {
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

        // ---------- 选手输入（GAP-16：cc.EditBox 真实输入，web 平台 DOM overlay 自动跟随节点）----------
        JJBView.label(root, 46, 226, 100, 28, "参赛选手", 20, th.ink);
        JJBView.box(root, 158, 218, 470, 54, th.panelBg, th.panelEdge, 1);
        const ebNode = JJBView.placed(root, 172, 227, 442, 38);
        ebNode.name = "jjbName"; // 便于自动化定位
        // 程序化 EditBox：textLabel/placeholderLabel 须手工建并指派（编辑器外创建为空时，失焦后文本不可见）
        const mkLbl = (txt: string, color: cc.Color): cc.Label => {
            const n = new cc.Node();
            n.parent = ebNode;
            n.setAnchorPoint(0, 1);
            n.setPosition(6, -7);
            const l = n.addComponent(cc.Label);
            l.string = txt;
            l.fontSize = 17;
            l.lineHeight = 24;
            l.horizontalAlign = HAlign.LEFT;
            l.verticalAlign = cc.Label.VerticalAlign.TOP;
            l.overflow = cc.Label.Overflow.NONE;
            n.color = color;
            return l;
        };
        const eb = ebNode.addComponent(cc.EditBox);
        eb.inputMode = cc.EditBox.InputMode.SINGLE_LINE;
        eb.returnType = cc.EditBox.KeyboardReturnType.DONE;
        eb.maxLength = 20;
        eb.textLabel = mkLbl("", th.ink);
        eb.placeholderLabel = mkLbl("请输入选手 ID", th.muted);
        eb.string = nameInit || "";
        const report = () => { if (onName) onName(eb.string); };
        ebNode.on("text-changed", report);
        ebNode.on("editing-did-ended", report);

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
