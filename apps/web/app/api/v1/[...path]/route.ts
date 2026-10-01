/**
 * Same-origin proxy to the API service, so the browser only ever talks to this origin and session cookies stay first-party.
 * The API address is read at runtime (APPFORGE_API_URL), so one build works in any environment.
 */
import { clientIp } from "../../../../lib/clientIp";

export const dynamic = "force-dynamic";

const HOP = new Set(["host", "connection", "content-length", "transfer-encoding", "keep-alive", "upgrade"]);

async function proxy(req: Request, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const localKey = process.env.APPFORGE_LOCAL_KEY;
  if (localKey) {
    // Desktop-agent mode has no sign-in, so the browser itself is the only gate. Refuse anything a web page on another origin
    // could cause: DNS-rebinding (unexpected Host) and cross-site state changes (Origin / Sec-Fetch-Site).
    const host = req.headers.get("host") ?? "";
    if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return Response.json({ error: "Forbidden" }, { status: 403 });
    const origin = req.headers.get("origin");
    const site = req.headers.get("sec-fetch-site");
    const mutating = req.method !== "GET" && req.method !== "HEAD";
    if (mutating && ((origin && new URL(origin).host !== host) || (site && site !== "same-origin" && site !== "none")))
      return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const { path } = await ctx.params;
  const api = process.env.APPFORGE_API_URL ?? "http://127.0.0.1:8787";
  const target = `${api}/v1/${path.map(encodeURIComponent).join("/")}${new URL(req.url).search}`;

  const headers = new Headers();
  req.headers.forEach((v, k) => { if (!HOP.has(k) && k !== "x-forwarded-for") headers.set(k, v); });
  headers.set("x-forwarded-for", clientIp(req.headers.get("x-forwarded-for")));
  if (localKey) headers.set("x-appforge-local-key", localKey);

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method, headers, redirect: "manual", cache: "no-store",
      body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer(),
    });
  } catch {
    return Response.json({ error: "The service is unavailable right now" }, { status: 502 });
  }
  // fetch() already decoded the body, so the upstream encoding/length headers no longer apply.
  const out = new Headers(upstream.headers);
  out.delete("content-encoding"); out.delete("content-length");
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as DELETE };
