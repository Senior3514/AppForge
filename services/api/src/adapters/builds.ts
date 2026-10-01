import { spawn } from "node:child_process";

export interface BuildRequest { appId: string; platform: "ios" | "android"; bundleId: string; appName: string; apiUrl: string; submit: boolean }
export interface BuildResult { status: "submitted" | "building" | "failed"; log: string }

export interface BuildProvider {
  readonly name: string;
  start(r: BuildRequest): Promise<BuildResult>;
}

/** Honest simulation: no binary is produced. The log says so, and the UI shows the provider name. */
export class MockBuilds implements BuildProvider {
  readonly name = "mock";
  async start(r: BuildRequest): Promise<BuildResult> {
    return { status: "submitted", log: [
      `SIMULATED build — no binary was produced (provider: mock).`,
      `platform=${r.platform} bundleId=${r.bundleId} name="${r.appName}"`,
      `To produce real store builds set APPFORGE_FLAG_EAS=true and EXPO_TOKEN.`,
    ].join("\n") };
  }
}

export type Exec = (cmd: string, args: string[], opts: { cwd: string; env: NodeJS.ProcessEnv }) => Promise<{ code: number; out: string }>;

const realExec: Exec = (cmd, args, opts) => new Promise((resolve) => {
  const p = spawn(cmd, args, { ...opts, stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  p.stdout.on("data", (d) => (out += d));
  p.stderr.on("data", (d) => (out += d));
  p.on("error", (e) => resolve({ code: 127, out: String(e) }));
  p.on("close", (code) => resolve({ code: code ?? 1, out }));
});

/**
 * White-label build via the EAS CLI. The runtime's app.config.ts reads APPFORGE_* env vars, so every tenant app
 * gets its own name, bundle id and spec source from one codebase. Requires EXPO_TOKEN and the user's own
 * Apple Developer / Google Play credentials configured in EAS.
 */
export class EasCliBuilds implements BuildProvider {
  readonly name = "eas";
  constructor(private o: { runtimeDir: string; expoToken: string; exec?: Exec }) {}
  async start(r: BuildRequest): Promise<BuildResult> {
    const env = {
      ...process.env, EXPO_TOKEN: this.o.expoToken, CI: "1",
      APPFORGE_APP_ID: r.appId, APPFORGE_APP_NAME: r.appName, APPFORGE_BUNDLE_ID: r.bundleId, EXPO_PUBLIC_API_URL: r.apiUrl,
    };
    const exec = this.o.exec ?? realExec;
    const args = ["eas-cli", "build", "--platform", r.platform, "--profile", "production", "--non-interactive", "--no-wait", ...(r.submit ? ["--auto-submit"] : [])];
    const res = await exec("npx", ["--yes", ...args], { cwd: this.o.runtimeDir, env });
    return { status: res.code === 0 ? (r.submit ? "submitted" : "building") : "failed", log: res.out.slice(-4000) };
  }
}
