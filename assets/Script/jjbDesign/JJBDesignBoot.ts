// 集结杯 × CM — 设计前端挂载 & 导航控制器
// 思路（最大化分工 / 不改 XP 代码）：XP 正常 init 后，本控制器隐藏老 jjUI（留作逻辑引擎），
// 叠加新视图；点击直接调用 XP 已写好的 InitPanel 处理函数 + 读 JijieData 渲染。
// 用法：localhost:7777/?design=home&style=metal&mode=dark   （&auto=0 可自动点第0个模式，便于截图/验证）
import { getTheme, Theme } from "./JJBTheme";
import JJBView from "./JJBView";
import JJBHome from "./JJBHome";
import JJBDrawn from "./JJBDrawn";
import JJBOverlay from "./JJBOverlay";
import JJBSelect from "./JJBSelect";
import JJBBattle from "./JJBBattle";
import JJBResult from "./JJBResult";
import JijieControl from "../jijie2/JijieContro";
import JijieData from "../jijie2/JijieData";

export default class JJBDesignBoot {

    private static stage: cc.Node;
    private static th: Theme;
    private static root: cc.Node;

    /** XP 逻辑就绪后调用；仅 ?design=... 时挂载新前端。任何异常都吞掉，不影响正常游戏。 */
    static tryMount(stage: cc.Node): void {
        try {
            const q = JJBDesignBoot.parseQuery();
            if (!q["design"]) return;

            cc.debug.setDisplayStats(false);
            const jj = stage.getChildByName("jjUI");
            if (jj) jj.active = false; // 老 UI 隐藏但存活，XP 逻辑照常运行不报错

            JJBDesignBoot.stage = stage;
            JJBDesignBoot.th = getTheme(q["style"] || "metal", q["mode"] || "dark");

            // 先加载拉丁字体，就绪后再渲染（避免 Label 用 fallback 画完缓存、字体后到不重绘）
            JJBDesignBoot.loadFontsThen(() => JJBDesignBoot.render(q));
        } catch (e) {
            cc.warn("[JJBDesignBoot] 挂载失败，不影响正常游戏: " + e);
        }
    }

    private static render(q: { [k: string]: string }): void {
        try {
            const screen = q["design"];
            if (screen === "overlay") {
                JJBOverlay.build(JJBDesignBoot.fresh(), JJBDesignBoot.th); // 常驻浮层（演示数据 + 真实图标）
                return;
            }
            if (screen === "select") {
                JJBSelect.build(JJBDesignBoot.fresh(), JJBDesignBoot.th); // 选择面板（演示数据 + 真实图标）
                return;
            }
            if (screen === "battle") {
                JJBBattle.build(JJBDesignBoot.fresh(), JJBDesignBoot.th); // 对战页（Verdict 三态判定 + JijieData 记分）
                return;
            }
            if (screen === "result") {
                JJBResult.build(JJBDesignBoot.fresh(), JJBDesignBoot.th); // 结算页（大比分 + 战绩卡，读 JijieData）
                return;
            }
            // 默认：可交互首页
            JJBDesignBoot.showHome();
            if (q["auto"] !== undefined && q["auto"] !== "") {
                JJBDesignBoot.onMode(parseInt(q["auto"], 10) || 0);
            }
        } catch (e) {
            cc.warn("[JJBDesignBoot] render 失败: " + e);
        }
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
        return JJBDesignBoot.root;
    }

    private static showHome(): void {
        JJBHome.build(JJBDesignBoot.fresh(), JJBDesignBoot.th, (i) => JJBDesignBoot.onMode(i));
    }

    /** 点击模式 → 调 XP 的 InitPanel 真实逻辑（设 JijieData + toStart 随机抽取）→ 渲染结果。 */
    private static onMode(i: number): void {
        try {
            const ip: any = JijieControl.jjUI.initPanel;
            if (ip && ip.txtName) ip.txtName.string = "选手";
            const handlers = ["onClick2", "onClick3", "onClick13", "onClick4", "onClickHard", "onClickSuiji"];
            const fn = handlers[i] || "onClick2";
            ip[fn](null); // 直接调用 XP 手写的处理函数，零改动复用其逻辑
        } catch (e) {
            cc.warn("[JJBDesignBoot] onMode 调 XP 逻辑出错: " + e);
        }
        JJBDesignBoot.showDrawn();
    }

    private static showDrawn(): void {
        JJBDrawn.build(JJBDesignBoot.fresh(), JJBDesignBoot.th, () => JJBDesignBoot.showHome());
        // 暴露给自动化验证（确认 XP 逻辑确实产出了真实数据）
        try {
            (window as any).__jjbDebug = {
                player: JijieData.playerName,
                factorCount: JijieData.modelFactorCount,
                maps: (JijieData.mapList || []).slice(),
                lockFactors: (JijieData.lockFactorList || []).slice(),
            };
        } catch (e) { /* noop */ }
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
