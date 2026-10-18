// M4 report tests: buildReport shape and determinism, Markdown/JSON export
// contents, and the assertExportable honesty guard.

import { describe, expect, it } from "vitest";
import { executeScenario } from "../run/runner";
import { scenarioById } from "../scenarios/registry";
import { ASSERTIONS } from "../run/assertions";
import { REPORT_DISCLAIMER } from "../run/verdict";
import {
  assertExportable,
  buildReport,
  platformSections,
  toJSON,
  toMarkdown
} from "./report";
import type { RunResult } from "../engine/types";

const FIXED_NOW = "2026-01-01T00:00:00.000Z";
const DEFAULT_PRESENTATION_MS = 571500; // 570000 script + 1500 tail

const runScenario = async (id: string): Promise<RunResult> =>
  executeScenario(scenarioById(id), "simulated");

describe("buildReport", () => {
  it("carries counts, verdict, disclaimer and both durations", async () => {
    const run = await runScenario("default-storyline");
    const report = buildReport(run, DEFAULT_PRESENTATION_MS, FIXED_NOW);
    expect(report.reportVersion).toBe(1);
    expect(report.runId).toBe("RUN-001");
    expect(report.mode).toBe("simulated");
    expect(report.scenarioId).toBe("default-storyline");
    expect(report.presentationDurationMs).toBe(DEFAULT_PRESENTATION_MS);
    expect(report.executionDurationMs).toBeNull(); // simulation never fakes wall clock
    expect(report.disclaimer).toBe(REPORT_DISCLAIMER);
    expect(Object.values(report.counts).reduce((a, b) => a + b, 0)).toBe(ASSERTIONS.length);
    expect(report.overall.status).toBe("passed-with-warnings");
    expect(report.results).toHaveLength(ASSERTIONS.length);
    expect(report.messages.length).toBeGreaterThan(0);
  });

  it("is deterministic for the same run and fixed clock", async () => {
    const run = await runScenario("default-storyline");
    expect(toJSON(buildReport(run, DEFAULT_PRESENTATION_MS, FIXED_NOW))).toBe(
      toJSON(buildReport(run, DEFAULT_PRESENTATION_MS, FIXED_NOW))
    );
  });

  it("live runs carry the live disclaimer and their real execution duration", () => {
    const liveRun: RunResult = {
      runId: "RUN-ABC-1",
      mode: "live",
      scenarioId: "default-storyline",
      messages: [],
      executionDurationMs: 4211,
      results: []
    };
    const report = buildReport(liveRun, DEFAULT_PRESENTATION_MS, FIXED_NOW);
    expect(report.disclaimer).toContain("Live mode:");
    expect(report.executionDurationMs).toBe(4211);
    expect(toMarkdown(report)).toContain("Live mode:");
  });
});

describe("toJSON", () => {
  it("parses back to the same report", async () => {
    const run = await runScenario("default-storyline");
    const report = buildReport(run, DEFAULT_PRESENTATION_MS, FIXED_NOW);
    expect(JSON.parse(toJSON(report))).toEqual(report);
  });
});

describe("toMarkdown", () => {
  it("contains the verdict banner, all 49 assertions, retry histories and the disclaimer", async () => {
    const run = await runScenario("default-storyline");
    const md = toMarkdown(buildReport(run, DEFAULT_PRESENTATION_MS, FIXED_NOW));

    expect(md).toContain("# Mission Deck — Integration Test Report");
    expect(md).toContain("PASSED WITH WARNINGS");
    expect(md).toContain(REPORT_DISCLAIMER);
    for (const assertion of ASSERTIONS) {
      expect(md).toContain(assertion.id);
    }
    // Recovered chain: both attempts preserved with statuses.
    expect(md).toContain("attempt 1=failed");
    expect(md).toContain("attempt 2=succeeded");
    // Correlation-scoped evidence appendix.
    expect(md).toContain("### s6-readiness");
    expect(md).toContain("### s9-timeout-probe");
    // Markdown closes with the disclaimer footer.
    expect(md.trimEnd().endsWith(REPORT_DISCLAIMER)).toBe(true);
  });

  it("escapes pipes so table rows stay intact", async () => {
    const run = await runScenario("default-storyline");
    const md = toMarkdown(buildReport(run, DEFAULT_PRESENTATION_MS, FIXED_NOW));
    // Every result row has exactly 5 cells even when actuals contain pipes.
    for (const line of md.split("\n")) {
      if (line.startsWith("| A-") && !line.includes("| ---")) {
        expect(line.split("|").length - 2).toBe(5);
      }
    }
  });
});

describe("assertExportable", () => {
  it("allows simulated reports", async () => {
    const run = await runScenario("not-configured");
    expect(() => assertExportable(buildReport(run, DEFAULT_PRESENTATION_MS, FIXED_NOW))).not.toThrow();
  });

  it("refuses a live report that contains not-configured results", async () => {
    const run = await runScenario("not-configured");
    const liveRun: RunResult = { ...run, mode: "live" };
    expect(() => assertExportable(buildReport(liveRun, DEFAULT_PRESENTATION_MS, FIXED_NOW))).toThrow(
      /not-configured/
    );
  });

  it("refuses a live report even when only some integrations are unconfigured", () => {
    const liveRun: RunResult = {
      runId: "RUN-LIVE",
      mode: "live",
      scenarioId: "default-storyline",
      messages: [],
      executionDurationMs: null,
      results: [
        {
          assertionId: "A-1-1",
          runId: "RUN-LIVE",
          kind: "process",
          status: "passed",
          mode: "live",
          expected: "e",
          actual: "a",
          attempts: []
        },
        {
          assertionId: "A-2-1",
          runId: "RUN-LIVE",
          kind: "message",
          status: "not-configured",
          mode: "live",
          expected: "e",
          actual: "a",
          attempts: [],
          correlationId: "s2-identity-check"
        }
      ]
    };
    expect(() => assertExportable(buildReport(liveRun, DEFAULT_PRESENTATION_MS, FIXED_NOW))).toThrow();
  });
});

describe("platformSections", () => {
  it("groups all 49 assertions across the ten platforms without gaps", () => {
    const sections = platformSections();
    expect(sections).toHaveLength(10);
    const total = sections.reduce((sum, s) => sum + s.assertionIds.length, 0);
    expect(total).toBe(ASSERTIONS.length);
    expect(sections.map((s) => s.platform)).toEqual([
      "os",
      "iam",
      "data-gateway",
      "logic",
      "release",
      "monitor",
      "utilities",
      "localization",
      "storage",
      "ai-agent"
    ]);
  });
});
