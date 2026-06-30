import { raceUrl } from '../lib/realAsset';

// <LoginHero> — 登录/注册屏左侧品牌 hero（集结杯字标 + kicker + 副标 + 三族印花）。
// 抽自 LoginScreen / RegisterScreen 两处一致块；唯一差异 = hero-sub 文案 → sub prop。零行为变化。
const RACES = [['P', '神族', 'PROTOSS'], ['T', '人族', 'TERRAN'], ['Z', '虫族', 'ZERG']] as const;

export function LoginHero({ sub }: { sub: string }) {
  return (
    <div className="login-hero">
      <div className="lockup lockup-lg">
        <div className="lockup-word">
          <span className="lockup-cn">集结杯</span>
          <span className="lockup-en">ASSEMBLY CUP</span>
        </div>
      </div>
      <div className="hero-kicker">STARCRAFT II · CO-OP MISSIONS</div>
      <div className="hero-sub">{sub}</div>
      <div className="hero-racesblock">
        <div className="hero-racescap">星际II 合作任务 · 参赛三族</div>
        <div className="hero-races">
          {RACES.map(([code, cn, en]) => (
            <div className="race-emblem" key={code}>
              <img src={raceUrl(code)} alt={cn} />
              <div className="race-name"><b>{cn}</b><span>{en}</span></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 登录/注册输入框内联样式（透明底无边框，继承字体）。抽自两屏一致的 inputStyle 常量。
export const loginInputStyle = { background: 'none', border: 'none', outline: 'none', color: 'var(--ink)', width: '100%', font: 'inherit' } as const;
