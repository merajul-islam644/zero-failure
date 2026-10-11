// Playwright setup project: signs in through the real login gate (app
// /login -> hosted IAM IdP -> /login/callback) once, then saves the session
// as storageState for every simulator test. Credentials come from the
// gitignored .env (E2E_USER_EMAIL / E2E_USER_PASSWORD) or the process env —
// never from this file: the repo is public.
//
// IAM may auto-redirect when it still holds a live session, so the form
// fill is opportunistic: fill it when it appears, otherwise the callback
// has already fired.

import { join } from "node:path";
import { expect, test } from "@playwright/test";

// Credentials arrive via process.env, loaded from the gitignored .env by
// playwright.config.ts — never hardcoded: the repo is public.
const STATE_PATH = join(process.cwd(), "e2e", ".auth", "user.json");

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

test("sign in through the login gate", async ({ page }) => {
  if (!email || !password) {
    throw new Error(
      "e2e needs credentials: set E2E_USER_EMAIL and E2E_USER_PASSWORD in zero-failure/.env"
    );
  }

  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await page.getByRole("button", { name: "Continue with Blocks" }).click();

  // Either IAM auto-redirects home (live session) or shows its form — and
  // the app -> authorize -> form redirect chain can outlast a naive wait
  // (it has once already). fill() waits through the chain; on the
  // auto-redirect path it times out harmlessly and we are already home.
  const form = page.getByRole("textbox", { name: "Work Email" });
  const showedForm = await form
    .fill(email, { timeout: 20_000 })
    .then(() => true)
    .catch(() => false);
  if (showedForm) {
    // By role/name, not input[type=password]: the field's type attribute is
    // IAM's business (show/hide toggle) and has already drifted once.
    await page.getByRole("textbox", { name: "Password" }).fill(password);
    await page.getByRole("button", { name: /login/i }).click();
  }

  // Through /login/callback, the gate returns us to the simulator. IAM's
  // staged pipeline ("Authenticating…" -> code -> redirect) has been seen
  // running past 20s — give the whole handoff room.
  await expect(page).toHaveURL(/\/(\?|$)/, { timeout: 60_000 });
  await expect(page.locator(".sim-scene-title").first()).toBeVisible();

  await page.context().storageState({ path: STATE_PATH });
});
