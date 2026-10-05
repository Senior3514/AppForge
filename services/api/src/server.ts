import { createServer } from "node:http";
import { createPlatform } from "./platform";

const platform = await createPlatform();
const port = Number(process.env.PORT ?? 8787);

setInterval(() => platform.tick().catch((e) => console.error("push scheduler:", e)), 30_000).unref();

createServer(async (incoming, outgoing) => {
  const chunks: Buffer[] = [];
  for await (const c of incoming) chunks.push(c as Buffer);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const res = await platform.handle(new Request(`http://${incoming.headers.host}${incoming.url}`, {
    method: incoming.method, headers: incoming.headers as Record<string, string>, body: incoming.method === "GET" || incoming.method === "HEAD" ? undefined : body,
  }));
  const headers: Record<string, string | string[]> = {};
  res.headers.forEach((v, k) => { if (k !== "set-cookie") headers[k] = v; });
  const cookies = res.headers.getSetCookie();
  if (cookies.length) headers["set-cookie"] = cookies;
  outgoing.writeHead(res.status, headers);
  outgoing.end(Buffer.from(await res.arrayBuffer()));
}).listen(port, platform.deps.local ? "127.0.0.1" : undefined, () => console.log(`AppForge API on :${port} — llm=${platform.deps.llm.name}${platform.deps.local ? " local-agent" : ""} db=${process.env.DATABASE_URL ? "postgres" : "embedded"}`));
