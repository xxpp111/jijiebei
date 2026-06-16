// 集结杯 v4 R3 — ① BP 面板（开局二选一：Ban 1 因子 / 自选 1 指挥官）+ ② Ban 因子标记。
// 设计源 Claude Design 项目 b4fe41ec（bp-panel.jsx / r2.css / spec-r2.jsx），照其「Cocos 2.4 落地要点」程序化复刻。
// ?design=bp[&pick=A|B|none]。复用 JJBView 原语 + JJBBorder 因子框/指挥官卡 + JJBTheme token。
// 坐标系：JJBView.placed 硬假设父锚原点=屏幕中心，故不可 placed 套 placed；分组一律用 group()
// （全屏居中节点，锚 0.5,0.5、pos 0,0 → 锚原点落屏幕中心），坐标全用屏幕绝对值。dim 靠 group.opacity。
import { Theme } from "./JJBTheme";
import JJBView from "./JJBView";
import JJBBorder from "./JJBBorder";

const HA = cc.Label.HorizontalAlign;
const W = 1280, H = 720;
const OSWALD = "Oswald";
const SONG = "Songti SC, STSong, serif";

// demo 因子（design 的 void/nuke/blizzard/lava/zombie → Cocos 真实因子名）
const STAGE_FX = ["虚空裂隙", "核弹打击", "暴风雪", "岩浆爆发", "丧尸大战"];
const BAN_IDX = 1; // 核弹打击 被 ban

export default class JJBBp {

    /** 入口：在 root（1280×720）上画 BP 面板。pick: "A"|"B"|"none"。 */
    static build(root: cc.Node, th: Theme, pick: string = "A"): void {
        JJBView.bg(root, th);
        // 遮罩（拦截层）
        const mask = th.mode === "light" ? cc.color(18, 32, 52, 87) : cc.color(4, 8, 14, 163);
        JJBView.box(root, 0, 0, W, H, mask);

        // 弹层 760×432 居中（直接画进 root，绝对坐标）
        const DW = 760, DH = 432;
        const dx = Math.round((W - DW) / 2), dy = Math.round((H - DH) / 2);
        JJBBp.panel(root, dx, dy, DW, DH, th, true, 18);

        // kicker / title / sub
        JJBView.label(root, dx, dy + 24, DW, 16, "BP PHASE", 12, th.accent, HA.CENTER, 255, OSWALD);
        JJBView.label(root, dx, dy + 44, DW, 34, "BP 阶段 · 二选一", 26, th.ink, HA.CENTER, 255, th.serifTitle ? SONG : undefined);
        JJBView.label(root, dx, dy + 84, DW, 18, "本局赛制：单选 · Ban 1 个因子 或 自选 1 名指挥官", 13.5, th.muted, HA.CENTER);

        // 两卡（绝对坐标）
        const pad = 36, gap = 18;
        const cw = Math.floor((DW - pad * 2 - gap) / 2); // 335
        const cy = dy + 114, ch = 220;
        const aX = dx + pad, bX = dx + pad + cw + gap;
        JJBBp.card(root, aX, cy, cw, ch, th, "A", "Ban 因子", "禁掉 1 个不想要的因子", "禁 1",
            "系统揉出一排因子 · 划掉 1 个 禁用", pick === "A", pick === "B", false);
        JJBBp.card(root, bX, cy, cw, ch, th, "B", "自选指挥官", "自选 1 名上场指挥官", "选 1",
            "从全量指挥官中自选 1 名", pick === "B", pick === "A", true);

        // 中线「或」
        JJBBp.orBadge(root, Math.round(dx + DW / 2 - 17), Math.round(cy + ch / 2 - 17), th);

        // 确认按钮
        const enabled = pick === "A" || pick === "B";
        JJBBp.confirm(root, Math.round(dx + DW / 2 - 110), cy + ch + 24, 220, 46, th, enabled);

        JJBBp.exposeDebug(pick, th);
    }

    /** 全屏居中分组节点（锚 0.5,0.5、pos 0,0）→ 锚原点落屏幕中心，placed 在其内坐标正确；整组可 dim。 */
    private static group(parent: cc.Node): cc.Node {
        const ds = cc.view.getDesignResolutionSize();
        const n = new cc.Node("jjbBpGroup");
        n.setAnchorPoint(0.5, 0.5);
        n.setContentSize(ds.width, ds.height);
        n.parent = parent;
        n.setPosition(0, 0);
        return n;
    }

    // ============ 单卡（A=因子排 / B=指挥官卡），全部绝对坐标 ============
    private static card(root: cc.Node, x: number, y: number, w: number, h: number, th: Theme,
                        letter: string, title: string, sub: string, modeTag: string, cap: string,
                        sel: boolean, dim: boolean, isCmd: boolean): void {
        const g = JJBBp.group(root);
        if (dim) g.opacity = 153; // 0.6
        JJBBp.panel(g, x, y, w, h, th, false, 14);

        // 头：字母徽标 + 标题/副标题 + mode tag
        JJBBp.letterBadge(g, x + 16, y + 18, th, letter, dim);
        JJBView.label(g, x + 64, y + 18, w - 130, 24, title, 19, th.ink, HA.LEFT);
        JJBView.label(g, x + 64, y + 43, w - 130, 16, sub, 12, th.muted, HA.LEFT);
        JJBBp.modeTag(g, x + w - 16, y + 19, th, modeTag, sel);

        // 舞台
        const stageTop = y + 74;
        if (!isCmd) {
            const fs = 44, fgap = 10;
            const blockW = STAGE_FX.length * fs + (STAGE_FX.length - 1) * fgap;
            const sx = x + Math.round((w - blockW) / 2);
            STAGE_FX.forEach((name, i) => {
                const fx = sx + i * (fs + fgap);
                JJBBorder.framedFactorV4(g, fx, stageTop, fs, name, th, { gold: false });
                if (i === BAN_IDX) JJBBp.banMark(g, fx, stageTop, fs, th);
            });
        } else {
            const cwd = 68, chd = 82;
            JJBBorder.framedCmdV4(g, x + Math.round((w - cwd) / 2), stageTop, cwd, chd, "阿塔尼斯", th,
                { sel: sel, check: sel, noName: false });
        }

        // 底部说明
        JJBView.label(g, x + 8, y + h - 26, w - 16, 16, cap, 11.5, th.muted, HA.CENTER);

        // 选中描边（accent 2px）+ ✓ 角标 —— 画进 root 顶层，不被 dim
        if (sel) {
            JJBBp.panel(root, x - 1, y - 1, w + 2, h + 2, th, false, 14, th.accent, 2, true);
            JJBBp.checkBadge(root, x + w - 13, y - 14, th);
        }
    }

    // ============ ② Ban 因子标记（红描边 + 灰膜 + ⊘ 红角标）============
    private static banMark(parent: cc.Node, x: number, y: number, size: number, th: Theme): void {
        const inset = size * 0.055, art = size * 0.89;
        JJBView.box(parent, x + inset, y + inset, art, art, cc.color(8, 10, 16, 107)); // 灰膜
        JJBView.box(parent, x, y, size, size, null, th.lose, 2);                        // 红描边
        const d = Math.round(size * 0.54);
        JJBBp.circle(parent, Math.round(x + size / 2 - d / 2), Math.round(y + size / 2 - d / 2), d, th.lose);
        JJBView.label(parent, x, Math.round(y + size / 2 - size * 0.25), size, Math.round(size * 0.5),
            "⊘", Math.round(size * 0.42), cc.Color.WHITE, HA.CENTER);
    }

    // ============ 字母徽标 A/B ============
    private static letterBadge(parent: cc.Node, x: number, y: number, th: Theme, ch: string, dim: boolean): void {
        const fill = dim ? th.panelEdge : th.accent;
        const fg = dim ? th.ink : th.onAccent;
        if (th.style === "metal") JJBView.cutBox(parent, x, y, 36, 36, fill, null, 0, 7);
        else if (th.style === "minimal") JJBBp.roundBox(parent, x, y, 36, 36, fill, null, 0, 6);
        else JJBView.box(parent, x, y, 36, 36, fill);
        JJBView.label(parent, x, y + 6, 36, 26, ch, 22, fg, HA.CENTER, 255, OSWALD);
    }

    // ============ mode tag（右上小标，right = 右边缘 x）============
    private static modeTag(parent: cc.Node, right: number, top: number, th: Theme, text: string, sel: boolean): void {
        const tw = text.length * 11 + 20;
        const x = right - tw;
        if (sel) JJBView.box(parent, x, top, tw, 20, th.accent);
        else JJBView.box(parent, x, top, tw, 20, null, th.panelEdge, 1);
        JJBView.label(parent, x, top + 4, tw, 14, text, 11, sel ? th.onAccent : th.muted, HA.CENTER);
    }

    // ============ 「或」中线徽标 ============
    private static orBadge(parent: cc.Node, x: number, y: number, th: Theme): void {
        JJBBp.circle(parent, x, y, 34, JJBBp.mix(th.bgA, th.bgB), th.panelEdge, 1);
        JJBView.label(parent, x, y + 9, 34, 16, "或", 13, th.muted, HA.CENTER);
    }

    // ============ ✓ 角标 ============
    private static checkBadge(parent: cc.Node, x: number, y: number, th: Theme): void {
        JJBBp.circle(parent, x, y, 27, th.accent);
        JJBView.label(parent, x, y + 5, 27, 17, "✓", 15, th.onAccent, HA.CENTER);
    }

    // ============ 确认按钮（启用=金底 / 禁用=灰底）============
    private static confirm(parent: cc.Node, x: number, y: number, w: number, h: number, th: Theme, enabled: boolean): void {
        const fill = enabled ? th.accent : th.panelBg;
        const fg = enabled ? th.onAccent : th.muted;
        const edge = enabled ? null : th.panelEdge;
        if (th.style === "metal") JJBView.cutBox(parent, x, y, w, h, fill, edge, 1, 13);
        else if (th.style === "minimal") JJBBp.roundBox(parent, x, y, w, h, fill, edge, 1, 8);
        else JJBView.box(parent, x, y, w, h, fill, edge, 1);
        JJBView.label(parent, x, y + (h - 20) / 2, w, 22, "确认 BP  ▶", 18, fg, HA.CENTER);
    }

    // ============ 弹层/卡 面板 chrome（metal 切角 / sc2 角刻线 / minimal 圆角）============
    private static panel(parent: cc.Node, x: number, top: number, w: number, h: number, th: Theme,
                         dialog: boolean, cut: number, edgeOverride?: cc.Color, lw: number = 1, frameOnly: boolean = false): void {
        const fill = frameOnly ? null : (dialog ? JJBBp.mix(JJBBp.darken(th.bgA), th.bgB) : th.panelBg);
        const edge = edgeOverride || th.panelEdge;
        if (th.style === "metal") JJBView.cutBox(parent, x, top, w, h, fill, edge, lw, cut);
        else if (th.style === "minimal") JJBBp.roundBox(parent, x, top, w, h, fill, edge, lw, dialog ? 12 : 8);
        else {
            JJBView.box(parent, x, top, w, h, fill, edge, lw);
            JJBView.cornerTicks(parent, x, top, w, h, th.accent, dialog ? 16 : 13, 2);
        }
    }

    // ============ 工具 ============
    private static roundBox(parent: cc.Node, left: number, top: number, w: number, h: number,
                            fill: cc.Color, edge: cc.Color, lineW: number, r: number): cc.Node {
        const n = JJBView.placed(parent, left, top, w, h);
        const g = n.addComponent(cc.Graphics);
        g.roundRect(0, -h, w, h, r);
        if (fill) { g.fillColor = fill; g.fill(); }
        if (edge) { g.strokeColor = edge; g.lineWidth = lineW; g.stroke(); }
        return n;
    }

    private static circle(parent: cc.Node, left: number, top: number, size: number,
                          fill: cc.Color, edge?: cc.Color, lineW: number = 1): cc.Node {
        const n = JJBView.placed(parent, left, top, size, size);
        const g = n.addComponent(cc.Graphics);
        g.circle(size / 2, -size / 2, size / 2);
        if (fill) { g.fillColor = fill; g.fill(); }
        if (edge) { g.strokeColor = edge; g.lineWidth = lineW; g.stroke(); }
        return n;
    }

    private static mix(a: cc.Color, b: cc.Color): cc.Color {
        return cc.color(Math.round((a.r + b.r) / 2), Math.round((a.g + b.g) / 2), Math.round((a.b + b.b) / 2), 255);
    }
    private static darken(c: cc.Color): cc.Color {
        return cc.color(Math.round(c.r * 0.9), Math.round(c.g * 0.9), Math.round(c.b * 0.9), 255);
    }

    private static exposeDebug(pick: string, th: Theme): void {
        try {
            const w: any = window;
            w.__jjbDebug = w.__jjbDebug || {};
            w.__jjbDebug.bp = { pick: pick, style: th.style, mode: th.mode, cards: 2, banIdx: BAN_IDX };
        } catch (e) { /* noop */ }
    }
}
