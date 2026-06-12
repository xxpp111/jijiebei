// 集结杯 × CM — 结构渲染助手（程序化建 Cocos 节点树）
// 设计坐标系：以动态 designResolution（1280×720 默认 / 1280×232 bare）为基准，
// 用「左上角 + 向右/向下」描述布局，内部转换为 Cocos 中心原点、y 向上的局部坐标。
// 便于直接照搬 design CSS 的 left/top/w/h。
// C1（Phase E bare）：HALF_W/HALF_H 跟 designResolution 动态算，否则 bare 模式
// root/placed 仍按 720 中心偏移 → 节点在可视区外。
import { Theme } from "./JJBTheme";

function getDesignHalf(): { w: number; h: number } {
    const ds = cc.view.getDesignResolutionSize();
    return { w: ds.width / 2, h: ds.height / 2 };
}

export default class JJBView {

    /** 建一个铺满画布的 root（挂在 Canvas 下，居中）。尺寸跟 designResolution 动态（720 / 232）。 */
    static root1280(stage: cc.Node): cc.Node {
        const ds = cc.view.getDesignResolutionSize();
        const root = new cc.Node("JJBDesignRoot");
        root.setAnchorPoint(0.5, 0.5);
        root.setContentSize(ds.width, ds.height);
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
        const dh = getDesignHalf();
        n.setPosition(-dh.w + left, dh.h - top);
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

    /** 虚线描边矩形（忠实 design 占位槽 .drop/.avatar.ph：dashed 边 + 淡填充）。
     *  cc.Graphics 2.4 无原生 setLineDash，故沿四边手画 dash 段后一次 stroke。 */
    static dashBox(parent: cc.Node, left: number, top: number, w: number, h: number,
                   fill?: cc.Color, edge?: cc.Color, lineW: number = 1, dash: number = 4, gap: number = 3): cc.Node {
        const n = JJBView.placed(parent, left, top, w, h);
        const g = n.addComponent(cc.Graphics);
        if (fill) { g.rect(0, -h, w, h); g.fillColor = fill; g.fill(); }
        if (edge) {
            g.strokeColor = edge; g.lineWidth = lineW;
            const step = dash + gap;
            for (let x = 0; x < w; x += step) { g.moveTo(x, 0); g.lineTo(Math.min(x + dash, w), 0); }            // 顶
            for (let x = 0; x < w; x += step) { g.moveTo(x, -h); g.lineTo(Math.min(x + dash, w), -h); }          // 底
            for (let y = 0; y < h; y += step) { g.moveTo(0, -y); g.lineTo(0, -Math.min(y + dash, h)); }          // 左
            for (let y = 0; y < h; y += step) { g.moveTo(w, -y); g.lineTo(w, -Math.min(y + dash, h)); }          // 右
            g.stroke();
        }
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

    /** 全屏背景：程序化渲染，对齐 design bg-grad(渐变) + bg-tex(sc2 网格/metal 斜纹/minimal 无) + 顶光晕 + bg-vignette(暗角)。弃 GPT-image 写实大图。 */
    static bg(parent: cc.Node, th: Theme): void {
        // ⓪ overscan 纯色底：宽屏 canvas 在 1280×720 设计区之外会露出 XP 原场景写实背景，用 bgB 纯色铺满盖住
        JJBView.box(parent, -360, -220, 2000, 1160, th.bgB);
        // ① 渐变底（bgA 顶 → bgB 底，分段独立 box 避免 Graphics 多 fill 路径累积）
        const SEG = 18;
        for (let i = 0; i < SEG; i++) {
            const t = i / (SEG - 1);
            const col = cc.color(
                Math.round(th.bgA.r + (th.bgB.r - th.bgA.r) * t),
                Math.round(th.bgA.g + (th.bgB.g - th.bgA.g) * t),
                Math.round(th.bgA.b + (th.bgB.b - th.bgA.b) * t), 255);
            JJBView.box(parent, 0, Math.floor(720 * i / SEG), 1280, Math.ceil(720 / SEG) + 1, col);
        }
        // 标记全屏 bg 已渲染（obsbar 等屏实测断言使用）
        try { (window as any).__jjbDebug = (window as any).__jjbDebug || {}; (window as any).__jjbDebug.__jjbFullscreenBgNode = true; } catch (e) { /* noop */ }
        // ② 皮肤纹理：sc2=44px 网格(椭圆遮罩→中心实四周淡,对齐 design radial mask) / metal=118° 斜纹 / minimal=无
        if (th.style === "sc2") {
            // 网格 accent@5%；椭圆 Mask 裁到中心区，近似 design radial 遮罩(中心30%实→边缘92%透明)
            const maskNode = new cc.Node("jjbGridMask");
            maskNode.parent = parent;
            maskNode.setAnchorPoint(0.5, 0.5);
            maskNode.setContentSize(1280 * 0.92, 720 * 0.84);
            maskNode.setPosition(0, 72); // design 中心(640,288)=(50%,40%) → root 局部(0,72)
            const mask = maskNode.addComponent(cc.Mask);
            mask.type = cc.Mask.Type.ELLIPSE;
            const gn = new cc.Node();
            gn.parent = maskNode; gn.setAnchorPoint(0.5, 0.5); gn.setPosition(0, 0);
            const g = gn.addComponent(cc.Graphics);
            g.strokeColor = cc.color(th.accent.r, th.accent.g, th.accent.b, th.mode === "dark" ? 14 : 16);
            g.lineWidth = 1;
            for (let x = 0; x <= 1280; x += 44) { const lx = x - 640; g.moveTo(lx, 288); g.lineTo(lx, -432); }
            for (let y = 0; y <= 720; y += 44) { const ly = 288 - y; g.moveTo(-640, ly); g.lineTo(640, ly); }
            g.stroke();
        } else if (th.style === "metal") {
            const tex = JJBView.placed(parent, 0, 0, 1280, 720).addComponent(cc.Graphics);
            const dx = 382; // 720·tan(28°)：斜纹偏垂直 28° = CSS repeating-linear-gradient(118°)
            tex.strokeColor = th.mode === "dark" ? cc.color(255, 255, 255, 7) : cc.color(21, 35, 58, 7);
            tex.lineWidth = 1;
            for (let x = -dx; x <= 1280; x += 7) { tex.moveTo(x, 0); tex.lineTo(x + dx, -720); }
            tex.stroke();
        }
        // 顶部光晕（metal/sc2 暗色：accent 色径向高光）
        if (th.mode === "dark" && th.style !== "minimal") {
            const halo = JJBView.placed(parent, 0, 0, 1280, 720).addComponent(cc.Graphics);
            halo.fillColor = cc.color(th.accent.r, th.accent.g, th.accent.b, 16);
            halo.ellipse(640, -60, 480, 240); halo.fill();
        }
        // ③ 暗角（多层 rect stroke 由外向内 alpha 递减，近似 inset vignette）
        const vg = JJBView.placed(parent, 0, 0, 1280, 720).addComponent(cc.Graphics);
        const vc = th.mode === "dark" ? [0, 0, 0] : [108, 124, 120];
        for (let i = 0; i < 7; i++) {
            const a = (th.mode === "dark" ? 24 : 15) - i * 3;
            if (a <= 0) break;
            vg.strokeColor = cc.color(vc[0], vc[1], vc[2], a);
            vg.lineWidth = 16;
            const o = i * 13;
            vg.rect(o, -(720 - o), 1280 - o * 2, 720 - o * 2);
            vg.stroke();
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

    /** 卡片/面板：半透明底 + 皮肤专属边框（metal 切角12 / sc2 四角刻线 / minimal 直角）。替代裸 box 画「卡片级」容器，还原 design HUD 质感。 */
    static panel(parent: cc.Node, left: number, top: number, w: number, h: number,
                 th: Theme, fill?: cc.Color, edge?: cc.Color): cc.Node {
        const f = fill === undefined ? th.panelBg : fill;
        const e = edge === undefined ? th.panelEdge : edge;
        let n: cc.Node;
        if (th.style === "metal") {
            n = JJBView.cutBox(parent, left, top, w, h, f, e, 1, 12); // 切角
        } else {
            n = JJBView.box(parent, left, top, w, h, f, e, 1);
            if (th.style === "sc2") JJBView.cornerTicks(parent, left, top, w, h, th.accent, 14, 2); // 四角刻线
        }
        return n;
    }
}
