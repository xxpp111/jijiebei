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
        JJBView.sprite(root, 46, 28, 58, 46, markFor(th.style, th.mode));
        const titleW = th.style === "sc2" ? 599 : th.style === "minimal" ? 666 : 585;
        const tH = 42, tWd = Math.round(tH * titleW / 200);
        JJBView.sprite(root, 114, 30, tWd, tH, "images/brand/jjb-title-" + th.style + "-" + th.mode);
        const fcount = dAny.modelFactorCount === 2 ? 8 : (dAny.modelFactorCount === 4 ? 12 : 10);
        const playerStr = live ? ("当前选手  " + (dAny.playerName || "选手")) : "当前选手  Potato_01";
        const modeStr = live ? ("比赛模式  " + fcount + " 因子 · 手选") : "比赛模式  8 因子 · 手选";
        JJBView.label(root, 760, 30, 470, 20, playerStr, 15, th.muted, HA.RIGHT);
        JJBView.label(root, 760, 54, 470, 20, modeStr, 15, th.ink, HA.RIGHT);

        // ---------- 3 场槽位（适度放大 · design 地图比例 475:85 · 无重叠）----------
        const PAD = 46;
        const slotsTop = 84, colW = 386, gap = 14, slotH = 252;
        let facPtr = 0; // 真实会话预填：跨场连续取随机因子
        for (let i = 0; i < 3; i++) {
            const sx = PAD + i * (colW + gap);
            const m = matches[i];
            const active = !live && i === 0; // DEMO 才有「选择中」装饰
            JJBView.panel(root, sx, slotsTop, colW, slotH, th);
            if (active) JJBView.box(root, sx, slotsTop, colW, slotH, null, th.accent, 2);

            // slot-head
            JJBView.label(root, sx + 16, slotsTop + 12, 100, 26, m.slot, 19, th.accent);
            JJBView.label(root, sx + 110, slotsTop + 15, 180, 20, m.map, 15, th.muted);
            if (!live && (m as any).doubles) { JJBView.box(root, sx + colW - 92, slotsTop + 13, 44, 22, null, th.accent, 1); JJBView.label(root, sx + colW - 92, slotsTop + 16, 44, 16, "双打", 12, th.accent, HA.CENTER); }
            if (active) { JJBView.box(root, sx + colW - 62, slotsTop + 13, 50, 22, th.accent, null); JJBView.label(root, sx + colW - 62, slotsTop + 17, 50, 16, "选择中", 12, th.onAccent, HA.CENTER); }

            // 地图横幅（按 design 比例 475:85 算高度，避免 cover 把地图两侧裁掉）
            const mapW = colW - 30, mapH = Math.round(mapW * 85 / 475);
            JJBView.coverSprite(root, sx + 15, slotsTop + 42, mapW, mapH, "images/maps/" + m.map);

            // 目标槽（指挥官 + 因子）
            const ty = slotsTop + 42 + mapH + 16;
            const cmdN = (!live && (m as any).doubles) ? 2 : 1;
            for (let k = 0; k < cmdN; k++) {
                const cxx = sx + 16 + k * 62;
                const prefill = live ? (cmdAll.length ? cmdAll[(i + k) % cmdAll.length] : null) : (active ? m.cmds[k] : null);
                const filled = !!prefill;
                let hint: cc.Node = null;
                if (!filled) { JJBView.box(root, cxx, ty, 56, 67, th.panelBg, th.dropEdge, 1); hint = JJBView.label(root, cxx, ty + 26, 56, 16, "指挥官", 11, th.muted, HA.CENTER); }
                const hit = JJBView.placed(root, cxx, ty, 56, 67);
                const t: DropTarget = { kind: "cmd", slot: i, idx: k, left: cxx, top: ty, w: 56, h: 67, hit, hint, fill: null, value: null };
                targets.push(t);
                if (filled) fillTarget(t, prefill);
            }
            const facN = live ? FAC_PER_MATCH : Math.max(3, m.factors.length);
            const facTop = ty + 75;
            for (let k = 0; k < facN; k++) {
                const fxx = sx + 16 + (k % 5) * 56;
                const fyy = facTop + Math.floor(k / 5) * 56;
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

        // ---------- 因子池(左) + 指挥官(右, A/B 各一行纵向, 杜绝 4+ 横排重叠) ----------
        const poolTop = slotsTop + slotH + 16; // 84+252+16 = 352
        JJBView.label(root, PAD, poolTop, 120, 18, "FACTORS", 13, th.accent, HA.LEFT, 255, FONT_NUM);
        JJBView.label(root, PAD + 84, poolTop - 4, 200, 26, "选择因子", 20, th.ink);
        factorPool.forEach((f, i) => {
            const fx = PAD + (i % 4) * 74, fy = poolTop + 28 + Math.floor(i / 4) * 74;
            const item = JJBView.sprite(root, fx, fy, 64, 64, "images/factor/" + f);
            if (!live && i < 3) { JJBView.box(root, fx - 2, fy - 2, 68, 68, null, th.accent, 2); JJBView.box(root, fx + 48, fy - 9, 20, 20, th.accent, null); JJBView.label(root, fx + 48, fy - 7, 20, 15, "✓", 12, th.onAccent, HA.CENTER); }
            makeDraggable(item, "factor", f);
        });

        // 指挥官（右）A 组、B 组各占一行（纵向堆叠，避免 A 组 4 个横排撞 B 组）
        const cmdX = 430;
        JJBView.label(root, cmdX, poolTop, 200, 22, "A 组指挥官", 17, th.ink);
        cmdPoolA.forEach((c, i) => makeDraggable(JJBView.coverSprite(root, cmdX + i * 72, poolTop + 26, 62, 74, "images/commander/" + c), "cmd", c));
        const bGrpTop = poolTop + 108;
        JJBView.label(root, cmdX, bGrpTop, 200, 22, "B 组指挥官", 17, th.ink);
        cmdPoolB.forEach((c, i) => makeDraggable(JJBView.coverSprite(root, cmdX + i * 72, bGrpTop + 26, 62, 74, "images/commander/" + c), "cmd", c));

        // 提示（统一：A/B 组即拖拽源，不再铺 18 格全解锁，避免溢出/重叠）
        JJBView.label(root, cmdX, bGrpTop + 100, 600, 22,
            live ? "随机池已抽取 · 从上方 A / B 组拖拽指挥官调整三场阵容" : "拖拽上方 A / B 组指挥官与左侧因子到三场槽位", 14, th.muted);

        // ---------- 比赛开始 ----------
        const bw = 210, bx = 1234 - bw, by = 614;
        if (th.style === "metal") JJBView.cutBox(root, bx, by, bw, 48, th.accent, null, 0, 12);
        else JJBView.box(root, bx, by, bw, 48, th.accent, null);
        JJBView.label(root, bx, by + 13, bw, 26, "比赛开始 ▶", 21, th.onAccent, HA.CENTER);
        const startHit = JJBView.hit(root, bx, by, bw, 48, () => { if (onStart) onStart(); });
        startHit.name = "jjbStart"; // 便于自动化点击断言定位

        updateDebug(); // 初始（含预填）即暴露选择状态
    }
}
