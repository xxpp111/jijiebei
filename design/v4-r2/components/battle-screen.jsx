// ============================================================
// 集结杯 × CM — v4 R2 · 对战页边框落位整屏 mock
// 复用 select-screen.jsx 的 CC / FX / CtrlBar；行/判定沿用 theme.css
// 组件: VBtn / MatchRow / BattleScreenV4 → window
// ============================================================

const B_LOGOS = {
  "metal-dark": "assets/logo-cm-gold.png",
  "metal-light": "assets/logo-cm-metal-light.png",
  "sc2-dark": "assets/logo-cm-blue.png",
  "sc2-light": "assets/logo-cm-sc2-light.png",
  "minimal-dark": "assets/logo-cm-vector.png",
  "minimal-light": "assets/logo-cm-minimal-light.png",
};

// ---------- 判定按钮（样式沿用 R1，不变） ----------
function VBtn({ label, kind, on }) {
  return <button className={"v-btn" + (on ? " on v-" + kind : "")}>{label}</button>;
}

// ---------- 单场行 ----------
function MatchRow({ no, dbl, boss, map, mapName, status, cmds, factors, verdict }) {
  // status: "done" | "live" | "wait"
  const cls = ["match", boss && "match-boss", status === "live" && "match-active", status === "done" && "match-done"].filter(Boolean).join(" ");
  return (
    <div className={cls}>
      <div className="match-no">
        <span className="match-no-t">{no}</span>
        {dbl && <span className="match-dbl">双打</span>}
        {status === "live" && <span className="match-live"><span className="ld"></span>进行中</span>}
      </div>
      <div className="match-map">
        <span className="mapthumb"><img src={map} alt="" /></span>
        <span className="match-map-name">{mapName}</span>
      </div>
      <div className="match-cmds">
        {cmds.map((c, i) => <CC key={i} src={c.src} name={c.name} w={58} h={70} />)}
      </div>
      <div className="match-factors">
        {factors.map((f, i) => <FX key={i} src={f.src} size={56} gold={f.gold} tag={f.tag || null} />)}
      </div>
      <div className="verdict">
        <VBtn label="胜利" kind="win" on={verdict === "win"} />
        <VBtn label="带奖励" kind="bonus" on={verdict === "bonus"} />
        <VBtn label="失败" kind="lose" on={verdict === "lose"} />
      </div>
    </div>
  );
}

// 三场数据（与 R1 select 同套地图/阵容；双打=每场 2 指挥官）
const B_ROWS = [
  {
    no: "第 1 场", dbl: true, map: "assets/map-korhal.png", mapName: "克哈裂痕",
    status: "done", verdict: "win",
    cmds: [{ src: "assets/cmd-raynor.png", name: "雷诺" }, { src: "assets/cmd-nova.png", name: "诺娃" }],
    factors: [
      { src: "assets/factor-nuke.png", tag: "官突" },
      { src: "assets/factor-void.png", tag: "官突" },
      { src: "assets/factor-money.png", gold: true },
      { src: "assets/factor-blizzard.png" },
      { src: "assets/factor-zombie.png" },
    ],
  },
  {
    no: "第 2 场", dbl: true, map: "assets/map-darkstar.png", mapName: "黑暗杀星",
    status: "live", verdict: null,
    cmds: [{ src: "assets/cmd-raynor.png", name: "雷诺" }, { src: "assets/cmd-nova.png", name: "诺娃" }],
    factors: [
      { src: "assets/factor-nuke.png", tag: "官突" },
      { src: "assets/factor-money.png", tag: "官突", gold: true },
      { src: "assets/factor-blizzard.png", gold: true },
      { src: "assets/factor-void.png" },
      { src: "assets/factor-lava.png" },
    ],
  },
  {
    no: "BOSS 战", dbl: true, boss: true, map: "assets/map-temple.png", mapName: "往日神庙",
    status: "wait", verdict: null,
    cmds: [{ src: "assets/cmd-artanis.png", name: "阿塔尼斯" }, { src: "assets/cmd-kerrigan.png", name: "凯瑞甘" }],
    factors: [
      { src: "assets/factor-void.png", tag: "官突" },
      { src: "assets/factor-nuke.png", tag: "官突" },
      { src: "assets/factor-lava.png", gold: true },
      { src: "assets/factor-zombie.png", gold: true },
      { src: "assets/factor-money.png" },
    ],
  },
];

// ---------- 整屏 ----------
function BattleScreenV4({ styleName = "sc2", mode = "dark", barState = "full" }) {
  const logo = B_LOGOS[styleName + "-" + mode] || B_LOGOS["sc2-dark"];
  return (
    <div className={`jjb style-${styleName} mode-${mode}`} data-screen-label={`battle-v4-${styleName}-${mode}`}>
      <div className="jjb-bg"><div className="bg-grad"></div><div className="bg-tex"></div><div className="bg-vignette"></div></div>
      <CtrlBar state={barState} styleName={styleName} mode={mode} active="battle" reach={["home", "select", "battle", "overlay"]} />
      <div className="jjb-inner battle">

        <div className="topbar">
          <div className="lockup lockup-sm">
            <img className="lockup-mark" src={logo} alt="CM" />
            <span className="lockup-div"></span>
            <div className="lockup-word"><span className="lockup-cn">集结杯</span></div>
          </div>
          <div className="topbar-meta">
            <div className="meta-row"><span className="meta-k">当前选手</span><span className="meta-v">双打队伍</span></div>
            <div className="meta-row"><span className="meta-k">比赛模式</span><span className="meta-v">双打 · 官突</span></div>
          </div>
        </div>

        <div className="matches">
          {B_ROWS.map((r, i) => <MatchRow key={i} {...r} />)}
        </div>

        <div className="foot">
          <span className="foot-org">CM × 集结杯 联合主办 · 主播「儒雅随和の土豆」</span>
          <span className="foot-links">
            <span className="foot-link"><b>CM 玩法说明</b>cm-coop.cc/how</span>
            <span className="foot-link"><b>B 站主播</b>儒雅随和の土豆</span>
          </span>
        </div>

      </div>
    </div>
  );
}

Object.assign(window, { VBtn, MatchRow, BattleScreenV4, B_ROWS });
