import { useMemo, useState } from 'react';
import { ScreenShell } from '../components/ScreenShell';
import { LoginHero, loginInputStyle } from '../components/LoginHero';
import { COMMANDERS } from '../config/commanders';
import { registerPlayer, pbAuthPlayer } from '../logic/backend';

// RegisterScreen — 选手注册界面（需求1）。对齐 LoginScreen F 风格（左 hero + 右卡）。
// 必填：昵称/手机号/密码/确认密码；选填：社交媒体账号 / 擅长指挥官（官方18+CM4）。
// 数据使用同意（D17，纯前端）：未勾选不放行注册，不落库。
// 后端 registerPlayer + pbAuthPlayer 走 backend.ts（经 vite proxy /api → PocketBase player_accounts，注册即登录）。
type RegStatus = 'idle' | 'loading' | 'error' | 'success';

export function RegisterScreen({ style, mode, onBack, onSuccess }: { style: string; mode: string; onBack: () => void; onSuccess: () => void }) {
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [social, setSocial] = useState('');
  const [favCmds, setFavCmds] = useState<Set<string>>(new Set());
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState<RegStatus>('idle');
  const [err, setErr] = useState('');

  const official = useMemo(() => COMMANDERS.filter((c) => c.source === 'official'), []);
  const cm = useMemo(() => COMMANDERS.filter((c) => c.source === 'cm'), []);
  const toggleCmd = (name: string) => { const n = new Set(favCmds); if (n.has(name)) n.delete(name); else n.add(name); setFavCmds(n); };
  const clearErr = () => { if (status === 'error') { setStatus('idle'); setErr(''); } };

  const handleRegister = async () => {
    if (status === 'loading' || status === 'success') return;
    if (!nickname || !phone || !pwd || !pwd2) { setErr('昵称 / 手机号 / 密码 / 确认密码必填'); setStatus('error'); return; }
    if (!/^1\d{10}$/.test(phone)) { setErr('手机号格式不对（11 位）'); setStatus('error'); return; }
    if (pwd.length < 8) { setErr('密码至少 8 位'); setStatus('error'); return; }
    if (pwd !== pwd2) { setErr('两次密码不一致'); setStatus('error'); return; }
    if (!agreed) { setErr('请先阅读并勾选同意数据使用说明'); setStatus('error'); return; }
    setStatus('loading');
    try {
      await registerPlayer({ nickname, phone, password: pwd, social: social || undefined, fav_commanders: favCmds.size ? [...favCmds] : undefined });
      await pbAuthPlayer(phone, pwd, false); // 注册成功 → 自动登录（会话内，不勾记住我）
      setStatus('success');
      setTimeout(onSuccess, 900);
    } catch (e) { setErr((e as Error).message || '注册失败，请重试'); setStatus('error'); }
  };

  const inputStyle = loginInputStyle;
  const reqFields: [string, string, (v: string) => void, string, string][] = [
    ['昵称', nickname, setNickname, 'text', '你的比赛昵称'],
    ['手机号', phone, setPhone, 'tel', '11 位手机号'],
    ['密码', pwd, setPwd, 'password', '至少 8 位'],
    ['确认密码', pwd2, setPwd2, 'password', '再输一次密码'],
  ];

  return (
    <ScreenShell className={`jjb login-stage reg-stage style-${style} mode-${mode}`} data-screen-label={`register-${style}-${mode}`}>
      <div className="jjb-inner login-inner">
        <LoginHero sub="选手 · 注册参赛" />
        <div className="hero-div"></div>
        <div className="slot login-card reg-card">
          <div className="login-titleblock">
            <span className="login-kicker">PLAYER · 选手注册</span>
            <span className="login-title">选手注册</span>
            <span className="login-cardsub">注册后参赛 · 练习自助记录 · 战绩仪表盘</span>
          </div>
          <div className="login-fields reg-fields">
            {reqFields.map(([label, val, setter, type, ph]) => (
              <div className="lf" key={label}>
                <span className="lf-label">{label}<i className="lf-req">*</i></span>
                <div className="player-field lf-field">
                  <input className="lf-val" type={type} value={val} placeholder={ph} data-reg-field={label}
                    onChange={(e) => { setter(e.target.value); clearErr(); }} style={inputStyle} />
                </div>
              </div>
            ))}
            <div className="reg-optdiv"><span>选填</span></div>
            <div className="lf">
              <span className="lf-label">社交媒体</span>
              <div className="player-field lf-field">
                <input className="lf-val" value={social} placeholder="B站 / 抖音 主页或 ID" data-reg-social onChange={(e) => setSocial(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <div className="lf reg-cmds-row">
              <span className="lf-label">擅长指挥官<span className="lf-optn">{favCmds.size ? ` · 已选 ${favCmds.size}` : '（多选）'}</span></span>
              <div className="reg-cmds">
                {official.map((c) => (
                  <button key={c.name} type="button" className={'reg-cmd-chip race-' + (c.race || '').toLowerCase() + (favCmds.has(c.name) ? ' on' : '')} data-reg-cmd={c.name} onClick={() => toggleCmd(c.name)}>{c.name}</button>
                ))}
                <span className="reg-cmd-cmdiv">CM</span>
                {cm.map((c) => (
                  <button key={c.name} type="button" className={'reg-cmd-chip reg-cmd-cm' + (favCmds.has(c.name) ? ' on' : '')} data-reg-cmd={c.name} onClick={() => toggleCmd(c.name)}>{c.name}</button>
                ))}
              </div>
            </div>
          </div>
          <label className="lf-remember reg-privacy" data-reg-privacy>
            <input type="checkbox" checked={agreed} onChange={(e) => { setAgreed(e.target.checked); clearErr(); }} />
            <span>已阅读并同意：注册后收集比赛/练习对局数据，仅用于集结杯难度调整迭代与 CM 新因子设计</span>
          </label>
          {status === 'error' && <div className="login-banner warn" data-reg-banner="error"><span className="banner-mark">!</span><span>{err}</span></div>}
          {status === 'success' && <div className="login-banner ok" data-reg-banner="success"><span className="banner-mark">✓</span><span>注册成功 · 正在进入</span></div>}
          <button className="startbtn login-btn" disabled={status === 'loading' || status === 'success'} onClick={() => void handleRegister()} data-reg-btn>
            {status === 'loading' && <span className="spin"></span>}
            <span>{status === 'loading' ? '注册中' : status === 'success' ? '进入' : '注册并参赛'}</span>
            {status !== 'loading' && <span className="startbtn-arrow">›</span>}
          </button>
          <div className="login-foot">
            <button className="login-link" onClick={onBack}>已有账号 · 去登录<span className="lk-en">SIGN IN</span></button>
            <span className="reg-foot-note">注册即建档 · 练习战绩可自助记录</span>
          </div>
        </div>
      </div>
    </ScreenShell>
  );
}
