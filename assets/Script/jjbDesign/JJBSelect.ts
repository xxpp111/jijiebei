// 集结杯 × CM — 选择面板（抽签）。按 design/v3 screens.jsx + theme.css 真实 flex 结构复刻：
//   .sel(column) → topbar / .slots(grid3) / .pool(横向: .pool-factors 340 | .pool-cmd[.grp-row A+B横排 + .grp-self 18格]) / .startbtn
// 双源（方案 A）：standalone(?design=select)=DEMO + 完整拖拽；真实会话(home→select)=真实 mapList/随机池，写 JijieData.selected*。
// 吸附判定复用 jijie2 SelectPanel.checkHit(<30px)。0 改 jijie2 源码。
import { Theme } from "./JJBTheme";
import { EVENT, DEMO_MATCHES, FACTORS, GROUP_A, GROUP_B, POOL, markFor, FONT_NUM, jjbLive, sessionMatches, manualSlots, facFlatIdx, modeLabel } from "./JJBData";
import JJBView from "./JJBView";
import SelectPanel from "../jijie2/view/SelectPanel"; // 只读复用静态 checkHit（<30px 吸附判定）
import JijieData from "../jijie2/JijieData";           // 真实会话下读写 public static（goal 允许；不改源码）
import ConfigData from "../jijie2/data/JJConfigData";  // 只读 commanderList（name→组别，B组≤1 校验对齐 XP checkBCount）

const HA = cc.Label.HorizontalAlign;
const BLACK = cc.color(0, 0, 0);          // 槽位/图标黑底（design .filled/.factor background:#000）
const NAMEBG = cc.color(0, 0, 0, 200);    // 名字浮层底（design .avatar-name 暗渐变近似）

// 一个目标槽（指挥官 / 因子）。hit=透明热点节点（checkHit 参照），fill=当前填充图标节点。
interface DropTarget {
    kind: string;       // "cmd" | "factor"
    slot: number;       // 第几场 0..2
    idx: number;        // 槽内序号
    left: number; top: number; w: number; h: number;
    hit: cc.Node;       // 透明热点（与池子拖拽项同为左上锚点，喂给 checkHit）
    hint: cc.Node;      // "指挥官"/"因子" 占位提示（命中后隐藏）
    dash: cc.Node;      // 虚线占位框（清槽后无条件重画，防节点累积）
    fill: cc.Node;      // 已填充图标
    aux: cc.Node[];     // 已填充时的底/边框/名字浮层（重填时一并销毁）
    value: string;
}

// 池子项注册（GAP-08 sel 已用反馈：上浮3px + accent 外圈 + ✓ 角标）。
interface PoolItem {
    node: cc.Node; kind: string; name: string;
    left: number; top: number; w: number; h: number;
    marks: cc.Node[]; lifted: boolean;
}

export default class JJBSelect {

    static build(root: cc.Node, th: Theme, onStart?: () => void): void {
        JJBView.bg(root, th);

        const live = jjbLive();
        const dAny: any = JijieData;
        // 数据源：真实会话→真实抽取；否则→DEMO。
        // standalone 洗牌：演示因子/指挥官同样走随机抽取逻辑（不写死这几个）；真实会话直接用 XP 随机池。
        const shuffle = (arr: string[]): string[] => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
        const matches: any[] = live ? sessionMatches() : DEMO_MATCHES;
        const factorPool: string[] = live ? (dAny.randomFactorPoor || []).filter((f: string) => !!f) : shuffle(FACTORS);
        const cmdPoolA: string[] = live ? (dAny.randomCommanderPoorA || []).filter((c: string) => c && c !== "自选") : shuffle(GROUP_A);
        const cmdPoolB: string[] = live ? (dAny.randomCommanderPoorB || []).filter((c: string) => c && c !== "自选") : shuffle(GROUP_B);
        const cmdAll = cmdPoolA.concat(cmdPoolB);

        // 本地选择状态（standalone 仅本地；真实会话同时写 JijieData）。
        const selection: any = { slots: [{ cmds: [], factors: [] }, { cmds: [], factors: [] }, { cmds: [], factors: [] }] };
        const targets: DropTarget[] = [];

        // GAP-01：每场手选槽数计划（live 镜像 XP updateStart；standalone DEMO 维持 3）。
        const slotsPlan: number[] = live ? [manualSlots(0), manualSlots(1), manualSlots(2)] : [3, 3, 3];
        // GAP-04：name→组别（只读 XP 配置，对齐 checkBCount 的 commanderList 查表语义——
        // 不按池子来源判组，拯救等模式 A 池里混入的 B 组指挥官按 XP 同样计 B）。
        const groupMap: { [n: string]: string } = {};
        try { (ConfigData.commanderList || []).forEach((arr: any[]) => { groupMap[arr[0]] = arr[1]; }); } catch (e) { /* noop */ }
        let lastError = "";

        const updateDebug = () => {
            try {
                const w: any = window;
                w.__jjbDebug = w.__jjbDebug || {};
                w.__jjbDebug.select = {
                    live: live,
                    slots: selection.slots.map((s: any) => ({ cmds: s.cmds.slice(), factors: s.factors.slice() })),
                    selectedCommanderList: live ? (dAny.selectedCommanderList || []).slice() : undefined,
                    selectedFactorList: live ? (dAny.selectedFactorList || []).slice() : undefined,
                    slotsPlan: slotsPlan.slice(),
                    lockFactors: live ? (dAny.modeSuiji ? [] : (dAny.lockFactorList || []).slice()) : undefined,
                    poolFactorCount: factorPool.length,
                    poolIdentity: live ? (factorPool.length === slotsPlan[0] + slotsPlan[1] + slotsPlan[2]) : undefined,
                    error: lastError,
                };
            } catch (e) { /* noop */ }
        };

        // GAP-03 开始校验（live；镜像 XP SelectPanel.onStartClick 三规则，按 jjbDesign 本地 selection 判定）。
        const validate = (): string => {
            for (let i = 0; i < 3; i++) {
                if (!selection.slots[i].cmds[0]) return "第" + (i + 1) + "场指挥官未选择";
            }
            for (let i = 0; i < 3; i++) {
                for (let k = 0; k < slotsPlan[i]; k++) {
                    if (!selection.slots[i].factors[k]) return "第" + (i + 1) + "场因子" + (k + 1) + "未选择";
                }
            }
            // GAP-04 B组≤1：触发条件精确对齐 XP（mfc>2 且非 onePick；8因子 mfc==2 不终检）。
            if (!dAny.modeIsOnePick && dAny.modelFactorCount > 2) {
                let b = 0;
                for (let i = 0; i < 3; i++) {
                    const c = selection.slots[i].cmds[0];
                    if (c && groupMap[c] === "B") b++;
                }
                if (b > 1) return "B组指挥官只能选1个";
            }
            return "";
        };

        // 填充某个目标槽（前置预填、拖拽命中均走此一处）。真实会话同步写 JijieData.selected*。
        let lastFillAt = 0; // 拖拽释放瞬间槽 hit 也会收到 MOUSE_UP（touch/mouse 双事件流）——350ms 窗口内不当成清槽点击
        const fillTarget = (t: DropTarget, name: string) => {
            if (t.fill && cc.isValid(t.fill)) t.fill.destroy();
            (t.aux || []).forEach((n) => { if (cc.isValid(n)) n.destroy(); });
            t.aux = [];
            if (t.dash && cc.isValid(t.dash)) t.dash.destroy();
            t.dash = null;
            if (t.hint && cc.isValid(t.hint)) t.hint.destroy();
            t.hint = null;
            // design .t-cmd/.t-fac.filled：黑底 + 1px accent 边框 + 图（内缩 1px 露边框）；指挥官加底部名字浮层(.avatar-name)
            t.aux.push(JJBView.box(root, t.left, t.top, t.w, t.h, BLACK, th.accent, 1));
            t.fill = t.kind === "factor"
                ? JJBView.sprite(root, t.left + 1, t.top + 1, t.w - 2, t.h - 2, "images/factor/" + name)
                : JJBView.coverSprite(root, t.left + 1, t.top + 1, t.w - 2, t.h - 2, "images/commander/" + name);
            if (t.kind === "cmd") {
                t.aux.push(JJBView.box(root, t.left + 1, t.top + t.h - 16, t.w - 2, 15, NAMEBG, null));
                t.aux.push(JJBView.label(root, t.left + 1, t.top + t.h - 15, t.w - 2, 12, name, 10, cc.Color.WHITE, HA.CENTER));
            }
            t.value = name;
            const slot = selection.slots[t.slot];
            (t.kind === "factor" ? slot.factors : slot.cmds)[t.idx] = name;
            if (live) {
                if (t.kind === "cmd") JijieData.selectedCommanderList[t.slot] = name;        // 每场 1 指挥官
                else JijieData.selectedFactorList[facFlatIdx(t.slot, t.idx)] = name;          // 扁平 场*3+槽
            }
            lastFillAt = Date.now();
            refreshPool();
            updateDebug();
        };

        // 槽占位（dashed 虚线 + hint）。清槽后无条件重画——standalone 预填槽 build 时没画过，不依赖底层残留。
        const drawPlaceholder = (t: DropTarget) => {
            if (t.dash && cc.isValid(t.dash)) t.dash.destroy();
            if (t.hint && cc.isValid(t.hint)) t.hint.destroy();
            t.dash = JJBView.dashBox(root, t.left, t.top, t.w, t.h, th.dropBg, th.dropEdge, 1.5);
            t.hint = t.kind === "cmd"
                ? JJBView.label(root, t.left, t.top + 26, t.w, 16, "指挥官", 11, th.muted, HA.CENTER)
                : (t.idx === 0 ? JJBView.label(root, t.left, t.top + 18, t.w, 14, "因子", 11, th.muted, HA.CENTER) : null);
        };

        // GAP-09 取消重选：点击已填槽=清空（destroy fill/aux → 重画占位 → selection/JijieData 置 null → 池 sel 重算）。
        const clearTarget = (t: DropTarget) => {
            if (!t.value) return;
            if (t.fill && cc.isValid(t.fill)) t.fill.destroy();
            t.fill = null;
            (t.aux || []).forEach((n) => { if (cc.isValid(n)) n.destroy(); });
            t.aux = [];
            drawPlaceholder(t);
            t.value = null;
            const slot = selection.slots[t.slot];
            (t.kind === "factor" ? slot.factors : slot.cmds)[t.idx] = null;
            if (live) {
                if (t.kind === "cmd") JijieData.selectedCommanderList[t.slot] = null;
                else JijieData.selectedFactorList[facFlatIdx(t.slot, t.idx)] = null;
            }
            refreshPool();
            updateDebug();
        };

        // GAP-08 池 sel 已用反馈（design theme.css .factor-sel：上浮3px + accent 外圈 + ✓角标）。
        // 名字被任何槽使用→sel 态；未使用→常态。不做整池 dim（多场同屏需保持未用项正常可见）。
        const poolItems: PoolItem[] = [];
        const refreshPool = () => {
            const u: { [n: string]: boolean } = {};
            selection.slots.forEach((s: any) => {
                (s.cmds || []).forEach((c: string) => { if (c) u[c] = true; });
                (s.factors || []).forEach((f: string) => { if (f) u[f] = true; });
            });
            poolItems.forEach((p) => {
                const used = !!u[p.name];
                if (used === p.lifted) return;
                p.marks.forEach((n) => { if (cc.isValid(n)) n.destroy(); });
                p.marks = [];
                p.lifted = used;
                if (!(p.node as any)._jjbDragging) p.node.y += used ? 3 : -3; // 拖拽中由回弹 tween 兜住目标位
                if (used) {
                    const mk = JJBView.box(root, p.left - 2, p.top - 5, p.w + 4, p.h + 4, null, th.accent, 2); // 外圈（含上浮 -3）
                    mk.name = "jjbSelMark_" + p.name;
                    p.marks.push(mk);
                    p.marks.push(JJBView.box(root, p.left + p.w - 12, p.top - 13, 20, 20, th.accent, null));
                    p.marks.push(JJBView.label(root, p.left + p.w - 12, p.top - 11, 20, 15, "✓", 12, th.onAccent, HA.CENTER));
                }
            });
        };

        // 让池子项可拖：TOUCH 拖动 → 抬手 checkHit 找最近匹配槽 → 命中填槽，否则回弹。
        const makeDraggable = (item: cc.Node, kind: string, name: string) => {
            item.name = "jjbItem_" + kind + "_" + name; // 便于自动化定位
            const homeX = item.x, homeY = item.y;
            const homeIdx = item.getSiblingIndex(); // 还原用：拖动会置顶，回弹后复位到原层级（否则盖住自身名字浮层）
            const pi: PoolItem = { node: item, kind, name, left: item.x + 640, top: 360 - item.y, w: item.width, h: item.height, marks: [], lifted: false };
            poolItems.push(pi);
            let gx = 0, gy = 0, dragging = false;
            item.on(cc.Node.EventType.TOUCH_START, (e: cc.Event.EventTouch) => {
                cc.Tween.stopAllByTarget(item);
                const lp = root.convertToNodeSpaceAR(e.getLocation());
                gx = item.x - lp.x; gy = item.y - lp.y;
                dragging = true;
                (item as any)._jjbDragging = true;
                item.setSiblingIndex(root.childrenCount - 1); // 拖动时置顶
                item.opacity = 235;
                item.scale = 1.12; // 抓取放大反馈（"拿起"手感）
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
                // 回池原位（sel 态含上浮 3px）+ 复位缩放 + 复位层级（名字浮层重新盖在上）
                cc.tween(item).to(0.14, { x: homeX, y: homeY + (pi.lifted ? 3 : 0), scale: 1 })
                    .call(() => { (item as any)._jjbDragging = false; if (cc.isValid(item)) item.setSiblingIndex(homeIdx); }).start();
            };
            item.on(cc.Node.EventType.TOUCH_END, onEnd);
            item.on(cc.Node.EventType.TOUCH_CANCEL, onEnd);
        };

        // 池子项容器（design .avatar/.factor）：黑底+边框+cover 图+可选名字浮层装进单容器，
        // 拖动/上浮/置顶整体移动（修拖动时只有图动、框名留在原地的割裂感）。容器即 makeDraggable/checkHit 对象。
        const framedItem = (left: number, top: number, w: number, h: number, resPath: string, name: string): cc.Node => {
            const item = JJBView.placed(root, left, top, w, h);
            const g = item.addComponent(cc.Graphics);
            g.rect(0, -h, w, h);
            g.fillColor = BLACK; g.fill();
            g.strokeColor = th.panelEdge; g.lineWidth = 1; g.stroke();
            // cover 图（内缩 1px 露边框）
            const mk = new cc.Node();
            mk.parent = item; mk.setAnchorPoint(0.5, 0.5);
            mk.setContentSize(w - 2, h - 2); mk.setPosition(w / 2, -h / 2);
            const mask = mk.addComponent(cc.Mask);
            mask.type = cc.Mask.Type.RECT;
            const inner = new cc.Node();
            inner.parent = mk; inner.setAnchorPoint(0.5, 0.5); inner.setPosition(0, 0);
            const sp = inner.addComponent(cc.Sprite);
            sp.sizeMode = cc.Sprite.SizeMode.CUSTOM; sp.trim = false;
            cc.resources.load(resPath, cc.SpriteFrame, (err: Error, sf: cc.SpriteFrame) => {
                if (err || !sf || !cc.isValid(inner)) return;
                sp.spriteFrame = sf;
                const os = sf.getOriginalSize();
                const sc = Math.max((w - 2) / os.width, (h - 2) / os.height);
                inner.setContentSize(os.width * sc, os.height * sc);
            });
            if (name) { // 名字浮层 .avatar-name
                const nb = new cc.Node();
                nb.parent = item; nb.setAnchorPoint(0, 1); nb.setPosition(1, -(h - 16));
                const ng = nb.addComponent(cc.Graphics);
                ng.rect(0, -15, w - 2, 15); ng.fillColor = NAMEBG; ng.fill();
                const nl = new cc.Node();
                nl.parent = item; nl.setAnchorPoint(0, 1);
                const lab = nl.addComponent(cc.Label);
                lab.string = name; lab.fontSize = 10; lab.lineHeight = 12;
                lab.horizontalAlign = HA.LEFT; lab.verticalAlign = cc.Label.VerticalAlign.TOP;
                lab.overflow = cc.Label.Overflow.NONE; lab.enableWrapText = false;
                nl.color = cc.Color.WHITE;
                const anyL: any = lab;
                if (typeof anyL._forceUpdateRenderData === "function") anyL._forceUpdateRenderData(true);
                let tw = nl.width;
                if (!tw || tw < 1) { tw = 0; for (let i = 0; i < name.length; i++) tw += name.charCodeAt(i) > 255 ? 10 : 5.5; }
                nl.setPosition(1 + (w - 2 - tw) / 2, -(h - 15)); // 居中（同 JJBView.label 测宽 trick）
            }
            return item;
        };
        const framedCmd = (left: number, top: number, w: number, h: number, cmd: string, withName: boolean): cc.Node =>
            framedItem(left, top, w, h, "images/commander/" + cmd, withName ? cmd : null);
        const framedFactor = (left: number, top: number, w: number, h: number, f: string): cc.Node =>
            framedItem(left, top, w, h, "images/factor/" + f, null);

        // ---------- TopBar（lockup sm + meta，design padding 38）----------
        JJBView.sprite(root, 38, 28, 56, 46, markFor(th.style, th.mode));
        const titleW = th.style === "sc2" ? 599 : th.style === "minimal" ? 666 : 585;
        const tH = 42, tWd = Math.round(tH * titleW / 200);
        JJBView.sprite(root, 104, 30, tWd, tH, "images/brand/jjb-title-" + th.style + "-" + th.mode);
        const playerStr = live ? ("当前选手  " + (dAny.playerName || "选手")) : "当前选手  Potato_01";
        const modeStr = live ? ("比赛模式  " + modeLabel()) : "比赛模式  8 因子 · 手选";
        JJBView.label(root, 762, 30, 480, 20, playerStr, 15, th.muted, HA.RIGHT);
        JJBView.label(root, 762, 54, 480, 20, modeStr, 15, th.ink, HA.RIGHT);

        // ---------- 三场槽 grid 3 列（design .slots：head + mapthumb 475:85 + t-cmds + t-facs）----------
        const PAD = 38;
        const slotsTop = 96, colW = 389, gap = 18, slotH = 248;
        for (let i = 0; i < 3; i++) {
            const sx = PAD + i * (colW + gap);
            const m = matches[i];
            const active = !live && i === 0;
            JJBView.panel(root, sx, slotsTop, colW, slotH, th);
            if (active) JJBView.box(root, sx, slotsTop, colW, slotH, null, th.accent, 2);
            // slot-head
            JJBView.label(root, sx + 14, slotsTop + 13, 120, 24, m.slot, 19, th.accent);
            JJBView.label(root, sx + 110, slotsTop + 16, 180, 20, m.map, 15, th.muted);
            if (!live && (m as any).doubles) { JJBView.box(root, sx + colW - 90, slotsTop + 13, 44, 22, null, th.accent, 1); JJBView.label(root, sx + colW - 90, slotsTop + 16, 44, 16, "双打", 12, th.accent, HA.CENTER); }
            if (active) { JJBView.box(root, sx + colW - 60, slotsTop + 13, 50, 22, th.accent, null); JJBView.label(root, sx + colW - 60, slotsTop + 17, 50, 16, "选择中", 12, th.onAccent, HA.CENTER); }
            // 地图横幅（design aspect 475:85）
            const mapW = colW - 28, mapH = Math.round(mapW * 85 / 475);
            JJBView.coverSprite(root, sx + 14, slotsTop + 42, mapW, mapH, "images/maps/" + m.map);
            // t-cmds（56×67）— doubles(BOSS双打) 留 2 个指挥官位
            const ty = slotsTop + 42 + mapH + 12;
            const cmdN = (m as any).doubles ? 2 : 1;
            for (let k = 0; k < cmdN; k++) {
                const cxx = sx + 14 + k * 62;
                // live：槽位留空(reserved)，主播从池子拖拽编排；standalone：仅 active 场预填做演示
                const prefill = (!live && active) ? (cmdAll[k] || m.cmds[k]) : null;
                const t: DropTarget = { kind: "cmd", slot: i, idx: k, left: cxx, top: ty, w: 56, h: 67, hit: null, hint: null, dash: null, fill: null, aux: [], value: null };
                drawPlaceholder(t);
                t.hit = JJBView.placed(root, cxx, ty, 56, 67);
                t.hit.name = "jjbSlot_cmd_" + i + "_" + k; // 便于自动化定位
                t.hit.on(cc.Node.EventType.MOUSE_UP, () => { if (Date.now() - lastFillAt > 350) clearTarget(t); }); // GAP-09 点击清槽
                targets.push(t);
                if (prefill) fillTarget(t, prefill);
            }
            // t-facs（52×52 wrap 5 列）。live 行首先渲染锁定因子固定格（GAP-02：filled 同款 + 「锁定」角标，
            // 不可拖不可清除，不入 targets；modeSuiji 整行无因子格），后接 GAP-01 动态手选槽。
            const facTop = ty + 75;
            let cell = 0;
            const lockName: string = (live && !dAny.modeSuiji) ? (dAny.lockFactorList || [])[i] : null;
            if (lockName) {
                const lxx = sx + 14;
                JJBView.box(root, lxx, facTop, 52, 52, BLACK, th.accent, 1);
                JJBView.sprite(root, lxx + 1, facTop + 1, 50, 50, "images/factor/" + lockName);
                JJBView.box(root, lxx, facTop + 38, 34, 14, th.accent, null);
                JJBView.label(root, lxx, facTop + 40, 34, 12, "锁定", 9, th.onAccent, HA.CENTER);
                cell = 1;
            }
            const facN = live ? slotsPlan[i] : Math.max(3, m.factors.length);
            for (let k = 0; k < facN; k++) {
                const fxx = sx + 14 + ((cell + k) % 5) * 58;
                const fyy = facTop + Math.floor((cell + k) / 5) * 58;
                // live：槽位留空(reserved)，主播拖拽编排；standalone：仅 active 场预填演示
                const prefill = (!live && active) ? (factorPool[k] || m.factors[k]) : null;
                const t: DropTarget = { kind: "factor", slot: i, idx: k, left: fxx, top: fyy, w: 52, h: 52, hit: null, hint: null, dash: null, fill: null, aux: [], value: null };
                drawPlaceholder(t);
                t.hit = JJBView.placed(root, fxx, fyy, 52, 52);
                t.hit.name = "jjbSlot_factor_" + i + "_" + k; // 便于自动化定位
                t.hit.on(cc.Node.EventType.MOUSE_UP, () => { if (Date.now() - lastFillAt > 350) clearTarget(t); }); // GAP-09 点击清槽
                targets.push(t);
                if (prefill) fillTarget(t, prefill);
            }
        }

        // ---------- pool 横向：左因子池(340) + 右指挥官区(grp-row A/B 横排 + grp-self 18 格)----------
        const poolTop = slotsTop + slotH + 16; // 96+248+16 = 360
        // 左：因子池（design .pool-factors 固定 340，.factor 66×66 wrap 4 列）
        JJBView.label(root, PAD, poolTop, 120, 18, "FACTORS", 13, th.accent, HA.LEFT, 255, FONT_NUM);
        JJBView.label(root, PAD + 84, poolTop - 4, 200, 26, "选择因子", 20, th.ink);
        if (live && factorPool.length === 0) JJBView.label(root, PAD, poolTop + 32, 330, 20, "随机模式 · 本局无需配置因子", 14, th.muted);
        factorPool.forEach((f, i) => {
            const fx = PAD + (i % 4) * 74, fy = poolTop + 26 + Math.floor(i / 4) * 74;
            makeDraggable(framedFactor(fx, fy, 66, 66, f), "factor", f); // 已用 ✓ sel 态由 refreshPool 统一渲染
        });
        // 右：指挥官区 — grp-row（A 组 + B 组横向并排，design .grp-row gap30 / .avatar-row 70×84）
        const cmdX = PAD + 340 + 26; // 404
        JJBView.label(root, cmdX, poolTop, 200, 22, "A 组指挥官", 16, th.ink);
        cmdPoolA.forEach((c, i) => makeDraggable(framedCmd(cmdX + i * 76, poolTop + 26, 66, 80, c, true), "cmd", c));
        const bGrpX = cmdX + cmdPoolA.length * 76 + 24; // B 组接 A 组后（gap24）
        JJBView.label(root, bGrpX, poolTop, 200, 22, "B 组指挥官", 16, th.ink);
        cmdPoolB.forEach((c, i) => makeDraggable(framedCmd(bGrpX + i * 76, poolTop + 26, 66, 80, c, true), "cmd", c));
        // grp-self（自选指挥官，design .avatar-grid 60×72 9列×2行）
        // GAP-10 live：渲染 JJConfigData.commanderList 全量（ban 后）减已入 A/B/C 池者，全部带框可拖
        // （合并 XP「拖自选图标+点选」两步，消灭其"没点选→加载 自选.png"的宽松漏洞）；
        // 显示条件镜像 XP SelectPanel.updateSelect（拯救/随机/极难①/非酋无自选区）。
        // B 组占用经 groupMap 计入 A4 校验；8因子(mfc==2)按 XP 不终检（checkBCount 强制计 B 仅影响 updateBCount 路径）。
        const selfTop = poolTop + 26 + 80 + 18; // 484
        JJBView.label(root, cmdX, selfTop, 200, 22, "自选指挥官", 16, th.ink);
        const selfPool: string[] = (() => {
            if (!live) return shuffle(POOL.filter(Boolean) as string[]);
            const show = !dAny.modeSuiji && !dAny.modeIsZhengjiu && (!dAny.modeIsVeryHard || dAny.modeIsVeryHard2) && !dAny.modeFeiqiu;
            if (!show) return [];
            const inPool: { [n: string]: boolean } = {};
            cmdAll.forEach((c) => { inPool[c] = true; });
            ((dAny.randomCommanderPoorC || []) as string[]).forEach((c) => { inPool[c] = true; });
            try { return (ConfigData.commanderList || []).map((arr: any[]) => arr[0] as string).filter((c: string) => !inPool[c]); } catch (e) { return []; }
        })();
        JJBView.label(root, cmdX + 150, selfTop + 3, 440, 16,
            live ? (selfPool.length ? "全量可选 · 拖入场次槽位（B 组占用合并计数）" : "本模式无自选区") : "18 位全解锁 · 双打可放 2 位", 13, th.muted);
        const selfCells: (string | null)[] = live ? selfPool : selfPool.concat(new Array(Math.max(0, 18 - selfPool.length)).fill(null));
        selfCells.slice(0, 18).forEach((c, i) => {
            const ax = cmdX + (i % 9) * 70, ay = selfTop + 28 + Math.floor(i / 9) * 74;
            if (c) makeDraggable(framedCmd(ax, ay, 60, 72, c, true), "cmd", c);
            else { JJBView.dashBox(root, ax, ay, 60, 72, th.dropBg, th.dropEdge, 1); JJBView.label(root, ax, ay + 26, 60, 18, "+", 20, th.muted, HA.CENTER); }
        });

        // ---------- 比赛开始（右下，design .startbtn align-flex-end padding 14/38）----------
        const bw = 200, bx = 1242 - bw, by = 658;
        if (th.style === "metal") JJBView.cutBox(root, bx, by, bw, 48, th.accent, null, 0, 12);
        else JJBView.box(root, bx, by, bw, 48, th.accent, null);
        JJBView.label(root, bx, by + 13, bw, 26, "比赛开始 ▶", 21, th.onAccent, HA.CENTER);
        // GAP-03：不通过 → startbtn 左侧红字（th.lose 色；design 暂无此元素，先用 token 红字）+ 不导航。
        let errNode: cc.Node = null;
        const showError = (msg: string) => {
            lastError = msg;
            if (errNode && cc.isValid(errNode)) { errNode.destroy(); errNode = null; }
            if (msg) errNode = JJBView.label(root, bx - 630, by + 15, 620, 22, msg, 16, th.lose, HA.RIGHT);
            updateDebug();
        };
        const startHit = JJBView.hit(root, bx, by, bw, 48, () => {
            if (live) {
                const err = validate();
                showError(err);
                if (err) return;
            }
            if (onStart) onStart();
        });
        startHit.name = "jjbStart"; // 便于自动化点击断言定位

        // 主题切换 reRenderCurrent 重建本屏时回读 JijieData.selected* 恢复已选视觉（数据在、节点树是新的）。
        // 新一局的重置由 JJBDesignBoot.onMode 统一负责，故此处读到的即本局已选。
        if (live) {
            targets.forEach((t) => {
                const v = t.kind === "cmd"
                    ? (JijieData.selectedCommanderList || [])[t.slot]
                    : (JijieData.selectedFactorList || [])[facFlatIdx(t.slot, t.idx)];
                if (v) fillTarget(t, v);
            });
        }

        refreshPool();  // standalone 预填发生在池子项注册之前，统一兜底重算 sel 态
        updateDebug(); // 初始（含预填/恢复）即暴露选择状态
    }
}
