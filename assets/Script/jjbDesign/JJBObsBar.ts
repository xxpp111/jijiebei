// 集结杯 v4 R2② — OBS 底部横条（1280×232）。
// 全屏 bg 盖 XP 老场景（OBS 裁底部 232px 区域，无副作用）；数据源与既有屏一致：双打→单刷 live→DEMO。
// R2-fix：A1 全屏 bg / A2 onState 替代硬编码 / A3 徽章按实宽右对齐 / A4 exposeDebug 改实测；
//         B1 已判定列子节点降权+地图暗色近似降饱和 / B2 字体+bold / B3 /总场拆分 /
//         B4 factorTag 复用 / B5 大比分入场动效+判定 backOut / B6 微调包与死代码。
import { Theme } from "./JJBTheme";
import {
    DEMO_MATCHES, EVENT, RESULT_LABEL, VAL_RESULT, jjbLive, markFor, sessionMatches,
} from "./JJBData";
import JJBDoubles, { DOUBLES_CONFIG, doublesLive, doublesMatches } from "./JJBDoubles";
import JJBBorder from "./JJBBorder";
import JJBView from "./JJBView";
import JijieData from "../jijie2/JijieData";

const HA = cc.Label.HorizontalAlign;
const BAR_W = 1280;
const BAR_H = 232;
const BAR_TOP = 720 - BAR_H;
const BARE_BACKING = { left: -360, top: -220, w: 2000, h: 1160 }; // same overscan envelope as JJBView.bg
const PAD_L = 24;
const SCORE_W = 188;
const GAP = 16;
const RIGHT_INNER_PAD = 13;   // 卡片右内缘留 13，徽章右缘 = 卡右内缘 - 实宽
const SONG = "Songti SC, STSong, serif";

interface ObsRow {
    slot: string;
    map: string;
    cmds: string[];
    factors: string[];
    doubles?: boolean;
    mutators?: string[];
    status: string;
    verdict?: string;
}

export default class JJBObsBar {

    static build(root: cc.Node, th: Theme, bare: boolean = false): void {
        // A1：全屏背景盖住 XP 老场景；OBS 端只裁底部 232px 区域，无副作用。
        // C2（Phase E bare）：bare 模式 designResolution 切 1280×232，整页可视区=仅横条，
        //     bg 全屏层会盖 letterbox 适配带（SHOW_ALL 多余边）造成白边，跳过。
        if (!bare) JJBView.bg(root, th);
        else JJBObsBar.solidBacking(root, th);

        const data = JJBObsBar.resolveRows();
        const rows = data.rows;
        const score = JJBObsBar.deriveScore(rows);
        const heroIndex = JJBObsBar.heroIndex(rows);

        // C2：bare 顶=可视区顶=0；非 bare 贴 720 舞台底（保持原行为）。
        const barTop = bare ? 0 : BAR_TOP;
        const bar = JJBView.placed(root, 0, barTop, BAR_W, BAR_H);
        bar.name = "jjbObsBar";
        JJBObsBar.drawBg(bar, th);
        JJBObsBar.box(bar, 0, 0, BAR_W, 3, JJBObsBar.alpha(th.accent, 235));

        JJBObsBar.drawScore(bar, th, score, data.finalState);
        JJBObsBar.drawMatches(bar, th, rows, heroIndex);

        // 入场：透明度淡入（y 由 JJBView.placed 置于目标，不做 tween 避免 Cocos 2.4 tween.y capture 行为差异影响实测）
        bar.opacity = 0;
        cc.tween(bar).to(0.24, { opacity: 255 }, { easing: "quadOut" }).start();

        JJBObsBar.exposeDebug(data.source, rows, score, heroIndex, data.finalState, bar, bare);
    }

    /** C2：bare 不画 JJBView.bg 全屏层；改由引擎 clearColor + DOM 底色承担 letterbox 适配带。
     *  此处同步引擎 clearColor（不依赖 DOM 拿到时机，createScene 后即可调），与 th.bgB 同色。 */
    private static solidBacking(root: cc.Node, th: Theme): void {
        const backing = JJBView.box(root, BARE_BACKING.left, BARE_BACKING.top, BARE_BACKING.w, BARE_BACKING.h, th.bgB);
        backing.name = "jjbObsBareBacking";
        try { backing.setSiblingIndex(0); } catch (e) { /* noop */ }
        try { (window as any).__jjbDebug = (window as any).__jjbDebug || {}; (window as any).__jjbDebug.__jjbBareBackingNode = true; } catch (e) { /* noop */ }
        try { cc.director.setClearColor(th.bgB); } catch (e) { /* noop */ }
        try {
            const d: any = (typeof document !== "undefined") ? document : null;
            const hex = "#" + JJBObsBar.toHex(th.bgB);
            if (d && d.body) d.body.style.backgroundColor = hex;
            if (d && d.getElementById) {
                const cv: any = d.getElementById("GameCanvas");
                if (cv && cv.style) cv.style.backgroundColor = "transparent";
            }
        } catch (e) { /* noop */ }
    }

    private static toHex(c: cc.Color): string {
        const f = (n: number) => { const v = Math.max(0, Math.min(255, Math.round(n))); return (v < 16 ? "0" : "") + v.toString(16); };
        return f(c.r) + f(c.g) + f(c.b);
    }

    private static resolveRows(): { source: string; rows: ObsRow[]; finalState: boolean } {
        const doubles = doublesLive();
        const live = !doubles && jjbLive();
        const raw: any[] = doubles ? doublesMatches() : (live ? sessionMatches() : DEMO_MATCHES);
        const wl: number[] = doubles ? (JJBDoubles.winLoseList || []) : (live ? (JijieData.winLoseList || []) : []);
        let liveAssigned = false;
        const rows: ObsRow[] = raw.map((m: any, i: number) => {
            let status = "";
            let verdict = "";
            if (live || doubles) {
                if (typeof wl[i] === "number") {
                    status = "done";
                    verdict = VAL_RESULT[wl[i]];
                } else if (!liveAssigned) {
                    status = "live";
                    liveAssigned = true;
                } else {
                    status = "wait";
                }
            } else if (m.status === "live" || m.status === "wait") {
                status = m.status;
            } else if (m.status === "win" || m.status === "bonus" || m.status === "lose") {
                status = "done";
                verdict = m.status;
            } else if (m.result) {
                status = "done";
                verdict = m.result;
            } else {
                status = "wait";
            }
            if (status === "done" && !verdict) verdict = m.result || "win";
            return {
                slot: m.slot || ("第 " + (i + 1) + " 场"),
                map: m.map || "往日神庙",
                cmds: (m.cmds || []).slice(),
                factors: (m.factors || []).slice(),
                doubles: !!m.doubles,
                mutators: m.mutators ? m.mutators.slice() : undefined,
                status: status,
                verdict: verdict,
            };
        });
        const finalState = rows.length > 0 && rows.every((r) => r.status === "done");
        return { source: doubles ? "doubles" : (live ? "live" : "demo"), rows: rows, finalState: finalState };
    }

    private static deriveScore(rows: ObsRow[]): { wins: number; total: number; pips: string[] } {
        const wins = rows.filter((r) => r.status === "done" && (r.verdict === "win" || r.verdict === "bonus")).length;
        const pips = rows.map((r) => {
            if (r.status === "live") return "live";
            if (r.status === "wait") return "wait";
            if (r.verdict === "bonus") return "bonus";
            if (r.verdict === "win") return "win";
            if (r.verdict === "lose") return "lose";
            return "wait";
        });
        return { wins: wins, total: rows.length, pips: pips };
    }

    private static heroIndex(rows: ObsRow[]): number {
        for (let i = 0; i < rows.length; i++) if (rows[i].status === "live") return i;
        return -1;
    }

    private static drawBg(parent: cc.Node, th: Theme): void {
        const seg = 8;
        for (let i = 0; i < seg; i++) {
            const t = i / (seg - 1);
            const col = cc.color(
                Math.round(th.bgA.r + (th.bgB.r - th.bgA.r) * t),
                Math.round(th.bgA.g + (th.bgB.g - th.bgA.g) * t),
                Math.round(th.bgA.b + (th.bgB.b - th.bgA.b) * t), 255);
            JJBObsBar.box(parent, 0, Math.floor(BAR_H * i / seg), BAR_W, Math.ceil(BAR_H / seg) + 1, col);
        }
        if (th.style === "sc2") {
            const g = JJBObsBar.placed(parent, 0, 0, BAR_W, BAR_H).addComponent(cc.Graphics);
            g.strokeColor = JJBObsBar.alpha(th.accent, th.mode === "dark" ? 14 : 16);
            g.lineWidth = 1;
            for (let x = 0; x <= BAR_W; x += 44) { g.moveTo(x, 0); g.lineTo(x, -BAR_H); }
            for (let y = 0; y <= BAR_H; y += 44) { g.moveTo(0, -y); g.lineTo(BAR_W, -y); }
            g.stroke();
        } else if (th.style === "metal") {
            const g = JJBObsBar.placed(parent, 0, 0, BAR_W, BAR_H).addComponent(cc.Graphics);
            g.strokeColor = th.mode === "dark" ? cc.color(255, 255, 255, 8) : cc.color(21, 35, 58, 8);
            g.lineWidth = 1;
            const dx = 124;
            for (let x = -dx; x <= BAR_W; x += 7) { g.moveTo(x, 0); g.lineTo(x + dx, -BAR_H); }
            g.stroke();
        }
        // B6：移除设计中不存在的 18px 暗角
    }

    private static drawScore(parent: cc.Node, th: Theme, score: { wins: number; total: number; pips: string[] }, finalState: boolean): void {
        const x = PAD_L;
        // B6：logo 等比（高 30 宽 auto，按原图宽高比缩放）
        const logo = JJBObsBar.logoSized(parent, x, 15, 30, markFor(th.style, th.mode));
        logo.name = "jjbObsLogo";
        JJBObsBar.box(parent, x + 48, 18, 1, 24, JJBObsBar.alpha(th.accent, 153));
        // B2：metal 衬线三处之一——标题用宋体（no-op "" 改 SONG）
        JJBObsBar.label(parent, x + 59, 15, 124, 26, EVENT.cn, 20, th.ink, HA.LEFT, 255, th.serifTitle ? SONG : undefined, true).name = "jjbObsTitle";

        // B2：大比分去 Oswald+bold（默认系统字 + LabelOutline 加粗）
        // B5：120ms 入场动效（与 pip 同手法 scaleY 0.25→1）
        const winStr = String(score.wins);
        const winNode = JJBObsBar.label(parent, x, 82, 72, 70, winStr, 74, th.accent, HA.LEFT, 255, th.serifTitle ? SONG : undefined, true);
        winNode.name = "jjbObsScoreWin";
        winNode.scaleY = 0.25;
        cc.tween(winNode).to(0.12, { scaleY: 1 }, { easing: "quadOut" }).start();

        // B3：拆 /总场成两个 label——"/" 用 muted、总场用 th.ink；x 紧贴大比分实宽
        //     实宽估测：74px 数字单字符 ≈ 0.6*74 = 44（无 Oswald 数字字宽），加 9px 视觉间隙
        const winW = winStr.length * Math.round(74 * 0.6);
        const slashX = x + winW + 9;
        const slashNode = JJBObsBar.label(parent, slashX, 113, 14, 32, "/", 30, th.muted, HA.LEFT, 255, th.serifTitle ? SONG : undefined);
        slashNode.name = "jjbObsScoreSlash";
        const totalNode = JJBObsBar.label(parent, slashX + 14, 113, 48, 32, String(score.total), 30, th.ink, HA.LEFT, 255, th.serifTitle ? SONG : undefined);
        totalNode.name = "jjbObsScoreTotal";
        JJBObsBar.label(parent, x, 149, SCORE_W, 16, finalState ? "终局 · 已胜场" : "当前局分 · 已胜场", 12, th.muted, HA.LEFT, th.serifTitle ? SONG : undefined).name = "jjbObsScoreLabel";

        const gap = 6;
        const pw = (SCORE_W - gap * Math.max(0, score.pips.length - 1)) / Math.max(1, score.pips.length);
        for (let i = 0; i < score.pips.length; i++) {
            const p = score.pips[i];
            const col = JJBObsBar.pipColor(th, p);
            const edge = p === "wait" ? th.panelEdge : null;
            // B6：pip top 200→208
            const n = JJBObsBar.box(parent, x + i * (pw + gap), 208, pw, 8, col, edge, 1);
            n.name = "jjbObsPip_" + i + "_" + p;
            if (p === "live") JJBObsBar.pulse(n);
            else if (p !== "wait") {
                n.scaleY = 0.25;
                cc.tween(n).to(0.12, { scaleY: 1 }, { easing: "quadOut" }).start();
            }
        }
    }

    private static drawMatches(parent: cc.Node, th: Theme, rows: ObsRow[], heroIndex: number): void {
        const left = PAD_L + SCORE_W + 20;
        const rightPad = 24;
        const matchTop = 15;
        const matchH = 201;
        const totalGap = GAP * Math.max(0, rows.length - 1);
        let units = 0;
        rows.forEach((r, i) => { units += i === heroIndex ? 1.52 : 1; });
        if (units <= 0) units = rows.length || 1;
        const available = BAR_W - left - rightPad - totalGap;
        let x = left;
        rows.forEach((r, i) => {
            const live = i === heroIndex;
            const w = available * (live ? 1.52 : 1) / units;
            JJBObsBar.drawMatch(parent, th, r, i, x, matchTop, w, matchH, live);
            x += w + GAP;
        });
    }

    private static drawMatch(parent: cc.Node, th: Theme, row: ObsRow, idx: number,
                             x: number, y: number, w: number, h: number, live: boolean): void {
        const done = row.status === "done";
        const panel = JJBObsBar.matchPanel(parent, x, y, w, h, th, live);
        panel.name = "jjbObsMatch_" + idx;
        if (done) panel.opacity = 220;
        // B6 微调包备注：hero 迁移/降权过渡类记设计债，本轮不做（移除 panel.scale 0.985 入场 tween 以保实测布局稳定）

        const padX = 13, topPad = 9;
        // B2：场次号去 Oswald+bold（系统中文 + LabelOutline 加粗）
        JJBObsBar.label(parent, x + padX, y + topPad + (live ? 0 : 2), 92, 24, row.slot, live ? 22 : 19, th.accent, HA.LEFT, 255, th.serifTitle ? SONG : undefined, true).name = "jjbObsMatchNo_" + idx;
        if (row.doubles) {
            // "双打" 标签（与 ① 保持一致的小字 tag 标）
            const tagX = x + padX + (row.slot.length > 4 ? 76 : 68);
            JJBObsBar.box(parent, tagX, y + topPad + 3, 44, 19, null, th.panelEdge, 1);
            JJBObsBar.label(parent, tagX, y + topPad + 6, 44, 12, "双打", 10, th.ink, HA.CENTER);
        }

        // A3：徽章按实宽右对齐（右缘 = 卡右内缘 - 实宽）；B5：判定 easing 改 backOut
        const kind = row.status === "done" ? row.verdict : row.status;
        const badgeW = live ? (kind === "bonus" ? 124 : 112) : (kind === "bonus" ? 104 : 92);
        const badgeX = x + w - RIGHT_INNER_PAD - badgeW;
        const badge = JJBObsBar.drawBadge(parent, th, row, badgeX, y + topPad - (live ? 1 : 0), live, badgeW);
        badge.name = "jjbObsBadge_" + idx + "_" + kind;
        if (done) badge.opacity = 220;

        const mapW = w - padX * 2;
        const mapH = live ? Math.min(72, Math.round(mapW * 85 / 475)) : Math.min(48, Math.round(mapW * 85 / 475));
        // B6：hero 列地图 top 43→49（与非 hero 错开，hero 视觉下沉让出 badge 行高）
        const mapTop = y + (live ? 49 : 43);
        const map = JJBObsBar.coverSprite(parent, x + padX, mapTop, mapW, mapH, "images/maps/" + row.map);
        map.name = "jjbObsMap_" + idx;
        // B1：地图叠暗色近似降饱和（Cocos 无 saturate，opacity 0.6 近似）
        //     ※ 设计稿要 saturate(.55) → 这里用半透明 + 黑底叠色近似降饱和（无内建 saturate）
        if (done) map.opacity = 180;
        else if (!live) map.opacity = 220;

        const ccW = live ? 56 : 46;
        const ccH = live ? 67 : 55;
        const fxSize = live ? 44 : 34;
        const factorGap = 8;
        const cmdGap = 6;
        const cmdBlockW = row.cmds.length > 0 ? row.cmds.length * ccW + Math.max(0, row.cmds.length - 1) * cmdGap : 0;
        const factorAreaX = x + padX + cmdBlockW + (row.cmds.length > 0 ? 10 : 0);
        const factorAreaW = Math.max(0, w - padX - (factorAreaX - x));
        const perRow = Math.max(1, Math.floor((factorAreaW + factorGap) / (fxSize + factorGap)));
        const rowsNeeded = Math.max(1, Math.ceil((row.factors || []).length / perRow));
        // B6：折行行距 7→8
        const factorLineGap = 8;
        const factorBlockH = rowsNeeded * fxSize + Math.max(0, rowsNeeded - 1) * factorLineGap;
        const lineH = Math.max(ccH, factorBlockH);
        const lineTop = y + h - 10 - lineH;
        const factorOffsetY = (lineH - factorBlockH) / 2;  // B6：因子块在阵容行垂直居中

        (row.cmds || []).forEach((c, k) => {
            const card = JJBObsBar.cmdCard(parent, x + padX + k * (ccW + cmdGap), lineTop + Math.max(0, (lineH - ccH) / 2), ccW, ccH, c, th, !live);
            if (done) card.opacity = 220;
        });
        (row.factors || []).forEach((f, k) => {
            const col = k % perRow;
            const rr = Math.floor(k / perRow);
            const isMutator = !!(row.doubles && row.mutators && k < row.mutators.length);
            const card = JJBObsBar.factorCard(parent, factorAreaX + col * (fxSize + factorGap), lineTop + factorOffsetY + rr * (fxSize + factorLineGap), fxSize, f, th, isMutator);
            if (done) card.opacity = 220;
        });
    }

    private static drawBadge(parent: cc.Node, th: Theme, row: ObsRow, x: number, y: number, liveSize: boolean, w: number): cc.Node {
        const kind = row.status === "done" ? row.verdict : row.status;
        const label = kind === "live" ? "进行中" : (kind === "wait" ? "待战" : RESULT_LABEL[kind]);
        const h = liveSize ? 34 : 26;
        let fill: cc.Color = null, edge: cc.Color = null, col = th.muted;
        // A2：胜利/带奖励字色用 th.onState（设计 on-state token），删 ON_STATE 硬编码
        if (kind === "win") { fill = th.win; col = th.onState; }
        else if (kind === "bonus") { fill = th.bonus; col = th.onState; }
        else if (kind === "lose") { fill = th.lose; col = cc.Color.WHITE; }
        else if (kind === "live") { fill = th.accent; col = th.onAccent; }
        else { fill = th.panelBg; edge = th.panelEdge; col = th.muted; }
        let n: cc.Node;
        if (th.style === "metal") n = JJBObsBar.cutBox(parent, x, y, w, h, fill, edge, 1, 7);
        else if (th.style === "minimal") n = JJBObsBar.roundBox(parent, x, y, w, h, fill, edge, 1, 5);
        else n = JJBObsBar.box(parent, x, y, w, h, fill, edge, 1);
        const textX = kind === "live" ? x + 15 : x;
        if (kind === "live") {
            const dot = JJBObsBar.dot(parent, x + 13, y + h / 2 - 4, 8, col);
            JJBObsBar.pulse(dot);
        }
        JJBObsBar.label(parent, textX, y + (liveSize ? 8 : 6), kind === "live" ? w - 18 : w, h - 8, label || "待判", liveSize ? 19 : 16, col, HA.CENTER, 255, undefined, true);
        // B5：判定落定 easing 改 backOut（1.04→1 弹回手感更稳）
        if (kind === "win" || kind === "bonus" || kind === "lose") {
            n.scale = 1;
            cc.tween(n).to(0.09, { scale: 1.04 }, { easing: "backOut" }).to(0.07, { scale: 1 }, { easing: "quadOut" }).start();
        }
        return n;
    }

    private static matchPanel(parent: cc.Node, x: number, y: number, w: number, h: number, th: Theme, live: boolean): cc.Node {
        let n: cc.Node;
        const edge = live ? th.accent : th.panelEdge;
        const lw = live ? 2 : 1;
        if (th.style === "metal") n = JJBObsBar.cutBox(parent, x, y, w, h, th.panelBg, edge, lw, 12);
        else if (th.style === "minimal") n = JJBObsBar.roundBox(parent, x, y, w, h, th.panelBg, edge, lw, 8);
        else {
            n = JJBObsBar.box(parent, x, y, w, h, th.panelBg, edge, lw);
            JJBObsBar.cornerTicks(parent, x, y, w, h, th.accent, 13, 2);
        }
        return n;
    }

    private static cmdCard(parent: cc.Node, x: number, y: number, w: number, h: number, name: string, th: Theme, noName: boolean): cc.Node {
        const n = JJBObsBar.placed(parent, x, y, w, h);
        n.name = "jjbObsCmd_" + name;
        JJBObsBar.roundBox(n, 1, 2, w, h, cc.color(0, 0, 0, 108), null, 0, 6);
        JJBObsBar.roundBox(n, 0, 0, w, h, cc.color(10, 16, 24, 255), cc.color(0, 0, 0, 158), 1, 6);
        JJBObsBar.coverSprite(n, 2, 2, w - 4, h - 4, "images/commander/" + name);
        JJBObsBar.roundBox(n, 2, 2, w - 4, Math.max(12, Math.round(h * 0.3)), cc.color(255, 255, 255, 34), null, 0, 4);
        JJBObsBar.roundBox(n, 2, 2, w - 4, h - 4, null, cc.color(255, 255, 255, 44), 1, 4);
        if (!noName && name) {
            JJBObsBar.box(n, 2, h - 18, w - 4, 16, cc.color(0, 0, 0, 210), null);
            JJBObsBar.label(n, 2, h - 16, w - 4, 13, name, name.length >= 4 ? 10 : 10.5, cc.Color.WHITE, HA.CENTER);
        }
        return n;
    }

    private static factorCard(parent: cc.Node, x: number, y: number, size: number, name: string, th: Theme, isMutator: boolean): cc.Node {
        return JJBBorder.framedFactorV4(parent, x, y, size, name, th, {
            local: true,
            nodeName: "jjbObsFx_" + name,
            tag: isMutator ? "官突" : undefined,
        });
    }

    private static exposeDebug(source: string, rows: ObsRow[], score: { wins: number; total: number; pips: string[] }, heroIndex: number, finalState: boolean, bar: cc.Node, bare: boolean = false): void {
        try {
            const w: any = window;
            w.__jjbDebug = w.__jjbDebug || {};
            const colUnits = rows.map((r, i) => i === heroIndex ? 1.52 : 1);
            // C4（Phase E）：强制刷新世界矩阵全链（convertToWorldSpaceAR 只 refresh bar 自身，
            //   但 parent (JJBDesignRoot) 的 _worldMatrix 在 view 切 / setContentSize 后可能 stale，
            //   导致 bar 矩阵基于旧 root 矩阵算错位。沿父链 root → canvas 全部 _updateWorldMatrix。
            //   同时把可读字段挂到 getter，自动化测试读 obsbar.* 时强制重算 + 刷新，避免 build-time stale。
            JJBObsBar.refreshWorldMatrixChain(bar);
            // A4：实测横条 1280×232 边界不越（用 convertToWorldSpaceAR 拿四到世界坐标）
            // C4（Phase E）：期望值从 cc.view.getVisibleSize 实测推导，禁止 magic number。
            // 实测确认 cc.Node.convertToWorldSpaceAR 在本项目（web-mobile SHOW_ALL, 1280×720/232 design）
            //   返回 Y-up bottom-left origin 坐标（Y=0 = 屏幕底，Y=vs.height = 屏幕顶）。
            //   bar 贴 720 design 底 → brY=0, tlY=232；bar 贴 232 design 顶 → brY=0, tlY=232。
            const ds = cc.view.getDesignResolutionSize();
            const vs = cc.view.getVisibleSize();
            const tl = bar.convertToWorldSpaceAR(cc.v2(0, 0));
            const br = bar.convertToWorldSpaceAR(cc.v2(bar.width, -bar.height));
            // viewport 边界（Y-up bottom-left）
            const viewportBottom = 0;
            const viewportTop = vs.height;
            const barBottom = br.y;
            const barTop = tl.y;
            const bottomAligned = Math.abs(barBottom - viewportBottom) < 1.5;
            const topAligned = Math.abs(barTop - viewportTop) < 1.5;
            // 期望：bar 底==可视区底（贴底非 bare）/ 顶==可视区顶（贴顶 bare）
            const expectedBottomY = viewportBottom;
            const expectedTopY = viewportTop;
            const wFromBR = br.x - tl.x, hFromBR = tl.y - br.y;
            // 实测：遍历 jjbObsBar 子节点包围盒校验不越 1280×232（用世界坐标）
            // 容忍 ≤1.5px 偏移（drawBg 8 段渐变重叠 1-2px 是已知的稳定 overflow，非视觉破相）
            let overflow = false;
            const overflowChips: any[] = [];
            const minX = tl.x, maxX = br.x;
            const minY = br.y, maxY = tl.y;
            const TOL = 1.5;
            for (let i = 0; i < bar.childrenCount; i++) {
                const c = bar.children[i];
                if (!c) continue;
                if (typeof cc.isValid === "function" && !cc.isValid(c, true)) continue;
                const cTL = c.convertToWorldSpaceAR ? c.convertToWorldSpaceAR(cc.v2(0, 0)) : null;
                const cBR = c.convertToWorldSpaceAR ? c.convertToWorldSpaceAR(cc.v2(c.width, -c.height)) : null;
                if (!cTL || !cBR) continue;
                if (cTL.x < minX - TOL || cBR.x > maxX + TOL || cBR.y < minY - TOL || cTL.y > maxY + TOL) {
                    overflow = true;
                    if (overflowChips.length < 4) overflowChips.push({ name: c.name, cTL: { x: Math.round(cTL.x), y: Math.round(cTL.y) }, cBR: { x: Math.round(cBR.x), y: Math.round(cBR.y) } });
                }
            }
            // 实测：徽章右缘 = 卡右内缘 - 13（不越卡片 6px 等破相）
            const badgeEdgesOk: boolean[] = [];
            const badgeEdgesDetail: any[] = [];
            const matchNodes: cc.Node[] = [];
            for (let i = 0; i < rows.length; i++) {
                const m = bar.getChildByName("jjbObsMatch_" + i);
                if (m) matchNodes.push(m);
            }
            for (let i = 0; i < bar.childrenCount; i++) {
                const c: any = bar.children[i];
                if (!c || !c.name || c.name.indexOf("jjbObsBadge_") !== 0) continue;
                const cTL = c.convertToWorldSpaceAR(cc.v2(0, 0));
                const cBR = c.convertToWorldSpaceAR(cc.v2(c.width, -c.height));
                const badgeRight = cBR.x;
                let host: cc.Node = null;
                for (const m of matchNodes) {
                    const mTL = m.convertToWorldSpaceAR(cc.v2(0, 0));
                    const mBR = m.convertToWorldSpaceAR(cc.v2(m.width, -m.height));
                    if (cTL.x + c.width * 0.5 >= mTL.x && cTL.x + c.width * 0.5 <= mBR.x) { host = m; break; }
                }
                if (!host) { badgeEdgesOk.push(false); badgeEdgesDetail.push({ name: c.name, noMatch: true }); continue; }
                const mBR = host.convertToWorldSpaceAR(cc.v2(host.width, -host.height));
                const cardRightInner = mBR.x - 13;
                const delta = badgeRight - cardRightInner;
                badgeEdgesOk.push(Math.abs(delta) < 1.5);
                badgeEdgesDetail.push({ name: c.name, badgeRight: Math.round(badgeRight * 10) / 10, cardRightInner: Math.round(cardRightInner * 10) / 10, delta: Math.round(delta * 10) / 10 });
            }
            const allBadgesRightAligned = badgeEdgesOk.length > 0 && badgeEdgesOk.every((v) => v);
            // C2/C4：bar 填满可视区实测（bare=true 时）
            //   期望：bar 底==可视区底 且 顶==底+BAR_H（实测推导，禁止 magic number）
            //   非 bare 时仍要求贴底（保持原行为兼容）。
            const barHeight = barTop - barBottom;
            const expectedBarHeight = BAR_H;
            const barFillsViewport = Math.abs(barBottom - expectedBottomY) < 1.5
                && Math.abs(barTop - expectedTopY) < 1.5
                && Math.abs(barHeight - expectedBarHeight) < 1.5;
            // C4（Phase E）：可读字段用 Object.defineProperty getter，自动化测试读 obsbar.* 时强制重算 + 刷新，
            //   避免 exposeDebug build-time 算时 _worldMatrix stale 报 stale 值。Proxy + JSON.stringify 不兼容，
            //   改用 defineProperty 单字段 getter。
            const o: any = {
                source: source,
                live: source === "live",
                doubles: source === "doubles",
                width: BAR_W,
                height: BAR_H,
                top: bare ? 0 : BAR_TOP,
                tlX: Math.round(tl.x),
                brX: Math.round(br.x),
                measuredW: Math.round(wFromBR),
                measuredH: Math.round(hFromBR),
                score: { wins: score.wins, total: score.total, label: finalState ? "终局 · 已胜场" : "当前局分 · 已胜场", pips: score.pips.slice() },
                statuses: rows.map((r) => r.status === "done" ? r.verdict : r.status),
                stateTokens: ["win", "bonus", "lose", "live", "wait"],
                heroIndex: heroIndex,
                heroFlex: heroIndex >= 0 ? 1.52 : 1,
                columnUnits: colUnits,
                matchCount: rows.length,
                mapRatio: "475:85",
                scale033: { width: Math.round(BAR_W * 0.333), height: Math.round(BAR_H * 0.333) },
                noOverflow: !overflow,
                overflowChips: overflowChips,
                badgesRightAligned: allBadgesRightAligned,
                badgeEdgesDetail: badgeEdgesDetail,
                fullscreenBgNode: !!w.__jjbDebug.__jjbFullscreenBgNode,
                finalState: finalState,
                goldFactorsActive: rows.some((r) => (r.factors || []).some((f) => JJBBorder.isGoldFactor(f))),
                bare: bare,
            };
            const recompute = () => {
                try {
                    JJBObsBar.refreshWorldMatrixChain(bar);
                    // 强制 init _worldMatrix（node destroy 后 or 第一次访问前 _worldMatrix 可能 null）
                    try { (bar as any).getWorldMatrix((cc as any).Mat4.identity(new (cc as any).Mat4())); } catch (e2) { /* noop */ }
                    const _ds = cc.view.getDesignResolutionSize();
                    const _vs = cc.view.getVisibleSize();
                    const _tl = bar.convertToWorldSpaceAR(cc.v2(0, 0));
                    const _br = bar.convertToWorldSpaceAR(cc.v2(bar.width, -bar.height));
                    return { _ds, _vs, _tl, _br, _ok: true };
                } catch (e) {
                    return { _ds: cc.view.getDesignResolutionSize(), _vs: cc.view.getVisibleSize(),
                        _tl: cc.v2(0, 0), _br: cc.v2(0, 0), _ok: false };
                }
            };
            const liveGetters: Array<[string, () => any]> = [
                ["brY", () => { const r = recompute(); return Math.round(r._br.y); }],
                ["tlY", () => { const r = recompute(); return Math.round(r._tl.y); }],
                ["barBottomY", () => { const r = recompute(); return Math.round(r._br.y * 10) / 10; }],
                ["barTopY", () => { const r = recompute(); return Math.round(r._tl.y * 10) / 10; }],
                ["barHeightMeasured", () => { const r = recompute(); return Math.round((r._tl.y - r._br.y) * 10) / 10; }],
                ["bottomAligned", () => { const r = recompute(); return Math.abs(r._br.y - 0) < 1.5; }],
                ["topAligned", () => { const r = recompute(); return Math.abs(r._tl.y - r._vs.height) < 1.5; }],
                ["barFillsViewport", () => {
                    const r = recompute();
                    return Math.abs(r._br.y - 0) < 1.5
                        && Math.abs(r._tl.y - r._vs.height) < 1.5
                        && Math.abs((r._tl.y - r._br.y) - BAR_H) < 1.5;
                }],
                ["designResolution", () => { const r = recompute(); return { width: r._ds.width, height: r._ds.height }; }],
                ["visibleSize", () => { const r = recompute(); return { width: r._vs.width, height: r._vs.height }; }],
                ["viewportBottomY", () => 0],
                ["viewportTopY", () => { const r = recompute(); return r._vs.height; }],
            ];
            for (const [k, g] of liveGetters) {
                Object.defineProperty(o, k, { get: g, enumerable: true, configurable: true });
            }
            w.__jjbDebug.obsbar = o;
            if (source === "doubles") JJBDoubles.exposeDebug();
        } catch (e) {
            cc.error("[JJBObsBar.exposeDebug] " + e);
        }
    }

    /** C4（Phase E）：沿 bar 父链 root → canvas 全部 _updateWorldMatrix。
     *  Cocos 2.4 convertToWorldSpaceAR 只 refresh bar 自身，父链 (JJBDesignRoot) _worldMatrix
     *  在 view 切 / setContentSize 后可能 stale，导致 bar 矩阵基于旧 root 矩阵算错位。 */
    private static refreshWorldMatrixChain(bar: cc.Node): void {
        try {
            const chain: any[] = [];
            let n: any = bar;
            while (n) { chain.push(n); n = n.parent; }
            for (let i = chain.length - 1; i >= 0; i--) {
                const node: any = chain[i];
                if (typeof node._updateWorldMatrix === "function") node._updateWorldMatrix();
            }
        } catch (e) { /* noop */ }
    }

    private static pipColor(th: Theme, p: string): cc.Color {
        if (p === "win") return th.win;
        if (p === "bonus") return th.bonus;
        if (p === "lose") return th.lose;
        if (p === "live") return th.accent;
        return th.panelBg;
    }

    private static pulse(n: cc.Node): void {
        cc.tween(n).repeatForever(
            cc.tween().to(0.55, { opacity: 56 }, { easing: "quadInOut" }).to(0.55, { opacity: 255 }, { easing: "quadInOut" })
        ).start();
    }

    private static alpha(c: cc.Color, a: number): cc.Color { return cc.color(c.r, c.g, c.b, a); }

    private static placed(parent: cc.Node, left: number, top: number, w: number, h: number): cc.Node {
        const n = new cc.Node();
        n.parent = parent;
        n.setAnchorPoint(0, 1);
        n.setContentSize(w, h);
        n.setPosition(left, -top);
        return n;
    }

    private static box(parent: cc.Node, left: number, top: number, w: number, h: number,
                       fill?: cc.Color, edge?: cc.Color, lineW: number = 1): cc.Node {
        const n = JJBObsBar.placed(parent, left, top, w, h);
        const g = n.addComponent(cc.Graphics);
        g.rect(0, -h, w, h);
        if (fill) { g.fillColor = fill; g.fill(); }
        if (edge) { g.strokeColor = edge; g.lineWidth = lineW; g.stroke(); }
        return n;
    }

    private static cutBox(parent: cc.Node, left: number, top: number, w: number, h: number,
                          fill?: cc.Color, edge?: cc.Color, lineW: number = 1, cut: number = 12): cc.Node {
        const n = JJBObsBar.placed(parent, left, top, w, h);
        const g = n.addComponent(cc.Graphics);
        g.moveTo(0, 0);
        g.lineTo(w - cut, 0); g.lineTo(w, -cut); g.lineTo(w, -h);
        g.lineTo(cut, -h); g.lineTo(0, -(h - cut)); g.close();
        if (fill) { g.fillColor = fill; g.fill(); }
        if (edge) { g.strokeColor = edge; g.lineWidth = lineW; g.stroke(); }
        return n;
    }

    private static roundBox(parent: cc.Node, left: number, top: number, w: number, h: number,
                            fill?: cc.Color, edge?: cc.Color, lineW: number = 1, r: number = 6): cc.Node {
        const n = JJBObsBar.placed(parent, left, top, w, h);
        const g = n.addComponent(cc.Graphics);
        g.roundRect(0, -h, w, h, r);
        if (fill) { g.fillColor = fill; g.fill(); }
        if (edge) { g.strokeColor = edge; g.lineWidth = lineW; g.stroke(); }
        return n;
    }

    private static dot(parent: cc.Node, left: number, top: number, size: number, color: cc.Color): cc.Node {
        const n = JJBObsBar.placed(parent, left, top, size, size);
        const g = n.addComponent(cc.Graphics);
        g.fillColor = color;
        g.circle(size / 2, -size / 2, size / 2);
        g.fill();
        return n;
    }

    private static label(parent: cc.Node, left: number, top: number, w: number, h: number,
                         text: string, size: number, color: cc.Color,
                         align: number = HA.LEFT, opacity: number = 255, font?: string, bold: boolean = false): cc.Node {
        const n = JJBObsBar.placed(parent, left, top, w, h);
        const l = n.addComponent(cc.Label);
        if (font) l.fontFamily = font;
        l.string = text;
        l.fontSize = size;
        l.lineHeight = Math.round(size * 1.12);
        l.horizontalAlign = align;
        l.verticalAlign = cc.Label.VerticalAlign.TOP;
        l.overflow = cc.Label.Overflow.CLAMP;
        l.enableWrapText = false;
        n.setContentSize(w, h);
        n.color = color;
        n.opacity = opacity;
        if (bold) {
            const shadow = n.addComponent(cc.LabelOutline);
            shadow.color = color;
            shadow.width = 1;
        }
        return n;
    }

    private static sprite(parent: cc.Node, left: number, top: number, w: number, h: number, resPath: string): cc.Node {
        const n = JJBObsBar.placed(parent, left, top, w, h);
        const s = n.addComponent(cc.Sprite);
        s.sizeMode = cc.Sprite.SizeMode.CUSTOM;
        s.trim = false;
        cc.resources.load(resPath, cc.SpriteFrame, (err: Error, sf: cc.SpriteFrame) => {
            if (!err && sf && cc.isValid(n)) {
                s.spriteFrame = sf;
                n.setContentSize(w, h);
            }
        });
        return n;
    }

    private static coverSprite(parent: cc.Node, left: number, top: number, w: number, h: number, resPath: string): cc.Node {
        const box = JJBObsBar.placed(parent, left, top, w, h);
        const mask = box.addComponent(cc.Mask);
        mask.type = cc.Mask.Type.RECT;
        const inner = new cc.Node();
        inner.parent = box;
        inner.setAnchorPoint(0.5, 0.5);
        inner.setPosition(w / 2, -h / 2);
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

    private static cornerTicks(parent: cc.Node, left: number, top: number, w: number, h: number,
                               color: cc.Color, len: number, lw: number): cc.Node {
        const n = JJBObsBar.placed(parent, left, top, w, h);
        const g = n.addComponent(cc.Graphics);
        g.strokeColor = color; g.lineWidth = lw;
        g.moveTo(0, 0); g.lineTo(len, 0); g.moveTo(0, 0); g.lineTo(0, -len);
        g.moveTo(w, -h); g.lineTo(w - len, -h); g.moveTo(w, -h); g.lineTo(w, -h + len);
        g.stroke();
        return n;
    }

    // B6：logo 等比——高固定、宽按原图比缩放
    private static logoSized(parent: cc.Node, left: number, top: number, height: number, resPath: string): cc.Node {
        const n = JJBObsBar.placed(parent, left, top, height, height);
        const s = n.addComponent(cc.Sprite);
        s.sizeMode = cc.Sprite.SizeMode.CUSTOM;
        s.trim = false;
        cc.resources.load(resPath, cc.SpriteFrame, (err: Error, sf: cc.SpriteFrame) => {
            if (err || !sf || !cc.isValid(n)) return;
            s.spriteFrame = sf;
            const os = sf.getOriginalSize();
            const w = os.height > 0 ? Math.round(os.width * height / os.height) : height;
            n.setContentSize(w, height);
        });
        return n;
    }
}
