import { useEffect, useState } from 'react';

// 校验 toast（select 单打/双打共用）：硬违规(hard)=阻断开赛 / 软违规(soft)=仍可开赛。
// 抽自 SelectScreen 单打 + 双打两处完全一致的 toast state + 4s 自动消失 + .toastv 渲染块。零行为变化。
export interface ToastState { msg: string; count: number; kind: 'hard' | 'soft' }

// useToast — toast state + 4s 自动消失（原 SelectScreen useEffect setTimeout 4000）。
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  return [toast, setToast] as const;
}

// <ToastV> — toast 渲染块（null 时不渲染）。DOM/className/data-* 与原 SelectScreen 内联块逐字一致。
export function ToastV({ toast }: { toast: ToastState | null }) {
  if (!toast) return null;
  return (
    <div className={'toastv ' + toast.kind + (toast.count > 1 ? ' toastv-stack' : '')} data-toast-err data-toast-kind={toast.kind}>
      <span className="toastv-ico">!</span>
      <span className="toastv-tx">{toast.msg}</span>
      {toast.count > 1 && <span className="toastv-n">+{toast.count - 1}</span>}
      <span className={toast.kind === 'soft' ? 'toastv-rule' : 'toastv-block'}>{toast.kind === 'soft' ? '仍可开赛' : '阻断开赛'}</span>
    </div>
  );
}
