// 集结杯 × CM — 选择面板（抽签）。忠实还原 design/v1 Selection + theme.css .sel/.slots/.slot/.pool/.factor/.avatar/.grp。
// 双源（方案 A）：
//   · standalone(直接 ?design=select)=结构高保真静态渲染(DEMO 数据 + 真实图标) + 完整拖拽吸附 —— 与既有一致，六皮肤零风险。
//   · 真实会话(home→select 跑过 XP toStart+toSelect)=渲染真实 mapList/随机池，拖拽/预填写真实 JijieData.selectedCommanderList/selectedFactorList。
// 吸附判定复用 jijie2 SelectPanel.checkHit(<30px)。0 改 jijie2 源码。
import { Theme } from "./JJBTheme";
import { EVENT, DEMO_MATCHES, FACTORS, GROUP_A, GROUP_B, POOL, markFor, FONT_NUM, jjbLive, sessionMatches, FAC_PER_MATCH, facFlatIdx } from "./JJBData";
import JJBView from "./JJBView";
import SelectPanel from "../jijie2/view/SelectPanel"; // 只读复用静态 checkHit（<30px 吸附判定）
import JijieData from "../jijie2/JijieData";           // 真实会话下读写 public static（goal 允许；不改源码）

const HA = cc.Label.HorizontalAlign;

// 一个目标槽（指挥官 / 因子）。hit=透明热点节点（checkHit 参照），fill=当前填充图标节点。
interface DropTarget {
    kind: string;       // "cmd" | "factor"
    slot: number;       // 第几场 0..2
    idx: number;        // 槽内序号
    left: number; top: number; w: number; h: number;
    hit: cc.Node;       // 透明热点（与池子拖拽项同为左上锚点，喂给 checkHit）
    hint: cc.Node;      // "指挥官"/"因子" 占位提示（命中后隐藏）
    fill: cc.Node;      // 已填充图标
    value: string;
}

export default class JJBSelect {

    static build(root: cc.Node, th: Theme, onStart?: () => void): void {
        JJBView.bg(root, th);

        const live = jjbLive();
        const dAny: any = JijieData;
        // 数据源：真实会话→真实抽取；否则→DEMO。
        const matches: any[] = live ? sessionMatches() : DEMO_MATCHES;
        const factorPool: string[] = live ? (dAny.randomFactorPoor || []).filter((f: string) => !!f) : FACTORS;
        const cmdPoolA: string[] = live ? (dAny.randomCommanderPoorA || []).filter((c: string) => c && c !== "自选") : GROUP_A;
        const cmdPoolB: string[] = live ? (dAny.randomCommanderPoorB || []).filter((c: string) => c && c !== "自选") : GROUP_B;
        const selfPool: (string | null)[] = live ? [] : POOL;
        const cmdAll = cmdPoolA.concat(cmdPoolB);

        // 本地选择状态（standalone 仅本地；真实会话同时写 JijieData）。
        const selection: any = { slots: [{ cmds: [], factors: [] }, { cmds: [], factors: [] }, { cmds: [], factors: [] }] };
        const targets: DropTarget[] = [];

        const updateDebug = () => {
            try {
                const w: any = window;
                w.__jjbDebug = w.__jjbDebug || {};
                w.__jjbDebug.select = {
                    live: live,
                    slots: selection.slots.map((s: any) => ({ cmds: s.cmds.slice(), factors: s.factors.slice() })),
                    selectedCommanderList: live ? (dAny.selectedCommanderList || []).slice() : undefined,
                    selectedFactorList: live ? (dAny.selectedFactorList || []).slice() : undefined,
                };
            } catch (e) { /* noop */ }
        };

        // 填充某个目标槽（前置预填、拖拽命中均走此一处）。真实会话同步写 JijieData.selected*。
        const fillTarget = (t: DropTarget, name: string) => {
            if (t.fill && cc.isValid(t.fill)) t.fill.destroy();
            t.fill = null;
            if (t.hint && cc.isValid(t.hint)) t.hint.active = false;
            t.fill = t.kind === "factor"
                ? JJBView.sprite(root, t.left, t.top, t.w, t.h, "images/factor/" + name)
                : JJBView.coverSprite(root, t.left, t.top, t.w, t.h, "images/commander/" + name);
            t.value = name;
            const slot = selection.slots[t.slot];
            (t.kind === "factor" ? slot.factors : slot.cmds)[t.idx] = name;
            if (live) {
                if (t.kind === "cmd") JijieData.selectedCommanderList[t.slot] = name;        // 每场 1 指挥官
                else JijieData.selectedFactorList[facFlatIdx(t.slot, t.idx)] = name;          // 扁平 场*3+槽
            }
            updateDebug();
        };

        // 让池子项可拖：TOUCH 拖动（桌面鼠标/移动端皆触发）→ 抬手 checkHit 找最近匹配槽 → 命中填槽，否则回弹。
        const makeDraggable = (item: cc.Node, kind: string, name: string) => {
            const homeX = item.x, homeY = item.y;
            let gx = 0, gy = 0, dragging = false;
            item.on(cc.Node.EventType.TOUCH_START, (e: cc.Event.EventTouch) => {
                cc.Tween.stopAllByTarget(item);
                const lp = root.convertToNodeSpaceAR(e.getLocation());
                gx = item.x - lp.x; gy = item.y - lp.y;
                dragging = true;
                item.setSiblingIndex(root.childrenCount - 1); // 拖动时置顶
                item.opacity = 235;
            });
            item.on(cc.Node.EventType.TOUCH_MOVE, (e: cc.Event.EventTouch) => {
                if (!dragging) return;
                const lp = root.convertToNodeSpaceAR(e.getLocation());
                item.setPosition(lp.x + gx, lp.y + gy);
            });
            const onEnd = () => {
                if (!dragging) return;
                dragging = false;
                item.opacity = 255;
                let hit: DropTarget = null;
                for (let j = 0; j < targets.length; j++) {
                    const t = targets[j];
                    if (t.kind !== kind) continue;
                    if (SelectPanel.checkHit(item, t.hit)) { hit = t; break; }
                }
                if (hit) fillTarget(hit, name);
                cc.tween(item).to(0.12, { x: homeX, y: homeY }).start(); // 始终回到池子原位（池=常驻调色板）
            };
            item.on(cc.Node.EventType.TOUCH_END, onEnd);
            item.on(cc.Node.EventType.TOUCH_CANCEL, onEnd);
        };

        // ---------- TopBar（lockup sm + meta） ----------
        JJBView.sprite(root, 50, 30, 52, 42, markFor(th.style, th.mode));
        const titleW = th.style === "sc2" ? 599 : th.style === "minimal" ? 666 : 585;
        const tH = 42, tWd = Math.round(tH * titleW / 200);
        JJBView.sprite(root, 116, 30, tWd, tH, "images/brand/jjb-title-" + th.style + "-" + th.mode);
        const fcount = dAny.modelFactorCount === 2 ? 8 : (dAny.modelFactorCount === 4 ? 12 : 10);
        const playerStr = live ? ("当前选手  " + (dAny.playerName || "选手")) : "当前选手  Potato_01";
        const modeStr = live ? ("比赛模式  " + fcount + " 因子 · 手选") : "比赛模式  8 因子 · 手选";
        JJBView.label(root, 760, 30, 470, 20, playerStr, 15, th.muted, HA.RIGHT);
        JJBView.label(root, 760, 54, 470, 20, modeStr, 15, th.ink, HA.RIGHT);

        // ---------- 3 场槽位 ----------
        const slotsTop = 92, colW = 382, gap = 16, slotH = 222;
        let facPtr = 0; // 真实会话预填：跨场连续取随机因子
        for (let i = 0; i < 3; i++) {
            const sx = 50 + i * (colW + gap);
            const m = matches[i];
            const active = !live && i === 0; // DEMO 才有「选择中」装饰
            JJBView.panel(root, sx, slotsTop, colW, slotH, th);
            if (active) JJBView.box(root, sx, slotsTop, colW, slotH, null, th.accent, 2); // 选择中外框

            // slot-head
            JJBView.label(root, sx + 14, slotsTop + 12, 90, 24, m.slot, 18, th.accent);
            JJBView.label(root, sx + 104, slotsTop + 14, 160, 20, m.map, 15, th.muted);
            if (!live && (m as any).doubles) { JJBView.box(root, sx + colW - 96, slotsTop + 12, 44, 22, null, th.accent, 1); JJBView.label(root, sx + colW - 96, slotsTop + 15, 44, 16, "双打", 12, th.accent, HA.CENTER); }
            if (active) { JJBView.box(root, sx + colW - 64, slotsTop + 12, 50, 22, th.accent, null); JJBView.label(root, sx + colW - 64, slotsTop + 16, 50, 16, "选择中", 12, th.onAccent, HA.CENTER); }

            // 地图横幅
            JJBView.coverSprite(root, sx + 14, slotsTop + 42, colW - 28, 62, "images/maps/" + m.map);

            // 目标槽（指挥官 + 因子）——全部注册为 drop target。DEMO active 场预填；真实会话全场预填(真实池)。
            const ty = slotsTop + 116;
            const cmdN = (!live && (m as any).doubles) ? 2 : 1;
            for (let k = 0; k < cmdN; k++) {
                const cxx = sx + 14 + k * 56;
                const prefill = live ? (cmdAll.length ? cmdAll[(i + k) % cmdAll.length] : null) : (active ? m.cmds[k] : null);
                const filled = !!prefill;
                let hint: cc.Node = null;
                if (!filled) { JJBView.box(root, cxx, ty, 50, 60, th.panelBg, th.dropEdge, 1); hint = JJBView.label(root, cxx, ty + 22, 50, 16, "指挥官", 11, th.muted, HA.CENTER); }
                const hit = JJBView.placed(root, cxx, ty, 50, 60); // 透明热点
                const t: DropTarget = { kind: "cmd", slot: i, idx: k, left: cxx, top: ty, w: 50, h: 60, hit, hint, fill: null, value: null };
                targets.push(t);
                if (filled) fillTarget(t, prefill);
            }
            const facN = live ? FAC_PER_MATCH : Math.max(3, m.factors.length);
            for (let k = 0; k < facN; k++) {
                const fxx = sx + 14 + (k % 5) * 56;
                const fyy = ty + 70 + Math.floor(k / 5) * 56;
                const prefill = live ? (factorPool.length ? factorPool[facPtr++ % factorPool.length] : null) : (active ? m.factors[k] : null);
                const filled = !!prefill;
                let hint: cc.Node = null;
                if (!filled) { JJBView.box(root, fxx, fyy, 50, 50, th.panelBg, th.dropEdge, 1); if (!active && !live && k === 0) hint = JJBView.label(root, fxx, fyy + 18, 50, 14, "因子", 11, th.muted, HA.CENTER); }
                const hit = JJBView.placed(root, fxx, fyy, 50, 50);
                const t: DropTarget = { kind: "factor", slot: i, idx: k, left: fxx, top: fyy, w: 50, h: 50, hit, hint, fill: null, value: null };
                targets.push(t);
                if (filled) fillTarget(t, prefill);
            }
        }

        // ---------- 因子池 + 指挥官 ----------
        const poolTop = slotsTop + slotH + 18;
        // 因子池（左 340）
        JJBView.label(root, 50, poolTop, 120, 16, "FACTORS", 13, th.accent, HA.LEFT, 255, FONT_NUM);
        JJBView.label(root, 130, poolTop - 4, 200, 24, "选择因子", 20, th.ink);
        factorPool.forEach((f, i) => {
            const fx = 50 + (i % 4) * 78, fy = poolTop + 28 + Math.floor(i / 4) * 78;
            const item = JJBView.sprite(root, fx, fy, 66, 66, "images/factor/" + f);
            if (!live && i < 3) { JJBView.box(root, fx - 2, fy - 2, 70, 70, null, th.accent, 2); JJBView.box(root, fx + 52, fy - 10, 22, 22, th.accent, null); JJBView.label(root, fx + 52, fy - 7, 22, 16, "✓", 13, th.onAccent, HA.CENTER); }
            makeDraggable(item, "factor", f);
        });

        // 指挥官（右）
        const cmdX = 416;
        JJBView.label(root, cmdX, poolTop - 4, 200, 22, "A 组指挥官", 18, th.ink);
        cmdPoolA.forEach((c, i) => makeDraggable(JJBView.coverSprite(root, cmdX + i * 78, poolTop + 26, 66, 79, "images/commander/" + c), "cmd", c));
        JJBView.label(root, cmdX + 280, poolTop - 4, 200, 22, "B 组指挥官", 18, th.ink);
        cmdPoolB.forEach((c, i) => makeDraggable(JJBView.coverSprite(root, cmdX + 280 + i * 78, poolTop + 26, 66, 79, "images/commander/" + c), "cmd", c));

        const selfTop = poolTop + 120;
        JJBView.label(root, cmdX, selfTop, 200, 20, "自选指挥官", 18, th.ink);
        JJBView.label(root, cmdX + 160, selfTop + 4, 360, 16, live ? "随机池已抽取 · 可拖拽调整阵容" : "18 位全解锁 · 双打可放 2 位", 13, th.muted);
        selfPool.forEach((c, i) => {
            const ax = cmdX + (i % 12) * 66, ay = selfTop + 26 + Math.floor(i / 12) * 76;
            if (c) makeDraggable(JJBView.coverSprite(root, ax, ay, 58, 70, "images/commander/" + c), "cmd", c);
            else { JJBView.box(root, ax, ay, 58, 70, th.panelBg, th.dropEdge, 1); JJBView.label(root, ax, ay + 26, 58, 18, "+", 20, th.muted, HA.CENTER); }
        });

        // ---------- 比赛开始 ----------
        const bw = 200, bx = 1230 - bw, by = 668;
        if (th.style === "metal") JJBView.cutBox(root, bx, by, bw, 44, th.accent, null, 0, 12);
        else JJBView.box(root, bx, by, bw, 44, th.accent, null);
        JJBView.label(root, bx, by + 11, bw, 24, "比赛开始 ▶", 20, th.onAccent, HA.CENTER);
        const startHit = JJBView.hit(root, bx, by, bw, 44, () => { if (onStart) onStart(); });
        startHit.name = "jjbStart"; // 便于自动化点击断言定位

        updateDebug(); // 初始（含预填）即暴露选择状态
    }
}
