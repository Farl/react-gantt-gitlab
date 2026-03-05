// src/utils/sessionWorkerClient.ts
//
// Client for the optional session-code Worker.
// If VITE_SESSION_WORKER_URL is not set, isSessionWorkerEnabled() returns false
// and all other functions throw — callers should gate on isSessionWorkerEnabled().

const SESSION_WORKER_URL = import.meta.env.VITE_SESSION_WORKER_URL as
  | string
  | undefined;

export function isSessionWorkerEnabled(): boolean {
  return !!SESSION_WORKER_URL;
}

const FETCH_TIMEOUT_MS = 10_000;

function workerUrl(path: string): string {
  if (!SESSION_WORKER_URL) throw new Error('Session worker not configured');
  return `${SESSION_WORKER_URL.replace(/\/$/, '')}${path}`;
}

function fetchWithTimeout(
  url: string,
  options: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

export interface CreateSessionResult {
  code: string;
  expiresInSeconds: number;
}

/** Send PAT to Worker, get back a 6-char code. */
export async function createSessionCode(
  pat: string,
): Promise<CreateSessionResult> {
  const res = await fetchWithTimeout(workerUrl('/session/create'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pat }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  return res.json();
}

/** Exchange a 6-char code for a PAT. One-time use — KV entry deleted on redemption. */
export async function redeemSessionCode(code: string): Promise<string> {
  const res = await fetchWithTimeout(workerUrl('/session/redeem'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: code.trim().toUpperCase() }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.pat as string;
}
