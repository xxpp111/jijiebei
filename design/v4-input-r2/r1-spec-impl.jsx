// ============================================================
// v4 规格板 · 控制条全家福 + 落地规格（九宫格 / 动效 / Cocos）
// 依赖 select-screen.jsx 的 CtrlBar、spec-factor.jsx 的 SpecBoard
// ============================================================

function CtrlStates() {
  return (
    <SpecBoard title="全局控制条 · 形态与状态" width={920}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {[
          ["full", "展开态（默认）— 屏幕导航｜危险操作｜主题｜收起"],
          ["confirm", "二次确认态（armed）— 点「重新随机/回主界面」后就地展开，5s 未操作自动还原"],
          ["collapsed", "收起态（直播）— 仅留 38% 透明度把手，hover 恢复；点击展开"],
        ].map(([st, lab]) => (
          <div key={st} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span className="mx-h" style={{ textAlign: "left" }}>{lab}</span>
            <div style={{ position: "relative", height: 62, background: "rgba(0,0,0,.18)", boxShadow: "inset 0 0 0 1px var(--panel-edge)" }}>
              <CtrlBar state={st} styleName="metal" mode="dark" />
            </div>
          </div>
        ))}
      </div>
      <div className="mx-divider"></div>
      <div className="mx-note">
        <b>位置</b>：顶部中央（替代现主题切换器，主题组并入）。<b>按钮态</b>：rest 灰 → hover 白 + 微底色；当前屏 accent 下划线 + 加粗；
        不可达屏（未开赛的对战/结算）32% 置灰禁点。<b>危险操作</b>：hover 转 <code>var(--lose)</code> 红，点击进入 armed——「确认重抽」实底红 / 「取消」描边灰；
        确认后执行并 toast 反馈。回主界面同流程（文案「放弃本局回主界面？」）。<b>误触兜底</b>：armed 态点击条外任意处=取消。
      </div>
    </SpecBoard>
  );
}

function ImplSpec() {
  return (
    <SpecBoard title="落地规格 · 九宫格 / 动效 / Cocos 要点" width={920}>
      <div style={{ display: "flex", gap: 26 }}>
        <div style={{ flex: "0 0 300px", display: "flex", flexDirection: "column", gap: 12 }}>
          <span className="mx-h" style={{ textAlign: "left" }}>边框素材切片</span>
          <div style={{ display: "flex", gap: 18 }}>
            {[["input/border-factor-normal.png", "71×73 · slice 16", 16 / 71], ["input/border-factor-gold.png", "126×126 · slice 26", 26 / 126]].map(([src, lab, frac]) => (
              <div key={src} style={{ display: "flex", flexDirection: "column", gap: 7, alignItems: "center" }}>
                <div style={{ position: "relative", width: 104, height: 104 }}>
                  <img src={src} alt="" style={{ width: "100%", height: "100%", imageRendering: "pixelated" }} />
                  {["top", "bottom"].map((p) => (
                    <span key={p} style={{ position: "absolute", left: 0, right: 0, [p]: `${frac * 100}%`, height: 1, background: "rgba(255,80,160,.85)" }}></span>
                  ))}
                  {["left", "right"].map((p) => (
                    <span key={p} style={{ position: "absolute", top: 0, bottom: 0, [p]: `${frac * 100}%`, width: 1, background: "rgba(255,80,160,.85)" }}></span>
                  ))}
                </div>
                <span className="mx-h">{lab}</span>
              </div>
            ))}
          </div>
          <div className="mx-note">
            因子位全部是正方形 → <b>整图等比缩放即可，不必九宫格</b>。如需矩形复用（地图角标等）：绿框 slice 16/71，金框 slice 26/126（凹口落在拉伸区，建议 repeat 模式用 stretch）。
            金框中心全透明；绿框中心带半透明灰膜（游戏内同款压图效果，保留）。
          </div>
        </div>
        <div style={{ width: 1, background: "var(--panel-edge)" }}></div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          <span className="mx-h" style={{ textAlign: "left" }}>动效规格（§4.5 池 sel / 清槽 / 拖放）</span>
          <div className="mx-kv">
            <div className="mx-kv-row"><span className="k">✓ 角标 出现</span><span className="v">scale 0 → 1.15 → 1 · 180ms · <i>back-out (.34,1.56,.64,1)</i></span></div>
            <div className="mx-kv-row"><span className="k">sel 上浮 + 外圈</span><span className="v">translateY 0→-3 / 圈 0→2px · 120ms · <i>ease-out</i></span></div>
            <div className="mx-kv-row"><span className="k">sel 取消（清除）</span><span className="v">反向整组 · 140ms · <i>ease-in</i>，✓ 直接 fade 90ms</span></div>
            <div className="mx-kv-row"><span className="k">拖入槽位落定</span><span className="v">图标 scale 1.08→1 · 160ms <i>ease-out</i>；槽框 accent 闪环 2px→0 · 240ms</span></div>
            <div className="mx-kv-row"><span className="k">清槽</span><span className="v">内容 scale 1→0 + fade · 160ms <i>ease-in</i>；空槽虚线框 fade-in 120ms</span></div>
            <div className="mx-kv-row"><span className="k">校验 toast</span><span className="v">slide-in 8px + fade 200ms；抖动 ±4px ×3 · 300ms；4s 自动消失</span></div>
            <div className="mx-kv-row"><span className="k">控制条 收起/展开</span><span className="v">宽度塌缩 + fade · 220ms · <i>ease-in-out</i></span></div>
            <div className="mx-kv-row"><span className="k">armed 自动还原</span><span className="v">5s 倒计时；条外点击立即取消</span></div>
          </div>
          <div className="mx-divider"></div>
          <div className="mx-note">
            <b>Cocos 备注</b>：cc 边框用 Graphics 圆角矩形两层描边 + Sprite 投影（或 92×106 九宫格 png，slice 8）；
            <code>color-mix</code> 辉光在 Cocos 用 accent 色 50% 透明度外圈 Sprite 模拟；dim 用材质灰度 + 55% 不透明度；
            金框/绿框直接贴 png Sprite（SIMPLE 模式整体缩放）。对比度复核：toast 红底白字 ≥4.5:1（lose 色 #a3434a 上白字 5.4:1 ✓）。
          </div>
        </div>
      </div>
    </SpecBoard>
  );
}

Object.assign(window, { CtrlStates, ImplSpec });
