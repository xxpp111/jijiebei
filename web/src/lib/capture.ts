// P2 截图导出 — snapDOM 封装。设计依据 docs/research-frontend-p2p3.md §A。
//
// 关键工程点：
// - snapDOM 走 <foreignObject> 序列化真实 DOM + computed CSS，clip-path polygon() 斜切天然保真
//   （metal 皮肤斜切卡/按钮/.fx.mutator 紫环/点金金框全保真）。这正是不选 html2canvas 的硬理由。
// - await document.fonts.ready + 显式 load 关键族，避免 styles/index.css:3 的 CDN @import 字体异步
//   加载导致首屏截图 fallback 字形（Oswald 数字 / 难度分 / 比分变形）。
// - 复制剪贴板(Chromium 主路径，能力探测) + 下载 PNG(兜底) 双路径。
// - 屏挂载时预热字体（warmupFonts），按钮点击链内 fonts 已就绪，避免 clipboard.write 脱离用户手势被拒。
import { snapdom } from '@zumer/snapdom';

export interface CaptureOptions {
  scale?: number;
  backgroundColor?: string | null;
}

export type CaptureStatus = 'idle' | 'capturing' | 'done' | 'error';

// 关键字体族（与 styles/index.css:3 @import 一致）：正文中文 + 数字/难度分 + 标题。
const FONT_SPECS = [
  '700 16px "Noto Sans SC"',
  '900 16px "Noto Serif SC"',
  '700 16px "Oswald"',
  '700 16px "Rajdhani"',
] as const;

// 预热字体：屏挂载时调，按钮点击时字体已就绪，复制链路内不再有长 await。
// fonts.ready 可能对 @import 误报就绪；race 1.5s 超时避免卡死（宁可偶发 fallback 也不挂按钮）。
export async function warmupFonts(): Promise<void> {
  try {
    await Promise.race([
      document.fonts.ready,
      new Promise<void>((r) => setTimeout(r, 1500)),
    ]);
    await Promise.all(FONT_SPECS.map((spec) => document.fonts.load(spec))).catch(() => {});
  } catch {
    // 无 fonts API 或加载失败：不阻断截图，接受 fallback 字形。
  }
}

// 截节点为 PNG Blob。snapDOM 内部 foreignObject 序列化真实 DOM + CSS（含 clip-path 斜切、box-shadow）。
export async function captureNodeToBlob(el: HTMLElement, opts: CaptureOptions = {}): Promise<Blob> {
  await warmupFonts();
  // 截图前临时隐藏导出按钮自身（data-capbtns 可能落在采集区内，如 result/select 页脚）——避免按钮入画分享图；截完 finally 恢复。
  const btns = Array.from(el.querySelectorAll<HTMLElement>('[data-capbtns]'));
  const prevDisplay = btns.map((b) => b.style.display);
  btns.forEach((b) => { b.style.display = 'none'; });
  try {
    const res = await snapdom(el, {
      scale: opts.scale ?? 2,
      embedFonts: true,
      backgroundColor: opts.backgroundColor ?? null,
    });
    return await res.toBlob({ type: 'png' });
  } finally {
    btns.forEach((b, i) => { b.style.display = prevDisplay[i]; });
  }
}

// 复制剪贴板能力探测：Chromium 有 ClipboardItem + clipboard.write；Firefox/Safari/移动端多缺失或受限。
export function canCopyImage(): boolean {
  return (
    typeof ClipboardItem !== 'undefined' &&
    !!navigator.clipboard &&
    typeof navigator.clipboard.write === 'function'
  );
}

// 复制 PNG 到剪贴板（须在用户手势内同步链触发）。
export async function copyPngToClipboard(blob: Blob): Promise<void> {
  await navigator.clipboard!.write([
    new ClipboardItem({ 'image/png': blob }),
  ]);
}

// 下载 PNG 兜底（全端可用）。
export function downloadPng(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// 暴露到 window 供 e2e/调试调（同 __jjbDebug 先例），不影响功能。
if (typeof window !== 'undefined') {
  (window as unknown as { __jjbCapture?: unknown }).__jjbCapture = {
    warmupFonts, captureNodeToBlob, canCopyImage, copyPngToClipboard, downloadPng,
  };
}
