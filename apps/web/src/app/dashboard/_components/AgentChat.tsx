'use client';

import { useState, useRef, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function AgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const res = await apiFetch<{ reply: string; sessionId: string }>('/agent/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: userMessage,
          ...(sessionId ? { session_id: sessionId } : {}),
        }),
      });
      setSessionId(res.sessionId);
      setMessages((prev) => [...prev, { role: 'assistant', content: res.reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${err instanceof Error ? err.message : 'No se pudo contactar al agente'}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="max-h-64 overflow-y-auto space-y-3 rounded-lg bg-slate-900/50 p-3">
        {messages.length === 0 && (
          <p className="text-sm text-slate-500">
            Pregunta sobre el estado de la flota, ubicaciones o alertas activas.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-lg px-3 py-2 text-sm ${
              m.role === 'user'
                ? 'ml-8 bg-emerald-900/40 text-emerald-100'
                : 'mr-8 bg-slate-800 text-slate-200'
            }`}
          >
            {m.content}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="¿Cuántos vehículos están activos?"
          className="flex-1 rounded-lg border border-[hsl(var(--border))] bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-600/50"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {loading ? '...' : 'Enviar'}
        </button>
      </form>
    </div>
  );
}
