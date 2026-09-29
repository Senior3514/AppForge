import { createServer } from "node:http";
import { createLlm } from "@appforge/generator";
import { createApi } from "./api";

const handle = createApi({ llm: createLlm() });
const port = Number(process.env.PORT ?? 8787);

createServer(async (incoming, outgoing) => {
  const chunks: Buffer[] = [];
  for await (const c of incoming) chunks.push(c as Buffer);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const res = await handle(new Request(`http://${incoming.headers.host}${incoming.url}`, {
    method: incoming.method, headers: incoming.headers as Record<string, string>, body: incoming.method === "GET" ? undefined : body,
  }));
  outgoing.writeHead(res.status, Object.fromEntries(res.headers));
  outgoing.end(Buffer.from(await res.arrayBuffer()));
}).listen(port, () => console.log(`AppForge API on :${port} (llm: ${createLlm().name})`));
