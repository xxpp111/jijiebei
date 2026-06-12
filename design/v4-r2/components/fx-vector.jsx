// ============================================================
// ②.5 因子边框矢量化 — FXV 组件（替换 PNG 贴图框本体）
// 几何/色值与 fx-vector.css = Cocos Graphics 规格一一对应。
// 状态语言（sel/dim/drag/ghost/✓/tag）沿用 v4 .fx 规则不变。
// ============================================================

function FXVFrame({ gold = false, only = null }) {
  const on = (k) => !only || only.indexOf(k) >= 0;
  if (gold) {
    return (
      <span className="fx-frame fxv fxv-gold">
        {on("gw") && <span className="gw1"></span>}
        {on("gw") && <span className="gw2"></span>}
        {on("g1") && <span className="g1"></span>}
        {on("g2") && <span className="g2"></span>}
        {on("g3") && <span className="g3"></span>}
        {on("ghl") && <span className="ghl"></span>}
        {on("g4") && <span className="g4"></span>}
        {on("gd") && [
          <span key="a" className="gd tl"></span>,
          <span key="b" className="gd tr"></span>,
          <span key="c" className="gd bl"></span>,
          <span key="d" className="gd br"></span>,
        ]}
      </span>
    );
  }
  return (
    <span className="fx-frame fxv fxv-green">
      {on("r1") && <span className="r1"></span>}
      {on("r2") && <span className="r2"></span>}
      {on("hl") && <span className="hl"></span>}
      {on("r3") && <span className="r3"></span>}
      {on("rv") && [
        <span key="a" className="rv tl"></span>,
        <span key="b" className="rv tr"></span>,
        <span key="c" className="rv bl"></span>,
        <span key="d" className="rv br"></span>,
      ]}
    </span>
  );
}

function FXV({
  src, size = 66, gold = false,
  sel = false, dim = false, drag = false, ghost = false,
  tag = null, check = false, clearHover = false,
  frameOnly = false, guide = false, only = null,
}) {
  const cls = [
    "fx", "vx", gold && "gold",
    sel && "fx-sel", dim && "fx-dim", drag && "fx-drag", ghost && "fx-ghost",
    guide && "fx-guide",
  ].filter(Boolean).join(" ");
  return (
    <div className={cls} style={{ "--fxz": size + "px" }}>
      {!frameOnly && <img className="fx-art" src={src} alt="" />}
      <FXVFrame gold={gold} only={only} />
      <span className="fx-ring"></span>
      {check && <span className="fx-check">✓</span>}
      {tag && <span className={"fx-tag" + (tag === "锁定" ? " lock" : "")}>{tag}</span>}
      {clearHover && <span className="fx-clear"><span className="cc-clear-x">✕</span></span>}
    </div>
  );
}

Object.assign(window, { FXV, FXVFrame });
