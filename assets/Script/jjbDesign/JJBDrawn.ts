// 集结杯 × CM — 抽取结果页（证明前端读 XP 真实逻辑产出的 JijieData）
// 数据来源：XP 的 JijieControl.toStart() 跑完后写入的 JijieData.mapList / lockFactorList。
import { Theme } from "./JJBTheme";
import JJBView from "./JJBView";
import JijieData from "../jijie2/JijieData";

const HA = cc.Label.HorizontalAlign;

export default class JJBDrawn {

    static build(root: cc.Node, th: Theme, onBack: () => void): void {
        JJBView.bg(root, th);

        const fcount = JijieData.modelFactorCount === 2 ? 8 : (JijieData.modelFactorCount === 4 ? 12 : 10);
        JJBView.label(root, 50, 40, 600, 40, "本局已抽取", 32, th.ink);
        JJBView.label(root, 50, 86, 900, 24,
            "选手 " + (JijieData.playerName || "-") + "    比赛模式 " + fcount + " 因子    · 由 XP 逻辑实时产出",
            16, th.muted);
        JJBView.box(root, 50, 122, 1180, 2, th.panelEdge);

        const maps = JijieData.mapList || [];
        const facs = JijieData.lockFactorList || [];
        const top0 = 152, rowH = 116, gap = 16;
        for (let i = 0; i < 3; i++) {
            const y = top0 + i * (rowH + gap);
            JJBView.box(root, 50, y, 1180, rowH, th.panelBg, th.panelEdge, 1);
            JJBView.box(root, 50, y, 4, rowH, th.accent);
            JJBView.label(root, 82, y + 20, 160, 30, "第 " + (i + 1) + " 场", 22, th.accent);
            JJBView.label(root, 82, y + 62, 360, 30, "地图　" + (maps[i] || "—"), 20, th.ink);
            JJBView.label(root, 540, y + 62, 560, 30, "锁定因子　" + (facs[i] || "—"), 20, th.ink);
        }

        // 返回首页
        JJBView.box(root, 50, 660, 168, 44, th.panelBg, th.panelEdge, 1);
        JJBView.label(root, 50, 671, 168, 24, "← 返回首页", 16, th.muted, HA.CENTER);
        JJBView.hit(root, 50, 660, 168, 44, onBack);
    }
}
