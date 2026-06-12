// ============================================================
// ②.5 规格板 · 因子边框矢量化
// 依赖: select-screen.jsx (FX 旧 PNG 件) / spec-factor.jsx (SpecBoard) /
//       fx-vector.jsx (FXV)
// ============================================================

function FXVCol({ cap, sub, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      {children}
      {cap && <span className="mx-h" style={{ padding: 0 }}>{cap}</span>}
      {sub && <span className="mx-rowlab" style={{ fontSize: 10, lineHeight: 1.45, textAlign: "center", whiteSpace: "normal", maxWidth: 148 }}>{sub}</span>}
    </div>
  );
}

function FXVDivider() {
  return <div style={{ width: 1, alignSelf: "stretch", background: "var(--panel-edge)" }}></div>;
}

// ---------- 新旧对比 ----------
function FXVCompare() {
  return (
    <SpecBoard title="新旧对比 · PNG 贴图 ↔ 程序化矢量（同屏直出）">
      <div style={{ display: "flex", alignItems: "flex-end", gap: 24, padding: "10px 4px 2px" }}>
        <FXVCol cap="66 · PNG"><FX src="assets/factor-blizzard.png" size={66} /></FXVCol>
        <FXVCol cap="66 · 矢量"><FXV src="assets/factor-blizzard.png" size={66} /></FXVCol>
        <FXVDivider />
        <FXVCol cap="132 · PNG" sub="71×73 原生 → ×1.86 上采样发糊（= Retina ×2 实况）"><FX src="assets/factor-blizzard.png" size={132} /></FXVCol>
        <FXVCol cap="132 · 矢量" sub="按 u 系数重画，任意倍率锐利"><FXV src="assets/factor-blizzard.png" size={132} /></FXVCol>
        <FXVDivider />
        <FXVCol cap="132 · PNG 金" sub="126×126 原生，放大同糊"><FX src="assets/factor-void.png" gold size={132} /></FXVCol>
        <FXVCol cap="132 · 矢量金"><FXV src="assets/factor-void.png" gold size={132} /></FXVCol>
      </div>
      <div className="mx-note">
        <b>动机</b>：mutatorframe 原生 71×73、grandmaster 126×126，无高清版；Retina（×2 物理像素）与 OBS 缩放必然重采样发糊，
        且位图边框是设计系统中唯一未程序化的组件；PNG 框内孔大于图芯，源图黑边/黑角会从框图之间露出。矢量版只用 Cocos 2.4 Graphics 原语逐层重画，
        按物理分辨率光栅化，任何档位不糊，且<b>框体规格性地压住图芯外缘</b>（普通 ~1.4u / 金 ~2.1u），露边为零。
        <b>外扩</b>：图芯统一 89%；普通框节点 <code>S×1.06</code>（每边 3%，虚线=图格边界）；金框 <code>S×1.16</code>（每边 8%）——厚金带<b>外包</b>图芯，不再内层叠加。
      </div>
    </SpecBoard>
  );
}

// ---------- 落位预览 ----------
function FXVPreview({ styleName = "metal", mode = "dark" }) {
  return (
    <SpecBoard styleName={styleName} mode={mode} title={`落位预览 · ${styleName} · ${mode}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <span className="mx-h" style={{ display: "block", textAlign: "left", paddingBottom: 8 }}>因子池 66</span>
          <div style={{ display: "flex", gap: 12 }}>
            <FXV src="assets/factor-blizzard.png" sel check />
            <FXV src="assets/factor-lava.png" />
            <FXV src="assets/factor-nuke.png" />
            <FXV src="assets/factor-zombie.png" dim />
            <FXV src="assets/factor-money.png" gold />
            <FXV src="assets/factor-void.png" gold dim />
          </div>
        </div>
        <div style={{ display: "flex", gap: 38 }}>
          <div>
            <span className="mx-h" style={{ display: "block", textAlign: "left", paddingBottom: 8 }}>槽位 52 · 角标压框</span>
            <div style={{ display: "flex", gap: 12 }}>
              <FXV src="assets/factor-lava.png" size={52} />
              <FXV src="assets/factor-lava.png" size={52} tag="锁定" />
              <FXV src="assets/factor-void.png" gold size={52} tag="官突" />
            </div>
          </div>
          <div>
            <span className="mx-h" style={{ display: "block", textAlign: "left", paddingBottom: 8 }}>OBS 横条 34</span>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <FXV src="assets/factor-blizzard.png" size={34} />
              <FXV src="assets/factor-nuke.png" size={34} />
              <FXV src="assets/factor-zombie.png" size={34} dim />
              <FXV src="assets/factor-money.png" gold size={34} />
            </div>
          </div>
        </div>
      </div>
    </SpecBoard>
  );
}

// ---------- 状态矩阵（语言不变，仅换框本体） ----------
function FXVMatrix() {
  const cols = "112px repeat(7, 102px)";
  const heads = ["", "常态", "选中 sel", "置灰 dim", "拖拽中", "残影 ghost", "已填（槽 52）", "锁定 / 官突"];
  return (
    <SpecBoard title="状态矩阵 · sel / dim / drag / ghost 语言零改动">
      <div className="mx-grid" style={{ gridTemplateColumns: cols }}>
        {heads.map((h, i) => <div key={i} className="mx-h">{h}</div>)}

        <div className="mx-rowlab">普通因子<br />矢量绿框</div>
        <div className="mx-cell"><FXV src="assets/factor-blizzard.png" /></div>
        <div className="mx-cell"><FXV src="assets/factor-blizzard.png" sel check /></div>
        <div className="mx-cell"><FXV src="assets/factor-blizzard.png" dim /></div>
        <div className="mx-cell"><FXV src="assets/factor-blizzard.png" drag /></div>
        <div className="mx-cell"><FXV src="assets/factor-blizzard.png" ghost /></div>
        <div className="mx-cell"><FXV src="assets/factor-blizzard.png" size={52} /></div>
        <div className="mx-cell"><FXV src="assets/factor-blizzard.png" size={52} tag="锁定" /></div>

        <div className="mx-rowlab">金色强化因子<br />矢量金框</div>
        <div className="mx-cell"><FXV src="assets/factor-void.png" gold /></div>
        <div className="mx-cell"><FXV src="assets/factor-void.png" gold sel check /></div>
        <div className="mx-cell"><FXV src="assets/factor-void.png" gold dim /></div>
        <div className="mx-cell"><FXV src="assets/factor-void.png" gold drag /></div>
        <div className="mx-cell"><FXV src="assets/factor-void.png" gold ghost /></div>
        <div className="mx-cell"><FXV src="assets/factor-void.png" gold size={52} /></div>
        <div className="mx-cell"><FXV src="assets/factor-void.png" gold size={52} tag="官突" /></div>
      </div>
      <div className="mx-divider"></div>
      <div className="mx-note">
        <b>叠加规则照旧</b>：sel/drag 的 accent 外圈（<code>.fx-ring</code>）、dim 压暗（图芯 38% / 框 55%）、ghost 28%、
        ✓ 与锁定/官突角标几何全部沿用 v4 现行 .fx 规则。本次仅替换 <code>.fx-frame</code> 本体（PNG → 矢量分层），
        图芯统一 89%（普通 86%→89%，金 82%→89%——金框改纯外包，普通/金可见面积一致）；金框 sel 外圈随外扩移到金带+发光之外。
      </div>
    </SpecBoard>
  );
}

// ---------- 尺寸族 ----------
function FXVSizes() {
  const sizes = [[34, "OBS 横条"], [44, "result 紧凑"], [56, "battle"], [66, "池 · 基准"], [74, "池 · 12 因子"]];
  const tbl = [
    ["34", "0.60（下限）", "36.0", "39.4"],
    ["44", "0.67", "46.6", "51.0"],
    ["56", "0.85", "59.4", "65.0"],
    ["66", "1.00", "70.0", "76.6"],
    ["74", "1.12", "78.4", "85.8"],
  ];
  return (
    <SpecBoard title="尺寸族 34 / 44 / 56 / 66 / 74 · 同一规格按 u 重画">
      <div style={{ display: "flex", alignItems: "flex-end", gap: 30, padding: "8px 4px 2px" }}>
        {sizes.map(([s, lab]) => (
          <FXVCol key={s} cap={`${s}×${s}`} sub={lab}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <FXV src="assets/factor-lava.png" size={s} />
              <FXV src="assets/factor-money.png" gold size={s} />
            </div>
          </FXVCol>
        ))}
      </div>
      <div className="fxt fxt-4">
        <div className="fxt-r h"><span>图格 S</span><span>u = max(S/66, 0.6)</span><span>普通框节点 S×1.06</span><span>金框节点 S×1.16</span></div>
        {tbl.map((r, i) => (
          <div key={i} className="fxt-r"><span className="m">{r[0]}</span><span className="m">{r[1]}</span><span className="m">{r[2]}</span><span className="m">{r[3]}</span></div>
        ))}
      </div>
      <div className="mx-note">
        u 公式对任意尺寸成立（52 槽位、46 result 同式）；<b>0.6 下限</b>保证 34 档最细线不低于 0.6 逻辑像素——小档位框体相对更厚，可辨性优先。
        34 档发光收敛为 1–2px 光晕，金色语义不丢。
      </div>
    </SpecBoard>
  );
}

// ---------- 6 主题条 ----------
function FXVThemes() {
  const themes = [["metal", "dark", "金属·暗"], ["metal", "light", "金属·亮"], ["sc2", "dark", "星际2·暗"], ["sc2", "light", "星际2·亮"], ["minimal", "dark", "极简·暗"], ["minimal", "light", "极简·亮"]];
  return (
    <div style={{ display: "flex", gap: 0 }}>
      {themes.map(([s, m, lab]) => (
        <div key={s + m} className={`jjbx style-${s} mode-${m}`} style={{ padding: "18px 16px 14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: 158, flex: "none" }}>
          <div style={{ display: "flex", gap: 14 }}>
            <FXV src="assets/factor-zombie.png" size={56} />
            <FXV src="assets/factor-money.png" gold size={56} />
          </div>
          <span className="mx-h">{lab}</span>
        </div>
      ))}
    </div>
  );
}

// ---------- 分层结构（爆炸图） ----------
function FXVAnatomy() {
  const Plus = ({ t = "+" }) => <span className="mx-h" style={{ alignSelf: "flex-start", marginTop: 48, fontSize: 14 }}>{t}</span>;
  const N = (only, cap, sub) => (
    <FXVCol cap={cap} sub={sub}><FXV size={104} frameOnly guide only={only} /></FXVCol>
  );
  const G = (only, cap, sub) => (
    <FXVCol cap={cap} sub={sub}><FXV size={104} gold frameOnly guide only={only} /></FXVCol>
  );
  return (
    <SpecBoard title="分层结构 · 自下而上绘制顺序（虚线 = 图格边界，可见外扩量）">
      <div style={{ display: "flex", gap: 16, padding: "6px 0 2px" }}>
        {N(["r1"], "L1-2 外轮廓 + 斜面亮缘", "1u #0A130C · 1.1u #86AE6A")}
        <Plus />
        {N(["r2", "hl"], "L3-4 金属框体 + 顶光", "3u #35522F · 1u #BCD9A0 α.5")}
        <Plus />
        {N(["r3"], "L5-6 内暗线 + 内亮线", "1u #111C13 · 1u #9FC683（压图芯）")}
        <Plus />
        {N(["rv"], "L7 角铆钉 ×4", "circle r1.7u #C2DBA4 / 环 #16241A")}
        <Plus t="=" />
        <FXVCol cap="合成 · 节点 S×1.06"><FXV src="assets/factor-blizzard.png" size={104} guide /></FXVCol>
      </div>
      <div className="mx-divider"></div>
      <div style={{ display: "flex", gap: 16, padding: "6px 0 2px" }}>
        {G(["gw"], "L1-2 外发光双描边", "2.5u α.13 · 1.8u α.30（无模糊）")}
        <Plus />
        {G(["g1", "g2"], "L3-4 暗轮廓 + 深金外缘", "1u #3A2306 · 1.5u #C98F26")}
        <Plus />
        {G(["g3", "ghl"], "L5-6 金框主体 + 顶光", "3u #F6C75A · 1u #FFEBAE α.75")}
        <Plus />
        {G(["g4"], "L7-8 内深金 + 热线", "1.5u #8F5E10 · 1u #FFF4C9（压图芯）")}
        <Plus />
        {G(["gd"], "L9 角金菱 ×4", "45° 方形 边4.6u #FFE284 / #6B4708")}
        <Plus t="=" />
        <FXVCol cap="合成 · 节点 S×1.16 外包"><FXV src="assets/factor-void.png" gold size={104} guide /></FXVCol>
      </div>
    </SpecBoard>
  );
}

// ---------- 精确值表 ----------
function Chip({ c }) { return <span className="fxt-chip" style={{ background: c }}></span>; }

function FXVTable({ rows }) {
  return (
    <div className="fxt">
      <div className="fxt-r h"><span>z</span><span>层</span><span>原语</span><span>中心线 inset · 圆角</span><span>线宽</span><span>色值</span><span>α</span></div>
      {rows.map((r, i) => (
        <div key={i} className="fxt-r">
          <span className="m">{r[0]}</span><span>{r[1]}</span><span>{r[2]}</span>
          <span className="m">{r[3]}</span><span className="m">{r[4]}</span>
          <span className="m">
            {r[5].map((c, j) => (
              <React.Fragment key={j}>{j > 0 && " / "}<Chip c={c} />{c}</React.Fragment>
            ))}
          </span>
          <span className="m">{r[6]}</span>
        </div>
      ))}
    </div>
  );
}

const FXV_ROWS_NORMAL = [
  ["0*", "投影板（仅亮色主题）", "roundRect 描边 offset(0,+1u)", "0.5u · r3.2u", "2u", ["#0A1622"], ".30"],
  ["1", "外轮廓暗线", "roundRect 描边", "0.5u · r3.2u", "1u", ["#0A130C"], ".95"],
  ["2", "外斜面亮缘", "roundRect 描边", "1.55u · r2.6u", "1.1u", ["#86AE6A"], "1"],
  ["3", "金属框体", "roundRect 描边", "3.5u · r2.2u", "3u", ["#35522F"], "1"],
  ["4", "框体顶光", "line（顶边）", "y3.1u · x 7u→W−7u", "1u", ["#BCD9A0"], ".50"],
  ["5", "内斜面暗线", "roundRect 描边", "5.5u · r1.4u", "1u", ["#111C13"], ".90"],
  ["6", "内亮线（压图芯）", "roundRect 描边", "6.5u · r1u", "1u", ["#9FC683"], ".90"],
  ["7", "角铆钉 ×4", "circle 填充+描边", "圆心 (3.5u,3.5u) 四角对称 · r1.7u", ".9u", ["#C2DBA4", "#16241A"], "1"],
];

const FXV_ROWS_GOLD = [
  ["0*", "投影板（仅亮色主题）", "roundRect 描边 offset(0,+1u)", "1.25u · r3.4u", "2u", ["#0A1622"], ".30"],
  ["1", "外发光 a", "roundRect 描边", "1.25u · r3.4u", "2.5u", ["#FFC846"], ".13"],
  ["2", "外发光 b", "roundRect 描边", "2.4u · r3u", "1.8u", ["#FFCE54"], ".30"],
  ["3", "外轮廓暗线", "roundRect 描边", "3.5u · r2.6u", "1u", ["#3A2306"], ".95"],
  ["4", "深金外缘", "roundRect 描边", "4.75u · r2.2u", "1.5u", ["#C98F26"], "1"],
  ["5", "金框主体", "roundRect 描边", "7u · r1.8u", "3u", ["#F6C75A"], "1"],
  ["6", "主体顶光", "line（顶边）", "y6.5u · x 9u→W−9u", "1u", ["#FFEBAE"], ".75"],
  ["7", "内深金缘", "roundRect 描边", "9.25u · r1.2u", "1.5u", ["#8F5E10"], "1"],
  ["8", "内热线（压图芯）", "roundRect 描边", "10.5u · r1u", "1u", ["#FFF4C9"], ".95"],
  ["9", "角金菱 ×4", "path 填充+描边（45° 方形）", "中心 (7u,7u) 四角对称 · 边4.6u", ".9u", ["#FFE284", "#6B4708"], "1"],
];

function FXVValues() {
  return (
    <SpecBoard title="精确值 · u = max(S/66, 0.6)px · inset 为描边中心线到节点外缘距离">
      <div className="mx-h" style={{ textAlign: "left", paddingBottom: 0 }}>普通绿框 · 节点 S×1.06 · anchor(0.5, 0.5) · 8 层</div>
      <FXVTable rows={FXV_ROWS_NORMAL} />
      <div className="mx-h" style={{ textAlign: "left", paddingBottom: 0, paddingTop: 6 }}>金色强化框 · 节点 S×1.16（外包） · anchor(0.5, 0.5) · 10 层</div>
      <FXVTable rows={FXV_ROWS_GOLD} />
      <div className="mx-note">
        图芯几何<b>统一</b> inset 5.5%（89%）：普通被 L5-6 压住外缘 ~1.4u，金被 L7-8 压住 ~2.1u——压边是硬规格，源图黑边/黑角永不露出。
        金框 sel/drag 外圈 inset = −(8%S + 2px)，包在金带+发光之外。框体色为固定值（素材语义跨主题恒定），不绑 6 主题 token；仅状态外圈用 <code>--accent</code>。
      </div>
    </SpecBoard>
  );
}

// ---------- Cocos 落地要点 ----------
function FXVCocos() {
  return (
    <SpecBoard title="Cocos 2.4 落地要点">
      <ul className="rule">
        <li>每枚因子挂一个 Graphics 子节点 <b>FrameG</b>：尺寸 S×1.06（金 S×1.16）、anchor(0.5,0.5)，zIndex 高于图芯 Sprite、低于角标/✓——层级同现行。</li>
        <li><b>图芯统一管线</b>（源图尺寸不一的根治）：trim 透明边 → 等比 cover 裁切 → ContentSize 统一 S×0.89；框体压边 ≥1.4u 兜底，源图黑边/黑角永藏框下。HTML 侧等价 object-fit:cover。</li>
        <li><b>u = max(S/66, 0.6)</b>；表中 inset / 线宽 / 圆角全部乘 u。尺寸切换 clear() 后重画（&lt;1ms），无需九宫格、无需多套贴图。</li>
        <li>只用 roundRect / circle / moveTo+lineTo / fill / stroke；颜色 cc.color(r,g,b,α×255)；描边居中对齐——表中 inset 给的是<b>描边中心线</b>位置。</li>
        <li>金框发光 = L1/L2 两道低透明宽描边，<b>禁用</b>模糊 shader 或发光贴图，保持纯矢量。</li>
        <li>亮色主题：最底层补投影板（z0*，offset(0,+1u)），图芯 Sprite 外缘补 1u 内描边 #0A1622 α.35——即现行 drop-shadow / outline 策略的矢量等价。</li>
        <li>状态不重画：dim 设 FrameG.opacity = 140（55%）、ghost = 71（28%）；sel/drag 的 accent 外圈仍由独立 ring 节点承担，禁止混入 FrameG。</li>
        <li>外扩碰撞账：普通 3%/边（66 档 ≈2px）、金 8%/边（66 档 ≈5.3px）。池 gap 12 时金-金相邻仅 L1 发光层（α.13）轻微重叠，无碍；74 档金因子建议 gap≥14；OBS 34 档 gap≥6 安全。</li>
      </ul>
      <div className="mx-divider"></div>
      <div className="mani">
        <div className="mani-row"><span className="mf">border-factor-normal.png</span><span className="ms">下线</span><span className="md">71×73 位图 → FrameG 矢量重画</span></div>
        <div className="mani-row"><span className="mf">border-factor-gold.png</span><span className="ms">下线</span><span className="md">126×126 位图 → FrameG 矢量重画</span></div>
        <div className="mani-row"><span className="mf">FX → FXV</span><span className="ms">替换</span><span className="md">props 不变；图芯统一 89%（普通 86%→89%，金 82%→89% 改外包）</span></div>
      </div>
    </SpecBoard>
  );
}

Object.assign(window, {
  FXVCompare, FXVPreview, FXVMatrix, FXVSizes, FXVThemes,
  FXVAnatomy, FXVValues, FXVCocos,
});
