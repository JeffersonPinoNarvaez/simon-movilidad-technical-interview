/** Browser: Next.js Route Handler proxy at /api/*. Server: direct API origin. */
function getApiBase(): string {
  if (typeof window !== 'undefined') {
    return '/api';
  }
  const origin = process.env.API_INTERNAL_URL ?? process.env.API_URL ?? 'http://localhost:3001';
  return origin.replace(/\/$/, '');
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const res = await fetch(`${getApiBase()}${normalized}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const problem = await res.json().catch(() => ({}));
    throw new Error(problem.detail ?? `API error ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const API_URL = getApiBase();
