// 入口宣传条 — 承接 Claude Design e956fe00 proposals/promo-cards/promo-bar.html（块B）。
// 三张横排入口卡（图标砖 + 主标签 + 副文案 + 箭头），替换原 .foot 细文字链。
// SVG 图标内联（线性 glyph，随品牌色）；bilibili 蓝 / 飞书绿松石；卡随主题 metal斜切·minimal圆角·sc2直角。
const LINKS = [
  {
    brand: 'b' as const,
    href: 'https://space.bilibili.com/347915855',
    name: '儒雅随和の土豆',
    sub: 'B站主播 · 直播间',
    icon: (
      <>
        <path d="M10 4 L14 9" /><path d="M22 4 L18 9" />
        <rect x="4" y="9" width="24" height="17" rx="5" />
        <circle cx="12" cy="18" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="20" cy="18" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="25.5" cy="7" r="2.4" fill="currentColor" stroke="none" />
      </>
    ),
  },
  {
    brand: 'b' as const,
    href: 'https://space.bilibili.com/277263402',
    name: 'CM 合作任务',
    sub: 'B站主页 · 玩法说明',
    icon: (
      <>
        <path d="M10 4 L14 9" /><path d="M22 4 L18 9" />
        <rect x="4" y="9" width="24" height="17" rx="5" />
        <path d="M13.5 14 L20.5 17.5 L13.5 21 Z" fill="currentColor" stroke="none" />
      </>
    ),
  },
  {
    brand: 'd' as const,
    href: 'https://mcn1taa2k785.feishu.cn/wiki/WF0ZwD2QciFDqGkmHSMcRrdvnyd',
    name: '集结杯文档',
    sub: '飞书知识库 · 规则赛程',
    icon: (
      <>
        <path d="M8 4 H19 L25 10 V28 H8 Z" />
        <path d="M19 4 V10 H25" />
        <path d="M12 16 H21" /><path d="M12 20 H21" /><path d="M12 23.5 H17.5" />
      </>
    ),
  },
];

export function PromoBar() {
  return (
    <div className="promo-wrap">
      <div className="promo-head">
        <span className="pk">外部链接 · LINKS</span>
        <span className="pl"></span>
      </div>
      <div className="promo">
        {LINKS.map((l) => (
          <a key={l.href} className={'pcard ' + l.brand} href={l.href} target="_blank" rel="noreferrer">
            <span className="pic">
              <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                {l.icon}
              </svg>
            </span>
            <span className="ptx">
              <span className="pm">{l.name}</span>
              <span className="ps"><i className="dot"></i>{l.sub}</span>
            </span>
            <span className="pchev">›</span>
          </a>
        ))}
      </div>
    </div>
  );
}
