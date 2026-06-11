// ============================================================
// ② OBS 底部横条 · 规格板（状态矩阵 / 尺寸族·1/3校验 / 动效·Cocos）
// 依赖 spec-factor.jsx(SpecBoard) / select-screen.jsx(CC,FX) /
//      obs-bar.jsx(OBSBar,OBSScaled,OBSBadge) / battle-screen.jsx(B_ROWS)
// 导出: OBSAnatomy / OBSStates / OBSSizes / OBSImpl → window
// ============================================================

// ---- ① 分区与落位 ----
function OBSAnatomy() {
  const zones = [
    ["分数轨", "188px", "品牌 lockup（30px mark）+ 大比分（已胜/总 · font-title 74）+ 局分 pip ×3；信息优先级 #2"],
    ["场次列 ×3", "flex", "单行三列；当前进行场 = hero（flex 1.52 加宽）+ accent 包边，其余 flex 1"],
    ["列头", "—", "第 N 场（font-title 19/22）+ 双打徽标 + 状态徽章（右对齐）"],
    ["地图缩略", "100%", "沿用 .mapthumb 475:85；图内已含地图名（无需叠加名牌）"],
    ["阵容行", "—", "双指挥官卡 .cc（hero 56×67 / 紧凑 46×55）+ 带框因子 .fx（hero 44 / 紧凑 34）"],
    ["状态徽章", "—", "胜利/带奖励/失败/进行中/待战 五态，色彩编码优先，贴列头右"],
  ];
  return (
    <SpecBoard title="OBS 底部横条 · 分区与落位（1280×232 专用形态）" width={1320}>
      <div style={{ boxShadow: "inset 0 0 0 1px var(--panel-edge)" }}>
        <OBSBar styleName="sc2" mode="dark" />
      </div>
      <div className="mx-divider"></div>
      <div className="mx-kv">
        {zones.map(([z, w, d]) => (
          <div className="mx-kv-row" key={z}>
            <span className="k" style={{ flexBasis: 96 }}>{z}</span>
            <span className="v" style={{ flex: 1 }}>
              <b style={{ color: "var(--ink)", fontFamily: "var(--font-num)", marginRight: 10 }}>{w}</b>{d}
            </span>
          </div>
        ))}
      </div>
      <div className="mx-note">
        边框/卡片体系 <b>直接复用 ①已定稿</b>：金属切角 / 星际2 角刻线 / 极简圆角 + 当前场 accent 包边（=<code>.match-active</code> 语言），仅作用域换到 <code>.obs-match</code>，值与 styles.css/v4.css 同步，<b>不改①任何文件</b>。指挥官卡 <code>.cc</code> / 因子框 <code>.fx</code> / <code>.mapthumb</code> 原样接入。
      </div>
    </SpecBoard>
  );
}

// ---- ② 状态徽章矩阵 + 当前场强调 ----
function Badge({ kind, label, dot }) {
  return <span className={"obs-badge b-" + kind}>{dot && <span className="dot"></span>}{label}</span>;
}
function OBSStates() {
  const badges = [
    ["win", "胜利", false, "var(--win) 实底 / on-state 深字 · 已判定·胜"],
    ["bonus", "带奖励", false, "var(--bonus) 实底 / on-state 深字 · 达成奖励目标"],
    ["lose", "失败", false, "var(--lose) 实底 / 白字 · 已判定·负"],
    ["live", "进行中", true, "var(--accent) 实底 / on-accent 深字 + 脉冲点"],
    ["wait", "待战", false, "panel-bg + panel-edge 描边 / muted 字 · 未开打"],
  ];
  return (
    <SpecBoard title="状态徽章 · 五态矩阵（色彩编码优先 · 缩放靠色辨识）" width={980}>
      <div className="mx-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        {badges.map(([k, l, d]) => <div key={k} className="mx-h">{l}</div>)}
        {badges.map(([k, l, d]) => <div key={k} className="mx-cell"><Badge kind={k} label={l} dot={d} /></div>)}
        {badges.map(([k, l, d, note]) => <div key={k} className="mx-rowlab" style={{ textAlign: "center", padding: "0 6px", lineHeight: 1.5, whiteSpace: "normal" }}>{note}</div>)}
      </div>
      <div className="mx-divider"></div>
      <span className="mx-h" style={{ textAlign: "left" }}>当前场次强调（hero）：加宽 flex 1.52 + accent 包边 + 字号上调，对照其余场</span>
      <div style={{ display: "flex", gap: 16, alignItems: "stretch" }}>
        <div className="obsbar style-sc2 mode-dark" style={{ width: 300, height: 150, padding: 0 }}>
          <div className="obs-matches" style={{ height: "100%", padding: 12 }}>
            <OBSMatchMini status="done" verdict="win" no="第 1 场" />
          </div>
        </div>
        <div className="obsbar style-sc2 mode-dark" style={{ width: 360, height: 150, padding: 0 }}>
          <div className="obs-matches" style={{ height: "100%", padding: 12 }}>
            <OBSMatchMini status="live" no="第 2 场" />
          </div>
        </div>
      </div>
      <div className="mx-note">
        <b>局分 pip</b>：左轨 3 段进度同步三场状态（win 绿 / bonus 蓝 / lose 红 / live 金脉冲 / wait 描边）。<b>对比度</b>：win #4f9d72·bonus #6f86bd 配 on-state #0b1206、lose #a3434a 配白字、live accent 配 on-accent 均 ≥4.5:1；亮色模式 fx 框补落影 + 图芯描边（沿用 v4.css <code>.mode-light .fx-*</code>）。
      </div>
    </SpecBoard>
  );
}

// 状态对照用迷你场次列（复用 .obs-match 结构，固定 1 张地图 + 双指挥官 + 因子）
function OBSMatchMini({ status, verdict, no }) {
  const live = status === "live";
  return (
    <div className={"obs-match" + (live ? " live" : "") + (status === "done" ? " done" : "")} style={{ flex: 1 }}>
      <div className="obs-match-head">
        <span className="obs-match-no"><b>{no}</b><span className="obs-dbl">双打</span></span>
        <OBSBadge status={status} verdict={verdict} />
      </div>
      <div className="obs-map"><span className="mapthumb"><img src="assets/map-darkstar.png" alt="" /></span></div>
      <div className="obs-line">
        <div className="obs-cmds">
          <CC src="assets/cmd-raynor.png" name="雷诺" w={live ? 50 : 44} h={live ? 60 : 53} noName={!live} />
          <CC src="assets/cmd-nova.png" name="诺娃" w={live ? 50 : 44} h={live ? 60 : 53} noName={!live} />
        </div>
        <div className="obs-facs">
          <FX src="assets/factor-nuke.png" size={live ? 40 : 32} />
          <FX src="assets/factor-money.png" gold size={live ? 40 : 32} />
          <FX src="assets/factor-void.png" size={live ? 40 : 32} />
        </div>
      </div>
    </div>
  );
}

// ---- ③ 尺寸族 + 1/3 缩放校验（硬标准） ----
function OBSSizes() {
  return (
    <SpecBoard title="尺寸族 & 缩至 1/3 仍可读（硬标准校验）" width={980}>
      <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: "0 0 auto" }}>
          <span className="mx-h" style={{ textAlign: "left" }}>阵容元件尺寸档（hero / 紧凑）</span>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 22 }}>
            {[["指挥官·hero", 56, 67], ["指挥官·紧凑", 46, 55]].map(([lab, w, h]) => (
              <div key={lab} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <CC src="assets/cmd-nova.png" name="诺娃" w={w} h={h} noName />
                <span className="mx-h">{w}×{h}</span>
                <span className="mx-rowlab" style={{ fontSize: 10.5 }}>{lab}</span>
              </div>
            ))}
            {[["因子·hero", 44], ["因子·紧凑", 34]].map(([lab, s]) => (
              <div key={lab} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <FX src="assets/factor-money.png" gold size={s} />
                <span className="mx-h">{s}×{s}</span>
                <span className="mx-rowlab" style={{ fontSize: 10.5 }}>{lab}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ width: 1, alignSelf: "stretch", background: "var(--panel-edge)" }}></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
          <span className="mx-h" style={{ textAlign: "left" }}>专用形态：1280 × 232（200~240 区间）</span>
          <ul className="rule">
            <li>单行布局，无折行；hero 场 + 分数轨保证缩放后结构不塌。</li>
            <li>正文最小字号 ≥12（场次名 19/22、徽章 16/19、局分 74），远距/缩放可读。</li>
            <li>状态以<b>色彩</b>为第一载体，文字为近距确认 —— 缩至 1/3 仍能凭色辨识胜负/进行。</li>
          </ul>
        </div>
      </div>
      <div className="mx-divider"></div>
      <span className="mx-h" style={{ textAlign: "left" }}>缩放校验：100% → 50% → 33%（同一横条，逐级缩小）</span>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 26, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <OBSScaled scale={0.5} styleName="sc2" mode="dark" />
          <span className="mx-rowlab">50% · 640×116</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <OBSScaled scale={0.333} styleName="sc2" mode="dark" />
          <span className="mx-rowlab" style={{ color: "var(--accent)" }}>33% · 427×77 — 硬标准基准</span>
        </div>
      </div>
      <div className="mx-note">
        在 33%（427px 宽）下：大比分、场次号、状态色块、当前场 accent 包边、指挥官头像与因子轮廓均保持可辨；细节文字（指挥官名）仅 hero 场保留，紧凑场以头像识别，避免缩放后糊成噪点。
      </div>
    </SpecBoard>
  );
}

// ---- ④ 动效 + Cocos 2.4 程序化要点 ----
function OBSImpl() {
  return (
    <SpecBoard title="动效 / Cocos 2.4 程序化落地要点" width={980}>
      <div style={{ display: "flex", gap: 26 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          <span className="mx-h" style={{ textAlign: "left" }}>动效规格</span>
          <div className="mx-kv">
            <div className="mx-kv-row"><span className="k">进行中徽章</span><span className="v">脉冲点 opacity 1↔.22 · 1.1s ease-in-out 循环（与左轨 live pip 同相）</span></div>
            <div className="mx-kv-row"><span className="k">切场（hero 迁移）</span><span className="v">旧 hero 收宽 + 撤包边，新 hero 展宽 + accent 圈 0→2px · 220ms ease-out</span></div>
            <div className="mx-kv-row"><span className="k">判定落定</span><span className="v">徽章底色 fade + scale 1→1.04→1 · 140ms back-out；对应 pip 同步换色</span></div>
            <div className="mx-kv-row"><span className="k">局分进位</span><span className="v">大比分数字翻牌 120ms（旧上移淡出 / 新下移淡入）</span></div>
            <div className="mx-kv-row"><span className="k">已判定降权</span><span className="v">整列 opacity 1→.86 + 图缩饱和 200ms（沿用 .match-done）</span></div>
            <div className="mx-kv-row"><span className="k">入/出场</span><span className="v">横条整体 Y 位移 24px + 淡入 240ms；OBS 场景切换友好</span></div>
          </div>
        </div>
        <div style={{ width: 1, background: "var(--panel-edge)" }}></div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          <span className="mx-h" style={{ textAlign: "left" }}>Cocos 2.4 落地</span>
          <ul className="rule">
            <li><b>根节点 1280×232</b> 透明画布（Canvas + ClearColor alpha 0），直接做 OBS 浏览器源/游戏内叠加，背景为主题底色 Sprite。</li>
            <li><b>cc / fx / mapthumb 复用</b>①已封装预制体，仅换尺寸档（hero 56×67·44 / 紧凑 46×55·34），无新资源。</li>
            <li><b>列布局</b>用 Layout(HORIZONTAL)+Widget；分数轨/紧凑场定宽，hero 场 sizeMode 撑大；列内 Layout(VERTICAL) 头/图/阵容三段。</li>
            <li><b>hero 包边</b>= accent 描边 Graphics（圆角矩形 strokeWidth 2）叠列底；金属切角列用 Mask 同步外形。</li>
            <li><b>状态徽章</b>同一 Sprite 换 SpriteFrame/color（win/bonus/lose/accent token + wait 描边）；进行中脉冲点 = cc.tween 循环。</li>
            <li><b>大比分 / pip</b> 用 Label + 3 段 Sprite，数据驱动（已胜场 / 三场状态枚举）一处更新。</li>
          </ul>
        </div>
      </div>
      <div className="mx-divider"></div>
      <div className="mx-note">
        <b>数据契约</b>：横条与①对战页共用同一份「三场（地图/双指挥官/因子/状态/判定）+ 局分」数据，单源驱动，切换 OBS 形态无需二次录入。<b>缩放</b>：根节点等比 scale 不重排，1/3 即设 scale 0.333，验收以该档为准。
      </div>
    </SpecBoard>
  );
}

Object.assign(window, { OBSAnatomy, OBSStates, OBSSizes, OBSImpl, OBSMatchMini });
