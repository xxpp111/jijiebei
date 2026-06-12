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
import JJBDoubles, { DOUBLES_CONFIG } from "./JJBDoubles";
import JJBObsBar from "./JJBObsBar";
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
    private static currentModeIdx: number = -1;
    private static ctrlCollapsed: boolean = false;
    private static armedAction: string = "";
    private static armedTimer: any = null;
    // C1（Phase E bare 模式）：?design=obsbar&bare=1 启动时进入裸采集；
    //   URL 旗标持久直到离开页面（页面内导航不重置）；离开 obsbar 自动恢复 1280×720，回到 obsbar 自动回 bare。
    private static bareMode: boolean = false;
    // 置顶停靠形态：?design=obsbar&bartop=1（非 bare）。横条挂页面顶部，主播把缩小后的源
    // 贴画布底边停靠，多余背景坠到画布外——直播姬窗口捕获零裁剪出横条（用户流程拍板）。
    private static barTopMode: boolean = false;
    private static lastDesignRes: { w: number; h: number; policy: number } = { w: 1280, h: 720, policy: cc.ResolutionPolicy.SHOW_ALL };
    // C3：bare 模式下控制条默认收起为 pill；点 pill 展开为精简 5 项导航。
    //   独立 flag 避免与 ctrlCollapsed 共用（同 if 条件会互锁——一个进另一个就出不去）。
    private static bareControlExpanded: boolean = false;

    /** XP 逻辑就绪后调用；仅 ?design=... 时挂载新前端。任何异常都吞掉，不影响正常游戏。 */
    static tryMount(stage: cc.Node): void {
        try {
            const q = JJBDesignBoot.parseQuery();
            // 去旗标默认接管：普通 URL 即进新 UI(首页)成生产入口；?design=<screen> 仍可单屏预览；?design=off 逃生回落老 UI。
            if (q["design"] === "off") return;

            cc.debug.setDisplayStats(false);
            const jj = stage.getChildByName("jjUI");
            if (jj) jj.active = false; // 老 UI 隐藏但存活，XP 逻辑照常运行不报错

            // C1（Phase E）：bare 旗标 → 适配切 1280×232 SHOW_ALL；其余维持 1280×720 SHOW_ALL。
            //   旧的整版 bg overscan 在 bare 下由 JJBObsBar.solidBacking 改为 th.bgB 纯色 + clearColor 兜底。
            JJBDesignBoot.bareMode = (q["design"] === "obsbar" && q["bare"] === "1");
            // bartop 不要求 design=obsbar：主播从首页开局玩整局，?bartop=1 随会话持久，
            // 任何时刻切到横条都是置顶停靠形态。
            JJBDesignBoot.barTopMode = (q["bartop"] === "1" && !JJBDesignBoot.bareMode);
            const designW = JJBDesignBoot.bareMode ? 1280 : 1280;
            const designH = JJBDesignBoot.bareMode ? 232 : 720;
            try {
                cc.view.setDesignResolutionSize(designW, designH, cc.ResolutionPolicy.SHOW_ALL);
                JJBDesignBoot.lastDesignRes = { w: designW, h: designH, policy: cc.ResolutionPolicy.SHOW_ALL };
            } catch (e) { /* noop */ }

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

    /** C1/C3（Phase E）：离开 obsbar 自动恢复 1280×720；进 obsbar 按 bareMode 决定切 1280×232。 */
    private static applyDesignResolutionForScreen(screen: string): void {
        const wantBare = JJBDesignBoot.bareMode && screen === "obsbar";
        const wantW = wantBare ? 1280 : 1280;
        const wantH = wantBare ? 232 : 720;
        if (JJBDesignBoot.lastDesignRes.w === wantW && JJBDesignBoot.lastDesignRes.h === wantH) return;
        try {
            cc.view.setDesignResolutionSize(wantW, wantH, cc.ResolutionPolicy.SHOW_ALL);
            JJBDesignBoot.lastDesignRes = { w: wantW, h: wantH, policy: cc.ResolutionPolicy.SHOW_ALL };
        } catch (e) { /* noop */ }
    }

    private static render(q: { [k: string]: string }): void {
        try {
            if (q["doubles"] === "1" && q["design"] !== "obsbar") {
                JJBDesignBoot.startDoubles();
                JJBDesignBoot.buildControlBar();
                return;
            }
            const screen = q["design"];
            if (screen === "overlay") { JJBDesignBoot.goOverlay(); }
            else if (screen === "select") { JJBDesignBoot.setScreen("select"); JJBSelect.build(JJBDesignBoot.fresh(), JJBDesignBoot.th, () => JJBDesignBoot.goBattle()); }
            else if (screen === "battle") { JJBDesignBoot.goBattle(); }
            else if (screen === "result") { JJBDesignBoot.setScreen("result"); JJBResult.build(JJBDesignBoot.fresh(), JJBDesignBoot.th); }
            else if (screen === "obsbar") {
                if (q["doubles"] === "1") JJBDoubles.start();
                JJBDesignBoot.goObsBar();
            }
            else {
                JJBDesignBoot.showHome();
                if (q["auto"] !== undefined && q["auto"] !== "") JJBDesignBoot.onMode(parseInt(q["auto"], 10) || 0);
            }
            JJBDesignBoot.buildControlBar(); // 屏 build 后建控制条并置顶（盖在当前屏之上）
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
        // 控制条常驻 canvas：gameplay 导航新建 root 会排到其上方盖住它，这里把已存在的控制条重新置顶保活
        try {
            const cv = cc.Canvas.instance ? cc.Canvas.instance.node : JJBDesignBoot.stage;
            const sw = cv && (cv.getChildByName("jjbControlBar") || cv.getChildByName("jjbSwitcher"));
            if (sw && cc.isValid(sw)) sw.setSiblingIndex(cv.childrenCount - 1);
        } catch (e) { /* noop */ }
        return JJBDesignBoot.root;
    }

    private static showHome(): void {
        JJBDesignBoot.applyDesignResolutionForScreen("home");
        JJBDesignBoot.setScreen("home");
        JJBHome.build(JJBDesignBoot.fresh(), JJBDesignBoot.th, (i) => JJBDesignBoot.onMode(i),
            JJBDesignBoot.playerInput, (s) => { JJBDesignBoot.playerInput = s; });
        JJBDesignBoot.buildControlBar();
    }

    /** 点击模式 → 调 XP 的 InitPanel 真实逻辑（设 JijieData + toStart 随机抽取）。
     *  标准 8/10/12 因子停在 status=1 → 弹「手选阵容/随机抽签」二选层（GAP-12，对齐老 UI btnSelect/btnRandom）；
     *  拯救/随机模式 toStart 内部已自调 toSelect → 直进选择面板。 */
    private static onMode(i: number): void {
        JJBDesignBoot.currentModeIdx = i;
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
        JJBDesignBoot.applyDesignResolutionForScreen("select");
        JJBDesignBoot.setScreen("select");
        JJBSelect.build(JJBDesignBoot.fresh(), JJBDesignBoot.th, () => JJBDesignBoot.goBattle());
        JJBDesignBoot.buildControlBar();
    }
    private static goBattle(): void {
        JJBDesignBoot.applyDesignResolutionForScreen("battle");
        JJBDesignBoot.setScreen("battle");
        JJBBattle.build(JJBDesignBoot.fresh(), JJBDesignBoot.th, () => JJBDesignBoot.goResult(), () => JJBDesignBoot.goOverlay(), () => JJBDesignBoot.goObsBar());
        JJBDesignBoot.buildControlBar();
    }
    private static goResult(): void {
        JJBDesignBoot.applyDesignResolutionForScreen("result");
        JJBDesignBoot.setScreen("result");
        JJBResult.build(JJBDesignBoot.fresh(), JJBDesignBoot.th);
        JJBDesignBoot.buildControlBar();
    }
    /** GAP-17 浮层（OBS 浏览器源+Interact 单窗口）：battle ↔ overlay 互切，主题切换器照常。 */
    private static goOverlay(): void {
        JJBDesignBoot.applyDesignResolutionForScreen("overlay");
        JJBDesignBoot.setScreen("overlay");
        JJBOverlay.build(JJBDesignBoot.fresh(), JJBDesignBoot.th, () => JJBDesignBoot.goBattle(), () => JJBDesignBoot.goObsBar());
        JJBDesignBoot.buildControlBar();
    }
    /** R2② OBS 底部横条：1280×232 贴 720 舞台底部，battle/overlay/result 可切入。 */
    private static goObsBar(): void {
        JJBDesignBoot.applyDesignResolutionForScreen("obsbar");
        JJBDesignBoot.setScreen("obsbar");
        JJBObsBar.build(JJBDesignBoot.fresh(), JJBDesignBoot.th, JJBDesignBoot.bareMode, JJBDesignBoot.barTopMode);
        JJBDesignBoot.buildControlBar();
    }

    /** v4 全局控制条：导航 + 危险操作 + 主题 + 收起。保留原 jjbSwitcher 的置顶保活职责。
     *  C3（Phase E bare）：obsbar+bare 模式下默认走收起 pill（与 collapsed 视觉共用），
     *  展开为精简导航条（对战/浮层/横条/主题/收起 5 项），覆盖在横条上层。 */
    private static buildControlBar(): void {
        const canvas = cc.Canvas.instance ? cc.Canvas.instance.node : JJBDesignBoot.stage;
        if (!canvas) return;
        // 幽灵清理：destroy 是帧末延迟的，getChildByName 只取第一个会漏掉同帧重建（真实点击
        // touch+mouse 双触发）累积出的多余控制条——遍历全部同名子节点逐个销毁。
        canvas.children.slice().forEach((c: cc.Node) => {
            if ((c.name === "jjbControlBar" || c.name === "jjbSwitcher") && cc.isValid(c)) c.destroy();
        });
        const th = JJBDesignBoot.th;
        const sw = new cc.Node("jjbControlBar");
        sw.parent = canvas; sw.setAnchorPoint(0.5, 0.5); sw.setContentSize(1280, 720); sw.setPosition(0, 0);
        sw.setSiblingIndex(canvas.childrenCount - 1);
        const CT = cc.Label.HorizontalAlign.CENTER;
        const canSelect = JJBDoubles.live() || JijieData.status >= 2;
        const canBattle = JJBDoubles.live() || JijieData.status >= 3;
        const total = JJBDoubles.live() ? JJBDoubles.totalCount() : JijieData.totalCount;
        const targetTotal = JJBDoubles.live() ? DOUBLES_CONFIG.matches : 3;
        const canResult = canBattle && total >= targetTotal;
        const canOverlay = canBattle;
        const canObsbar = canBattle;

        // C3：obsbar+bare 默认走 pill（即使 ctrlCollapsed=false）。非 bare 行为零变化。
        // bartop 停靠形态同走 pill：完整控制条会叠在置顶横条上，广播捕获会穿帮。
        const isObsBarBare = JJBDesignBoot.curScreen === "obsbar" && (JJBDesignBoot.bareMode || JJBDesignBoot.barTopMode);
        if (JJBDesignBoot.ctrlCollapsed || (isObsBarBare && !JJBDesignBoot.bareControlExpanded)) {
            // F5：bare pill 放入比分区空位，避开右侧三列徽章/地图/阵容内容；非 bare 沿用原位置。
            // bartop：pill 挪到 232px 采集线以下的空背景区——观众画面零控制 UI，主播浏览器内可见。
            const pillLayout = isObsBarBare
                ? (JJBDesignBoot.bareMode ? JJBDesignBoot.barePillLayout() : { left: 24, top: 242, w: 132, h: 22 })
                : { left: 574, top: 12, w: 132, h: 22 };
            const pillLeft = pillLayout.left;
            const pillTop = pillLayout.top;
            const pillW = pillLayout.w;
            const pillH = pillLayout.h;
            const pill = JJBView.box(sw, pillLeft, pillTop, pillW, pillH, th.panelBg, th.panelEdge, 1);
            pill.name = "jjbCtrlPill";
            pill.opacity = 97;
            JJBView.label(sw, pillLeft + 6, pillTop + 4, pillW - 12, 14, isObsBarBare ? "··· 控制" : "··· 控制", 11, th.muted, CT);
            const hit = JJBView.hit(sw, pillLeft, pillTop, pillW, pillH, () => {
                if (isObsBarBare) JJBDesignBoot.bareControlExpanded = true;
                else JJBDesignBoot.ctrlCollapsed = false;
                JJBDesignBoot.buildControlBar();
            });
            hit.name = "jjbCtrl_expand";
            hit.on(cc.Node.EventType.MOUSE_ENTER, () => { if (cc.isValid(pill)) pill.opacity = 255; });
            hit.on(cc.Node.EventType.MOUSE_LEAVE, () => { if (cc.isValid(pill)) pill.opacity = 97; });
            JJBDesignBoot.exposeControlDebug(canSelect, canBattle, canResult, canOverlay, canObsbar);
            return;
        }

        if (JJBDesignBoot.armedAction) {
            const outside = JJBView.hit(sw, 0, 0, 1280, 720, () => JJBDesignBoot.cancelArmed());
            outside.name = "jjbCtrl_outsideCancel";
        }

        // C3：bare 模式展开 = 精简 5 项导航（覆盖在横条上层），不走完整版（含 reroll/homeReset/armed 等非采集所需）。
        if (isObsBarBare) {
            // 5 项 = 浮层 / 横条(高亮+disabled) / 主题(轮转 6 主题) / 收起 + 分隔。
            //   bare：居中靠右 barTop=12（232 画布内无处可避）；
            //   bartop：整条挪到 232px 采集线以下（y=242），观众画面零穿帮。
            const barTop = JJBDesignBoot.bareMode ? 12 : 242;
            const barW = 232;
            const barLeft = JJBDesignBoot.bareMode ? (1280 - 12 - barW) : 24;
            if (th.style === "metal") JJBView.cutBox(sw, barLeft, barTop, barW, 38, th.panelBg, th.panelEdge, 1, 10);
            else JJBView.box(sw, barLeft, barTop, barW, 38, th.panelBg, th.panelEdge, 1);
            const sep = (x: number) => JJBView.box(sw, x, barTop + 6, 1, 26, th.panelEdge, null);
            const btn = (left: number, w: number, label: string, name: string, on: boolean, enabled: boolean, cb: () => void) => {
                const top = barTop + 5;
                const fill = on ? th.accent : null;
                if (fill) JJBView.box(sw, left, top, w, 28, fill, null);
                const col = enabled ? (on ? th.onAccent : th.muted) : th.muted;
                const lab = JJBView.label(sw, left, top + 6, w, 16, label, 12, col, CT);
                if (!enabled) lab.opacity = 82;
                if (enabled) {
                    const h = JJBView.hit(sw, left, top, w, 28, cb);
                    h.name = name;
                }
            };
            let x = barLeft + 8;
            btn(x, 40, "对战", "jjbCtrl_battle", JJBDesignBoot.curScreen === "battle", canBattle, () => JJBDesignBoot.goBattle()); x += 42;
            btn(x, 40, "浮层", "jjbCtrl_overlay", JJBDesignBoot.curScreen === "overlay", canOverlay, () => JJBDesignBoot.goOverlay()); x += 42;
            btn(x, 40, "横条", "jjbCtrl_obsbar", true, false, () => { /* 当前屏 */ }); x += 42;
            sep(x); x += 8;
            // 主题：点击轮转 6 主题（metal/sc2/minimal × dark/light）
            const cycleTheme = () => {
                const seq: Array<[string, string]> = [
                    ["metal", "dark"], ["metal", "light"],
                    ["sc2", "dark"], ["sc2", "light"],
                    ["minimal", "dark"], ["minimal", "light"],
                ];
                const i = seq.findIndex((s) => s[0] === JJBDesignBoot.curStyle && s[1] === JJBDesignBoot.curMode);
                const next = seq[(i < 0 ? 0 : (i + 1) % seq.length)];
                JJBDesignBoot.applyTheme(next[0], next[1]);
            };
            btn(x, 56, th.style + "·" + (th.mode === "dark" ? "暗" : "亮"), "jjbCtrl_themeCycle", false, true, cycleTheme); x += 58;
            btn(x, 40, "«收起", "jjbCtrl_collapse", false, true, () => { JJBDesignBoot.bareControlExpanded = false; JJBDesignBoot.buildControlBar(); });
            JJBDesignBoot.exposeControlDebug(canSelect, canBattle, canResult, canOverlay, canObsbar);
            return;
        }

        const barLeft = JJBDesignBoot.armedAction ? 246 : 260;
        const barTop = 12;
        const barW = JJBDesignBoot.armedAction ? 840 : 770;
        if (th.style === "metal") JJBView.cutBox(sw, barLeft, barTop, barW, 38, th.panelBg, th.panelEdge, 1, 10);
        else JJBView.box(sw, barLeft, barTop, barW, 38, th.panelBg, th.panelEdge, 1);
        const sep = (x: number) => JJBView.box(sw, x, barTop + 6, 1, 26, th.panelEdge, null);
        const btn = (left: number, w: number, label: string, name: string, on: boolean, enabled: boolean, cb: () => void, warn: boolean = false) => {
            const top = 17;
            const fill = on ? th.accent : (warn && enabled ? cc.color(th.lose.r, th.lose.g, th.lose.b, 24) : null);
            if (fill) JJBView.box(sw, left, top, w, 28, fill, null);
            const col = enabled ? (on ? th.onAccent : (warn ? th.lose : th.muted)) : th.muted;
            const lab = JJBView.label(sw, left, top + 6, w, 16, label, 12, col, CT);
            if (!enabled) lab.opacity = 82;
            if (enabled) {
                const h = JJBView.hit(sw, left, top, w, 28, cb);
                h.name = name;
            }
        };

        let x = barLeft + 8;
        btn(x, 38, "首页", "jjbCtrl_home", JJBDesignBoot.curScreen === "home", true, () => JJBDesignBoot.showHome()); x += 40;
        btn(x, 38, "选择", "jjbCtrl_select", JJBDesignBoot.curScreen === "select", canSelect, () => JJBDesignBoot.goSelect()); x += 40;
        btn(x, 38, "对战", "jjbCtrl_battle", JJBDesignBoot.curScreen === "battle", canBattle, () => JJBDesignBoot.goBattle()); x += 40;
        btn(x, 38, "结算", "jjbCtrl_result", JJBDesignBoot.curScreen === "result", canResult, () => JJBDesignBoot.goResult()); x += 40;
        btn(x, 38, "浮层", "jjbCtrl_overlay", JJBDesignBoot.curScreen === "overlay", canOverlay, () => JJBDesignBoot.goOverlay()); x += 44;
        btn(x, 38, "横条", "jjbCtrl_obsbar", JJBDesignBoot.curScreen === "obsbar", canObsbar, () => JJBDesignBoot.goObsBar()); x += 44;
        sep(x); x += 8;

        if (JJBDesignBoot.armedAction) {
            const q = JJBDesignBoot.armedAction === "reroll" ? "重抽当前局？" : "放弃本局回主界面？";
            JJBView.box(sw, x, 17, 250, 28, cc.color(th.lose.r, th.lose.g, th.lose.b, 38), th.lose, 1);
            JJBView.label(sw, x + 8, 23, 92, 16, q, 12, th.ink, cc.Label.HorizontalAlign.LEFT);
            const yesW = JJBDesignBoot.armedAction === "reroll" ? 72 : 86;
            JJBView.box(sw, x + 108, 19, yesW, 24, th.lose, null);
            JJBView.label(sw, x + 108, 24, yesW, 14, JJBDesignBoot.armedAction === "reroll" ? "确认重抽" : "确认回主", 12, cc.Color.WHITE, CT);
            const yes = JJBView.hit(sw, x + 108, 19, yesW, 24, () => JJBDesignBoot.confirmArmed());
            yes.name = "jjbCtrl_confirm";
            JJBView.box(sw, x + 108 + yesW + 8, 19, 48, 24, null, th.panelEdge, 1);
            JJBView.label(sw, x + 108 + yesW + 8, 24, 48, 14, "取消", 12, th.muted, CT);
            const no = JJBView.hit(sw, x + 108 + yesW + 8, 19, 48, 24, () => JJBDesignBoot.cancelArmed());
            no.name = "jjbCtrl_cancel";
            x += 258;
        } else {
            btn(x, 82, "↻重新随机", "jjbCtrl_reroll", false, canSelect || canBattle, () => JJBDesignBoot.arm("reroll"), true); x += 84;
            btn(x, 82, "←回主界面", "jjbCtrl_homeReset", false, true, () => JJBDesignBoot.arm("home"), true); x += 88;
        }
        sep(x); x += 8;

        const styles: Array<[string, string, number]> = [["metal", "金属", 44], ["sc2", "星际2", 50], ["minimal", "极简", 42]];
        styles.forEach((it) => { btn(x, it[2], it[1], "jjbCtrl_style_" + it[0], JJBDesignBoot.curStyle === it[0], true, () => JJBDesignBoot.applyTheme(it[0], "")); x += it[2] + 2; });
        x += 4;
        const modes: Array<[string, string]> = [["dark", "暗"], ["light", "亮"]];
        modes.forEach((it) => { btn(x, 28, it[1], "jjbCtrl_mode_" + it[0], JJBDesignBoot.curMode === it[0], true, () => JJBDesignBoot.applyTheme("", it[0])); x += 30; });
        sep(x); x += 8;
        btn(x, 48, "«收起", "jjbCtrl_collapse", false, true, () => { JJBDesignBoot.ctrlCollapsed = true; JJBDesignBoot.buildControlBar(); });
        JJBDesignBoot.exposeControlDebug(canSelect, canBattle, canResult, canOverlay, canObsbar);
    }

    private static buildSwitcher(): void {
        JJBDesignBoot.buildControlBar();
    }

    private static exposeControlDebug(canSelect: boolean, canBattle: boolean, canResult: boolean, canOverlay: boolean, canObsbar: boolean): void {
        try {
            const w: any = window; w.__jjbDebug = w.__jjbDebug || {};
            const bareControl = JJBDesignBoot.measureBareControlIntersection();
            w.__jjbDebug.control = {
                collapsed: JJBDesignBoot.ctrlCollapsed,
                armed: JJBDesignBoot.armedAction,
                canSelect: canSelect,
                canBattle: canBattle,
                canResult: canResult,
                canOverlay: canOverlay,
                canObsbar: canObsbar,
                barePillNoIntersection: bareControl.noIntersection,
                barePillIntersections: bareControl.intersections,
            };
        } catch (e) { /* noop */ }
    }

    private static barePillLayout(): { left: number; top: number; w: number; h: number } {
        const scoreLeft = 24;
        const scoreW = 188;
        const scoreWinTop = 82;
        const scoreRightGutter = 0;
        const w = 66;
        const h = 20;
        return {
            left: scoreLeft + scoreW - scoreRightGutter - w,
            top: scoreWinTop + Math.round((70 - h) * 0.16),
            w,
            h,
        };
    }

    private static measureBareControlIntersection(): { noIntersection: boolean; intersections: any[] } {
        if (!(JJBDesignBoot.curScreen === "obsbar" && JJBDesignBoot.bareMode)) return { noIntersection: true, intersections: [] };
        try {
            const canvas = cc.Canvas.instance ? cc.Canvas.instance.node : JJBDesignBoot.stage;
            const ctrl = canvas && canvas.getChildByName("jjbControlBar");
            const pill = ctrl && ctrl.getChildByName("jjbCtrlPill");
            const bar = JJBDesignBoot.root && JJBDesignBoot.root.getChildByName("jjbObsBar");
            if (!pill || !bar) return { noIntersection: false, intersections: [{ reason: "missing-pill-or-bar" }] };
            const pillBox = JJBDesignBoot.worldBox(pill);
            if (!pillBox) return { noIntersection: false, intersections: [{ reason: "missing-pill-box" }] };
            const names = [
                "jjbObsLogo", "jjbObsTitle", "jjbObsScoreWin", "jjbObsScoreSlash", "jjbObsScoreTotal", "jjbObsScoreLabel",
                "jjbObsPip_", "jjbObsMatchNo_", "jjbObsBadge_", "jjbObsMap_", "jjbObsCmd_", "jjbObsFx_", "jjbFxV4_",
            ];
            const hits: any[] = [];
            const visit = (n: cc.Node) => {
                if (!n || hits.length >= 8) return;
                const nm = n.name || "";
                const check = names.some((p) => nm === p || nm.indexOf(p) === 0);
                if (check) {
                    const b = JJBDesignBoot.worldBox(n);
                    if (b && JJBDesignBoot.boxesIntersect(pillBox, b)) hits.push({ name: nm, box: b });
                }
                for (let i = 0; i < n.childrenCount; i++) visit(n.children[i]);
            };
            visit(bar);
            return { noIntersection: hits.length === 0, intersections: hits };
        } catch (e) {
            return { noIntersection: false, intersections: [{ reason: String(e) }] };
        }
    }

    private static worldBox(n: cc.Node): { left: number; right: number; top: number; bottom: number } {
        try {
            JJBDesignBoot.refreshWorldMatrixChain(n);
            const tl = n.convertToWorldSpaceAR(cc.v2(0, 0));
            const br = n.convertToWorldSpaceAR(cc.v2(n.width, -n.height));
            return {
                left: Math.min(tl.x, br.x),
                right: Math.max(tl.x, br.x),
                top: Math.max(tl.y, br.y),
                bottom: Math.min(tl.y, br.y),
            };
        } catch (e) {
            return null;
        }
    }

    private static boxesIntersect(a: { left: number; right: number; top: number; bottom: number },
                                  b: { left: number; right: number; top: number; bottom: number }): boolean {
        return a.left < b.right && a.right > b.left && a.bottom < b.top && a.top > b.bottom;
    }

    private static refreshWorldMatrixChain(n: cc.Node): void {
        try {
            const chain: any[] = [];
            let cur: any = n;
            while (cur) { chain.push(cur); cur = cur.parent; }
            for (let i = chain.length - 1; i >= 0; i--) {
                const node: any = chain[i];
                if (typeof node._updateWorldMatrix === "function") node._updateWorldMatrix();
            }
        } catch (e) { /* noop */ }
    }

    private static arm(action: string): void {
        JJBDesignBoot.armedAction = action;
        if (JJBDesignBoot.armedTimer) clearTimeout(JJBDesignBoot.armedTimer);
        JJBDesignBoot.armedTimer = setTimeout(() => JJBDesignBoot.cancelArmed(), 5000);
        JJBDesignBoot.buildControlBar();
    }

    private static cancelArmed(): void {
        JJBDesignBoot.armedAction = "";
        if (JJBDesignBoot.armedTimer) clearTimeout(JJBDesignBoot.armedTimer);
        JJBDesignBoot.armedTimer = null;
        JJBDesignBoot.buildControlBar();
    }

    private static confirmArmed(): void {
        const action = JJBDesignBoot.armedAction;
        JJBDesignBoot.armedAction = "";
        if (JJBDesignBoot.armedTimer) clearTimeout(JJBDesignBoot.armedTimer);
        JJBDesignBoot.armedTimer = null;
        if (action === "reroll") JJBDesignBoot.rerollCurrent();
        else if (action === "home") JJBDesignBoot.resetToHome();
        else JJBDesignBoot.buildControlBar();
    }

    private static rerollCurrent(): void {
        if (JJBDoubles.live()) {
            JJBDoubles.start();
            JJBDesignBoot.goSelect();
            return;
        }
        const idx = JJBDesignBoot.currentModeIdx >= 0 ? JJBDesignBoot.currentModeIdx : 1;
        try {
            JijieData.initStart();
            JijieData.reset();
        } catch (e) { /* noop */ }
        JJBDesignBoot.autoPath = "manual";
        JJBDesignBoot.onMode(idx);
    }

    private static resetToHome(): void {
        try {
            JJBDoubles.reset();
            JijieData.initStart();
            JijieData.reset();
        } catch (e) { /* noop */ }
        JJBDesignBoot.currentModeIdx = -1;
        JJBDesignBoot.autoPath = "";
        JJBDesignBoot.showHome();
    }

    private static applyTheme(style: string, mode: string): void {
        if (style) JJBDesignBoot.curStyle = style;
        if (mode) JJBDesignBoot.curMode = mode;
        JJBDesignBoot.th = getTheme(JJBDesignBoot.curStyle, JJBDesignBoot.curMode);
        JJBDesignBoot.reRenderCurrent();   // 用新 th 重渲当前屏（fresh 重建 root，JijieData 真实数据保留）
        JJBDesignBoot.buildControlBar();   // 屏重建后重建控制条并置顶（反映高亮 + 新皮肤配色）
    }

    private static reRenderCurrent(): void {
        const s = JJBDesignBoot.curScreen;
        JJBDesignBoot.applyDesignResolutionForScreen(s);
        if (s === "overlay") JJBDesignBoot.goOverlay();
        else if (s === "obsbar") JJBDesignBoot.goObsBar();
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
