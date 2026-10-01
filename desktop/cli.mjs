#!/usr/bin/env node
// Runs the agent without Electron (handy for development and CI smoke tests): node desktop/cli.mjs [dataDir]
import os from "node:os";
import path from "node:path";
import { startAgent } from "./launcher.mjs";

const agentDir = process.env.APPFORGE_AGENT_DIR ?? path.resolve(import.meta.dirname, "../dist/agent");
const dataDir = process.argv[2] ?? path.join(os.homedir(), ".appforge");
const agent = await startAgent({ agentDir, dataDir, log: (l) => console.log(l) });
console.log(`AppForge is running: ${agent.url}`);
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { agent.stop(); process.exit(0); });
