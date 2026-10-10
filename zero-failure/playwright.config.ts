// Playwright e2e for the simulator. Runs against the HTTPS dev origin with
// its self-signed cert (ignoreHTTPSErrors); reuses an already-running dev
// server so `npm run dev` sessions are not disrupted.

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    // Full-Chromium new headless: the dedicated headless shell is still
    // downloading, and this build ships in chromium-1248 already.
    channel: "chromium",
    baseURL: "https://dfcdyp.slsblx.com:5173",
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 }
  },
  webServer: {
    command: "npm run dev",
    url: "https://dfcdyp.slsblx.com:5173",
    ignoreHTTPSErrors: true,
    reuseExistingServer: true,
    timeout: 60_000
  }
});
