import { defineConfig } from "@playwright/test";

// Real servers, as the desktop agent runs them: the API in local mode (embedded Postgres in memory, mock adapters) and the production
// Next build in front of it, both on loopback with a shared key. A second web server without the key is the public download site.
const KEY = "e2e-local-key-0123456789abcdef";
export default defineConfig({
  testDir: "e2e",
  workers: 1,
  webServer: [
    { command: "pnpm --filter @appforge/api dev", cwd: "../..", url: "http://127.0.0.1:8787/health", reuseExistingServer: !process.env.CI, timeout: 60_000,
      env: { PORT: "8787", APPFORGE_PUBLIC_URL: "http://localhost:3111", APPFORGE_LOCAL: "true", APPFORGE_LOCAL_KEY: KEY } },
    { command: "pnpm exec next start -p 3111 -H 127.0.0.1", url: "http://localhost:3111/en", reuseExistingServer: !process.env.CI, timeout: 60_000,
      env: { APPFORGE_API_URL: "http://127.0.0.1:8787", APPFORGE_PUBLIC_URL: "http://localhost:3111", APPFORGE_LOCAL_KEY: KEY } },
    { command: "pnpm exec next start -p 3112 -H 127.0.0.1", url: "http://localhost:3112/en", reuseExistingServer: !process.env.CI, timeout: 60_000,
      env: { APPFORGE_API_URL: "http://127.0.0.1:1", APPFORGE_PUBLIC_URL: "http://localhost:3112" } },
  ],
  use: {
    baseURL: "http://localhost:3111",
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
});
