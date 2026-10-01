import { defineConfig } from "@playwright/test";

// Two real servers: the API on embedded Postgres (in memory) with mock adapters, and the production Next build in front of it.
export default defineConfig({
  testDir: "e2e",
  workers: 1,
  webServer: [
    { command: "pnpm --filter @appforge/api dev", cwd: "../..", url: "http://127.0.0.1:8787/health", reuseExistingServer: !process.env.CI, timeout: 60_000,
      env: { PORT: "8787", APPFORGE_PUBLIC_URL: "http://localhost:3111" } },
    { command: "pnpm exec next start -p 3111", url: "http://localhost:3111/en", reuseExistingServer: !process.env.CI, timeout: 60_000,
      env: { APPFORGE_API_URL: "http://127.0.0.1:8787", APPFORGE_PUBLIC_URL: "http://localhost:3111" } },
  ],
  use: {
    baseURL: "http://localhost:3111",
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
});
