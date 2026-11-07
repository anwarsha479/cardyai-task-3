import type { ApiErrorBody } from './types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL;
if (!BASE_URL) {
  throw new Error('VITE_API_BASE_URL is missing from the .env file');
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly reason?: string,
    readonly details?: ApiErrorBody['details'],
  ) {
    super(message);
  }

  get fieldErrors(): Record<string, string[]> {
    return this.details?.fields ?? {};
  }
}

let authToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

/** Called when a signed-in request gets 401 (expired or invalid token). */
export function onUnauthorized(handler: () => void): void {
  unauthorizedHandler = handler;
}

export async function api<T>(
  path: string,
  options: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Is the API running?');
  }

  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (data as { error?: ApiErrorBody } | null)?.error;
    if (response.status === 401 && authToken) unauthorizedHandler?.();
    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN',
      error?.message ?? `Request failed (${response.status})`,
      error?.reason,
      error?.details,
    );
  }
  return data as T;
}

/**
 * Reads a Server-Sent Events stream with fetch rather than EventSource, so the bearer token travels in
 * a header instead of the URL. Resolves when the stream ends; rejects on HTTP or network errors.
 */
export async function readEventStream<T>(path: string, onMessage: (message: T) => void, signal: AbortSignal): Promise<void> {
  const headers: Record<string, string> = { Accept: 'text/event-stream' };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const response = await fetch(`${BASE_URL}${path}`, { headers, signal });
  if (!response.ok || !response.body) {
    if (response.status === 401 && authToken) unauthorizedHandler?.();
    throw new ApiError(response.status, 'STREAM_ERROR', `Live updates unavailable (${response.status})`);
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += value;
    let end: number;
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const data = buffer
        .slice(0, end)
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('\n');
      buffer = buffer.slice(end + 2);
      if (data) onMessage(JSON.parse(data) as T);
    }
  }
}
