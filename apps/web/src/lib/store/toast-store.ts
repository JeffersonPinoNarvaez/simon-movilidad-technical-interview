'use client';

import { create } from 'zustand';
import type { AlertNewEvent } from '@fleet-portal/shared';

export type ToastVariant = 'success' | 'warning' | 'error' | 'info';

export interface Toast {
  id: string;
  title: string;
  message: string;
  variant: ToastVariant;
}

interface ToastStore {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [{ ...toast, id }, ...s.toasts].slice(0, 5) }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 6000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function pushAlertToast(alert: AlertNewEvent) {
  const variant: ToastVariant =
    alert.severity === 'critical' ? 'error' : alert.severity === 'warning' ? 'warning' : 'info';

  useToastStore.getState().push({
    title: alert.type.replace('_', ' '),
    message: alert.message,
    variant,
  });
}
