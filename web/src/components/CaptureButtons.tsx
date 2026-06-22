// P2 截图导出按钮组。设计依据 docs/research-frontend-p2p3.md §A4/A5。
//
// - 双路径：「复制图片」(Chromium 主路径，canCopyImage 探测决定渲染) + 「下载 PNG」(全端兜底)。
// - 不 try 复制失败再 fallback（部分浏览器抛异步异常难捕获），按 canCopyImage 决定渲染哪个；复制失败提示改用下载。
// - 微态：idle/capturing(导出中…)/done(已生成 toast)/error(失败 toast)。
// - ?bare=1 纯采集态返回 null（不出导出 UI，不污染 OBS 采集产物）。
// - 屏挂载时 warmupFonts 预热，按钮点击链内字体已就绪，避免 clipboard.write 脱离用户手势被拒。
import { useEffect, useState } from 'react';
import {
  captureNodeToBlob,
  canCopyImage,
  copyPngToClipboard,
  downloadPng,
  warmupFonts,
  type CaptureStatus,
} from '../lib/capture';

interface CaptureButtonsProps {
  /** 截图目标选择器，如 '[data-capture="select"]' */
  targetSelector: string;
  /** 下载文件名（含 .png） */
  filename: string;
  /** 高清倍率，默认 2；OBS 横条窄高可传 3 */
  scale?: number;
}

export function CaptureButtons({ targetSelector, filename, scale }: CaptureButtonsProps) {
  const bare =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('bare') === '1';
  const [status, setStatus] = useState<CaptureStatus>('idle');
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null);

  useEffect(() => {
    warmupFonts();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  if (bare) return null; // ?bare=1 纯采集态不出导出 UI

  const copyEnabled = canCopyImage();
  const busy = status === 'capturing';

  const resolveEl = (): HTMLElement | null => {
    const el = document.querySelector<HTMLElement>(targetSelector);
    if (!el) {
      setStatus('error');
      setToast({ msg: '未找到画面', kind: 'err' });
    }
    return el;
  };

  const doDownload = async () => {
    const el = resolveEl();
    if (!el) return;
    setStatus('capturing');
    try {
      const blob = await captureNodeToBlob(el, { scale });
      downloadPng(blob, filename);
      setStatus('done');
      setToast({ msg: '已下载 PNG', kind: 'ok' });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[capture] download failed:', e);
      setStatus('error');
      setToast({ msg: '导出失败', kind: 'err' });
    }
  };

  const doCopy = async () => {
    const el = resolveEl();
    if (!el) return;
    setStatus('capturing');
    try {
      const blob = await captureNodeToBlob(el, { scale });
      await copyPngToClipboard(blob); // 主路径：复制剪贴板。不 try-fallback，失败提示改用下载。
      setStatus('done');
      setToast({ msg: '已复制 · 可直接粘贴', kind: 'ok' });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[capture] copy failed:', e);
      setStatus('error');
      setToast({ msg: '复制失败 · 改用下载', kind: 'err' });
    }
  };

  return (
    <div
      className="capbtns"
      data-capbtns
      style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}
    >
      {toast && (
        <span
          className={'capbtns-toast ' + (toast.kind === 'ok' ? 'capbtns-ok' : 'capbtns-err')}
          data-capbtns-toast
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: 4,
            color: toast.kind === 'ok' ? 'var(--accent, #e8b84b)' : '#ff6b6b',
            background: 'rgba(0,0,0,0.35)',
          }}
        >
          {toast.msg}
        </span>
      )}
      {copyEnabled && (
        <button
          type="button"
          className="capbtn capbtn-copy"
          data-capbtn-copy
          disabled={busy}
          onClick={doCopy}
          style={{
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--text, #fff)',
            background: 'transparent',
            border: '1px solid var(--panel-edge, #3a3a44)',
            borderRadius: 6,
            cursor: busy ? 'wait' : 'pointer',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? '导出中…' : '复制图片'}
        </button>
      )}
      <button
        type="button"
        className="capbtn capbtn-dl"
        data-capbtn-download
        disabled={busy}
        onClick={doDownload}
        style={{
          padding: '10px 18px',
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--text, #fff)',
          background: 'transparent',
          border: '1px solid var(--panel-edge, #3a3a44)',
          borderRadius: 6,
          cursor: busy ? 'wait' : 'pointer',
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? '导出中…' : '下载 PNG'}
      </button>
    </div>
  );
}
