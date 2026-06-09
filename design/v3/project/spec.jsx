/* 集结杯 × CM — per-style spec sheet + handoff brief */
(function () {
  const MARK = () => window.JJB.MARK;
  const MARK_LIGHT = () => window.JJB.MARK_LIGHT;
  const markFor = (style, mode) => (mode === 'light' ? MARK_LIGHT() : MARK())[style];
  const SPECS = {
    metal: {
      label: '风格 A', name: '精修金属', en: 'POLISHED METAL',
      blurb: '星际2 官方旗舰质感 · 深藏青 + 金属金 + 银钢。切角金属面板、衬线金字标题。庄重、厚重，金色在直播暗场里极醒目。',
      dark: [['底', '#0A1422'], ['金属金', '#D8B15A'], ['银钢/字', '#E9EEF4']],
      light: [['底', '#E2E9F1'], ['暗金', '#A9761F'], ['墨蓝/字', '#15233A']],
      type: [['赛事标题', 'Noto Serif SC 900', 52], ['区块标题', 'Noto Sans SC 700', 26], ['正文/标签', 'Noto Sans SC 500', 20], ['按钮文字', 'Noto Sans SC 700', 22], ['数字/拉丁', 'Oswald 600', 18]],
      logo: '金属金「dM」字标 ｜ 竖向金线分隔 ｜ 衬线金字「集结杯」',
    },
    sc2: {
      label: '风格 B', name: '星际2质感', en: 'SC2 CONSOLE',
      blurb: '仿游戏指挥台 · 钢绿读出 + 转角刻线 + 钢面板。冷峻硬核，绿色强调与星际2 HUD 同源，叠在游戏画面毫无违和。',
      dark: [['底', '#0B1416'], ['钢绿', '#56CF8C'], ['钢银/字', '#DFEAE6']],
      light: [['底', '#DDE8E4'], ['深绿', '#1F8A55'], ['墨绿/字', '#14241F']],
      type: [['赛事标题', 'Rajdhani 700 / Noto Sans SC', 48], ['区块标题', 'Noto Sans SC 600', 24], ['正文/标签', 'Noto Sans SC 500', 18], ['按钮文字', 'Noto Sans SC 600', 20], ['代号/数据', 'Share Tech Mono', 16]],
      logo: '银钢「dM」字标 ｜ 钢绿刻线分隔 ｜ 集结杯 + 钢绿副标',
    },
    minimal: {
      label: '风格 C', name: '极简', en: 'MINIMAL',
      blurb: '克制留白 · 平面 + 单一蓝强调 + 大字号。信息层级最清晰，明暗切换都干净；适合快节奏直播一眼读懂。',
      dark: [['底', '#0F1013'], ['蓝强调', '#4F8FF5'], ['白/字', '#F1F3F6']],
      light: [['底', '#FFFFFF'], ['蓝强调', '#2F6FD6'], ['墨/字', '#14171C']],
      type: [['赛事标题', 'Noto Sans SC 900', 54], ['区块标题', 'Noto Sans SC 700', 26], ['正文/标签', 'Noto Sans SC 500', 19], ['按钮文字', 'Noto Sans SC 700', 22], ['数字/拉丁', 'Oswald', 20]],
      logo: '矢量「II/CM」标 ｜ 蓝色细线分隔 ｜ 粗黑无衬线「集结杯」',
    },
  };

  function Swatches({ rows }) {
    return (
      <div className="sw-row">
        {rows.map((c, i) => (
          <div className="sw" key={i}>
            <span className="sw-chip" style={{ background: c[1] }} />
            <span className="sw-meta"><b>{c[0]}</b><code>{c[1]}</code></span>
          </div>
        ))}
      </div>
    );
  }

  function Spec({ style, mode }) {
    const s = SPECS[style];
    return (
      <div className={'jjb style-' + style + ' mode-' + mode + ' spec'} data-screen-label="规范">
        <div className="jjb-bg spec-bg" aria-hidden="true"><div className="bg-grad" /><div className="bg-tex" /></div>
        <div className="jjb-inner spec-inner">
          <header className="spec-head">
            <span className="spec-idx">{s.label}</span>
            <span className="spec-name">{s.name}</span>
            <span className="spec-en">{s.en}</span>
          </header>
          <p className="spec-blurb">{s.blurb}</p>
          <div className="spec-grid">
            <section className="spec-card spec-logo">
              <h4 className="spec-card-t">联名 LOGO 概念</h4>
              <div className="spec-logo-show">
                <div className="lockup lockup-lg">
                  <img className="lockup-mark" src={markFor(style, mode)} alt="CM" />
                  <span className="lockup-div" />
                  <span className="lockup-word"><span className="lockup-cn">集结杯</span><span className="lockup-en">REGROUP CUP</span></span>
                </div>
              </div>
              <p className="spec-logo-note">{s.logo}</p>
            </section>

            <section className="spec-card">
              <h4 className="spec-card-t">配色 · 明 / 暗双模式 · ≤3 主色</h4>
              <div style={{ fontSize: '12px', letterSpacing: '2px', color: 'var(--muted)', margin: '0 0 8px' }}>暗色模式</div>
              <Swatches rows={s.dark} />
              <div style={{ fontSize: '12px', letterSpacing: '2px', color: 'var(--muted)', margin: '16px 0 8px' }}>亮色模式</div>
              <Swatches rows={s.light} />
            </section>

            <section className="spec-card">
              <h4 className="spec-card-t">字号层级 · 基准 1280×720</h4>
              <div className="type-rows">
                {s.type.map((t, i) => (
                  <div className="type-row" key={i}>
                    <span className="type-sample" style={{ fontSize: Math.min(t[2], 28) + 'px' }}>{t[0]}</span>
                    <span className="type-spec"><span className="type-px">{t[2]}px</span><span className="type-fam">{t[1]}</span></span>
                  </div>
                ))}
              </div>
            </section>

            <section className="spec-card">
              <h4 className="spec-card-t">组件 · 按钮 / 状态</h4>
              <div className="comp-row">
                <button className="mode-btn comp-mode" type="button"><span className="mode-no">01</span><span className="mode-name">8 因子模式</span><span className="mode-tag">标准</span></button>
                <div className="verdict comp-verdict">
                  <button className="v-btn v-win on" type="button">胜利</button>
                  <button className="v-btn v-bonus" type="button">带奖励</button>
                  <button className="v-btn v-lose" type="button">失败</button>
                </div>
              </div>
              <p className="spec-bg-note">背景：星际2 战场实景图（GPT-image-2 产出 · 暗化 ~65%），文字层独立叠加。</p>
            </section>
          </div>
        </div>
      </div>
    );
  }

  function Brief({ style, mode }) {
    return (
      <div className={'jjb style-' + style + ' mode-' + mode + ' spec brief'} data-screen-label="交付规范">
        <div className="jjb-bg spec-bg" aria-hidden="true"><div className="bg-grad" /><div className="bg-tex" /></div>
        <div className="jjb-inner spec-inner">
          <header className="spec-head">
            <span className="spec-idx">交付</span>
            <span className="spec-name">渲染分层 & 工具分工</span>
            <span className="spec-en">DELIVERY · OBS SPEC</span>
          </header>
          <p className="spec-blurb">每屏 = 4 层节点叠加。本套（Claude Design）产出 ② 控件骨架 + ④ 文字层级 + 风格/明暗切换 + data.js，并指定 ① 整图清单交 GPT-image-2；③ 游戏图标用既有素材、围固定尺寸排版。产物 HTML/CSS/React/data.js 入 git，工程在 Cocos 重实现。</p>
          <div className="spec-grid">
            <section className="spec-card">
              <h4 className="spec-card-t">渲染分层 · 4 层节点</h4>
              <div className="brief-list">
                <div className="brief-row"><span className="bn">①</span><span>静态美术整图</span><span className="bk">images/bg/</span><span className="own ext">GPT-image-2</span></div>
                <div className="brief-row"><span className="bn">②</span><span>控件「占位」视觉</span><span className="bk">按钮/面板/槽位</span><span className="own us">本套设计</span></div>
                <div className="brief-row"><span className="bn">③</span><span>动态游戏图标</span><span className="bk">运行时加载</span><span className="own fix">既有素材</span></div>
                <div className="brief-row"><span className="bn">④</span><span>文字 Label</span><span className="bk">字号+overflow</span><span className="own us">本套设计</span></div>
              </div>
              <div className="brief-flow">
                <span className="flow-step">① 定骨架</span><span className="flow-arr">→</span>
                <span className="flow-step">② 出整图</span><span className="flow-arr">→</span>
                <span className="flow-step">③ Cocos 组装</span><span className="flow-arr">→</span>
                <span className="flow-step">④ build+截图反馈</span>
              </div>
            </section>

            <section className="spec-card">
              <h4 className="spec-card-t">整图需求清单 · 交 GPT-image-2</h4>
              <div className="mani">
                <div className="mani-row"><span className="mf">bg-main.jpg</span><span className="ms">1280×720</span><span className="md">全屏底 · 无字 · 暗化 ~65%</span></div>
                <div className="mani-row"><span className="mf">title-banner.png</span><span className="ms">1076×285</span><span className="md">集结杯标题艺术字（替换回归杯）</span></div>
                <div className="mani-row"><span className="mf">bg-light.jpg</span><span className="ms">1280×720</span><span className="md">亮色模式底（明暗各一套）</span></div>
                <div className="mani-row"><span className="mf">texture.png</span><span className="ms">1280×720</span><span className="md">底纹叠加（可选）</span></div>
              </div>
            </section>

            <section className="spec-card">
              <h4 className="spec-card-t">既有图标基准 · 不重画 · 预留双打</h4>
              <div className="mani">
                <div className="mani-row"><span className="mf">指挥官头像</span><span className="ms">60×60</span><span className="md">单打 1 位 · 双打 2 位</span></div>
                <div className="mani-row"><span className="mf">地图缩略</span><span className="ms">200×70</span><span className="md">横幅比例</span></div>
                <div className="mani-row"><span className="mf">因子图标</span><span className="ms">76×76</span><span className="md">单打 3–6 · 双打更多 · 自动换行</span></div>
              </div>
              <p className="spec-bg-note">槽位/栅格按以上固定尺寸排版并预留双打容量；图标不重绘。</p>
            </section>

            <section className="spec-card">
              <h4 className="spec-card-t">直播 / 切换规范</h4>
              <ul className="rule">
                <li>支持 3 风格 × 明暗切换；每种组合均高对比、可直接入镜。</li>
                <li>选中因子高亮 + 上浮 + ✓；未选压暗 40%，直播一眼可辨。</li>
                <li>常驻浮层为全屏渲染，主播在 OBS 内自行拖拽 / 缩放定位。</li>
                <li>mode/players/result 框仅 103×50 → 定字号层级 + 截断/自适应，禁止溢出。</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Cocos 落地几何规格 (P4) + 比例换算 (P2) + 背景方向 (P5) ---------- */
  function CocosSpec({ style, mode }) {
    return (
      <div className={'jjb style-' + style + ' mode-' + mode + ' spec brief cocos'} data-screen-label="Cocos规格">
        <div className="jjb-bg spec-bg" aria-hidden="true"><div className="bg-grad" /><div className="bg-tex" /></div>
        <div className="jjb-inner spec-inner">
          <header className="spec-head">
            <span className="spec-idx">Cocos</span>
            <span className="spec-name">皮肤专属视觉 · 落地几何规格</span>
            <span className="spec-en">GEOMETRY · SCALING · BACKGROUND</span>
          </header>
          <p className="spec-blurb">CSS 效果 Cocos 无法直接还原 → 此处给每个皮肤标志性效果的精确几何（供 sprite / 九宫格 / shader 还原）或 Cocos 友好简化等效。所有数值基于 1280×720。</p>
          <div className="spec-grid">
            <section className="spec-card">
              <h4 className="spec-card-t">① 金属 · 切角 chamfer</h4>
              <div className="geo-demo">
                <span className="geo-box geo-chamfer" />
                <span className="geo-cap">仅 ↖ 左上 + ↘ 右下 两角 · 45°</span>
              </div>
              <div className="mani">
                <div className="mani-row"><span className="mf">面板/卡片</span><span className="ms">12 px</span><span className="md">切角直角边长（两直角边各 12px）</span></div>
                <div className="mani-row"><span className="mf">按钮</span><span className="ms">15 px</span><span className="md">同上 · 角度 45°</span></div>
              </div>
              <p className="spec-bg-note">Cocos：九宫格 sprite 预切角，或多边形遮罩顶点 (0,0)(W-12,0)(W,12)(W,H)(12,H)(0,H-12)。</p>
            </section>

            <section className="spec-card">
              <h4 className="spec-card-t">② 星际2 · 四角刻线 corner ticks</h4>
              <div className="geo-demo">
                <span className="geo-box geo-ticks" />
                <span className="geo-cap">↖ 上+左 / ↘ 下+右 · L 形</span>
              </div>
              <div className="mani">
                <div className="mani-row"><span className="mf">线长</span><span className="ms">14 px</span><span className="md">每条边臂长</span></div>
                <div className="mani-row"><span className="mf">线宽</span><span className="ms">2 px</span><span className="md">accent 色 100%</span></div>
                <div className="mani-row"><span className="mf">偏移</span><span className="ms">-1 px</span><span className="md">压在边框外缘</span></div>
              </div>
              <p className="spec-bg-note">Cocos：4 个 14×2 / 2×14 色块 Sprite 锚定四角；或一张九宫格刻线贴图。</p>
            </section>

            <section className="spec-card">
              <h4 className="spec-card-t">③ 渐变 / 遮罩 · 数值停靠点</h4>
              <div className="mani">
                <div className="mani-row"><span className="mf">金字渐变</span><span className="ms">180°</span><span className="md">#F6E7B6 0% → #D8B15A 52% → #A87E2F 100%</span></div>
                <div className="mani-row"><span className="mf">亮色金字</span><span className="ms">180°</span><span className="md">#8A6516 0% → #5D4310 55% → #2F2105 100%</span></div>
                <div className="mani-row"><span className="mf">sc2 网格</span><span className="ms">44 px</span><span className="md">线 accent@5% · radial 遮罩 50%/40% 中心 30%→92% 透明</span></div>
                <div className="mani-row"><span className="mf">面板顶高光</span><span className="ms">1 px</span><span className="md">inset 顶边 白@14%（暗）/ 白@70%（亮）</span></div>
              </div>
              <p className="spec-bg-note">Cocos：渐变文字 = 预渲染 PNG 标题（推荐），或逐字渐变材质；网格 = 平铺 sprite + 径向 alpha 遮罩贴图。</p>
            </section>

            <section className="spec-card">
              <h4 className="spec-card-t">④ 比例换算 · rs-num 与全局 px</h4>
              <p className="scale-formula">px<sub>实际</sub> = px<sub>720基准</sub> × (屏高 / 720)　·　rs-num 基准 <b>108px</b></p>
              <div className="scale-table">
                <div className="st-row st-h"><span>分辨率</span><span>缩放</span><span>rs-num</span></div>
                <div className="st-row"><span>1280×720</span><span>1.00×</span><span>108 px</span></div>
                <div className="st-row"><span>1600×900</span><span>1.25×</span><span>135 px</span></div>
                <div className="st-row"><span>1920×1080</span><span>1.50×</span><span>162 px</span></div>
                <div className="st-row"><span>2560×1440</span><span>2.00×</span><span>216 px</span></div>
              </div>
              <p className="spec-bg-note">Cocos：用 Canvas + Widget 等比缩放整层（设计分辨率 1280×720，Fit Height），字号无需逐档手改。</p>
            </section>

            <section className="spec-card spec-span2">
              <h4 className="spec-card-t">⑤ 背景层方向确认 · 写实整图 + 可读性遮罩（推荐保留）</h4>
              <div className="bgconf">
                <div className="bgconf-col">
                  <p className="bgconf-rec">建议：保留 GPT-image 写实星际场景（已落地、直播质感强），网格/斜纹降级为低透明叠加，保住皮肤纹理签名。</p>
                  <ul className="rule">
                    <li>整图 → 叠 <b>黑色蒙版 62–68%</b>（暗模式）/ <b>白色蒙版 55–62%</b>（亮模式）。</li>
                    <li>文字区加 <b>顶/底 scrim</b>：线性渐变 黑@55% → 透明，高度 ≈ 30%。</li>
                    <li>面板自带近不透明底（≥ 74% 不透明），不依赖整图对比。</li>
                  </ul>
                </div>
                <div className="bgconf-col">
                  <div className="mani">
                    <div className="mani-row"><span className="mf">bg-dark.jpg</span><span className="ms">1280×720</span><span className="md">暗模式底 · 已暗化 65%</span></div>
                    <div className="mani-row"><span className="mf">bg-light.jpg</span><span className="ms">1280×720</span><span className="md">亮模式底 · 提亮去饱和</span></div>
                    <div className="mani-row"><span className="mf">tex-grid.png</span><span className="ms">平铺</span><span className="md">皮肤纹理 · 叠加 @5–8%</span></div>
                    <div className="mani-row"><span className="mf">scrim.png</span><span className="ms">1280×216</span><span className="md">顶/底渐隐（或纯 shader）</span></div>
                  </div>
                  <p className="spec-bg-note">对比目标：正文文字与其背景对比度 ≥ 4.5:1（WCAG AA），直播压缩后仍清晰。</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  Object.assign(window, { Spec, Brief, CocosSpec });
}());
