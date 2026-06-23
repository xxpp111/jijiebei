import { useState } from 'react';
import { pbAuth } from '../logic/backend';
import { raceUrl } from '../lib/realAsset';

// LoginScreen — 主播登录界面 F（承接 Claude Design fa6fc5cf 主播登录.dc.html）。
// 左品牌 hero(集结杯字标 + 星际2 三族印花) / 右登录卡(主播账号·密码 + 4态)。pbAuth 接 P5 accounts(role host/admin)。
type LoginStatus = 'idle' | 'loading' | 'error' | 'success';

export function LoginScreen({ style, mode, onBack, onSuccess }: { style: string; mode: string; onBack: () => void; onSuccess: () => void }) {
  const [acct, setAcct] = useState('');
  const [pwd, setPwd] = useState('');
  const [status, setStatus] = useState<LoginStatus>('idle');

  const handleLogin = async () => {
    if (status === 'loading' || status === 'success') return;
    if (!acct || !pwd) { setStatus('error'); return; }
    setStatus('loading');
    try {
      await pbAuth(acct, pwd); // identity=主播账号(email) → token 内存态
      setStatus('success');
      setTimeout(onSuccess, 900); // 成功态展示后跳转
    } catch {
      setStatus('error');
    }
  };

  const inputStyle = { background: 'none', border: 'none', outline: 'none', color: 'var(--ink)', width: '100%', font: 'inherit' } as const;
  const btnText = status === 'loading' ? '登录中' : status === 'success' ? '进入后台' : '登录';
  const btnDisabled = status === 'loading' || status === 'success';

  return (
    <div className={`jjb login-stage style-${style} mode-${mode}`} style={{ width: 1280, height: 720 }} data-screen-label={`login-${style}-${mode}`}>
      <div className="jjb-bg"><div className="bg-grad"></div><div className="bg-tex"></div><div className="bg-vignette"></div></div>
      <div className="jjb-inner login-inner">

        {/* 左：品牌 hero */}
        <div className="login-hero">
          <div className="lockup lockup-lg">
            <div className="lockup-word">
              <span className="lockup-cn">集结杯</span>
              <span className="lockup-en">ASSEMBLY CUP</span>
            </div>
          </div>
          <div className="hero-kicker">STARCRAFT II · CO-OP MISSIONS</div>
          <div className="hero-sub">主播 · 比赛后台</div>
          <div className="hero-racesblock">
            <div className="hero-racescap">星际II 合作任务 · 参赛三族</div>
            <div className="hero-races">
              {([['P', '神族', 'PROTOSS'], ['T', '人族', 'TERRAN'], ['Z', '虫族', 'ZERG']] as const).map(([code, cn, en]) => (
                <div className="race-emblem" key={code}>
                  <img src={raceUrl(code)} alt={cn} />
                  <div className="race-name"><b>{cn}</b><span>{en}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="hero-div"></div>

        {/* 右：登录卡 */}
        <div className="slot login-card">
          <div className="login-titleblock">
            <span className="login-kicker">ADMIN · 比赛后台</span>
            <span className="login-title">主播登录</span>
            <span className="login-cardsub">登录后判定对局 · 生成对局码 · 写入积分</span>
          </div>

          <div className="login-fields">
            <div className="lf">
              <span className="lf-label">主播账号</span>
              <div className={'player-field lf-field' + (status === 'idle' || acct ? ' active' : '')}>
                <input className="lf-val" value={acct} placeholder="主播账号" data-login-acct
                  onChange={(e) => { setAcct(e.target.value); if (status === 'error') setStatus('idle'); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleLogin(); }} style={inputStyle} />
              </div>
            </div>
            <div className="lf">
              <span className="lf-label">密码</span>
              <div className="player-field lf-field">
                <input className="lf-val" type="password" value={pwd} placeholder="密码" data-login-pwd
                  onChange={(e) => { setPwd(e.target.value); if (status === 'error') setStatus('idle'); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleLogin(); }} style={inputStyle} />
              </div>
            </div>
          </div>

          {status === 'error' && (
            <div className="login-banner warn" data-login-banner="error">
              <span className="banner-mark">!</span><span>账号或密码错误</span>
            </div>
          )}
          {status === 'success' && (
            <div className="login-banner ok" data-login-banner="success">
              <span className="banner-mark">✓</span><span>登录成功 · 正在进入比赛后台</span>
            </div>
          )}

          <button className="startbtn login-btn" disabled={btnDisabled} onClick={() => void handleLogin()} data-login-btn>
            {status === 'loading' && <span className="spin"></span>}
            <span>{btnText}</span>
            {status !== 'loading' && <span className="startbtn-arrow">›</span>}
          </button>

          <div className="login-foot">
            <button className="login-link" onClick={onBack}>返回练习<span className="lk-en">PRACTICE</span></button>
            <button className="login-link" type="button">忘记密码<span className="lk-en">RESET</span></button>
          </div>
        </div>

      </div>
    </div>
  );
}
