#!/usr/bin/env node
// Builds the self-contained AppForge agent into dist/agent: the API as one bundled file + the Next standalone server.
// Run on each target OS (native modules such as sharp are installed for the machine doing the build).
//   dist/agent/api/server.mjs   dist/agent/migrations/   dist/agent/web/apps/web/server.js
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "dist", "agent");
const run = (cmd, args, cwd = root) => execFileSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });

rmSync(out, { recursive: true, force: true });
mkdirSync(path.join(out, "api"), { recursive: true });

// 1. API: bundle everything except modules that ship binaries/WASM next to themselves.
const EXTERNAL = ["sharp", "@electric-sql/pglite", "pg-native"];
await build({
  entryPoints: [path.join(root, "services/api/src/server.ts")],
  outfile: path.join(out, "api/server.mjs"),
  bundle: true, platform: "node", format: "esm", target: "node22", sourcemap: false, minify: false,
  external: EXTERNAL,
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
  logLevel: "warning",
});
cpSync(path.join(root, "services/api/migrations"), path.join(out, "migrations"), { recursive: true });

// 2. Install the external modules at the exact versions the API declares.
const apiPkg = JSON.parse(readFileSync(path.join(root, "services/api/package.json"), "utf8"));
writeFileSync(path.join(out, "api/package.json"), JSON.stringify({
  name: "appforge-agent-api", private: true, type: "module",
  dependencies: Object.fromEntries(EXTERNAL.filter((n) => apiPkg.dependencies[n]).map((n) => [n, apiPkg.dependencies[n]])),
}, null, 2));
run("npm", ["install", "--omit=dev", "--no-audit", "--no-fund", "--loglevel=error"], path.join(out, "api"));

// 3. Web: Next standalone server (+ static assets, which standalone does not copy itself).
run("pnpm", ["--filter", "@appforge/web", "build"]);
const standalone = path.join(root, "apps/web/.next/standalone");
if (!existsSync(path.join(standalone, "apps/web/server.js"))) throw new Error("Next standalone output not found; is output: 'standalone' set?");
cpSync(standalone, path.join(out, "web"), { recursive: true });
cpSync(path.join(root, "apps/web/.next/static"), path.join(out, "web/apps/web/.next/static"), { recursive: true });
if (existsSync(path.join(root, "apps/web/public"))) cpSync(path.join(root, "apps/web/public"), path.join(out, "web/apps/web/public"), { recursive: true });
console.log(`agent built → ${path.relative(root, out)}`);
