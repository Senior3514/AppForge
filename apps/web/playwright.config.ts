import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  webServer: { command: "pnpm exec next start -p 3111", port: 3111, reuseExistingServer: !process.env.CI, timeout: 60_000 },
  use: {
    baseURL: "http://localhost:3111",
    // Use the preinstalled Chromium when present (CI installs its own via `playwright install`).
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
});
