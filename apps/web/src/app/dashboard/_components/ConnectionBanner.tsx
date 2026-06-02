'use client';

import { WifiOff } from 'lucide-react';

export function ConnectionBanner() {
  return (
    <div
      role="alert"
      className="toast-enter mb-6 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-950/60 to-slate-900/60 px-4 py-3 shadow-lg shadow-amber-900/20 backdrop-blur-sm"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15">
        <WifiOff className="h-5 w-5 text-amber-400" />
      </div>
      <div>
        <p className="text-sm font-medium text-amber-200">Conexión en tiempo real interrumpida</p>
        <p className="text-xs text-amber-200/70">Reintentando cada 5s con backoff exponencial…</p>
      </div>
    </div>
  );
}
