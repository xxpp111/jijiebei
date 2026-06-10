// 集结杯 × CM — 设计前端挂载 & 导航控制器
// 思路（最大化分工 / 不改 XP 代码）：XP 正常 init 后，本控制器隐藏老 jjUI（留作逻辑引擎），
// 叠加新视图；点击直接调用 XP 已写好的 InitPanel 处理函数 + 读 JijieData 渲染。
// 用法：localhost:7777/?design=home&style=metal&mode=dark   （&auto=0 可自动点第0个模式，便于截图/验证）
// 主题：右上角常驻切换器（精修金属/星际2质感/极简 × 暗/亮，6 套 runtime 切换，重渲染当前屏，JijieData 数据保留）。
import { getTheme, Theme } from "./JJBTheme";
import { facFlatIdx } from "./JJBData";
import JJBView from "./JJBView";
import JJBHome from "./JJBHome";
import JJBOverlay from "./JJBOverlay";
import JJBSelect from "./JJBSelect";
import JJBBattle from "./JJBBattle";
import JJBResult from "./JJBResult";
import JJBDoubles from "./JJBDoubles";
import JijieControl from "../jijie2/JijieContro";
import JijieData from "../jijie2/JijieData";

export default class JJBDesignBoot {

    private static stage: cc.Node;
    private static th: Theme;
    private static root: cc.Node;
    private static curStyle: string = "metal";
    private static curMode: string = "dark";
    private static curScreen: string = "home";
    private static playerInput: string = ""; // GAP-16：home EditBox 输入值（主题切换重建后恢复）
    private static autoPath: string = "";    // 自动化旗标 ?path=manual|random：标准模式二选层自动选路

    /** XP 逻辑就绪后调用；仅 ?design=... 时挂载新前端。任何异常都吞掉，不影响正常游戏。 */
    static tryMount(stage: cc.Node): void {
        try {
            const q = JJBDesignBoot.parseQuery();
            // 去旗标默认接管：普通 URL 即进新 UI(首页)成生产入口；?design=<screen> 仍可单屏预览；?design=off 逃生回落老 UI。
            if (q["design"] === "off") return;

            cc.debug.setDisplayStats(false);
            const jj = stage.getChildByName("jjUI");
            if (jj) jj.active = false; // 老 UI 隐藏但存活，XP 逻辑照常运行不报错

            // OBS 浮层固定 1280×720：用 SHOW_ALL 保证整版完整可见（窗口非 16:9 时加黑边而非裁内容）。
            // 否则默认 FIXED_HEIGHT 在非 16:9 窗口会裁掉左右各约 34px，让 design 的 38px 页边距看起来像 0。
            try { cc.view.setDesignResolutionSize(1280, 720, cc.ResolutionPolicy.SHOW_ALL); } catch (e) { /* noop */ }

            JJBDesignBoot.stage = stage;
            JJBDesignBoot.curStyle = q["style"] || "metal";
            JJBDesignBoot.curMode = q["mode"] || "dark";
            JJBDesignBoot.autoPath = q["path"] || "";
            JJBDesignBoot.th = getTheme(JJBDesignBoot.curStyle, JJBDesignBoot.curMode);

            // 先加载拉丁字体，就绪后再渲染（避免 Label 用 fallback 画完缓存、字体后到不重绘）
            JJBDesignBoot.loadFontsThen(() => JJBDesignBoot.render(q));
        } catch (e) {
            // Y1 可见降级：默认接管后挂载失败不黑屏——升 error(生产可见) + 恢复老 jjUI 兜底。
            cc.error("[JJBDesignBoot] 挂载失败，回落老 UI: " + e);
            try { const jj = stage.getChildByName("jjUI"); if (jj) jj.active = true; } catch (e2) { /* noop */ }
        }
    }

    private static render(q: { [k: string]: string }): void {
        try {
            if (q["doubles"] === "1") {
                JJBDesignBoot.startDoubles();
                JJBDesignBoot.buildSwitcher();
                return;
            }
            const screen = q["design"];
            if (screen === "overlay") { JJBDesignBoot.goOverlay(); }
            else if (screen === "select") { JJBDesignBoot.setScreen("select"); JJBSelect.build(JJBDesignBoot.fresh(), JJBDesignBoot.th, () => JJBDesignBoot.goBattle()); }
            else if (screen === "battle") { JJBDesignBoot.goBattle(); }
            else if (screen === "result") { JJBDesignBoot.setScreen("result"); JJBResult.build(JJBDesignBoot.fresh(), JJBDesignBoot.th); }
            else {
                JJBDesignBoot.showHome();
                if (q["auto"] !== undefined && q["auto"] !== "") JJBDesignBoot.onMode(parseInt(q["auto"], 10) || 0);
            }
            JJBDesignBoot.buildSwitcher(); // 屏 build 后建切换器并置顶（盖在当前屏之上）
        } catch (e) {
            cc.warn("[JJBDesignBoot] render 失败: " + e);
        }
    }

    /** curScreen 唯一写入口（同步暴露给自动化断言）。 */
    private static setScreen(s: string): void {
        JJBDesignBoot.curScreen = s;
        try { const w: any = window; w.__jjbDebug = w.__jjbDebug || {}; w.__jjbDebug.screen = s; } catch (e) { /* noop */ }
    }

    /** 注入 Google Fonts（拉丁：Oswald/Rajdhani/Share Tech Mono），就绪或超时后回调渲染。中文走系统字。 */
    private static loadFontsThen(cb: () => void): void {
        try {
            const d: any = (typeof document !== "undefined") ? document : null;
            if (!d || !d.head) { cb(); return; }
            if (!d.getElementById("jjb-fonts")) {
                const lk = d.createElement("link");
                lk.id = "jjb-fonts"; lk.rel = "stylesheet";
                lk.href = "https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Rajdhani:wght@500;600;700&family=Share+Tech+Mono&display=swap";
                d.head.appendChild(lk);
            }
            let done = false;
            const go = () => { if (done) return; done = true; cb(); };
            const fonts: any = d.fonts;
            if (fonts && fonts.ready && fonts.load) {
                Promise.all([
                    fonts.load("600 24px Oswald").catch(() => {}),
                    fonts.load("600 24px Rajdhani").catch(() => {}),
                    fonts.ready,
                ]).then(go).catch(go);
                if (typeof setTimeout !== "undefined") setTimeout(go, 1800);
            } else if (typeof setTimeout !== "undefined") {
                setTimeout(go, 600);
            } else {
                go();
            }
        } catch (e) {
            cb();
        }
    }

    private static fresh(): cc.Node {
        if (JJBDesignBoot.root && cc.isValid(JJBDesignBoot.root)) JJBDesignBoot.root.destroy();
        JJBDesignBoot.root = JJBView.root1280(JJBDesignBoot.stage);
        // 切换器常驻 canvas：gameplay 导航新建 root 会排到其上方盖住它，这里把已存在的切换器重新置顶保活
        try {
            const cv = cc.Canvas.instance ? cc.Canvas.instance.node : JJBDesignBoot.stage;
            const sw = cv && cv.getChildByName("jjbSwitcher");
            if (sw && cc.isValid(sw)) sw.setSiblingIndex(cv.childrenCount - 1);
        } catch (e) { /* noop */ }
        return JJBDesignBoot.root;
    }

    private static showHome(): void {
        JJBDesignBoot.setScreen("home");
        JJBHome.build(JJBDesignBoot.fresh(), JJBDesignBoot.th, (i) => JJBDesignBoot.onMode(i),
            JJBDesignBoot.playerInput, (s) => { JJBDesignBoot.playerInput = s; });
    }

    /** 点击模式 → 调 XP 的 InitPanel 真实逻辑（设 JijieData + toStart 随机抽取）。
     *  标准 8/10/12 因子停在 status=1 → 弹「手选阵容/随机抽签」二选层（GAP-12，对齐老 UI btnSelect/btnRandom）；
     *  拯救/随机模式 toStart 内部已自调 toSelect → 直进选择面板。 */
    private static onMode(i: number): void {
        try { (window as any).__jjbDebug = { screen: JJBDesignBoot.curScreen }; } catch (e) { /* noop */ } // 新局清残留 debug
        if (i === 5) {
            JJBDesignBoot.startDoubles();
            return;
        }
        JJBDoubles.reset();
        try {
            const ip: any = JijieControl.jjUI.initPanel;
            // GAP-16：把 home EditBox 真实输入写进 XP 老输入框，XP onClickX 自己读它写 JijieData.playerName（零语义漂移）
            const nm = (JJBDesignBoot.playerInput || "").trim();
            if (ip && ip.txtName) ip.txtName.string = nm || "选手";
            // 赛制（土豆确认 2026-06）：单刷一律打满 3 场——不沿用老 UI「modeIsRandom=falsy 输一场即终局」语义。
            // 显式置 false 防多局残留（XP initStart 不重置该 flag）；「随机抽签」路径由 XP onRandomClick 置 true。
            JijieData.modeIsRandom = false;
            const handlers = ["onClick2", "onClick3", "onClick13", "onClick4", "onClickSuiji"]; // 极难(onClickHard)暂不上 home（土豆决策），XP 代码路径保留
            const fn = handlers[i] || "onClick3";
            ip[fn](null); // 直接调用 XP 手写的处理函数，零改动复用其逻辑（toStart 随机抽取）
        } catch (e) {
            cc.warn("[JJBDesignBoot] onMode 调 XP 逻辑出错: " + e);
        }
        if (JijieData.status < 2) {
            // 标准模式：XP 原版此处二选（手选/随机抽签）
            if (JJBDesignBoot.autoPath === "manual") { JJBDesignBoot.startManual(); return; }
            if (JJBDesignBoot.autoPath === "random") { JJBDesignBoot.startRandom(); return; }
            JJBDesignBoot.showPathChoice();
        } else {
            JJBDesignBoot.startManual(); // 拯救/随机模式：XP 已 toSelect，固化契约后直进
        }
    }

    private static startDoubles(): void {
        try { (window as any).__jjbDebug = { screen: JJBDesignBoot.curScreen }; } catch (e) { /* noop */ }
        JJBDoubles.start();
        JJBDesignBoot.goSelect();
    }

    /** 标准模式二选层：手选阵容 / 随机抽签（叠在 home 屏之上，遮罩挡底层点击）。 */
    private static showPathChoice(): void {
        const root = JJBDesignBoot.root, th = JJBDesignBoot.th;
        if (!root || !cc.isValid(root)) { JJBDesignBoot.startManual(); return; }
        const CT = cc.Label.HorizontalAlign.CENTER;
        const dim = JJBView.box(root, 0, 0, 1280, 720, cc.color(0, 0, 0, 165));
        dim.on(cc.Node.EventType.MOUSE_UP, () => { /* 吞底层点击 */ });
        JJBView.panel(root, 430, 256, 420, 208, th);
        JJBView.label(root, 430, 286, 420, 30, "选择出战方式", 22, th.ink, CT);
        const mkBtn = (left: number, label: string, name: string, cb: () => void) => {
            if (th.style === "metal") JJBView.cutBox(root, left, 348, 180, 56, th.accent, null, 0, 10);
            else JJBView.box(root, left, 348, 180, 56, th.accent, null);
            JJBView.label(root, left, 364, 180, 26, label, 19, th.onAccent, CT);
            const hit = JJBView.hit(root, left, 348, 180, 56, cb);
            hit.name = name;
        };
        mkBtn(456, "手选阵容", "jjbPathManual", () => JJBDesignBoot.startManual());
        mkBtn(648, "随机抽签", "jjbPathRandom", () => JJBDesignBoot.startRandom());
    }

    /** 手选路径：modeIsRandom=false → toSelect 抽池 → 固化 9 格契约 → 进选择面板。 */
    private static startManual(): void {
        try {
            JijieData.modeIsRandom = false;
            if (JijieData.status < 2) JijieControl.toSelect();
            // jjbDesign 契约固化：selected* 重置为 3/9 格全 null（覆盖 toSelect 预填的 mfc*3-2 个 null + 清上局残留）；
            // 新一局记分清零统一在此（battle 屏重渲染不再清，见 JJBBattle）。
            JijieData.selectedCommanderList = [null, null, null];
            JijieData.selectedFactorList = new Array(9).fill(null);
            JijieData.winLoseList = [];
        } catch (e) {
            cc.warn("[JJBDesignBoot] startManual 调 XP 逻辑出错: " + e);
        }
        JJBDesignBoot.exposeDebug();
        JJBDesignBoot.goSelect();
    }

    /** GAP-12 随机抽签：调 XP public onRandomClick（置 modeIsRandom=true + 抽 3 指挥官/全部因子写进
     *  隐藏老 UI 组件字段 + 内部 toBattle 到 status=3）→ 镜像写回 9 格契约（新 battle 屏才渲染得出）。
     *  已知 XP 副作用（与线上老 UI 行为一致，单局无影响）：onRandomClick 直接 splice ConfigData.commanderList
     *  抽走 3 人——本前端单局流程（result 后无"再来一局"，刷新开新局）不受影响；后续加局内重开时需注意。 */
    private static startRandom(): void {
        try {
            const jjUI: any = JijieControl.jjUI;
            jjUI.onRandomClick(null); // XP：抽取 + 填老 UI 组件 + toBattle（status=3）
            JijieData.selectedCommanderList = [null, null, null];
            JijieData.selectedFactorList = new Array(9).fill(null);
            for (let m = 1; m <= 3; m++) {
                const match: any = jjUI["map" + m];
                if (!match) continue;
                JijieData.selectedCommanderList[m - 1] = match.spCommander ? (match.spCommander.cname || null) : null;
                for (let f = 1; f <= 3; f++) {
                    const fct = match["factor" + f];
                    if (fct && fct.node && fct.node.active && fct.factorName) {
                        JijieData.selectedFactorList[facFlatIdx(m - 1, f - 1)] = fct.factorName;
                    }
                }
            }
            JijieData.winLoseList = [];
        } catch (e) {
            cc.warn("[JJBDesignBoot] startRandom 调 XP 逻辑出错: " + e);
        }
        JJBDesignBoot.exposeDebug();
        JJBDesignBoot.goBattle();
    }

    /** 暴露给自动化验证（确认 XP 逻辑确实产出了真实数据）。 */
    private static exposeDebug(): void {
        try {
            const w: any = window;
            w.__jjbDebug = w.__jjbDebug || {};
            w.__jjbDebug.player = JijieData.playerName;
            w.__jjbDebug.factorCount = JijieData.modelFactorCount;
            w.__jjbDebug.status = JijieData.status;
            w.__jjbDebug.modeIsRandom = JijieData.modeIsRandom;
            w.__jjbDebug.maps = (JijieData.mapList || []).slice();
            w.__jjbDebug.lockFactors = (JijieData.lockFactorList || []).slice();
            w.__jjbDebug.randomFactorPoor = (JijieData.randomFactorPoor || []).slice();
            w.__jjbDebug.randomCommanderPoorA = (JijieData.randomCommanderPoorA || []).slice();
            w.__jjbDebug.randomCommanderPoorB = (JijieData.randomCommanderPoorB || []).slice();
            w.__jjbDebug.selectedCommanderList = (JijieData.selectedCommanderList || []).slice();
            w.__jjbDebug.selectedFactorList = (JijieData.selectedFactorList || []).slice();
        } catch (e) { /* noop */ }
    }

    /** 端到端导航（同一会话内重建节点树，数据连续，不刷新页面）。 */
    private static goSelect(): void {
        JJBDesignBoot.setScreen("select");
        JJBSelect.build(JJBDesignBoot.fresh(), JJBDesignBoot.th, () => JJBDesignBoot.goBattle());
    }
    private static goBattle(): void {
        JJBDesignBoot.setScreen("battle");
        JJBBattle.build(JJBDesignBoot.fresh(), JJBDesignBoot.th, () => JJBDesignBoot.goResult(), () => JJBDesignBoot.goOverlay());
    }
    private static goResult(): void {
        JJBDesignBoot.setScreen("result");
        JJBResult.build(JJBDesignBoot.fresh(), JJBDesignBoot.th);
    }
    /** GAP-17 浮层（OBS 浏览器源+Interact 单窗口）：battle ↔ overlay 互切，主题切换器照常。 */
    private static goOverlay(): void {
        JJBDesignBoot.setScreen("overlay");
        JJBOverlay.build(JJBDesignBoot.fresh(), JJBDesignBoot.th, () => JJBDesignBoot.goBattle());
    }

    /** 右上角常驻主题切换器：3 风格 + 2 模式按钮，当前高亮；点击 runtime 切 + 重渲当前屏。 */
    private static buildSwitcher(): void {
        const canvas = cc.Canvas.instance ? cc.Canvas.instance.node : JJBDesignBoot.stage;
        if (!canvas) return;
        const old = canvas.getChildByName("jjbSwitcher");
        if (old && cc.isValid(old)) old.destroy();
        const th = JJBDesignBoot.th;
        const sw = new cc.Node("jjbSwitcher");
        sw.parent = canvas; sw.setAnchorPoint(0.5, 0.5); sw.setContentSize(1280, 720); sw.setPosition(0, 0);
        sw.setSiblingIndex(canvas.childrenCount - 1); // 置顶，盖在当前屏之上
        const CT = cc.Label.HorizontalAlign.CENTER;
        const mk = (left: number, w: number, label: string, on: boolean, cb: () => void) => {
            JJBView.box(sw, left, 12, w, 28, on ? th.accent : th.panelBg, on ? th.accent : th.panelEdge, 1);
            JJBView.label(sw, left, 18, w, 18, label, 13, on ? th.onAccent : th.muted, CT);
            JJBView.hit(sw, left, 12, w, 28, cb);
        };
        // 顶部留白区（各屏 logo/标题 右端 ~463 与右侧 meta 左端 ~1052 之间的公共空隙），避免压住「当前选手」等 meta
        let bx = 610;
        const styles: Array<[string, string]> = [["metal", "金属"], ["sc2", "星际2"], ["minimal", "极简"]];
        styles.forEach((it) => { mk(bx, 62, it[1], JJBDesignBoot.curStyle === it[0], () => JJBDesignBoot.applyTheme(it[0], "")); bx += 64; });
        bx += 12;
        const modes: Array<[string, string]> = [["dark", "暗"], ["light", "亮"]];
        modes.forEach((it) => { mk(bx, 44, it[1], JJBDesignBoot.curMode === it[0], () => JJBDesignBoot.applyTheme("", it[0])); bx += 46; });
    }

    private static applyTheme(style: string, mode: string): void {
        if (style) JJBDesignBoot.curStyle = style;
        if (mode) JJBDesignBoot.curMode = mode;
        JJBDesignBoot.th = getTheme(JJBDesignBoot.curStyle, JJBDesignBoot.curMode);
        JJBDesignBoot.reRenderCurrent();   // 用新 th 重渲当前屏（fresh 重建 root，JijieData 真实数据保留）
        JJBDesignBoot.buildSwitcher();     // 屏重建后重建切换器并置顶（反映高亮 + 新皮肤配色）
    }

    private static reRenderCurrent(): void {
        const s = JJBDesignBoot.curScreen;
        if (s === "overlay") JJBDesignBoot.goOverlay();
        else if (s === "select") JJBDesignBoot.goSelect();
        else if (s === "battle") JJBDesignBoot.goBattle();
        else if (s === "result") JJBDesignBoot.goResult();
        else JJBDesignBoot.showHome();
    }

    private static parseQuery(): { [k: string]: string } {
        const out: { [k: string]: string } = {};
        if (typeof window === "undefined" || !window.location || !window.location.search) return out;
        const s = window.location.search.replace(/^\?/, "");
        s.split("&").forEach((pair) => {
            if (!pair) return;
            const idx = pair.indexOf("=");
            const k = idx >= 0 ? pair.substr(0, idx) : pair;
            const v = idx >= 0 ? decodeURIComponent(pair.substr(idx + 1)) : "";
            out[k] = v;
        });
        return out;
    }
}
