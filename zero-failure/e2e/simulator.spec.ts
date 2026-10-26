// Playwright e2e for Mission Deck. Strategy: full playthroughs are
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
  // The dashboard is "/" now — the simulator lives at /simulator.
  await page.goto("/simulator");
  // The status rail's PANEL seat starts with the run-panel deck folded —
  // unfold it the way a viewer would before any panel-bound assertion.
  await page.locator('[aria-label="Toggle the run panels"]').click();
  await expect(page.locator(".sim-tabs")).toBeVisible();
});

/** Blur whatever holds focus (e.g. the scenario <select>, whose keydown
 *  guard swallows End/Space). A drawer's backdrop owns every click while
 *  open, so this never clicks — playback keys land on window regardless. */
async function focusStage(page: Page): Promise<void> {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
  });
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

  test("static live capability rows are visible in the inspector", async ({
    page,
  }) => {
    await openTab(page, "Inspector");
    // Static capability truth — independent of tenant state or probe timing
    // (the SDK-backed rows render live probe results, which vary by tenant).
    await expect(
      page.getByText("no live API — simulated").first(),
    ).toBeVisible();
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
    // The transport sits under the drawer's backdrop and hides until the
    // pointer comes down to it — fold the deck and wake the bar first.
    await page.keyboard.press("Escape");
    await page.mouse.move(960, 885);
    await page.locator(".sim-speed select").selectOption("16");
    await focusStage(page);
    if (
      (await page.locator(PLAY_BUTTON).getAttribute("aria-label")) === "Play"
    ) {
      await page.keyboard.press("Space");
    }
    await page.locator('[aria-label="Toggle the run panels"]').click();
    await openTab(page, "Results");
    // 571.5 s at 16x ≈ 36 s real; the first (cold) attempt renders a full-
    // display canvas, so leave real headroom for CI.
    await expect(page.locator(`${VERDICT} .sim-verdict-count`)).toHaveText(
      /49\/49 assertions evaluated/,
      { timeout: 150_000 },
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

    // PageDown jumps to the next scene's start — two jumps land deep in
    // the story, well past this 10s mark. Escape folds the run-panel
    // drawer first so nothing is holding the pointer.
    await page.keyboard.press("Escape");
    const before = await page.locator(TIMER).textContent();
    await page.keyboard.press("PageDown");
    await page.keyboard.press("PageDown");
    await expect(page.locator(TIMER)).not.toHaveText(before ?? "");

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
