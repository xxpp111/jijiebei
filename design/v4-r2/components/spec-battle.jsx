// ============================================================
// v4 R2 规格板 · 对战页边框落位
// 依赖 select-screen.jsx (CC/FX/CtrlBar) / battle-screen.jsx (VBtn/MatchRow) /
//      spec-factor.jsx (SpecBoard)
// 导出: BattleAnatomy / BattleStates / BattleSizes / BattleImpl → window
// ============================================================

// ---- 单行结构与分区（注释版） ----
function BattleAnatomy() {
  const zones = [
    ["场次号区", "100px", "第 N 场 / BOSS 战（font-title 22）+ 双打徽标 + 进行中徽标（仅当前场）"],
    ["地图区", "250px", "mapthumb 250×~45（475:85）+ 名称行；双打较 R1 select 收窄 40px 让位阵容"],
    ["指挥官区", "124px", "cc 卡 58×70 ×N；单刷=1 张，双打=并排 2 张（gap 9）含名牌"],
    ["因子区", "flex", "fx 框 56×56，绿框/金框；官突=实底 accent 角标 / 锁定=深底金字角标"],
    ["判定区", "≈227px", "胜利 / 带奖励 / 失败 三按钮，样式沿用 R1（未变）"],
  ];
  return (
    <SpecBoard title="对战行 · 分区与落位（双打 · 1280 宽行内排布）" width={1300}>
      <div style={{ background: "rgba(0,0,0,.18)", padding: "14px 26px", boxShadow: "inset 0 0 0 1px var(--panel-edge)" }}>
        <div className="battle" style={{ padding: 0 }}>
          <MatchRow
            no="第 2 场" dbl boss={false} map="assets/map-darkstar.png" mapName="黑暗杀星" status="live" verdict={null}
            cmds={[{ src: "assets/cmd-raynor.png", name: "雷诺" }, { src: "assets/cmd-nova.png", name: "诺娃" }]}
            factors={[
              { src: "assets/factor-nuke.png", tag: "官突" },
              { src: "assets/factor-money.png", tag: "官突", gold: true },
              { src: "assets/factor-blizzard.png", gold: true },
              { src: "assets/factor-void.png" },
              { src: "assets/factor-lava.png" },
            ]}
          />
        </div>
      </div>
      <div className="mx-divider"></div>
      <div className="mx-kv">
        {zones.map(([z, w, d]) => (
          <div className="mx-kv-row" key={z}><span className="k" style={{ flexBasis: 96 }}>{z}</span><span className="v" style={{ flex: 1 }}><b style={{ color: "var(--ink)", fontFamily: "var(--font-num)", marginRight: 10 }}>{w}</b>{d}</span></div>
        ))}
      </div>
      <div className="mx-note">
        行容器 / 切角 / 角刻线 / 判定按钮 = <b>沿用 theme.css 既有 .match·.verdict，未改</b>；R2 仅把池中已定稿的 <code>.cc</code> / <code>.fx</code> 接入指挥官位与因子位，并补「进行中 / 已判定」两个行级状态。
      </div>
    </SpecBoard>
  );
}

// ---- 状态矩阵：行级 × 判定 ----
function BattleStates() {
  return (
    <SpecBoard title="对战行 · 状态矩阵（行级状态 × 判定按钮）" width={920}>
      <span className="mx-h" style={{ textAlign: "left" }}>行级状态（左侧场次徽标 + 行边框）</span>
      <div className="mx-grid" style={{ gridTemplateColumns: "120px repeat(3, 1fr)" }}>
        <div className="mx-h"></div>
        <div className="mx-h">待战 wait</div>
        <div className="mx-h">进行中 live</div>
        <div className="mx-h">已判定 done</div>
        <div className="mx-rowlab">场次徽标</div>
        <div className="mx-cell"><span className="match-dbl" style={{ border: "1px solid var(--panel-edge)", padding: "2px 8px", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "var(--ink)" }}>双打</span></div>
        <div className="mx-cell"><span className="match-live"><span className="ld"></span>进行中</span></div>
        <div className="mx-cell"><span style={{ fontSize: 12, color: "var(--win)", fontWeight: 700, letterSpacing: 1 }}>胜利 ✓</span></div>
        <div className="mx-rowlab">行边框</div>
        <div className="mx-cell"><span className="mx-rowlab">常态 panel-edge</span></div>
        <div className="mx-cell"><span className="mx-rowlab" style={{ color: "var(--accent)" }}>accent 2px 包边</span></div>
        <div className="mx-cell"><span className="mx-rowlab">常态 + 整行 82% 透明</span></div>
      </div>
      <div className="mx-divider"></div>
      <span className="mx-h" style={{ textAlign: "left" }}>判定按钮（样式沿用 R1，三态择一）</span>
      <div className="battle" style={{ display: "flex", gap: 14, padding: "4px 2px" }}>
        {[["未判定", null], ["胜利", "win"], ["带奖励", "bonus"], ["失败", "lose"]].map(([lab, k]) => (
          <div key={lab} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div className="verdict" style={{ gap: 8 }}>
              <VBtn label="胜利" kind="win" on={k === "win"} />
              <VBtn label="带奖励" kind="bonus" on={k === "bonus"} />
              <VBtn label="失败" kind="lose" on={k === "lose"} />
            </div>
            <span className="mx-h">{lab}</span>
          </div>
        ))}
      </div>
      <div className="mx-note">
        <b>互斥单选</b>：点一枚即点亮（实底 + 状态色），其余复位描边；再点同枚=取消回未判定。<b>视觉平衡</b>：cc/fx 接入后行内信息更"满"，判定按钮高度拉到与 cc 卡齐平（70），未选态描边加重一档（<code>inset 0 0 0 1px</code>），避免被边框抢焦点。
      </div>
    </SpecBoard>
  );
}

// ---- 尺寸族：battle 档 + 单刷/双打 ----
function BattleSizes() {
  return (
    <SpecBoard title="对战页 · 边框尺寸族 & 单刷/双打阵容位" width={920}>
      <div style={{ display: "flex", gap: 30, alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: "0 0 auto" }}>
          <span className="mx-h" style={{ textAlign: "left" }}>battle 档（指挥官 58×70 / 因子 56×56）</span>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 22 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <CC src="assets/cmd-nova.png" name="诺娃" w={58} h={70} />
              <span className="mx-h">58×70</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <FX src="assets/factor-lava.png" size={56} />
              <span className="mx-h">56×56</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <FX src="assets/factor-money.png" gold size={56} />
              <span className="mx-h">56×56 金</span>
            </div>
          </div>
        </div>
        <div style={{ width: 1, alignSelf: "stretch", background: "var(--panel-edge)" }}></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
          <span className="mx-h" style={{ textAlign: "left" }}>阵容位：单刷 1 张 / 双打并排 2 张</span>
          <div style={{ display: "flex", gap: 30, alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div className="match-cmds" style={{ display: "flex", gap: 9 }}>
                <CC src="assets/cmd-kerrigan.png" name="凯瑞甘" w={58} h={70} />
              </div>
              <span className="mx-h">单刷 · 58 宽</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div className="match-cmds" style={{ display: "flex", gap: 9 }}>
                <CC src="assets/cmd-artanis.png" name="阿塔尼斯" w={58} h={70} />
                <CC src="assets/cmd-kerrigan.png" name="凯瑞甘" w={58} h={70} />
              </div>
              <span className="mx-h">双打 · 124 宽（2×58+9）</span>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-note">
        因子区 <code>flex:1 + flex-wrap</code>：双打常见 5 枚（含 2 官突）单行排布约 320px 容得下；6 枚及以上自动折行居中，不挤压判定区。名牌在 58×70 下仍单行可读（10.5px）。
      </div>
    </SpecBoard>
  );
}

// ---- 落地：动效 + Cocos ----
function BattleImpl() {
  return (
    <SpecBoard title="对战页 · 动效 / Cocos 落地要点" width={920}>
      <div style={{ display: "flex", gap: 26 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          <span className="mx-h" style={{ textAlign: "left" }}>动效规格</span>
          <div className="mx-kv">
            <div className="mx-kv-row"><span className="k">判定点亮</span><span className="v">底色 fade + scale 1→1.04→1 · 140ms · <i>back-out</i>；取消反向 120ms</span></div>
            <div className="mx-kv-row"><span className="k">进行中徽标</span><span className="v">圆点 opacity 1↔.25 · 1.1s ease-in-out 循环（仅当前场，单点）</span></div>
            <div className="mx-kv-row"><span className="k">行 live 包边</span><span className="v">accent 圈 0→2px + 投影 · 180ms ease-out；切场时旧行收、新行起</span></div>
            <div className="mx-kv-row"><span className="k">已判定降权</span><span className="v">整行 opacity 1→.82 + 图缩饱和 · 200ms ease</span></div>
            <div className="mx-kv-row"><span className="k">cc/fx 接入</span><span className="v">入场无额外动效（静态记分态）；状态切换复用池内 §4.5 时长</span></div>
          </div>
        </div>
        <div style={{ width: 1, background: "var(--panel-edge)" }}></div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          <span className="mx-h" style={{ textAlign: "left" }}>Cocos 2.4 落地</span>
          <ul className="rule">
            <li><b>cc / fx 直接复用</b>选择面板已封装的预制体（Sprite 边框 + Label 名牌），仅换尺寸档 58×70 / 56；无需新资源。</li>
            <li><b>行布局</b>用 Layout（HORIZONTAL）+ Widget；场次/地图/判定定宽，因子区 sizeMode 撑满 + 内层 Layout 自动折行居中。</li>
            <li><b>进行中包边</b>= accent 描边 Graphics（圆角矩形 strokeWidth 2）叠在行底；金属切角行用 mask 同步外形。</li>
            <li><b>判定按钮</b>三态用同一 Sprite 换 SpriteFrame / 改 color；on 态加状态色底（win/bonus/lose token）。</li>
            <li><b>官突 / 锁定角标</b>= fx 子节点 Label + 底 Sprite，锚点贴框左下，z 高于边框。</li>
          </ul>
        </div>
      </div>
      <div className="mx-divider"></div>
      <div className="mx-note">
        <b>对比度复核</b>：判定 on 态 win #4f9d72 / bonus #6f86bd 上深字（on-state #0b1206）、lose #a3434a 上白字均 ≥4.5:1；进行中 accent 徽标深字 ≥7:1。亮色模式 fx 框补 <code>drop-shadow + 图芯 1px 描边</code> 保证白底不糊。
      </div>
    </SpecBoard>
  );
}

Object.assign(window, { BattleAnatomy, BattleStates, BattleSizes, BattleImpl });
