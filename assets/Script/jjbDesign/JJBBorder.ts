// 集结杯 v4 边框系统。只在 jjbDesign 内程序化复刻 design/v4 的因子框、指挥官卡与 toast。
import { Theme } from "./JJBTheme";
import { GOLD_FACTORS } from "./JJBData";
import JJBView from "./JJBView";

export interface FactorFrameOpts {
    gold?: boolean;
    sel?: boolean;
    dim?: boolean;
    drag?: boolean;
    filled?: boolean;
    tag?: string;
    check?: boolean;
    ghost?: boolean;
    local?: boolean;
    nodeName?: string;
}

export interface CmdFrameOpts {
    sel?: boolean;
    drag?: boolean;
    fill?: boolean;
    ghost?: boolean;
    check?: boolean;
    clearHover?: boolean;
    noName?: boolean;
}

const BLACK = cc.color(0, 0, 0, 255);
const SHADOW = cc.color(0, 0, 0, 108);
const INNER_LIGHT = cc.color(255, 255, 255, 44);
const NAME_BG = cc.color(0, 0, 0, 210);

export default class JJBBorder {
    static isGoldFactor(name: string): boolean {
        return !!name && GOLD_FACTORS.indexOf(name) >= 0;
    }

    static framedFactorV4(parent: cc.Node, left: number, top: number, size: number, name: string,
                          th: Theme, opts: FactorFrameOpts = {}): cc.Node {
        const gold = opts.gold === true || (opts.gold !== false && JJBBorder.isGoldFactor(name));
        const n = opts.local ? JJBBorder.localNode(parent, left, top, size, size) : JJBView.placed(parent, left, top, size, size);
        n.name = opts.nodeName || ("jjbFxV4_" + (name || "empty"));
        if (opts.ghost) {
            const g = n.addComponent(cc.Graphics);
            g.strokeColor = th.dropEdge;
            g.lineWidth = 1.5;
            g.roundRect(0, -size, size, size, 4);
            g.stroke();
            n.opacity = 95;
            return n;
        }

        const artInset = size * 0.055;
        const artSize = size * 0.89;
        const art = JJBBorder.localCoverSprite(n, artInset, artInset, artSize, artSize, "images/factor/" + name);
        art.opacity = opts.dim ? 100 : 255;
        if (th.mode === "light") {
            const u = Math.max(size / 66, 0.6);
            JJBBorder.localRoundBox(n, artInset, artInset, artSize, artSize, null, cc.color(10, 22, 34, 89), u, 2);
        }

        const frame = JJBBorder.vectorFactorFrame(n, size, gold, th);
        frame.opacity = opts.dim ? 140 : 255;

        if (opts.sel || opts.drag || opts.filled) JJBBorder.factorRing(n, size, gold, th, opts.sel ? 2 : 1);
        if (opts.check) JJBBorder.check(n, size - 10, -9, th);
        if (opts.tag) JJBBorder.factorTag(n, opts.tag, th, opts.tag === "锁定");
        if (opts.drag) {
            n.scale = 1.07;
            n.y += 2;
        } else if (opts.sel) {
            n.y += 3;
        }
        return n;
    }

    private static factorRing(parent: cc.Node, size: number, gold: boolean, th: Theme, lineW: number): void {
        const out = gold ? size * 0.08 + 2 : 2;
        const s = size + out * 2;
        const n = new cc.Node("fx-ring");
        n.parent = parent;
        n.setAnchorPoint(0, 1);
        n.setContentSize(s, s);
        n.setPosition(-out, out);
        const g = n.addComponent(cc.Graphics);
        g.strokeColor = th.accent;
        g.lineWidth = lineW;
        g.roundRect(0, -s, s, s, gold ? 8 : 5);
        g.stroke();
    }

    static framedCmdV4(parent: cc.Node, left: number, top: number, w: number, h: number, name: string,
                       th: Theme, opts: CmdFrameOpts = {}): cc.Node {
        const n = JJBView.placed(parent, left, top, w, h);
        n.name = "jjbCmdV4_" + (name || "empty");

        if (opts.ghost) {
            JJBBorder.localRoundBox(n, 0, 0, w, h, th.dropBg, th.dropEdge, 1.5, 6);
            n.opacity = 95;
            return n;
        }

        JJBBorder.localRoundBox(n, 1, 2, w, h, SHADOW, null, 0, 6);
        JJBBorder.localRoundBox(n, 0, 0, w, h, cc.color(10, 16, 24, 255), cc.color(0, 0, 0, 158), 1, 6);
        const art = JJBBorder.localCoverSprite(n, 2, 2, w - 4, h - 4, "images/commander/" + name);
        if (opts.sel) art.opacity = 205;

        const gloss = new cc.Node("gloss");
        gloss.parent = n;
        gloss.setAnchorPoint(0, 1);
        gloss.setPosition(2, -2);
        gloss.setContentSize(w - 4, Math.max(12, Math.round(h * 0.3)));
        const gg = gloss.addComponent(cc.Graphics);
        gg.fillColor = cc.color(255, 255, 255, 34);
        const glossH = Math.max(12, Math.round(h * 0.3));
        gg.roundRect(0, -glossH, w - 4, glossH, 4);
        gg.fill();

        if (!opts.noName && name) {
            const nb = new cc.Node("cmd-name-bg");
            nb.parent = n; nb.setAnchorPoint(0, 1); nb.setPosition(2, -(h - 18));
            nb.setContentSize(w - 4, 16);
            const ng = nb.addComponent(cc.Graphics);
            ng.rect(0, -16, w - 4, 16); ng.fillColor = NAME_BG; ng.fill();
            const fs = name.length >= 4 ? 10 : 10.5;
            JJBBorder.localLabel(n, 2, h - 16, w - 4, 13, name, fs, cc.Color.WHITE, cc.Label.HorizontalAlign.CENTER);
        }

        const inner = n.addComponent(cc.Graphics);
        inner.strokeColor = opts.fill ? cc.color(th.accent.r, th.accent.g, th.accent.b, 165) : INNER_LIGHT;
        inner.lineWidth = 1;
        inner.roundRect(2, -(h - 2), w - 4, h - 4, 4);
        inner.stroke();
        if (opts.sel || opts.drag) {
            const rg = n.addComponent(cc.Graphics);
            rg.strokeColor = th.accent;
            rg.lineWidth = 2;
            rg.roundRect(-2, -(h + 2), w + 4, h + 4, 7);
            rg.stroke();
            if (opts.check) JJBBorder.check(n, w - 10, -9, th);
        }
        if (opts.clearHover) JJBBorder.clearOverlay(n, w, h);
        if (opts.drag) n.scale = 1.06;
        else if (opts.sel) n.y += 2;
        return n;
    }

    static toastV4(parent: cc.Node, left: number, top: number, w: number, text: string,
                   count: number, th: Theme): cc.Node {
        const h = 38;
        const n = th.style === "metal"
            ? JJBView.cutBox(parent, left, top, w, h, JJBBorder.mix(th.lose, cc.color(8, 12, 19), th.mode === "light" ? 0.1 : 0.18), th.lose, 1, 9)
            : JJBView.box(parent, left, top, w, h, JJBBorder.mix(th.lose, th.mode === "light" ? cc.Color.WHITE : cc.color(8, 12, 19), th.mode === "light" ? 0.1 : 0.18), th.lose, 1);
        n.name = "jjbToastV4";
        JJBView.box(parent, left + 14, top + 10, 18, 18, th.lose, null);
        JJBView.label(parent, left + 14, top + 11, 18, 16, "!", 12, cc.Color.WHITE, cc.Label.HorizontalAlign.CENTER);
        JJBView.label(parent, left + 42, top + 10, w - 104, 18, text, 13.5, th.ink, cc.Label.HorizontalAlign.LEFT);
        if (count > 1) {
            JJBView.box(parent, left + w - 48, top + 10, 34, 18, th.lose, null);
            JJBView.label(parent, left + w - 48, top + 12, 34, 14, "+" + (count - 1), 11, cc.Color.WHITE, cc.Label.HorizontalAlign.CENTER, 255, "Oswald");
        }
        n.opacity = 0;
        n.x += 8;
        cc.tween(n)
            .to(0.2, { opacity: 255, x: n.x - 8 })
            .by(0.05, { x: 4 }).by(0.05, { x: -8 }).by(0.05, { x: 8 }).by(0.05, { x: -8 }).by(0.05, { x: 4 })
            .delay(3.7)
            .to(0.18, { opacity: 0 })
            .call(() => { if (cc.isValid(n)) n.destroy(); })
            .start();
        return n;
    }

    static factorTag(parent: cc.Node, text: string, th: Theme, lock: boolean): void {
        const w = text.length > 2 ? 42 : 34;
        const bg = lock ? cc.color(7, 11, 19, 225) : th.accent;
        const fg = lock ? th.accent : th.onAccent;
        JJBBorder.localBox(parent, -5, parent.height - 7, w, 15, bg, lock ? th.accent : null, 1);
        JJBBorder.localLabel(parent, -5, parent.height - 5, w, 12, text, 9, fg, cc.Label.HorizontalAlign.CENTER);
    }

    private static vectorFactorFrame(parent: cc.Node, size: number, gold: boolean, th: Theme): cc.Node {
        const scale = gold ? 1.16 : 1.06;
        const out = gold ? size * 0.08 : size * 0.03;
        const frameSize = size * scale;
        const n = new cc.Node("FrameG");
        n.parent = parent;
        n.setAnchorPoint(0, 1);
        n.setContentSize(frameSize, frameSize);
        n.setPosition(-out, out);
        const u = Math.max(size / 66, 0.6);
        if (gold) JJBBorder.drawGoldFactorFrame(n, frameSize, u, th);
        else JJBBorder.drawNormalFactorFrame(n, frameSize, u, th);
        return n;
    }

    private static drawNormalFactorFrame(frame: cc.Node, s: number, u: number, th: Theme): void {
        if (th.mode === "light") JJBBorder.strokeRound(frame, s, 0.5 * u, 2 * u, 3.2 * u, cc.color(10, 22, 34, 77), 0, -u);
        JJBBorder.strokeRound(frame, s, 0.5 * u, 1 * u, 3.2 * u, JJBBorder.hex("#0A130C", 242));
        JJBBorder.strokeRound(frame, s, 1.55 * u, 1.1 * u, 2.6 * u, JJBBorder.hex("#86AE6A"));
        JJBBorder.strokeRound(frame, s, 3.5 * u, 3 * u, 2.2 * u, JJBBorder.hex("#35522F"));
        JJBBorder.strokeLine(frame, 7 * u, 3.1 * u, s - 7 * u, 3.1 * u, 1 * u, JJBBorder.hex("#BCD9A0", 128));
        JJBBorder.strokeRound(frame, s, 5.5 * u, 1 * u, 1.4 * u, JJBBorder.hex("#111C13", 230));
        JJBBorder.strokeRound(frame, s, 6.5 * u, 1 * u, 1 * u, JJBBorder.hex("#9FC683", 230));
        JJBBorder.rivet(frame, 3.5 * u, 3.5 * u, 1.7 * u, 0.9 * u, JJBBorder.hex("#C2DBA4"), JJBBorder.hex("#16241A"));
        JJBBorder.rivet(frame, s - 3.5 * u, 3.5 * u, 1.7 * u, 0.9 * u, JJBBorder.hex("#C2DBA4"), JJBBorder.hex("#16241A"));
        JJBBorder.rivet(frame, 3.5 * u, s - 3.5 * u, 1.7 * u, 0.9 * u, JJBBorder.hex("#C2DBA4"), JJBBorder.hex("#16241A"));
        JJBBorder.rivet(frame, s - 3.5 * u, s - 3.5 * u, 1.7 * u, 0.9 * u, JJBBorder.hex("#C2DBA4"), JJBBorder.hex("#16241A"));
    }

    private static drawGoldFactorFrame(frame: cc.Node, s: number, u: number, th: Theme): void {
        if (th.mode === "light") JJBBorder.strokeRound(frame, s, 1.25 * u, 2 * u, 3.4 * u, cc.color(10, 22, 34, 77), 0, -u);
        JJBBorder.strokeRound(frame, s, 1.25 * u, 2.5 * u, 3.4 * u, JJBBorder.hex("#FFC846", 33));
        JJBBorder.strokeRound(frame, s, 2.4 * u, 1.8 * u, 3 * u, JJBBorder.hex("#FFCE54", 77));
        JJBBorder.strokeRound(frame, s, 3.5 * u, 1 * u, 2.6 * u, JJBBorder.hex("#3A2306", 242));
        JJBBorder.strokeRound(frame, s, 4.75 * u, 1.5 * u, 2.2 * u, JJBBorder.hex("#C98F26"));
        JJBBorder.strokeRound(frame, s, 7 * u, 3 * u, 1.8 * u, JJBBorder.hex("#F6C75A"));
        JJBBorder.strokeLine(frame, 9 * u, 6.5 * u, s - 9 * u, 6.5 * u, 1 * u, JJBBorder.hex("#FFEBAE", 191));
        JJBBorder.strokeRound(frame, s, 9.25 * u, 1.5 * u, 1.2 * u, JJBBorder.hex("#8F5E10"));
        JJBBorder.strokeRound(frame, s, 10.5 * u, 1 * u, 1 * u, JJBBorder.hex("#FFF4C9", 242));
        JJBBorder.diamond(frame, 7 * u, 7 * u, 4.6 * u, 0.9 * u, JJBBorder.hex("#FFE284"), JJBBorder.hex("#6B4708"));
        JJBBorder.diamond(frame, s - 7 * u, 7 * u, 4.6 * u, 0.9 * u, JJBBorder.hex("#FFE284"), JJBBorder.hex("#6B4708"));
        JJBBorder.diamond(frame, 7 * u, s - 7 * u, 4.6 * u, 0.9 * u, JJBBorder.hex("#FFE284"), JJBBorder.hex("#6B4708"));
        JJBBorder.diamond(frame, s - 7 * u, s - 7 * u, 4.6 * u, 0.9 * u, JJBBorder.hex("#FFE284"), JJBBorder.hex("#6B4708"));
    }

    private static graphicsLayer(parent: cc.Node, name: string, s: number): cc.Graphics {
        const n = new cc.Node(name);
        n.parent = parent;
        n.setAnchorPoint(0, 1);
        n.setContentSize(s, s);
        n.setPosition(0, 0);
        return n.addComponent(cc.Graphics);
    }

    private static strokeRound(parent: cc.Node, s: number, inset: number, lineW: number, r: number,
                               color: cc.Color, dx: number = 0, dy: number = 0): void {
        const g = JJBBorder.graphicsLayer(parent, "fxv-round", s);
        g.strokeColor = color;
        g.lineWidth = lineW;
        g.roundRect(inset + dx, -s + inset + dy, s - inset * 2, s - inset * 2, r);
        g.stroke();
    }

    private static strokeLine(parent: cc.Node, x1: number, y1: number, x2: number, y2: number,
                              lineW: number, color: cc.Color): void {
        const s = parent.width;
        const g = JJBBorder.graphicsLayer(parent, "fxv-line", s);
        g.strokeColor = color;
        g.lineWidth = lineW;
        g.moveTo(x1, -y1);
        g.lineTo(x2, -y2);
        g.stroke();
    }

    private static rivet(parent: cc.Node, cx: number, cy: number, r: number, lineW: number,
                         fill: cc.Color, edge: cc.Color): void {
        const s = parent.width;
        const g = JJBBorder.graphicsLayer(parent, "fxv-rivet", s);
        g.fillColor = fill;
        g.strokeColor = edge;
        g.lineWidth = lineW;
        g.circle(cx, -cy, r);
        g.fill();
        g.stroke();
        const gloss = JJBBorder.graphicsLayer(parent, "fxv-rivet-shade", s);
        gloss.strokeColor = cc.color(10, 19, 12, 89);
        gloss.lineWidth = Math.max(0.6, lineW);
        gloss.moveTo(cx - r * 0.55, -cy - r * 0.35);
        gloss.lineTo(cx + r * 0.55, -cy - r * 0.35);
        gloss.stroke();
    }

    private static diamond(parent: cc.Node, cx: number, cy: number, side: number, lineW: number,
                           fill: cc.Color, edge: cc.Color): void {
        const s = parent.width;
        const d = side / Math.SQRT2;
        const g = JJBBorder.graphicsLayer(parent, "fxv-diamond", s);
        g.fillColor = fill;
        g.strokeColor = edge;
        g.lineWidth = lineW;
        g.moveTo(cx, -(cy - d));
        g.lineTo(cx + d, -cy);
        g.lineTo(cx, -(cy + d));
        g.lineTo(cx - d, -cy);
        g.close();
        g.fill();
        g.stroke();
    }

    private static hex(hex: string, alpha: number = 255): cc.Color {
        const s = hex.replace("#", "");
        const n = parseInt(s, 16);
        return cc.color((n >> 16) & 255, (n >> 8) & 255, n & 255, alpha);
    }

    private static check(parent: cc.Node, x: number, y: number, th: Theme): void {
        JJBBorder.localRoundBox(parent, x, y, 21, 21, th.accent, null, 0, 10.5);
        JJBBorder.localLabel(parent, x, y + 4, 21, 15, "✓", 12, th.onAccent, cc.Label.HorizontalAlign.CENTER);
    }

    private static clearOverlay(parent: cc.Node, w: number, h: number): void {
        JJBBorder.localRoundBox(parent, 2, 2, w - 4, h - 4, cc.color(5, 8, 14, 158), null, 0, 4);
        JJBBorder.localRoundBox(parent, w / 2 - 10, h / 2 - 12, 20, 20, null, cc.Color.WHITE, 1.5, 10);
        JJBBorder.localLabel(parent, w / 2 - 10, h / 2 - 9, 20, 12, "×", 10, cc.Color.WHITE, cc.Label.HorizontalAlign.CENTER);
        if (h >= 64) JJBBorder.localLabel(parent, 0, h / 2 + 10, w, 12, "点击清除", 9.5, cc.Color.WHITE, cc.Label.HorizontalAlign.CENTER);
    }

    private static localSprite(parent: cc.Node, left: number, top: number, w: number, h: number,
                               resPath: string, cover: boolean): cc.Node {
        if (cover) return JJBBorder.localCoverSprite(parent, left, top, w, h, resPath);
        const n = JJBBorder.localNode(parent, left, top, w, h);
        const s = n.addComponent(cc.Sprite);
        s.sizeMode = cc.Sprite.SizeMode.CUSTOM; s.trim = false;
        cc.resources.load(resPath, cc.SpriteFrame, (err: Error, sf: cc.SpriteFrame) => {
            if (!err && sf && cc.isValid(n)) { s.spriteFrame = sf; n.setContentSize(w, h); }
        });
        return n;
    }

    private static localCoverSprite(parent: cc.Node, left: number, top: number, w: number, h: number, resPath: string): cc.Node {
        const box = JJBBorder.localNode(parent, left, top, w, h);
        const mask = box.addComponent(cc.Mask); mask.type = cc.Mask.Type.RECT;
        const inner = new cc.Node();
        inner.parent = box; inner.setAnchorPoint(0.5, 0.5); inner.setPosition(w / 2, -h / 2);
        const s = inner.addComponent(cc.Sprite); s.sizeMode = cc.Sprite.SizeMode.CUSTOM; s.trim = false;
        cc.resources.load(resPath, cc.SpriteFrame, (err: Error, sf: cc.SpriteFrame) => {
            if (err || !sf || !cc.isValid(inner)) return;
            s.spriteFrame = sf;
            const os = sf.getOriginalSize();
            const sc = Math.max(w / os.width, h / os.height);
            inner.setContentSize(os.width * sc, os.height * sc);
        });
        return box;
    }

    private static localBox(parent: cc.Node, left: number, top: number, w: number, h: number,
                            fill?: cc.Color, edge?: cc.Color, lineW: number = 1): cc.Node {
        const n = JJBBorder.localNode(parent, left, top, w, h);
        const g = n.addComponent(cc.Graphics);
        g.rect(0, -h, w, h);
        if (fill) { g.fillColor = fill; g.fill(); }
        if (edge) { g.strokeColor = edge; g.lineWidth = lineW; g.stroke(); }
        return n;
    }

    private static localRoundBox(parent: cc.Node, left: number, top: number, w: number, h: number,
                                 fill?: cc.Color, edge?: cc.Color, lineW: number = 1, r: number = 6): cc.Node {
        const n = JJBBorder.localNode(parent, left, top, w, h);
        const g = n.addComponent(cc.Graphics);
        g.roundRect(0, -h, w, h, r);
        if (fill) { g.fillColor = fill; g.fill(); }
        if (edge) { g.strokeColor = edge; g.lineWidth = lineW; g.stroke(); }
        return n;
    }

    private static localLabel(parent: cc.Node, left: number, top: number, w: number, h: number,
                              text: string, size: number, color: cc.Color,
                              align: number = cc.Label.HorizontalAlign.LEFT): cc.Node {
        const n = JJBBorder.localNode(parent, left, top, w, h);
        const l = n.addComponent(cc.Label);
        l.string = text; l.fontSize = size; l.lineHeight = Math.round(size * 1.2);
        l.horizontalAlign = align; l.verticalAlign = cc.Label.VerticalAlign.TOP;
        l.overflow = cc.Label.Overflow.CLAMP; l.enableWrapText = false;
        n.color = color;
        return n;
    }

    private static localNode(parent: cc.Node, left: number, top: number, w: number, h: number): cc.Node {
        const n = new cc.Node();
        n.parent = parent;
        n.setAnchorPoint(0, 1);
        n.setContentSize(w, h);
        n.setPosition(left, -top);
        return n;
    }

    private static mix(a: cc.Color, b: cc.Color, amountA: number): cc.Color {
        const t = Math.max(0, Math.min(1, amountA));
        return cc.color(
            Math.round(a.r * t + b.r * (1 - t)),
            Math.round(a.g * t + b.g * (1 - t)),
            Math.round(a.b * t + b.b * (1 - t)),
            235
        );
    }
}
