#!/usr/bin/env node
// Runs the API and the web app together: `node scripts/run.mjs dev|start`.
import { spawn } from "node:child_process";
import path from "node:path";

const mode = process.argv[2] === "start" ? "start" : "dev";
const root = path.resolve(import.meta.dirname, "..");
const { PORT: _ignored, ...base } = process.env; // a shared PORT would make both servers fight over one port
const apiPort = process.env.APPFORGE_API_PORT ?? "8787";
const webPort = process.env.APPFORGE_WEB_PORT ?? "3000";
const env = {
  ...base,
  // Embedded Postgres persists here unless DATABASE_URL points at a real database.
  APPFORGE_DATA_DIR: process.env.DATABASE_URL ? undefined : process.env.APPFORGE_DATA_DIR ?? path.join(root, ".data", "pg"),
  APPFORGE_API_URL: process.env.APPFORGE_API_URL ?? `http://127.0.0.1:${apiPort}`,
  APPFORGE_PUBLIC_URL: process.env.APPFORGE_PUBLIC_URL ?? `http://localhost:${webPort}`,
};

const run = (name, args, port) => {
  const p = spawn("pnpm", args, { cwd: root, env: { ...env, PORT: port }, stdio: "inherit" });
  p.on("exit", (code) => { console.log(`[${name}] exited (${code})`); shutdown(code ?? 1); });
  return p;
};
const procs = [run("api", ["--filter", "@appforge/api", mode], apiPort), run("web", ["--filter", "@appforge/web", mode], webPort)];
let closing = false;
function shutdown(code) { if (closing) return; closing = true; for (const p of procs) p.kill("SIGTERM"); setTimeout(() => process.exit(code), 500); }
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
