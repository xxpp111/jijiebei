// ============================================================
// v4 规格板 · 指挥官边框状态矩阵 + 尺寸族 + 名牌
// 依赖 select-screen.jsx 的 CC、spec-factor.jsx 的 SpecBoard
// ============================================================

function CmdMatrix() {
  const cols = "120px repeat(5, 116px)";
  const heads = ["", "池中常态", "已用 sel", "拖拽中", "槽位 filled", "清槽 hover"];
  return (
    <SpecBoard title="指挥官边框 · 状态矩阵（微圆角 + 内外亮光描边 + 投影）">
      <div className="mx-grid" style={{ gridTemplateColumns: cols }}>
        {heads.map((h, i) => <div key={i} className="mx-h">{h}</div>)}
        <div className="mx-rowlab">70×84<br />A/B 池</div>
        <div className="mx-cell"><CC src="assets/cmd-raynor.png" name="雷诺" /></div>
        <div className="mx-cell"><CC src="assets/cmd-raynor.png" name="雷诺" sel check /></div>
        <div className="mx-cell"><CC src="assets/cmd-raynor.png" name="雷诺" drag /></div>
        <div className="mx-cell"><CC src="assets/cmd-raynor.png" name="雷诺" w={56} h={67} fill /></div>
        <div className="mx-cell"><CC src="assets/cmd-raynor.png" name="雷诺" w={56} h={67} fill clearHover /></div>
      </div>
      <div className="mx-divider"></div>
      <div className="mx-note">
        <b>结构（由内到外）</b>：画面 inset 2px / r4 → 顶部 30% 高光膜 → 内亮线 <code>inset 0 0 0 1px rgba(255,255,255,.17)</code> + 顶缘反光 →
        外圈 r6 暗描边 <code>0 0 0 1px rgba(0,0,0,.62)</code> → 投影 <code>0 3px 9px rgba(0,0,0,.42)</code>。亮色模式外圈换深蓝灰 <code>rgba(21,35,58,.4)</code>。<br />
        <b>sel</b> = accent 2px 光圈 + 12–16px 辉光 + 上浮 2px + ✓，画面降饱和 75%（"已被使用"）；<b>拖拽</b> = 缩放 1.06 + 光圈 + 大投影；
        <b>filled</b> = 同族边框 + accent 65% 内细线（替换现 1px 直角框）；<b>清槽 hover</b> = 62% 黑蒙层 + ✕ + 「点击清除」（10px）。
      </div>
    </SpecBoard>
  );
}

function CmdSizes() {
  const sizes = [[70, 84, "A/B 池"], [66, 80, "池·紧凑"], [60, 72, "自选区"], [58, 70, "battle"], [64, 78, "result/浮层"], [56, 67, "槽位"]];
  return (
    <SpecBoard title="指挥官边框 · 尺寸族（r6 / 内 r4 固定，描边不随尺寸缩放）">
      <div style={{ display: "flex", alignItems: "flex-end", gap: 26, padding: "8px 4px 2px" }}>
        {sizes.map(([w, h, lab]) => (
          <div key={lab} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 9 }}>
            <CC src="assets/cmd-nova.png" name="诺娃" w={w} h={h} />
            <span className="mx-h">{w}×{h}</span>
            <span className="mx-rowlab" style={{ fontSize: 10.5 }}>{lab}</span>
          </div>
        ))}
      </div>
      <div className="mx-note">
        <b>名牌</b>：底部渐变 <code>transparent → rgba(0,0,0,.9)</code> 内嵌于 r4 画面区（不再溢出边框），10.5px / 字距 1 / 单行截断；
        56×67 以下若名字 ≥4 字可降到 10px。名牌属于卡片内容层（z=2），始终被内亮线压住。
      </div>
    </SpecBoard>
  );
}

Object.assign(window, { CmdMatrix, CmdSizes });
