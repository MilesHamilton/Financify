import { useAuthStore } from './auth-store';

/** Financify's Next.js deployment. Inlined at build time. */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(`${status} ${code}`);
    this.name = 'ApiError';
  }
}

const TIMEOUT_MS = 30_000;

/**
 * Calls a Financify API route with the stored bearer token. A 401 means the
 * 90-day token expired or was rejected, so the user is signed out.
 */
export async function api<T>(
  path: string,
  init: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const token = init.auth === false ? null : useAuthStore.getState().token;
  const res = await fetch(`${API_URL}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (res.status === 401 && init.auth !== false) await useAuthStore.getState().signOut();
    throw new ApiError(data.error ?? 'request_failed', res.status);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export async function login(username: string, password: string): Promise<void> {
  const { token } = await api<{ token: string }>('/api/mobile/login', {
    method: 'POST',
    body: { username, password },
    auth: false,
  });
  await useAuthStore.getState().setToken(token);
}
