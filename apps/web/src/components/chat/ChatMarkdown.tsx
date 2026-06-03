'use client';

import ReactMarkdown from 'react-markdown';

export function ChatMarkdown({ content }: { content: string }) {
  return (
    <div className="chat-markdown space-y-2 text-sm leading-relaxed text-slate-200">
    <ReactMarkdown
      components={{
        p: ({ children }) => <p className="last:mb-0">{children}</p>,
        strong: ({ children }) => (
          <strong className="font-semibold text-white">{children}</strong>
        ),
        em: ({ children }) => <em className="text-slate-300">{children}</em>,
        ul: ({ children }) => (
          <ul className="ml-4 list-disc space-y-1 text-slate-300">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="ml-4 list-decimal space-y-1 text-slate-300">{children}</ol>
        ),
        li: ({ children }) => <li>{children}</li>,
        code: ({ children }) => (
          <code className="rounded bg-slate-900/80 px-1.5 py-0.5 text-xs text-emerald-300">
            {children}
          </code>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  );
}
