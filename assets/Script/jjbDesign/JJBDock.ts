// 集结杯 v4 — 直播停靠浮层 Dock（1280×300 全宽底部大条）。
// 用户方向（2026-06-14）：放直播屏幕底部/右下，三场「等大」、因子/头像/地图放大到观众能看清，
//   观看舒适 > 设计美学，可向下超出屏底。推翻 handoff 的 1280×160 hero+chip 压缩形态（那个把 2 场缩成小 chip）。
// 三场等大渲染，live 场用 accent 描边高亮（不放大、不压缩别的）。横条在上、本框在下，二者互补。
// 配色取自 JJBTheme token（零自创色）；因子框/指挥官卡复用 JJBBorder；数据读真实会话(sessionMatches/jjbLive)→DEMO 兜底。
import { Theme } from "./JJBTheme";
import { DEMO_MATCHES, VAL_RESULT, RESULT_LABEL, jjbLive, markFor, sessionMatches } from "./JJBData";
import JJBDoubles, { doublesLive, doublesMatches } from "./JJBDoubles";
import JJBBorder from "./JJBBorder";
import JJBView from "./JJBView";
import JijieData from "../jijie2/JijieData";

const HA = cc.Label.HorizontalAlign;
const DOCK_W = 1280;
const DOCK_H = 300;
const SONG = "Songti SC, STSong, serif";

interface DockRow {
    slot: string; map: string; cmds: string[]; factors: string[];
    doubles: boolean; status: string; verdict: string;
}

export default class JJBDock {

    /** 入口：在 root（designResolution 已切 1280×300）上画整条 Dock。 */
    static build(root: cc.Node, th: Theme, bare: boolean = false): void {
        JJBDock.backing(root, th);
        JJBDock.grad(root, th);

        const data = JJBDock.resolve();
        const rows = data.rows;
        if (!rows.length) return;
        const score = JJBDock.deriveScore(rows);
        const liveIdx = JJBDock.heroIndex(rows); // 仅用于 live 场描边高亮（不改变尺寸）

        JJBView.box(root, 0, 0, DOCK_W, 3, JJBDock.alpha(th.accent, 235)); // 顶部 accent 描边
        JJBDock.scoreBlock(root, th, score, data.finalState);

        // 三场「等大」面板（横向排开）
        const sbW = 214;                                    // 比分块占宽
        const gap = 14, rightPad = 24;
        const startX = sbW + 10;                            // 224
        const panelW = Math.floor((DOCK_W - startX - rightPad - gap * 2) / 3); // ≈335
        rows.forEach((r, i) => {
            const x = startX + i * (panelW + gap);
            JJBDock.matchPanel(root, x, panelW, th, r, i === liveIdx);
        });

        if (data.source === "demo") JJBView.demoBadge(root, th, DOCK_W - 116, 8);
        JJBDock.exposeDebug(data.source, rows, score, liveIdx, data.finalState);
    }

    // ============ 数据解析（端口 JJBObsBar.resolveRows/deriveScore/heroIndex）============
    private static resolve(): { rows: DockRow[]; source: string; finalState: boolean } {
        const d: any = JijieData;
        const doubles = doublesLive();
        const live = !doubles && jjbLive();
        const raw: any[] = doubles ? doublesMatches() : (live ? sessionMatches() : DEMO_MATCHES);
        const wl: number[] = doubles ? (JJBDoubles.winLoseList || []) : (live ? (d.winLoseList || []) : []);
        let liveAssigned = false;
        const rows: DockRow[] = raw.map((m: any, i: number) => {
            let status = "", verdict = "";
            if (live || doubles) {
                if (typeof wl[i] === "number") { status = "done"; verdict = VAL_RESULT[wl[i]]; }
                else if (!liveAssigned) { status = "live"; liveAssigned = true; }
                else status = "wait";
            } else if (m.status === "live" || m.status === "wait") {
                status = m.status;
            } else if (m.status === "win" || m.status === "bonus" || m.status === "lose") {
                status = "done"; verdict = m.status;
            } else if (m.result) {
                status = "done"; verdict = m.result;
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
                status: status, verdict: verdict,
            };
        });
        const finalState = rows.length > 0 && rows.every((r) => r.status === "done");
        return { rows: rows, source: doubles ? "doubles" : (live ? "live" : "demo"), finalState: finalState };
    }

    private static deriveScore(rows: DockRow[]): { wins: number; total: number; pips: string[] } {
        const wins = rows.filter((r) => r.status === "done" && (r.verdict === "win" || r.verdict === "bonus")).length;
        const pips = rows.map((r) => {
            if (r.status === "live") return "live";
            if (r.status === "wait") return "wait";
            return r.verdict || "wait";
        });
        return { wins: wins, total: rows.length, pips: pips };
    }

    private static heroIndex(rows: DockRow[]): number {
        for (let i = 0; i < rows.length; i++) if (rows[i].status === "live") return i;
        return -1;
    }

    // ============ 背景 ============
    private static backing(root: cc.Node, th: Theme): void {
        JJBView.box(root, -360, -260, 2000, 1160, th.bgB); // overscan
    }

    private static grad(root: cc.Node, th: Theme): void {
        const SEG = 16;
        for (let i = 0; i < SEG; i++) {
            const t = i / (SEG - 1);
            const col = cc.color(
                Math.round(th.bgA.r + (th.bgB.r - th.bgA.r) * t),
                Math.round(th.bgA.g + (th.bgB.g - th.bgA.g) * t),
                Math.round(th.bgA.b + (th.bgB.b - th.bgA.b) * t), 255);
            JJBView.box(root, 0, Math.floor(DOCK_H * i / SEG), DOCK_W, Math.ceil(DOCK_H / SEG) + 1, col);
        }
    }

    // ============ 比分块（x24 w190，放大）============
    private static scoreBlock(root: cc.Node, th: Theme, score: { wins: number; total: number; pips: string[] }, finalState: boolean): void {
        const X = 24;
        JJBView.sprite(root, X, 22, 30, 30, markFor(th.style, th.mode));
        JJBView.box(root, X + 40, 22, 1, 28, JJBDock.alpha(th.accent, 153));
        JJBView.label(root, X + 50, 25, 150, 26, "集结杯", 18, th.ink, HA.LEFT, 255, th.serifTitle ? SONG : undefined);
        // 大比分 wins / total
        JJBView.label(root, X, 66, 80, 76, String(score.wins), 76, th.accent, HA.LEFT, 255, "Oswald");
        JJBView.label(root, X + 50, 100, 18, 36, "/", 36, th.muted, HA.LEFT);
        JJBView.label(root, X + 66, 100, 30, 36, String(score.total), 36, th.ink, HA.LEFT, 255, "Oswald");
        JJBView.label(root, X, 176, 196, 18, finalState ? "终局 · 已胜场" : "当前局分 · 已胜场", 14, th.muted, HA.LEFT);
        // pip 进度条（3 段，放大）
        const segW = (196 - 16) / 3;
        score.pips.forEach((p, i) => {
            const px = X + Math.round(i * (segW + 8));
            const c = JJBDock.pipColor(th, p);
            if (c) JJBView.box(root, px, 212, Math.round(segW), 14, c);
            else JJBView.box(root, px, 212, Math.round(segW), 14, null, th.panelEdge, 1);
        });
    }

    private static pipColor(th: Theme, p: string): cc.Color {
        if (p === "live") return th.accent;
        if (p === "win") return th.win;
        if (p === "bonus") return th.bonus;
        if (p === "lose") return th.lose;
        return null;
    }

    // ============ 单场面板（三场等大；live 场 accent 描边）============
    private static matchPanel(root: cc.Node, x: number, w: number, th: Theme, row: DockRow, live: boolean): void {
        const top = 16, H = 272;
        const done = row.status === "done";
        const p = JJBDock.panel(root, x, top, w, H, th, live);
        if (done) p.opacity = 224;
        const cx = x + 14, contentR = x + w - 14, innerW = w - 28;
        const kind = done ? row.verdict : row.status;
        // 顶行：场次 + 判定徽章（右）
        JJBView.label(root, cx, top + 14, 170, 28, row.slot, 22, th.accent, HA.LEFT, 255, th.serifTitle ? SONG : undefined);
        const bw = JJBDock.badgeW(kind, true);
        JJBDock.badge(root, contentR - bw, top + 12, bw, th, kind, true);
        // 中行：指挥官卡（放大）+ 地图横幅（放大）
        const midY = top + 52;
        JJBBorder.framedCmdV4(root, cx, midY, 66, 82, row.cmds[0] || "", th, { noName: false });
        const mapX = cx + 66 + 12;
        JJBDock.mapBanner(root, mapX, midY + 2, contentR - mapX, 78, row.map, th);
        // 因子横排（放大到 76px + 名字，三场都看清）
        const fw = 76, fgap = 10, fac = (row.factors || []).slice(0, 3);
        const blockW = fac.length * fw + Math.max(0, fac.length - 1) * fgap;
        const fStart = cx + Math.max(0, (innerW - blockW) / 2);
        const fY = top + 52 + 82 + 14;
        fac.forEach((f, i) => {
            const fx = fStart + i * (fw + fgap);
            JJBBorder.framedFactorV4(root, fx, fY, fw, f, th, {});
            JJBView.label(root, fx - 6, fY + fw + 3, fw + 12, 15, f, 12, th.muted, HA.CENTER);
        });
    }

    // ============ 主题面板（metal 切角12 / sc2 直角+四角刻线 / minimal 圆角8；live→accent 描边）============
    private static panel(root: cc.Node, x: number, top: number, w: number, h: number, th: Theme, live: boolean): cc.Node {
        const edge = live ? th.accent : th.panelEdge;
        const lw = live ? 2 : 1;
        if (th.style === "metal") return JJBView.cutBox(root, x, top, w, h, th.panelBg, edge, lw, 12);
        if (th.style === "minimal") return JJBDock.roundBox(root, x, top, w, h, th.panelBg, edge, lw, 8);
        const n = JJBView.box(root, x, top, w, h, th.panelBg, edge, lw);
        JJBView.cornerTicks(root, x, top, w, h, th.accent, 14, 2);
        return n;
    }

    // ============ 地图横幅（cover 图 + 底部暗条 + 名字）============
    private static mapBanner(root: cc.Node, x: number, top: number, w: number, h: number, name: string, th: Theme): void {
        JJBView.coverSprite(root, x, top, w, h, "images/maps/" + name);
        JJBView.box(root, x, top + h - 22, w, 22, cc.color(0, 0, 0, 130));
        JJBView.label(root, x + 9, top + h - 20, w - 14, 16, name, 13, cc.Color.WHITE, HA.LEFT);
    }

    // ============ 判定/状态徽章（metal 切角 / minimal 圆角 / sc2 直角；live 脉冲点）============
    private static badge(root: cc.Node, x: number, top: number, w: number, th: Theme, kind: string, big: boolean): cc.Node {
        const label = kind === "live" ? "进行中" : (kind === "wait" ? "待战" : (RESULT_LABEL[kind] || "待判"));
        const h = big ? 32 : 24, fs = big ? 17 : 13.5;
        let fill: cc.Color = th.panelBg, edge: cc.Color = th.panelEdge, col = th.muted;
        if (kind === "win") { fill = th.win; edge = null; col = th.onState; }
        else if (kind === "bonus") { fill = th.bonus; edge = null; col = th.onState; }
        else if (kind === "lose") { fill = th.lose; edge = null; col = cc.Color.WHITE; }
        else if (kind === "live") { fill = th.accent; edge = null; col = th.onAccent; }
        let n: cc.Node;
        if (th.style === "metal") n = JJBView.cutBox(root, x, top, w, h, fill, edge, 1, 7);
        else if (th.style === "minimal") n = JJBDock.roundBox(root, x, top, w, h, fill, edge, 1, 5);
        else n = JJBView.box(root, x, top, w, h, fill, edge, 1);
        const textX = kind === "live" ? x + (big ? 17 : 15) : x;
        const textW = kind === "live" ? w - (big ? 20 : 17) : w;
        if (kind === "live") {
            const dot = JJBView.box(root, x + (big ? 12 : 10), top + h / 2 - (big ? 4 : 3), big ? 9 : 7, big ? 9 : 7, col);
            cc.tween(dot).repeatForever(cc.tween().to(0.65, { opacity: 130 }).to(0.65, { opacity: 255 })).start();
        }
        JJBView.label(root, textX, top + (h - fs) / 2 - 1, textW, fs + 2, label, fs, col, HA.CENTER);
        return n;
    }

    private static badgeW(kind: string, big: boolean): number {
        const label = kind === "live" ? "进行中" : (kind === "wait" ? "待战" : (RESULT_LABEL[kind] || "待判"));
        const fs = big ? 17 : 13.5, pad = big ? 26 : 18;
        const dot = kind === "live" ? (big ? 15 : 13) : 0;
        return Math.round(pad + label.length * fs + dot);
    }

    // ============ 工具 ============
    private static alpha(c: cc.Color, a: number): cc.Color { return cc.color(c.r, c.g, c.b, a); }

    private static roundBox(parent: cc.Node, left: number, top: number, w: number, h: number,
                            fill: cc.Color, edge: cc.Color, lineW: number, r: number): cc.Node {
        const n = JJBView.placed(parent, left, top, w, h);
        const g = n.addComponent(cc.Graphics);
        g.roundRect(0, -h, w, h, r);
        if (fill) { g.fillColor = fill; g.fill(); }
        if (edge) { g.strokeColor = edge; g.lineWidth = lineW; g.stroke(); }
        return n;
    }

    private static exposeDebug(source: string, rows: DockRow[], score: { wins: number; total: number; pips: string[] }, liveIdx: number, finalState: boolean): void {
        try {
            const w: any = window;
            w.__jjbDebug = w.__jjbDebug || {};
            w.__jjbDebug.dock = {
                source: source, wins: score.wins, total: score.total, liveIdx: liveIdx, finalState: finalState,
                rows: rows.map((r) => ({ slot: r.slot, map: r.map, status: r.status, verdict: r.verdict, cmds: r.cmds.length, factors: r.factors.length })),
                canvas: [DOCK_W, DOCK_H],
            };
        } catch (e) { /* noop */ }
    }
}
