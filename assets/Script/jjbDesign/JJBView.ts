// 集结杯 × CM — 结构渲染助手（程序化建 Cocos 节点树）
// 设计坐标系：以 1280×720 root（锚点 .5,.5）为基准，用「左上角 + 向右/向下」描述布局，
// 内部转换为 Cocos 中心原点、y 向上的局部坐标。便于直接照搬 design CSS 的 left/top/w/h。
import { Theme } from "./JJBTheme";

const HALF_W = 640;
const HALF_H = 360;

export default class JJBView {

    /** 建一个铺满画布的 1280×720 root（挂在 Canvas 下，居中）。 */
    static root1280(stage: cc.Node): cc.Node {
        const root = new cc.Node("JJBDesignRoot");
        root.setAnchorPoint(0.5, 0.5);
        root.setContentSize(1280, 720);
        const canvas = cc.Canvas.instance ? cc.Canvas.instance.node : stage;
        root.parent = canvas;
        root.setPosition(0, 0);
        return root;
    }

    /** 在 root 内按 (left,top,w,h) 放一个节点（默认左上角锚点）。 */
    static placed(parent: cc.Node, left: number, top: number, w: number, h: number, ax: number = 0, ay: number = 1): cc.Node {
        const n = new cc.Node();
        n.setAnchorPoint(ax, ay);
        n.setContentSize(w, h);
        n.parent = parent;
        n.setPosition(-HALF_W + left, HALF_H - top);
        return n;
    }

    /** 实心 / 描边矩形（左上锚点，向右下绘制）。 */
    static box(parent: cc.Node, left: number, top: number, w: number, h: number,
               fill?: cc.Color, edge?: cc.Color, lineW: number = 1): cc.Node {
        const n = JJBView.placed(parent, left, top, w, h);
        const g = n.addComponent(cc.Graphics);
        g.rect(0, -h, w, h);
        if (fill) { g.fillColor = fill; g.fill(); }
        if (edge) { g.strokeColor = edge; g.lineWidth = lineW; g.stroke(); }
        return n;
    }

    /** 切角矩形（精修金属按钮特征：右上 / 左下切角）。 */
    static cutBox(parent: cc.Node, left: number, top: number, w: number, h: number,
                  fill?: cc.Color, edge?: cc.Color, lineW: number = 1, cut: number = 15): cc.Node {
        const n = JJBView.placed(parent, left, top, w, h);
        const g = n.addComponent(cc.Graphics);
        // 左上原点、y 向上；CSS 的向下 = 负 y
        g.moveTo(0, 0);
        g.lineTo(w - cut, 0);
        g.lineTo(w, -cut);
        g.lineTo(w, -h);
        g.lineTo(cut, -h);
        g.lineTo(0, -(h - cut));
        g.close();
        if (fill) { g.fillColor = fill; g.fill(); }
        if (edge) { g.strokeColor = edge; g.lineWidth = lineW; g.stroke(); }
        return n;
    }

    /** 文本（左上锚点；overflow=NONE 自适应内容，向右下生长）。 */
    /** 文本。居中/右对齐用"LEFT+NONE 渲染 → 测内容宽 → 手动偏移"实现（避开 2.4 CLAMP/SHRINK 空白 bug）。 */
    static label(parent: cc.Node, left: number, top: number, w: number, h: number,
                 text: string, size: number, color: cc.Color,
                 align: number = cc.Label.HorizontalAlign.LEFT, opacity: number = 255, font?: string): cc.Node {
        const n = JJBView.placed(parent, left, top, w, h);
        const l = n.addComponent(cc.Label);
        if (font) l.fontFamily = font; // 拉丁字体(Oswald等)；中文不传走系统字
        l.string = text;
        l.fontSize = size;
        l.lineHeight = Math.round(size * 1.2);
        l.horizontalAlign = cc.Label.HorizontalAlign.LEFT; // 始终 LEFT 渲染，避免空白
        l.verticalAlign = cc.Label.VerticalAlign.TOP;
        l.overflow = cc.Label.Overflow.NONE;
        l.enableWrapText = false;
        n.color = color;
        n.opacity = opacity;

        if (align !== cc.Label.HorizontalAlign.LEFT) {
            // 强制布局后测内容宽；失败则按字符估算（CJK≈size, ASCII≈size*0.55）
            const anyL: any = l;
            if (typeof anyL._forceUpdateRenderData === "function") anyL._forceUpdateRenderData(true);
            let tw = n.width;
            if (!tw || tw < 1) {
                tw = 0;
                for (let i = 0; i < text.length; i++) tw += text.charCodeAt(i) > 255 ? size : size * 0.55;
            }
            const dx = align === cc.Label.HorizontalAlign.RIGHT ? (w - tw) : (w - tw) / 2;
            n.x += dx;
        }
        return n;
    }

    /** 异步加载游戏图标 / 资源 Sprite，按目标尺寸定制。 */
    static sprite(parent: cc.Node, left: number, top: number, w: number, h: number,
                  resPath: string, onDone?: (n: cc.Node) => void): cc.Node {
        const n = JJBView.placed(parent, left, top, w, h);
        const s = n.addComponent(cc.Sprite);
        s.sizeMode = cc.Sprite.SizeMode.CUSTOM;
        s.trim = false;
        cc.resources.load(resPath, cc.SpriteFrame, (err: Error, sf: cc.SpriteFrame) => {
            if (!err && sf && cc.isValid(n)) {
                s.spriteFrame = sf;
                n.setContentSize(w, h);
            }
            if (onDone) onDone(n);
        });
        return n;
    }

    /** object-fit:cover 的图片（Mask 等比裁剪到框，不压扁）。用于地图横幅等。 */
    static coverSprite(parent: cc.Node, left: number, top: number, w: number, h: number, resPath: string): cc.Node {
        const box = JJBView.placed(parent, left, top, w, h);
        const mask = box.addComponent(cc.Mask);
        mask.type = cc.Mask.Type.RECT;
        const inner = new cc.Node();
        inner.parent = box;
        inner.setAnchorPoint(0.5, 0.5);
        inner.setPosition(w / 2, -h / 2); // box 锚点(0,1) → 中心
        const s = inner.addComponent(cc.Sprite);
        s.sizeMode = cc.Sprite.SizeMode.CUSTOM;
        s.trim = false;
        cc.resources.load(resPath, cc.SpriteFrame, (err: Error, sf: cc.SpriteFrame) => {
            if (err || !sf || !cc.isValid(inner)) return;
            s.spriteFrame = sf;
            const os = sf.getOriginalSize();
            const scale = Math.max(w / os.width, h / os.height);
            inner.setContentSize(os.width * scale, os.height * scale);
        });
        return box;
    }

    /** 全屏背景：① 真实整图底(GPT-image-2, mode 选 dark/light, 2 张共享) + 皮肤色调叠层/暗角。 */
    static bg(parent: cc.Node, th: Theme): void {
        const path = th.mode === "dark" ? "images/bg/jjb-bg-main" : "images/bg/jjb-bg-light";
        JJBView.coverSprite(parent, 0, 0, 1280, 720, path);
        const n = JJBView.placed(parent, 0, 0, 1280, 720);
        const g = n.addComponent(cc.Graphics);
        if (th.mode === "dark") {
            g.fillColor = cc.color(th.bgB.r, th.bgB.g, th.bgB.b, 70); g.rect(0, -720, 1280, 720); g.fill();
            g.fillColor = cc.color(th.accent.r, th.accent.g, th.accent.b, 16); g.ellipse(640, -150, 820, 420); g.fill();
            g.fillColor = cc.color(0, 0, 0, 120); g.rect(0, -720, 1280, 150); g.fill();
        } else {
            g.fillColor = cc.color(255, 255, 255, 96); g.rect(0, -720, 1280, 720); g.fill();
            g.fillColor = cc.color(th.bgB.r, th.bgB.g, th.bgB.b, 40); g.rect(0, -560, 1280, 160); g.fill();
        }
    }

    /** 透明点击热区（叠在按钮可视层之上，接收 MOUSE_UP）。 */
    static hit(parent: cc.Node, left: number, top: number, w: number, h: number, cb: () => void): cc.Node {
        const n = JJBView.placed(parent, left, top, w, h);
        n.on(cc.Node.EventType.MOUSE_UP, cb);
        return n;
    }

    /** 星际2质感转角刻线：左上 + 右下 L 形括号。 */
    static cornerTicks(parent: cc.Node, left: number, top: number, w: number, h: number,
                       color: cc.Color, len: number = 14, lw: number = 2): cc.Node {
        const n = JJBView.placed(parent, left, top, w, h);
        const g = n.addComponent(cc.Graphics);
        g.strokeColor = color; g.lineWidth = lw;
        g.moveTo(0, 0); g.lineTo(len, 0);
        g.moveTo(0, 0); g.lineTo(0, -len);
        g.moveTo(w, -h); g.lineTo(w - len, -h);
        g.moveTo(w, -h); g.lineTo(w, -h + len);
        g.stroke();
        return n;
    }
}
