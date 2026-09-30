#!/usr/bin/env node
// Runs the API and the web app together: `node scripts/run.mjs dev|start`.
import { spawn } from "node:child_process";
import path from "node:path";

const mode = process.argv[2] === "start" ? "start" : "dev";
const root = path.resolve(import.meta.dirname, "..");
const env = {
  ...process.env,
  // Embedded Postgres persists here unless DATABASE_URL points at a real database.
  APPFORGE_DATA_DIR: process.env.DATABASE_URL ? undefined : process.env.APPFORGE_DATA_DIR ?? path.join(root, ".data", "pg"),
  APPFORGE_API_URL: process.env.APPFORGE_API_URL ?? "http://127.0.0.1:8787",
  APPFORGE_PUBLIC_URL: process.env.APPFORGE_PUBLIC_URL ?? "http://localhost:3000",
};

const run = (name, args) => {
  const p = spawn("pnpm", args, { cwd: root, env, stdio: "inherit" });
  p.on("exit", (code) => { console.log(`[${name}] exited (${code})`); shutdown(code ?? 1); });
  return p;
};
const procs = [run("api", ["--filter", "@appforge/api", "dev"]), run("web", ["--filter", "@appforge/web", mode])];
let closing = false;
function shutdown(code) { if (closing) return; closing = true; for (const p of procs) p.kill("SIGTERM"); setTimeout(() => process.exit(code), 500); }
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
