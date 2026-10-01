export class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly details?: unknown) { super(message); }
}

/** Same-origin call to the API (proxied by Next). Throws ApiError with the server's message on non-2xx. */
export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
    headers: opts.body === undefined ? undefined : { "content-type": "application/json" },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const o = (data ?? {}) as { error?: string; details?: unknown };
    throw new ApiError(res.status, o.error ?? res.statusText, o.details);
  }
  return data as T;
}
