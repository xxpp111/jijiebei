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
        const n = JJBView.placed(parent, left, top, size, size);
        n.name = "jjbFxV4_" + (name || "empty");
        if (opts.sel || opts.drag || opts.filled) {
            const ring = n.addComponent(cc.Graphics);
            ring.strokeColor = th.accent;
            ring.lineWidth = opts.sel ? 2 : 1;
            ring.roundRect(-2, -(size + 2), size + 4, size + 4, 5);
            ring.stroke();
        }
        if (opts.ghost) {
            const g = n.addComponent(cc.Graphics);
            g.strokeColor = th.dropEdge;
            g.lineWidth = 1.5;
            g.roundRect(0, -size, size, size, 4);
            g.stroke();
            n.opacity = 95;
            return n;
        }

        const artInset = Math.round(size * (gold ? 0.09 : 0.07));
        const artSize = size - artInset * 2;
        const art = JJBBorder.localSprite(n, artInset, artInset, artSize, artSize, "images/factor/" + name, false);
        art.opacity = opts.dim ? 100 : 255;
        if (opts.dim) n.opacity = 150;

        const framePad = gold ? -Math.round(size * 0.05) : 0;
        const frameSize = gold ? Math.round(size * 1.1) : size;
        const frame = JJBBorder.localSprite(n, framePad, framePad, frameSize, frameSize,
            gold ? "images/brand/border-factor-gold" : "images/brand/border-factor-normal", false);
        frame.opacity = opts.dim ? 140 : 255;

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

    private static factorTag(parent: cc.Node, text: string, th: Theme, lock: boolean): void {
        const w = text.length > 2 ? 42 : 34;
        const bg = lock ? cc.color(7, 11, 19, 225) : th.accent;
        const fg = lock ? th.accent : th.onAccent;
        JJBBorder.localBox(parent, -5, parent.height - 7, w, 15, bg, lock ? th.accent : null, 1);
        JJBBorder.localLabel(parent, -5, parent.height - 5, w, 12, text, 9, fg, cc.Label.HorizontalAlign.CENTER);
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
        const n = new cc.Node();
        n.parent = parent; n.setAnchorPoint(0, 1); n.setContentSize(w, h); n.setPosition(left, -top);
        const s = n.addComponent(cc.Sprite);
        s.sizeMode = cc.Sprite.SizeMode.CUSTOM; s.trim = false;
        cc.resources.load(resPath, cc.SpriteFrame, (err: Error, sf: cc.SpriteFrame) => {
            if (!err && sf && cc.isValid(n)) { s.spriteFrame = sf; n.setContentSize(w, h); }
        });
        return n;
    }

    private static localCoverSprite(parent: cc.Node, left: number, top: number, w: number, h: number, resPath: string): cc.Node {
        const box = new cc.Node();
        box.parent = parent; box.setAnchorPoint(0, 1); box.setContentSize(w, h); box.setPosition(left, -top);
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
        const n = new cc.Node();
        n.parent = parent; n.setAnchorPoint(0, 1); n.setContentSize(w, h); n.setPosition(left, -top);
        const g = n.addComponent(cc.Graphics);
        g.rect(0, -h, w, h);
        if (fill) { g.fillColor = fill; g.fill(); }
        if (edge) { g.strokeColor = edge; g.lineWidth = lineW; g.stroke(); }
        return n;
    }

    private static localRoundBox(parent: cc.Node, left: number, top: number, w: number, h: number,
                                 fill?: cc.Color, edge?: cc.Color, lineW: number = 1, r: number = 6): cc.Node {
        const n = new cc.Node();
        n.parent = parent; n.setAnchorPoint(0, 1); n.setContentSize(w, h); n.setPosition(left, -top);
        const g = n.addComponent(cc.Graphics);
        g.roundRect(0, -h, w, h, r);
        if (fill) { g.fillColor = fill; g.fill(); }
        if (edge) { g.strokeColor = edge; g.lineWidth = lineW; g.stroke(); }
        return n;
    }

    private static localLabel(parent: cc.Node, left: number, top: number, w: number, h: number,
                              text: string, size: number, color: cc.Color,
                              align: number = cc.Label.HorizontalAlign.LEFT): cc.Node {
        const n = new cc.Node();
        n.parent = parent; n.setAnchorPoint(0, 1); n.setContentSize(w, h); n.setPosition(left, -top);
        const l = n.addComponent(cc.Label);
        l.string = text; l.fontSize = size; l.lineHeight = Math.round(size * 1.2);
        l.horizontalAlign = align; l.verticalAlign = cc.Label.VerticalAlign.TOP;
        l.overflow = cc.Label.Overflow.CLAMP; l.enableWrapText = false;
        n.color = color;
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
