import type { ReactNode, CSSProperties } from 'react';

// <ScreenShell> — 屏根外壳：固定 1280×720 stage + jjb-bg 4 层背景（bg-grad/bg-tex/bg-vignette）。
// 抽自 11 屏重复的 `<div className="jjb …" style={{width:1280,height:720}}>` + 4 层 bg 块。
// 表现型零行为变化：className/data-* 全由调用方透传，style 在默认 1280×720 上浅合并（调用方可覆盖/追加）。
// 注：Obs 控制条等非屏根、非 1280×720 的容器不走本壳（保留各自布局）。
export interface ScreenShellProps {
  className: string;     // 完整 className（含 jjb / style-x / mode-y / 各屏特有类），原样透传
  style?: CSSProperties; // 浅合并到默认 {width:1280,height:720}（Code 屏 overflow:hidden 等追加）
  children: ReactNode;
  [data: `data-${string}`]: unknown; // data-screen-label / data-capture / data-tick / data-doubles-* 等透传
}

export function ScreenShell({ className, style, children, ...rest }: ScreenShellProps) {
  return (
    <div className={className} style={{ width: 1280, height: 720, ...style }} {...rest}>
      <div className="jjb-bg">
        <div className="bg-grad"></div>
        <div className="bg-tex"></div>
        <div className="bg-vignette"></div>
      </div>
      {children}
    </div>
  );
}
