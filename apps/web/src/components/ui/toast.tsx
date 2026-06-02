'use client';

import { X, CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { useToastStore, type ToastVariant } from '@/lib/store/toast-store';
import { cn } from '@/lib/utils';

const VARIANT: Record<
  ToastVariant,
  { icon: typeof Info; ring: string; bg: string; iconColor: string }
> = {
  success: {
    icon: CheckCircle2,
    ring: 'ring-emerald-500/30',
    bg: 'from-emerald-950/90 to-slate-900/90',
    iconColor: 'text-emerald-400',
  },
  warning: {
    icon: AlertTriangle,
    ring: 'ring-amber-500/30',
    bg: 'from-amber-950/90 to-slate-900/90',
    iconColor: 'text-amber-400',
  },
  error: {
    icon: AlertCircle,
    ring: 'ring-red-500/40',
    bg: 'from-red-950/90 to-slate-900/90',
    iconColor: 'text-red-400',
  },
  info: {
    icon: Info,
    ring: 'ring-blue-500/30',
    bg: 'from-blue-950/90 to-slate-900/90',
    iconColor: 'text-blue-400',
  },
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 top-4 z-[9999] flex w-full max-w-sm flex-col gap-3">
      {toasts.map((toast) => {
        const v = VARIANT[toast.variant];
        const Icon = v.icon;
        return (
          <div
            key={toast.id}
            className={cn(
              'toast-enter flex items-start gap-3 rounded-xl border border-white/10 bg-gradient-to-br p-4 shadow-2xl shadow-black/40 ring-1 backdrop-blur-xl',
              v.ring,
              v.bg,
            )}
            role="alert"
          >
            <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', v.iconColor)} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold capitalize text-white">{toast.title}</p>
              <p className="mt-0.5 text-sm text-slate-300">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="rounded-lg p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
