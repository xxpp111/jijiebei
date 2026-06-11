// ============================================================
// 集结杯 × CM — ② OBS 底部横条（重点块） · 1280×224
// 复用 select-screen.jsx 的 CC / FX、theme.css 的 .mapthumb、
// battle-screen.jsx 的 B_ROWS（同套地图/阵容/因子，保证与①一致）
// 组件: OBSBadge / OBSMatch / OBSBar / OBSScaled → window
// ============================================================

const OBS_LOGOS = {
  "metal-dark": "assets/logo-cm-gold.png",
  "metal-light": "assets/logo-cm-metal-light.png",
  "sc2-dark": "assets/logo-cm-blue.png",
  "sc2-light": "assets/logo-cm-sc2-light.png",
  "minimal-dark": "assets/logo-cm-vector.png",
  "minimal-light": "assets/logo-cm-minimal-light.png",
};

// status: "done" | "live" | "wait"；verdict: "win" | "bonus" | "lose" | null
// 解析为单一徽章（色彩编码优先：win 绿 / bonus 蓝 / lose 红 / live 金脉冲 / wait 描边）
function resolveBadge(status, verdict) {
  if (status === "live") return { kind: "live", label: "进行中", dot: true };
  if (status === "wait") return { kind: "wait", label: "待战", dot: false };
  if (verdict === "win") return { kind: "win", label: "胜利", dot: false };
  if (verdict === "bonus") return { kind: "bonus", label: "带奖励", dot: false };
  if (verdict === "lose") return { kind: "lose", label: "失败", dot: false };
  return { kind: "wait", label: "待判", dot: false };
}

function OBSBadge({ status, verdict }) {
  const b = resolveBadge(status, verdict);
  return (
    <span className={"obs-badge b-" + b.kind}>
      {b.dot && <span className="dot"></span>}
      {b.label}
    </span>
  );
}

// 单场列。live=hero（加宽 + accent 包边 + 名牌/因子放大）；
// 非 live 紧凑（指挥官仅头像不挂名，降噪利于缩放）
function OBSMatch({ row }) {
  const live = row.status === "live";
  const ccW = live ? 56 : 46;
  const ccH = live ? 67 : 55;
  const fxz = live ? 44 : 34;
  const cls = ["obs-match", live && "live", row.status === "done" && "done"].filter(Boolean).join(" ");
  return (
    <div className={cls} data-screen-label={"obs-match-" + row.no}>
      <div className="obs-match-head">
        <span className="obs-match-no">
          <b>{row.no}</b>
          {row.dbl && <span className="obs-dbl">双打</span>}
        </span>
        <OBSBadge status={row.status} verdict={row.verdict} />
      </div>
      <div className="obs-map">
        <span className="mapthumb"><img src={row.map} alt="" /></span>
      </div>
      <div className="obs-line">
        <div className="obs-cmds">
          {row.cmds.map((c, i) => (
            <CC key={i} src={c.src} name={c.name} w={ccW} h={ccH} noName={!live} />
          ))}
        </div>
        <div className="obs-facs">
          {row.factors.map((f, i) => (
            <FX key={i} src={f.src} size={fxz} gold={f.gold} />
          ))}
        </div>
      </div>
    </div>
  );
}

// 由三场推导局分（已胜场数 / 总场数）与局分进度 pip
function deriveScore(rows) {
  const wins = rows.filter((r) => r.status === "done" && (r.verdict === "win" || r.verdict === "bonus")).length;
  const pips = rows.map((r) => {
    if (r.status === "live") return "live";
    if (r.status === "wait") return "wait";
    if (r.verdict === "win" || r.verdict === "bonus") return "win";
    if (r.verdict === "lose") return "lose";
    return "wait";
  });
  return { wins, total: rows.length, pips };
}

function OBSBar({ styleName = "sc2", mode = "dark", rows = B_ROWS, scoreLabel = "当前局分 · 已胜场" }) {
  const logo = OBS_LOGOS[styleName + "-" + mode] || OBS_LOGOS["sc2-dark"];
  const { wins, total, pips } = deriveScore(rows);
  return (
    <div className={`obsbar style-${styleName} mode-${mode}`} data-screen-label={`obs-bar-${styleName}-${mode}`}>
      <div className="bg-tex"></div>
      <div className="obsbar-edge"></div>
      <div className="obsbar-inner">

        <div className="obs-score">
          <div className="obs-score-brand">
            <img className="obs-score-mark" src={logo} alt="CM" />
            <span className="obs-score-div"></span>
            <span className="obs-score-cn">集结杯</span>
          </div>
          <div>
            <div className="obs-score-main">
              <span className="obs-score-win">{wins}</span>
              <span className="obs-score-of">/<b>{total}</b></span>
            </div>
            <span className="obs-score-lbl">{scoreLabel}</span>
          </div>
          <div className="obs-pips">
            {pips.map((p, i) => <span key={i} className={"obs-pip " + p}></span>)}
          </div>
        </div>

        <div className="obs-matches">
          {rows.map((r, i) => <OBSMatch key={i} row={r} />)}
        </div>

      </div>
    </div>
  );
}

// 缩放校验包裹：以 scale 渲染 1280×224 横条（缩至 1/3 仍可读 硬标准）
function OBSScaled({ scale = 1, ...props }) {
  return (
    <div style={{ width: 1280 * scale, height: 232 * scale, overflow: "hidden" }}>
      <div style={{ width: 1280, height: 232, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <OBSBar {...props} />
      </div>
    </div>
  );
}

// 全场已判定数据集（展示 胜利 / 带奖励 / 失败 三种判定态在横条中的样子）
const OBS_ROWS_DECIDED = [
  {
    no: "第 1 场", dbl: true, map: "assets/map-korhal.png", mapName: "克哈裂痕",
    status: "done", verdict: "win",
    cmds: [{ src: "assets/cmd-raynor.png", name: "雷诺" }, { src: "assets/cmd-nova.png", name: "诺娃" }],
    factors: [
      { src: "assets/factor-nuke.png" }, { src: "assets/factor-void.png" },
      { src: "assets/factor-money.png", gold: true }, { src: "assets/factor-blizzard.png" },
      { src: "assets/factor-zombie.png" },
    ],
  },
  {
    no: "第 2 场", dbl: true, map: "assets/map-darkstar.png", mapName: "黑暗杀星",
    status: "done", verdict: "bonus",
    cmds: [{ src: "assets/cmd-raynor.png", name: "雷诺" }, { src: "assets/cmd-nova.png", name: "诺娃" }],
    factors: [
      { src: "assets/factor-nuke.png" }, { src: "assets/factor-money.png", gold: true },
      { src: "assets/factor-blizzard.png", gold: true }, { src: "assets/factor-void.png" },
      { src: "assets/factor-lava.png" },
    ],
  },
  {
    no: "BOSS 战", dbl: true, boss: true, map: "assets/map-temple.png", mapName: "往日神庙",
    status: "done", verdict: "lose",
    cmds: [{ src: "assets/cmd-artanis.png", name: "阿塔尼斯" }, { src: "assets/cmd-kerrigan.png", name: "凯瑞甘" }],
    factors: [
      { src: "assets/factor-void.png" }, { src: "assets/factor-nuke.png" },
      { src: "assets/factor-lava.png", gold: true }, { src: "assets/factor-zombie.png", gold: true },
      { src: "assets/factor-money.png" },
    ],
  },
];

Object.assign(window, { OBSBadge, OBSMatch, OBSBar, OBSScaled, OBS_ROWS_DECIDED, resolveBadge, deriveScore });
