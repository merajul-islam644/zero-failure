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

  // The IAM SPA is slow and lossy: its shell can sit blank past 20s, and its
  // controlled inputs have been observed remounting mid-fill — clearing the
  // email before submit and leaving the pipeline "Awaiting User Input"
  // forever. So: check for the auto-redirect path, fill, VERIFY the values
  // held, submit — and if the form is still there shortly after, do it again.
  const form = page.getByRole("textbox", { name: "Work Email" });
  const passwordBox = page.getByRole("textbox", { name: "Password" });
  const loginButton = page.getByRole("button", { name: /login/i });
  const backHome = () =>
    page.waitForURL(/\/(\?|$)/, { timeout: 30_000 }).then(() => true).catch(() => false);

  for (let attempt = 1; attempt <= 3; attempt++) {
    // IAM may auto-redirect when it still holds a live session — the form
    // never appears and the callback has already fired.
    if (await page.waitForURL(/\/(\?|$)/, { timeout: 5_000 }).then(() => true).catch(() => false)) break;

    const filled = await form
      .fill(email, { timeout: 30_000 })
      .then(() => true)
      .catch(() => false);
    if (!filled) continue;
    // By role/name, not input[type=password]: the field's type attribute is
    // IAM's business (show/hide toggle) and has already drifted once.
    await passwordBox.fill(password);
    // A late SPA re-render resets controlled inputs; make sure both held.
    await page.waitForTimeout(1_500);
    const emailHeld = (await form.inputValue().catch(() => "")) === email;
    const passwordHeld = (await passwordBox.inputValue().catch(() => "")) === password;
    if (!emailHeld || !passwordHeld) continue;
    await loginButton.click();
    if (await backHome()) break;
  }

  // Through /login/callback, the gate returns us to the simulator. IAM's
  // staged pipeline ("Authenticating…" -> code -> redirect) has been seen
  // running past 20s — give the whole handoff room.
  await expect(page).toHaveURL(/\/(\?|$)/, { timeout: 60_000 });
  await expect(page.locator(".sim-scene-title").first()).toBeVisible();

  await page.context().storageState({ path: STATE_PATH });
});
