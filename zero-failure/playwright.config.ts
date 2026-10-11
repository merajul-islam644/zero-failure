// Playwright e2e for the simulator. Runs against the HTTPS dev origin with
// its self-signed cert (ignoreHTTPSErrors); reuses an already-running dev
// server so `npm run dev` sessions are not disrupted.

import { readFileSync } from "node:fs";
import { defineConfig } from "@playwright/test";

// E2E credentials live in the gitignored .env (E2E_USER_EMAIL /
// E2E_USER_PASSWORD). Loaded here — the config runs in plain Node, where
// process.env is the one channel the setup project can rely on. Process env
// always wins.
try {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const eq = line.indexOf("=");
    if (eq > 0 && /^[A-Za-z_]/.test(line)) {
      const key = line.slice(0, eq);
      if (!(key in process.env)) process.env[key] = line.slice(eq + 1);
    }
  }
} catch {
  // No .env — CI or another host; credentials must come from the environment.
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  // The demo IAM tenant throttles bursts of sign-ins (the staged
  // "Authenticating…" pipeline has been seen crawling past a minute), so a
  // single retry absorbs a throttled setup attempt instead of failing suite.
  retries: 1,
  // The simulator sits behind the login gate: the "setup" project signs in
  // once through the real IAM flow, and every simulator test reuses that
  // saved session (e2e/.auth/user.json, gitignored).
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "simulator",
      testMatch: /simulator\.spec\.ts/,
      dependencies: ["setup"],
      use: { storageState: "e2e/.auth/user.json" }
    }
  ],
  use: {
    // Full-Chromium new headless: the dedicated headless shell is still
    // downloading, and this build ships in chromium-1248 already.
    // Headed, deliberately: the IAM IdP's SPA renders blank under headless
    // Chromium, which would strand the setup project's sign-in.
    channel: "chromium",
    headless: false,
    baseURL: "https://dfcdyp.slsblx.com:5173",
    ignoreHTTPSErrors: true,
    screenshot: "only-on-failure",
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
