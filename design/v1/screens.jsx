/* 集结杯 × CM — screens. Shared markup; skinned by .style-X.mode-Y via styles.css */
(function () {
  const { EVENT, MARK, MODES, FACTORS, GROUP_A, GROUP_B, POOL, MATCHES } = window.JJB;
  const RESULT_LABEL = { win: '胜利', bonus: '带奖励', lose: '失败' };

  const cx = (style, mode, extra) => 'jjb style-' + style + ' mode-' + mode + (extra ? ' ' + extra : '');

  function Bg() {
    return (
      <div className="jjb-bg" aria-hidden="true">
        <div className="bg-grad" />
        <div className="bg-tex" />
        <div className="bg-vignette" />
      </div>
    );
  }

  function Lockup({ style, size = 'md' }) {
    return (
      <div className={'lockup lockup-' + size}>
        <img className="lockup-mark" src={MARK[style]} alt="CM" />
        <span className="lockup-div" />
        <span className="lockup-word">
          <span className="lockup-cn">{EVENT.cn}</span>
          <span className="lockup-en">{EVENT.en}</span>
        </span>
      </div>
    );
  }

  function FactorIcon({ f, size, state }) {
    return (
      <span className={'factor' + (state ? ' factor-' + state : '')} style={size ? { '--fz': size + 'px' } : null} title={f.name}>
        <img src={f.img} alt={f.name} />
        {state === 'sel' ? <span className="factor-check">✓</span> : null}
      </span>
    );
  }

  function Avatar({ c, big, name = true }) {
    if (c.ph) return <span className="avatar ph" />;
    return (
      <span className={'avatar' + (big ? ' big' : '')} title={c.name}>
        <img src={c.img} alt={c.name} />
        {name ? <span className="avatar-name">{c.name}</span> : null}
      </span>
    );
  }

  function MapThumb({ m }) {
    return (<span className="mapthumb"><img src={m.img} alt={m.name} /></span>);
  }

  function Foot() {
    return (
      <div className="foot">
        <span className="foot-org">{EVENT.org}</span>
        <span className="foot-links">
          {EVENT.links.map((l, i) => (<span className="foot-link" key={i}><b>{l.k}</b>{l.v}</span>))}
          <span className="foot-link"><b>开黑群</b>{EVENT.qq}</span>
        </span>
      </div>
    );
  }

  /* ---------- 1 · 首页 ---------- */
  function Home({ style, mode }) {
    return (
      <div className={cx(style, mode)} data-screen-label="首页">
        <Bg />
        <div className="jjb-inner home">
          <header className="home-head">
            <Lockup style={style} size="lg" />
            <p className="home-sub">{EVENT.sub}</p>
            <p className="home-host">{EVENT.org}　·　B站主播「{EVENT.host}」</p>
          </header>

          <div className="player-row">
            <label className="player-label">参赛选手</label>
            <span className="player-field"><span className="player-ph">请输入选手 ID</span><span className="caret" /></span>
          </div>

          <div className="mode-block">
            <div className="block-head"><span className="block-kicker">SELECT MODE</span><span className="block-title">比赛模式</span></div>
            <div className="mode-grid">
              {MODES.map((m) => (
                <button className="mode-btn" key={m.no} type="button">
                  <span className="mode-no">{m.no}</span>
                  <span className="mode-name">{m.name}</span>
                  <span className="mode-tag">{m.tag}</span>
                </button>
              ))}
            </div>
          </div>

          <Foot />
        </div>
      </div>
    );
  }

  function TopBar({ style, meta }) {
    return (
      <header className="topbar">
        <Lockup style={style} size="sm" />
        <div className="topbar-meta">
          {meta.map((row, i) => (<span className="meta-row" key={i}><span className="meta-k">{row[0]}</span><span className="meta-v">{row[1]}</span></span>))}
        </div>
      </header>
    );
  }

  /* ---------- 2 · 选择面板 (高对比, 预留双打) ---------- */
  function Selection({ style, mode }) {
    return (
      <div className={cx(style, mode)} data-screen-label="选择面板">
        <Bg />
        <div className="jjb-inner sel">
          <TopBar style={style} meta={[['当前选手', 'Potato_01'], ['比赛模式', '8 因子 · 手选']]} />

          <div className="slots">
            {MATCHES.map((m, i) => {
              const active = i === 0;
              const cmdN = m.doubles ? 2 : 1;
              const facN = Math.max(3, m.factors.length);
              return (
                <div className={'slot' + (m.boss ? ' slot-boss' : '') + (active ? ' slot-active' : '')} key={i}>
                  <div className="slot-head">
                    <span className="slot-no">{m.slot}</span>
                    <span className="slot-map-name">{m.map.name}</span>
                    {m.doubles ? <span className="slot-dbl">双打</span> : null}
                    {active ? <span className="slot-flag">选择中</span> : null}
                  </div>
                  <MapThumb m={m.map} />
                  <div className="slot-targets">
                    <div className="t-cmds">
                      {Array.from({ length: cmdN }).map((_, k) => (
                        active && m.cmds[k]
                          ? <span className="t-cmd filled" key={k}><img className="t-fill" src={m.cmds[k].img} alt="" /></span>
                          : <span className="t-cmd drop" key={k}><span className="drop-hint">指挥官</span></span>
                      ))}
                    </div>
                    <div className="t-facs">
                      {Array.from({ length: facN }).map((_, k) => (
                        active && m.factors[k]
                          ? <span className="t-fac filled" key={k}><img className="t-fill" src={m.factors[k].img} alt="" /></span>
                          : <span className="t-fac drop" key={k}>{!active && k === 0 ? <span className="drop-hint">因子</span> : null}</span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pool">
            <div className="pool-col pool-factors">
              <div className="block-head sm"><span className="block-kicker">FACTORS</span><span className="block-title">选择因子</span></div>
              <div className="factor-row">
                {FACTORS.map((f) => <FactorIcon key={f.id} f={f} size={66} state={['lava', 'void', 'zombie'].includes(f.id) ? 'sel' : 'dim'} />)}
              </div>
            </div>
            <div className="pool-col pool-cmd">
              <div className="grp-row">
                <div className="grp">
                  <div className="block-head sm"><span className="block-title">A 组指挥官</span></div>
                  <div className="avatar-row">{GROUP_A.map((c) => <Avatar key={c.id} c={c} />)}</div>
                </div>
                <div className="grp">
                  <div className="block-head sm"><span className="block-title">B 组指挥官</span></div>
                  <div className="avatar-row">{GROUP_B.map((c) => <Avatar key={c.id} c={c} />)}</div>
                </div>
              </div>
              <div className="grp grp-self">
                <div className="block-head sm"><span className="block-title">自选指挥官</span><span className="block-note">18 位全解锁 · 双打可放 2 位</span></div>
                <div className="avatar-grid">{POOL.map((c) => <Avatar key={c.id} c={c} name={false} />)}</div>
              </div>
            </div>
          </div>

          <button className="startbtn" type="button">比赛开始<span className="startbtn-arrow">▶</span></button>
        </div>
      </div>
    );
  }

  function Verdict({ active }) {
    return (
      <div className="verdict">
        {['win', 'bonus', 'lose'].map((o) => (
          <button key={o} type="button" className={'v-btn v-' + o + (active === o ? ' on' : '')}>{RESULT_LABEL[o]}</button>
        ))}
      </div>
    );
  }

  /* ---------- 3 · 对战页 (操作位, 含双打) ---------- */
  function Battle({ style, mode }) {
    return (
      <div className={cx(style, mode)} data-screen-label="对战页">
        <Bg />
        <div className="jjb-inner battle">
          <TopBar style={style} meta={[['当前选手', 'Potato_01'], ['比赛模式', '8 因子 · 手选']]} />
          <div className="matches">
            {MATCHES.map((m, i) => (
              <div className={'match' + (m.boss ? ' match-boss' : '')} key={i}>
                <div className="match-no"><span className="match-no-t">{m.slot}</span>{m.doubles ? <span className="match-dbl">双打</span> : null}</div>
                <div className="match-map"><MapThumb m={m.map} /><span className="match-map-name">{m.map.name}</span></div>
                <div className="match-cmds">{m.cmds.map((c) => <Avatar key={c.id} c={c} big />)}</div>
                <div className="match-factors">{m.factors.map((f) => <FactorIcon key={f.id} f={f} size={50} />)}</div>
                <Verdict active={m.result} />
              </div>
            ))}
          </div>
          <Foot />
        </div>
      </div>
    );
  }

  /* ---------- 4 · 结算页 ---------- */
  function Result({ style, mode }) {
    const wins = MATCHES.filter((m) => m.result === 'win' || m.result === 'bonus').length;
    return (
      <div className={cx(style, mode)} data-screen-label="结算页">
        <Bg />
        <div className="jjb-inner result">
          <TopBar style={style} meta={[['当前选手', 'Potato_01'], ['比赛模式', '8 因子 · 手选']]} />
          <div className="result-body">
            <div className="result-banner">
              <span className="result-kicker">MATCH COMPLETE · 比赛结束</span>
              <span className="result-score"><span className="rs-num">{wins}</span><span className="rs-unit">/ 3 场获胜</span></span>
              <span className="result-tag">{wins === 3 ? '完美通关' : '本局战绩'}</span>
            </div>
            <div className="result-list">
              {MATCHES.map((m, i) => (
                <div className={'rcard rcard-' + m.result} key={i}>
                  <span className="rcard-no">{m.slot}</span>
                  <MapThumb m={m.map} />
                  <span className="rcard-mid">
                    <span className="rcard-cmds">{m.cmds.map((c) => <Avatar key={c.id} c={c} name={false} />)}</span>
                    <span className="rcard-facs">{m.factors.map((f) => <FactorIcon key={f.id} f={f} size={38} />)}</span>
                  </span>
                  <span className={'rcard-badge b-' + m.result}>{RESULT_LABEL[m.result]}</span>
                </div>
              ))}
            </div>
          </div>
          <Foot />
        </div>
      </div>
    );
  }

  /* ---------- 5 · 常驻浮层 (全屏 · 直播常驻记分板 · 主播自行拖拽缩放) ---------- */
  function Overlay({ style, mode }) {
    const ST = ['win', 'live', 'wait'];
    const LABEL = { win: '胜利', bonus: '带奖励', lose: '失败', live: '进行中', wait: '待战' };
    const wins = 1;
    return (
      <div className={cx(style, mode, 'ovl-full')} data-screen-label="常驻浮层">
        <Bg />
        <div className="jjb-inner ovf">
          <header className="ovf-head">
            <Lockup style={style} size="md" />
            <div className="ovf-score">
              <span className="ovf-score-num"><b>{wins}</b><i>/ 3</i></span>
              <span className="ovf-score-lbl">当前获胜</span>
            </div>
          </header>
          <div className="ovf-list">
            {MATCHES.map((m, i) => (
              <div className={'ovf-row st-' + ST[i] + (ST[i] === 'live' ? ' ovf-live' : '')} key={i}>
                <span className="ovf-no">{m.slot}{m.doubles ? <i className="ovf-dbl">双打</i> : null}</span>
                <span className="ovf-map"><MapThumb m={m.map} /></span>
                <span className="ovf-cmds">{m.cmds.map((c) => <Avatar key={c.id} c={c} big name={false} />)}</span>
                <span className="ovf-facs">{m.factors.map((f) => <FactorIcon key={f.id} f={f} size={52} />)}</span>
                <span className={'ovf-st bg-' + ST[i]}>{LABEL[ST[i]]}</span>
              </div>
            ))}
          </div>
          <footer className="ovf-foot">
            <span className="ovf-foot-org">{EVENT.org}　·　主播「{EVENT.host}」</span>
            <span className="ovf-foot-links">{EVENT.links.map((l, i) => <span key={i}><b>{l.k}</b> {l.v}</span>)}</span>
          </footer>
        </div>
      </div>
    );
  }

  Object.assign(window, { JJBLockup: Lockup, Home, Selection, Battle, Result, Overlay });
})();
