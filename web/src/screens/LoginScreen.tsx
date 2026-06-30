import { useState } from 'react';
import { pbAuthHost, pbAuthPlayer } from '../logic/backend';
import { ScreenShell } from '../components/ScreenShell';
import { LoginHero, loginInputStyle } from '../components/LoginHero';

// LoginScreen — 登录界面 F。选手/主播双 tab：
//   主播 tab → pbAuthHost(accounts, role host/admin)；选手 tab → pbAuthPlayer(player_accounts, phone 登录)。
//   记住我勾选 → localStorage 跨会话自动登录。选手 tab 底部「去注册」→ onRegister。
type LoginStatus = 'idle' | 'loading' | 'error' | 'success';
type LoginKind = 'host' | 'player';

export function LoginScreen({ style, mode, onBack, onSuccess, onRegister }: { style: string; mode: string; onBack: () => void; onSuccess: () => void; onRegister: () => void }) {
  const [kind, setKind] = useState<LoginKind>('player');
  const [acct, setAcct] = useState('');
  const [pwd, setPwd] = useState('');
  const [remember, setRemember] = useState(false);
  const [status, setStatus] = useState<LoginStatus>('idle');

  const isPlayer = kind === 'player';
  const switchKind = (k: LoginKind) => { if (k === kind) return; setKind(k); setStatus('idle'); };
  const clearErr = () => { if (status === 'error') setStatus('idle'); };

  const handleLogin = async () => {
    if (status === 'loading' || status === 'success') return;
    if (!acct || !pwd) { setStatus('error'); return; }
    setStatus('loading');
    try {
      if (isPlayer) await pbAuthPlayer(acct, pwd, remember); // 选手：phone + 密码
      else await pbAuthHost(acct, pwd, remember);            // 主播：email + 密码
      setStatus('success');
      setTimeout(onSuccess, 900);
    } catch {
      setStatus('error');
    }
  };

  const inputStyle = loginInputStyle;
  const btnText = status === 'loading' ? '登录中' : status === 'success' ? (isPlayer ? '进入' : '进入后台') : '登录';
  const btnDisabled = status === 'loading' || status === 'success';

  return (
    <ScreenShell className={`jjb login-stage style-${style} mode-${mode}`} data-screen-label={`login-${style}-${mode}`}>
      <div className="jjb-inner login-inner">

        {/* 左：品牌 hero */}
        <LoginHero sub={isPlayer ? '选手 · 参赛登录' : '主播 · 比赛后台'} />

        <div className="hero-div"></div>

        {/* 右：登录卡（选手/主播双 tab） */}
        <div className="slot login-card">
          <div className="login-tabs" role="tablist">
            <button type="button" className={'login-tab' + (isPlayer ? ' on' : '')} data-login-tab="player" onClick={() => switchKind('player')}>选手登录</button>
            <button type="button" className={'login-tab' + (!isPlayer ? ' on' : '')} data-login-tab="host" onClick={() => switchKind('host')}>主播登录</button>
          </div>

          <div className="login-titleblock">
            <span className="login-kicker">{isPlayer ? 'PLAYER · 参赛选手' : 'ADMIN · 比赛后台'}</span>
            <span className="login-title">{isPlayer ? '选手登录' : '主播登录'}</span>
            <span className="login-cardsub">{isPlayer ? '登录后参赛 · 练习战绩可自助记录' : '登录后判定对局 · 生成对局码 · 写入积分'}</span>
          </div>

          <div className="login-fields">
            <div className="lf">
              <span className="lf-label">{isPlayer ? '手机号' : '主播账号'}</span>
              <div className="player-field lf-field">
                <input className="lf-val" type={isPlayer ? 'tel' : 'text'} value={acct} placeholder={isPlayer ? '注册手机号' : '主播账号'} data-login-acct
                  onChange={(e) => { setAcct(e.target.value); clearErr(); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleLogin(); }} style={inputStyle} />
              </div>
            </div>
            <div className="lf">
              <span className="lf-label">密码</span>
              <div className="player-field lf-field">
                <input className="lf-val" type="password" value={pwd} placeholder="密码" data-login-pwd
                  onChange={(e) => { setPwd(e.target.value); clearErr(); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleLogin(); }} style={inputStyle} />
              </div>
            </div>
            <label className="lf-remember" data-login-remember>
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span>记住我 · 下次自动登录</span>
            </label>
          </div>

          {status === 'error' && (
            <div className="login-banner warn" data-login-banner="error">
              <span className="banner-mark">!</span><span>{isPlayer ? '手机号或密码错误' : '账号或密码错误'}</span>
            </div>
          )}
          {status === 'success' && (
            <div className="login-banner ok" data-login-banner="success">
              <span className="banner-mark">✓</span><span>登录成功 · 正在进入</span>
            </div>
          )}

          <button className="startbtn login-btn" disabled={btnDisabled} onClick={() => void handleLogin()} data-login-btn>
            {status === 'loading' && <span className="spin"></span>}
            <span>{btnText}</span>
            {status !== 'loading' && <span className="startbtn-arrow">›</span>}
          </button>

          <div className="login-foot">
            <button className="login-link" onClick={onBack}>返回练习<span className="lk-en">PRACTICE</span></button>
            {isPlayer
              ? <button className="login-link" type="button" onClick={onRegister} data-login-register>没有账号？注册<span className="lk-en">SIGN UP</span></button>
              : <button className="login-link" type="button">忘记密码<span className="lk-en">RESET</span></button>}
          </div>
        </div>

      </div>
    </ScreenShell>
  );
}
