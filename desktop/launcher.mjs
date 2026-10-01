// Starts the bundled AppForge agent (API + web, both on loopback) and resolves when it is ready to open.
// Shared by the Electron shell (desktop/main.mjs) and the plain-Node entry (desktop/cli.mjs).
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";

const freePort = () => new Promise((resolve, reject) => {
  const srv = net.createServer();
  srv.once("error", reject);
  srv.listen(0, "127.0.0.1", () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
});

/** Secret that encrypts the user's saved AI key. Created once per machine, readable only by the user. */
function localSecret(dataDir) {
  const file = path.join(dataDir, "secret");
  if (existsSync(file)) return readFileSync(file, "utf8").trim();
  const fresh = randomBytes(32).toString("hex");
  writeFileSync(file, fresh, { mode: 0o600 });
  return fresh;
}

async function waitFor(url, timeoutMs, isAlive) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    if (!isAlive()) throw new Error(`a server exited while starting (waiting for ${url})`);
    try { if ((await fetch(url)).ok) return; } catch { /* not up yet */ }
    if (Date.now() > until) throw new Error(`timed out waiting for ${url}`);
    await new Promise((r) => setTimeout(r, 300));
  }
}

/**
 * @param {{ agentDir: string, dataDir: string, nodeBin?: string, nodeEnv?: Record<string,string>, log?: (line: string) => void }} o
 *   agentDir = the folder produced by scripts/build-agent.mjs; dataDir = where this user's apps live.
 *   nodeBin/nodeEnv: Electron passes its own binary with ELECTRON_RUN_AS_NODE=1 so no separate Node install is needed.
 */
export async function startAgent({ agentDir, dataDir, nodeBin = process.execPath, nodeEnv = {}, log = () => {} }) {
  mkdirSync(dataDir, { recursive: true });
  const [apiPort, webPort] = [await freePort(), await freePort()];
  const key = randomBytes(24).toString("hex");
  const base = { ...process.env, ...nodeEnv, APPFORGE_LOCAL: "true", APPFORGE_LOCAL_KEY: key };
  delete base.DATABASE_URL; // the desktop agent is always local-first
  const procs = [];
  const launch = (name, script, env) => {
    const p = spawn(nodeBin, [script], { cwd: path.dirname(script), env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    p.stdout.on("data", (d) => log(`[${name}] ${d}`.trimEnd()));
    p.stderr.on("data", (d) => log(`[${name}] ${d}`.trimEnd()));
    p.alive = true; p.on("exit", () => { p.alive = false; });
    procs.push(p);
    return p;
  };
  const api = launch("api", path.join(agentDir, "api/server.mjs"), {
    ...base, PORT: String(apiPort), APPFORGE_DATA_DIR: path.join(dataDir, "pg"), APPFORGE_SECRET: localSecret(dataDir),
    APPFORGE_PUBLIC_URL: `http://localhost:${webPort}`,
  });
  const web = launch("web", path.join(agentDir, "web/apps/web/server.js"), {
    ...base, PORT: String(webPort), HOSTNAME: "127.0.0.1", APPFORGE_API_URL: `http://127.0.0.1:${apiPort}`,
    APPFORGE_PUBLIC_URL: `http://localhost:${webPort}`, NODE_ENV: "production",
  });
  const stop = () => { for (const p of procs) if (p.alive) p.kill(); };
  try {
    await waitFor(`http://127.0.0.1:${apiPort}/health`, 90_000, () => api.alive);
    await waitFor(`http://127.0.0.1:${webPort}/en`, 90_000, () => web.alive);
  } catch (e) { stop(); throw e; }
  return { url: `http://localhost:${webPort}/en`, apiPort, webPort, stop };
}
