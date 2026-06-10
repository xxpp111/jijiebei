// ============================================================
// 集结杯 × CM — v4 选择面板整屏 mock（theme 参数化）
// 组件: FX(因子+边框) / CC(指挥官卡) / CtrlBar(全局控制条) /
//       ToastV(校验提示) / SelectScreenV4(整屏)
// ============================================================

const V4_BORDER_NORMAL = "input/border-factor-normal.png";
const V4_BORDER_GOLD = "input/border-factor-gold.png";

const V4_LOGOS = {
  "metal-dark": "assets/logo-cm-gold.png",
  "metal-light": "assets/logo-cm-metal-light.png",
  "sc2-dark": "assets/logo-cm-blue.png",
  "sc2-light": "assets/logo-cm-sc2-light.png",
  "minimal-dark": "assets/logo-cm-vector.png",
  "minimal-light": "assets/logo-cm-minimal-light.png",
};

// ---------- 因子（普通绿框 / 金色金框） ----------
function FX({ src, size = 66, gold = false, sel = false, dim = false, drag = false, ghost = false, tag = null, check = false, clearHover = false }) {
  const cls = ["fx", gold && "gold", sel && "fx-sel", dim && "fx-dim", drag && "fx-drag", ghost && "fx-ghost"].filter(Boolean).join(" ");
  return (
    <div className={cls} style={{ "--fxz": size + "px" }}>
      <img className="fx-art" src={src} alt="" />
      <img className="fx-frame" src={gold ? V4_BORDER_GOLD : V4_BORDER_NORMAL} alt="" />
      <span className="fx-ring"></span>
      {check && <span className="fx-check">✓</span>}
      {tag && <span className={"fx-tag" + (tag === "锁定" ? " lock" : "")}>{tag}</span>}
      {clearHover && <span className="fx-clear"><span className="cc-clear-x">✕</span></span>}
    </div>
  );
}

// ---------- 指挥官卡 ----------
function CC({ src, name, w = 70, h = 84, sel = false, drag = false, ghost = false, fill = false, check = false, clearHover = false, noName = false }) {
  const cls = ["cc", sel && "cc-sel", drag && "cc-drag", ghost && "cc-ghost", fill && "cc-fill"].filter(Boolean).join(" ");
  return (
    <div className={cls} style={{ "--ccw": w + "px", "--cch": h + "px" }}>
      <div className="cc-art">{src && <img src={src} alt="" />}</div>
      <span className="cc-gloss"></span>
      {!noName && name && <span className="cc-name">{name}</span>}
      {check && <span className="cc-check">✓</span>}
      {clearHover && (
        <span className="cc-clear">
          <span className="cc-clear-x">✕</span>
          <span className="cc-clear-t">点击清除</span>
        </span>
      )}
    </div>
  );
}

// ---------- 空槽 ----------
function DropCell({ w, h, hint, over = false }) {
  return (
    <span className={"drop" + (over ? " dropv-over" : "")} style={{ width: w, height: h, display: "flex" }}>
      <span className="drop-hint">{hint}</span>
    </span>
  );
}

// ---------- 全局控制条 ----------
function CtrlBar({ state = "full", styleName = "metal", mode = "dark" }) {
  if (state === "collapsed") {
    return (
      <div className="ctrl-pill">
        <span className="ctrl-dot"></span><span className="ctrl-dot"></span><span className="ctrl-dot"></span>
        <span style={{ fontSize: 11, color: "var(--muted)", letterSpacing: 2, marginLeft: 3 }}>控制</span>
      </div>
    );
  }
  return (
    <div className="ctrl">
      <div className="ctrl-g">
        <button className="ctrl-btn">首页</button>
        <button className="ctrl-btn on">选择</button>
        <button className="ctrl-btn off">对战</button>
        <button className="ctrl-btn off">结算</button>
        <button className="ctrl-btn">浮层</button>
      </div>
      {state === "confirm" ? (
        <div className="ctrl-g" style={{ padding: 0 }}>
          <div className="ctrl-confirm">
            <span className="ctrl-confirm-q">重抽当前局？</span>
            <button className="ctrl-cbtn yes">确认重抽</button>
            <button className="ctrl-cbtn no">取消</button>
          </div>
        </div>
      ) : (
        <div className="ctrl-g">
          <button className="ctrl-btn warn"><span className="ctrl-ico">↻</span><span>重新随机</span></button>
          <button className="ctrl-btn warn"><span className="ctrl-ico">←</span><span>回主界面</span></button>
        </div>
      )}
      <div className="ctrl-g">
        <button className={"ctrl-btn" + (styleName === "metal" ? " on" : "")}>金属</button>
        <button className={"ctrl-btn" + (styleName === "sc2" ? " on" : "")}>星际2</button>
        <button className={"ctrl-btn" + (styleName === "minimal" ? " on" : "")}>极简</button>
      </div>
      <div className="ctrl-g">
        <button className={"ctrl-btn" + (mode === "dark" ? " on" : "")}>暗</button>
        <button className={"ctrl-btn" + (mode === "light" ? " on" : "")}>亮</button>
      </div>
      <div className="ctrl-g">
        <button className="ctrl-btn" style={{ padding: "0 8px" }}>«</button>
      </div>
    </div>
  );
}

// ---------- 校验提示 ----------
function ToastV({ text = "第 2 场指挥官未选择", count = 2 }) {
  return (
    <div className="toastv">
      <span className="toastv-ico">!</span>
      <span className="toastv-tx">{text}</span>
      {count > 1 && <span className="toastv-n">+{count - 1}</span>}
    </div>
  );
}

// ---------- 整屏 ----------
function SelectScreenV4({ styleName = "metal", mode = "dark", barState = "full", toast = true, showClearHover = false }) {
  const logo = V4_LOGOS[styleName + "-" + mode] || V4_LOGOS["metal-dark"];
  return (
    <div className={`jjb style-${styleName} mode-${mode}`} data-screen-label={`select-v4-${styleName}-${mode}`}>
      <div className="jjb-bg"><div className="bg-grad"></div><div className="bg-tex"></div><div className="bg-vignette"></div></div>
      <CtrlBar state={barState} styleName={styleName} mode={mode} />
      <div className="jjb-inner sel">

        <div className="topbar">
          <div className="lockup lockup-sm">
            <img className="lockup-mark" src={logo} alt="CM" />
            <span className="lockup-div"></span>
            <div className="lockup-word"><span className="lockup-cn">集结杯</span></div>
          </div>
          <div className="topbar-meta">
            <div className="meta-row"><span className="meta-k">当前选手</span><span className="meta-v">选手</span></div>
            <div className="meta-row"><span className="meta-k">比赛模式</span><span className="meta-v">8 因子 · 手选</span></div>
          </div>
        </div>

        <div className="slots">
          {/* 第 1 场 — 已填满：cc-fill + 金色因子已填 + 锁定因子 */}
          <div className="slot">
            <div className="slot-head">
              <span className="slot-no">第 1 场</span><span className="slot-map-name">克哈裂痕</span>
            </div>
            <span className="mapthumb"><img src="assets/map-korhal.png" alt="" /></span>
            <div className="slot-targets">
              <div className="t-cmds">
                <CC src="assets/cmd-kerrigan.png" name="凯瑞甘" w={56} h={67} fill clearHover={showClearHover} />
              </div>
              <div className="t-facs">
                <FX src="assets/factor-nuke.png" size={52} tag="锁定" />
                <FX src="assets/factor-void.png" size={52} gold />
                <DropCell w={52} h={52} hint="因子" />
              </div>
            </div>
          </div>

          {/* 第 2 场 — 空槽 + 拖放 hover 演示 */}
          <div className="slot slot-active">
            <div className="slot-head">
              <span className="slot-no">第 2 场</span><span className="slot-map-name">黑暗杀星</span>
            </div>
            <span className="mapthumb"><img src="assets/map-darkstar.png" alt="" /></span>
            <div className="slot-targets">
              <div className="t-cmds">
                <DropCell w={56} h={67} hint="指挥官" over />
              </div>
              <div className="t-facs">
                <FX src="assets/factor-lava.png" size={52} tag="锁定" />
                <DropCell w={52} h={52} hint="因子" />
                <DropCell w={52} h={52} hint="" />
              </div>
            </div>
          </div>

          {/* BOSS 战 */}
          <div className="slot">
            <div className="slot-head">
              <span className="slot-no">BOSS 战</span><span className="slot-map-name">往日神庙</span>
              <span className="slot-flag">双倍</span>
            </div>
            <span className="mapthumb"><img src="assets/map-temple.png" alt="" /></span>
            <div className="slot-targets">
              <div className="t-cmds">
                <DropCell w={56} h={67} hint="指挥官" />
              </div>
              <div className="t-facs">
                <FX src="assets/factor-zombie.png" size={52} tag="锁定" />
                <DropCell w={52} h={52} hint="因子" />
                <DropCell w={52} h={52} hint="" />
              </div>
            </div>
          </div>
        </div>

        <div className="pool">
          <div className="pool-factors">
            <div className="block-head sm"><span className="block-kicker">FACTORS</span><span className="block-title">选择因子</span></div>
            <div className="factor-row" style={{ gap: 14 }}>
              <FX src="assets/factor-void.png" gold sel check />
              <FX src="assets/factor-money.png" gold />
              <FX src="assets/factor-blizzard.png" />
              <FX src="assets/factor-lava.png" dim />
              <FX src="assets/factor-zombie.png" />
              <FX src="assets/factor-nuke.png" />
            </div>
          </div>
          <div className="pool-cmd">
            <div className="grp-row">
              <div className="grp">
                <div className="block-head sm"><span className="block-title">A 组指挥官</span></div>
                <div className="avatar-row" style={{ gap: 13 }}>
                  <CC src="assets/cmd-kerrigan.png" name="凯瑞甘" sel check />
                  <CC src="assets/cmd-artanis.png" name="阿塔尼斯" />
                  <CC src="assets/cmd-raynor.png" name="雷诺" />
                  <CC src="assets/cmd-dehaka.png" name="德哈卡" />
                </div>
              </div>
              <div className="grp">
                <div className="block-head sm"><span className="block-title">B 组指挥官</span></div>
                <div className="avatar-row" style={{ gap: 13 }}>
                  <CC src="assets/cmd-nova.png" name="诺娃" />
                  <CC src="assets/cmd-tychus.png" name="泰凯斯" />
                </div>
              </div>
            </div>
            <div className="grp">
              <div className="block-head sm">
                <span className="block-title">自选指挥官</span>
                <span className="block-note">全量可选 · 拖入场次槽位（B 组占用合并计数）</span>
              </div>
              <div className="avatar-grid" style={{ gap: 11 }}>
                <CC src="assets/cmd-raynor.png" name="雷诺" w={60} h={72} />
                <CC src="assets/cmd-artanis.png" name="阿塔尼斯" w={60} h={72} drag />
                <CC src="assets/cmd-nova.png" name="诺娃" w={60} h={72} />
                <CC src="assets/cmd-dehaka.png" name="德哈卡" w={60} h={72} ghost />
                <CC src="assets/cmd-tychus.png" name="泰凯斯" w={60} h={72} />
                <CC src="assets/cmd-kerrigan.png" name="凯瑞甘" w={60} h={72} />
              </div>
            </div>
            <div style={{ marginTop: "auto", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 16 }}>
              {toast && <ToastV />}
              <button className="startbtn" style={{ margin: 0 }}>比赛开始 <span className="startbtn-arrow">▶</span></button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

Object.assign(window, { FX, CC, DropCell, CtrlBar, ToastV, SelectScreenV4, V4_BORDER_NORMAL, V4_BORDER_GOLD });
