'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Sparkles } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Spinner } from '@/components/ui/loading';
import { ChatMarkdown } from '@/components/chat/ChatMarkdown';
import { cn } from '@/lib/utils';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  '¿Qué vehículos llevan detenidos más de 20 minutos en zonas críticas?',
  '¿Cuántos vehículos están activos ahora?',
  'Muéstrame alertas de velocidad activas',
];

export function AgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    setMessages((prev) => [...prev, { role: 'user', content: text.trim() }]);
    setLoading(true);

    try {
      const res = await apiFetch<{ reply: string; sessionId: string }>('/agent/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: text.trim(),
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
          content: `No pude contactar al agente: ${err instanceof Error ? err.message : 'error desconocido'}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input;
    setInput('');
    await sendMessage(text);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-h-80 overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/50 p-4 backdrop-blur-sm">
        {messages.length === 0 && (
          <div className="py-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 ring-1 ring-emerald-500/30">
              <Sparkles className="h-7 w-7 text-emerald-400" />
            </div>
            <p className="text-sm font-medium text-slate-300">Asistente operativo de flota</p>
            <p className="mt-1 text-xs text-slate-500">Consulta estado, zonas críticas e historial</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => sendMessage(s)}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-200"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                'flex gap-3',
                m.role === 'user' ? 'justify-end' : 'justify-start',
              )}
            >
              {m.role === 'assistant' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
                  <Bot className="h-4 w-4 text-emerald-400" />
                </div>
              )}
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                  m.role === 'user'
                    ? 'rounded-br-md bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow-lg shadow-emerald-900/30'
                    : 'rounded-bl-md border border-white/10 bg-slate-800/80 text-slate-200',
                )}
              >
                {m.role === 'assistant' ? (
                  <ChatMarkdown content={m.content} />
                ) : (
                  m.content
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15">
                <Bot className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-white/10 bg-slate-800/80 px-4 py-3">
                <Spinner size="sm" />
                <span className="text-sm text-slate-400">Analizando flota…</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu consulta operativa…"
          className="flex-1 rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-40"
        >
          {loading ? <Spinner size="sm" className="border-white/30 border-t-white" /> : <Send className="h-4 w-4" />}
          Enviar
        </button>
      </form>
    </div>
  );
}
