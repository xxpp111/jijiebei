// ============================================================
// v4 规格板 · 因子边框状态矩阵 + 6 主题适配条
// 依赖 select-screen.jsx 已导出的 FX
// ============================================================

function SpecBoard({ title, children, styleName = "metal", mode = "dark", width }) {
  return (
    <div className={`jjbx style-${styleName} mode-${mode}`} style={{ width: width || "auto", minHeight: "100%" }}>
      <div className="mx">
        <div className="mx-title">{title}</div>
        {children}
      </div>
    </div>
  );
}

function FactorMatrix() {
  const cols = "120px repeat(6, 108px)";
  const heads = ["", "常态", "选中 sel", "置灰 dim", "拖拽中", "已填（槽位）", "锁定 / 官突"];
  return (
    <SpecBoard title="因子边框 · 状态矩阵（普通绿框 / 金色金框）">
      <div className="mx-grid" style={{ gridTemplateColumns: cols }}>
        {heads.map((h, i) => <div key={i} className="mx-h">{h}</div>)}

        <div className="mx-rowlab">普通因子<br />mutatorframe</div>
        <div className="mx-cell"><FX src="assets/factor-blizzard.png" /></div>
        <div className="mx-cell"><FX src="assets/factor-blizzard.png" sel check /></div>
        <div className="mx-cell"><FX src="assets/factor-blizzard.png" dim /></div>
        <div className="mx-cell"><FX src="assets/factor-blizzard.png" drag /></div>
        <div className="mx-cell"><FX src="assets/factor-blizzard.png" size={52} /></div>
        <div className="mx-cell"><FX src="assets/factor-blizzard.png" size={52} tag="锁定" /></div>

        <div className="mx-rowlab">金色强化因子<br />grandmaster</div>
        <div className="mx-cell"><FX src="assets/factor-void.png" gold /></div>
        <div className="mx-cell"><FX src="assets/factor-void.png" gold sel check /></div>
        <div className="mx-cell"><FX src="assets/factor-void.png" gold dim /></div>
        <div className="mx-cell"><FX src="assets/factor-void.png" gold drag /></div>
        <div className="mx-cell"><FX src="assets/factor-void.png" gold size={52} /></div>
        <div className="mx-cell"><FX src="assets/factor-void.png" gold size={52} tag="官突" /></div>
      </div>
      <div className="mx-divider"></div>
      <div className="mx-note">
        <b>叠加规则</b>：边框是图标的固有皮肤（z=2），状态效果一律包在边框外侧——sel 外圈 <code>0 0 0 2px var(--accent)</code> + 上浮 3px + ✓ 角标（z=5）；
        dim 同时压暗图芯（38%）与边框（55%），保持轮廓可辨；锁定 = 深底描金字角标，官突 = 实底 accent 角标，均贴左下角压边框。
        金色框自带外发光，框面放大 110%、图芯内收 82%，sel 外圈包在发光之外。
      </div>
    </SpecBoard>
  );
}

function FactorSizes() {
  const sizes = [[74, "池 · 12 因子"], [66, "池 · 8 因子"], [56, "battle"], [52, "槽位"], [46, "result"]];
  return (
    <SpecBoard title="因子边框 · 尺寸族（同一素材整体缩放，无需九宫格）">
      <div style={{ display: "flex", alignItems: "flex-end", gap: 30, padding: "8px 4px 2px" }}>
        {sizes.map(([s, lab]) => (
          <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 9 }}>
            <FX src="assets/factor-lava.png" size={s} />
            <span className="mx-h">{s}×{s}</span>
            <span className="mx-rowlab" style={{ fontSize: 10.5 }}>{lab}</span>
          </div>
        ))}
        <div style={{ width: 1, alignSelf: "stretch", background: "var(--panel-edge)" }}></div>
        {sizes.slice(1, 4).map(([s]) => (
          <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 9 }}>
            <FX src="assets/factor-money.png" gold size={s} />
            <span className="mx-h">{s}×{s}</span>
          </div>
        ))}
      </div>
      <div className="mx-note">最小 46×46 时绿框细节仍可辨；金框发光在 46px 下收敛为 1–2px 光晕，不丢失金色语义。</div>
    </SpecBoard>
  );
}

function ThemeStrip() {
  const themes = [["metal", "dark", "金属·暗"], ["metal", "light", "金属·亮"], ["sc2", "dark", "星际2·暗"], ["sc2", "light", "星际2·亮"], ["minimal", "dark", "极简·暗"], ["minimal", "light", "极简·亮"]];
  return (
    <div style={{ display: "flex", gap: 0 }}>
      {themes.map(([s, m, lab]) => (
        <div key={s + m} className={`jjbx style-${s} mode-${m}`} style={{ padding: "18px 16px 14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: 158, flex: "none" }}>
          <div style={{ display: "flex", gap: 14 }}>
            <FX src="assets/factor-zombie.png" size={56} />
            <FX src="assets/factor-money.png" gold size={56} />
          </div>
          <span className="mx-h">{lab}</span>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { SpecBoard, FactorMatrix, FactorSizes, ThemeStrip });
