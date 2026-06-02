'use client';

export function ConnectionBanner() {
  return (
    <div
      role="alert"
      className="mb-4 rounded-lg border border-amber-600/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-200"
    >
      Conexión WebSocket perdida. Reintentando cada 5s con backoff exponencial...
    </div>
  );
}
