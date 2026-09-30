export interface Ctx {
  req: Request;
  url: URL;
  params: Record<string, string>;
  /** Parsed JSON body; throws HttpError(400) when missing or malformed. */
  body<T = unknown>(): Promise<T>;
  raw(): Promise<string>;
  cookie(name: string): string | undefined;
  ip: string;
}

export class HttpError extends Error {
  constructor(readonly status: number, message: string, readonly details?: unknown) { super(message); }
}

type Handler = (c: Ctx) => Promise<Response | unknown> | Response | unknown;
interface Route { method: string; parts: string[]; handler: Handler }

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

export class Router {
  private routes: Route[] = [];
  add(method: string, pattern: string, handler: Handler) { this.routes.push({ method, parts: pattern.split("/").filter(Boolean), handler }); }
  get = (p: string, h: Handler) => this.add("GET", p, h);
  post = (p: string, h: Handler) => this.add("POST", p, h);
  put = (p: string, h: Handler) => this.add("PUT", p, h);
  delete = (p: string, h: Handler) => this.add("DELETE", p, h);

  async handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const segs = url.pathname.split("/").filter(Boolean);
    let pathMatched = false;
    for (const r of this.routes) {
      if (r.parts.length !== segs.length) continue;
      const params: Record<string, string> = {};
      const ok = r.parts.every((p, i) => p.startsWith(":") ? ((params[p.slice(1)] = decodeURIComponent(segs[i]!)), true) : p === segs[i]);
      if (!ok) continue;
      pathMatched = true;
      if (r.method !== req.method) continue;
      let text: string | undefined;
      const raw = async () => (text ??= await req.text());
      const ctx: Ctx = {
        req, url, params, raw,
        ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local",
        cookie: (n) => req.headers.get("cookie")?.split(/;\s*/).map((c) => c.split("=")).find(([k]) => k === n)?.[1],
        async body<T>() {
          try { return JSON.parse(await raw()) as T; } catch { throw new HttpError(400, "Invalid JSON body"); }
        },
      };
      const out = await r.handler(ctx);
      return out instanceof Response ? out : json(out);
    }
    return json({ error: pathMatched ? "Method not allowed" : "Not found" }, pathMatched ? 405 : 404);
  }
}

/** Fixed-window in-memory limiter. Good enough for one process; put a shared store behind it to scale out. */
export class RateLimiter {
  private hits = new Map<string, { n: number; resetAt: number }>();
  constructor(private now: () => number = Date.now) {}
  /** Returns true if the call is allowed. */
  allow(key: string, limit: number, windowMs: number): boolean {
    const t = this.now();
    const h = this.hits.get(key);
    if (!h || h.resetAt <= t) { this.hits.set(key, { n: 1, resetAt: t + windowMs }); return true; }
    if (h.n >= limit) return false;
    h.n++;
    return true;
  }
}

export function cookieHeader(name: string, value: string, opts: { maxAgeSec?: number; secure: boolean }): string {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax${opts.secure ? "; Secure" : ""}${opts.maxAgeSec !== undefined ? `; Max-Age=${opts.maxAgeSec}` : ""}`;
}
