// Playwright e2e for Operation Zero Failure. Strategy: full playthroughs are
// too slow for a verdict matrix, but seeking to the End crosses every
// assertion-result event at once — so each scenario's final verdict is
// reachable in milliseconds. One real 16x playthrough smoke proves the
// progressive path; keyboard and export specs cover the interaction contract.

import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const SCENARIO_SELECT = '[aria-label="Select failure scenario"]';
const VERDICT = ".sim-verdict";
const TIMER = '[role="timer"][aria-label="Playback time"]';
const PLAY_BUTTON = '.sim-btn[aria-label="Play"], .sim-btn[aria-label="Pause"]';

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".sim-scene-title").first()).toBeVisible();
});

/** Focus off the scenario <select>, whose keydown guard swallows End/Space. */
async function focusStage(page: Page): Promise<void> {
  await page.locator(".sim-stage").click({ position: { x: 10, y: 10 } });
}

async function openTab(page: Page, name: string): Promise<void> {
  await page.getByRole("tab", { name }).click();
}

async function selectScenario(page: Page, title: string): Promise<void> {
  await openTab(page, "Config");
  await page.locator(SCENARIO_SELECT).selectOption({ label: title });
  await focusStage(page);
}

/** Seek to the end: every assertion-result event fires, dashboard converges. */
async function revealAll(page: Page): Promise<void> {
  await page.keyboard.press("End");
  await expect(page.locator(`${VERDICT} .sim-verdict-count`)).toHaveText(
    /49\/49 assertions evaluated/,
  );
}

test.describe("verdict matrix", () => {
  const cases = [
    {
      title: "Default storyline",
      status: "passed-with-warnings",
      label: "PASSED WITH WARNINGS",
    },
    { title: "2 — Authentication fails", status: "failed", label: "FAILED" },
    {
      title: "6 — Workflow dependency is unavailable",
      status: "incomplete",
      label: "INCOMPLETE",
    },
    {
      title: "14 — Integration is not configured",
      status: "not-configured-only",
      label: "NOT CONFIGURED ONLY",
    },
  ];

  for (const c of cases) {
    test(`"${c.title}" converges to ${c.status}`, async ({ page }) => {
      await selectScenario(page, c.title);
      await openTab(page, "Results");
      await revealAll(page);
      await expect(page.locator(VERDICT)).toHaveAttribute(
        "data-verdict",
        c.status,
      );
      await expect(page.locator(`${VERDICT} .sim-verdict-label`)).toHaveText(
        c.label,
      );
    });
  }

  test("dashboard rows stay not tested until revealed", async ({ page }) => {
    await openTab(page, "Results");
    // At t=0 only scene 1's initial statuses have fired; most rows pending.
    await expect(
      page.locator('.sim-result-row[data-status="not-tested"]').first(),
    ).toBeVisible();
    await revealAll(page);
    await expect(
      page.locator('.sim-result-row[data-status="not-tested"]'),
    ).toHaveCount(0);
  });

  test("simulation badge and not-configured live strip are visible", async ({
    page,
  }) => {
    await expect(page.getByText(/SIMULATION ONLY/i).first()).toBeVisible();
    await openTab(page, "Inspector");
    await expect(page.getByText("Not Configured").first()).toBeVisible();
  });

  test("config panel offers narration voice selection", async ({ page }) => {
    await openTab(page, "Config");
    const voiceSelect = page.locator('[aria-label="Default narration voice"]');
    await expect(voiceSelect).toBeVisible();
    // Headless engines may load zero voices; Auto must always be there.
    await expect(voiceSelect.locator('option[value="auto"]')).toHaveText(
      "Auto (system default)",
    );
    // Per-character cast pickers: one per character, all defaulting to cast.
    for (const name of ["OS", "IAM", "Monitor", "AI Agent"]) {
      const picker = page.locator(`[aria-label="Voice for ${name}"]`);
      await expect(picker).toBeVisible();
      await expect(picker).toHaveValue("cast");
    }
  });
});

test.describe("playback", () => {
  test("16x playthrough smoke: story reaches its final verdict by playing", async ({
    page,
  }) => {
    await focusStage(page);
    if (
      (await page.locator(PLAY_BUTTON).getAttribute("aria-label")) === "Play"
    ) {
      await page.keyboard.press("Space");
    }
    await openTab(page, "Results");
    await page.locator(".sim-speed select").selectOption("16");
    await focusStage(page);
    // 571.5 s at 16x ≈ 36 s real; generous headroom for CI.
    await expect(page.locator(`${VERDICT} .sim-verdict-count`)).toHaveText(
      /49\/49 assertions evaluated/,
      { timeout: 90_000 },
    );
    await expect(page.locator(VERDICT)).toHaveAttribute(
      "data-verdict",
      "passed-with-warnings",
    );
  });

  test("keyboard-only: space, arrows and scene jumps drive playback", async ({
    page,
  }) => {
    await focusStage(page);

    // Space flips play/pause (clock starts paused).
    await page.keyboard.press("Space");
    await expect(page.locator(PLAY_BUTTON)).toHaveAttribute(
      "aria-label",
      "Pause",
    );
    await page.keyboard.press("Space");
    await expect(page.locator(PLAY_BUTTON)).toHaveAttribute(
      "aria-label",
      "Play",
    );

    // ArrowRight skips exactly 10 s from 0.
    await page.keyboard.press("Home");
    await expect(page.locator(TIMER)).toHaveText("0:00");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(TIMER)).toHaveText("0:10");

    // PageDown jumps to the next scene's start.
    const before = await page.locator(".sim-scene-title").first().textContent();
    await page.keyboard.press("PageDown");
    await page.keyboard.press("PageDown");
    await expect(page.locator(".sim-scene-title").first()).not.toHaveText(
      before ?? "",
    );

    // R restarts to zero, paused.
    await page.keyboard.press("KeyR");
    await expect(page.locator(TIMER)).toHaveText("0:00");
  });
});

test.describe("export", () => {
  test("scenario 14 JSON export downloads and parses", async ({ page }) => {
    await selectScenario(page, "14 — Integration is not configured");
    await openTab(page, "Results");
    await revealAll(page);
    await page.getByRole("button", { name: "View full report" }).click();

    const reportDialog = page.getByRole("dialog", { name: "Full test report" });
    await expect(reportDialog).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      reportDialog.getByRole("button", { name: "Export JSON" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("RUN-001-not-configured.json");

    const file = await download.path();
    const report = JSON.parse(readFileSync(file, "utf8")) as {
      disclaimer: string;
      overall: { status: string };
      counts: Record<string, number>;
      presentationDurationMs: number;
    };
    expect(report.overall.status).toBe("not-configured-only");
    expect(report.disclaimer).toContain("Simulation only");
    expect(report.presentationDurationMs).toBeGreaterThan(500_000);
    expect(report.counts["not-configured"]).toBeGreaterThan(0);
  });

  test("default storyline markdown export contains verdict and attempts", async ({
    page,
  }) => {
    await openTab(page, "Results");
    await revealAll(page);
    await page.getByRole("button", { name: "View full report" }).click();
    const reportDialog = page.getByRole("dialog", { name: "Full test report" });

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      reportDialog.getByRole("button", { name: "Export Markdown" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("RUN-001-default-storyline.md");

    const content = readFileSync(await download.path(), "utf8");
    expect(content).toContain("PASSED WITH WARNINGS");
    expect(content).toContain("Simulation only");
    expect(content).toContain("attempt 1=failed");
  });
});
