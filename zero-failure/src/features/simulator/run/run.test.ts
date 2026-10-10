// M3 simulation-semantics tests: determinism, the default storyline's
// golden expectations, the 15-row scenario/verdict table, verdict-rule
// invariants, and run-driven timeline compilation (including blocked
// dependents and assertion-result events).

import { describe, expect, it } from "vitest";
import { executeScenario, RUN_ID } from "./runner";
import { scenarioById, SCENARIOS } from "../scenarios/registry";
import { ASSERTIONS } from "./assertions";
import { countStatuses, computeOverall } from "./verdict";
import { buildTimeline } from "../engine/timeline";
import { SCENES } from "../script/scenes";
import type { AssertionStatus, ExecutionMode, RunResult, TestResult } from "../engine/types";

const runScenario = (id: string): Promise<RunResult> => executeScenario(scenarioById(id), "simulated");

const statusByCorrelation = (run: RunResult): Map<string, string> =>
  new Map(run.messages.map((m) => [`${m.correlationId}#${m.attempt}`, m.status]));

const resultById = (run: RunResult): Map<string, TestResult> =>
  new Map(run.results.map((r) => [r.assertionId, r]));

const verdictOf = (run: RunResult): ReturnType<typeof computeOverall>["status"] =>
  computeOverall(run.results, countStatuses(run.results)).status;

describe("default storyline (script as written)", () => {
  it("is deterministic: two executions produce identical runs", async () => {
    const a = await runScenario("default-storyline");
    const b = await runScenario("default-storyline");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("executes every scripted checkpoint as an assertion", async () => {
    const run = await runScenario("default-storyline");
    expect(run.results).toHaveLength(ASSERTIONS.length);
    expect(ASSERTIONS).toHaveLength(49);
    expect(new Set(run.results.map((r) => r.assertionId))).toEqual(
      new Set(ASSERTIONS.map((a) => a.id))
    );
  });

  it("keeps every message under RUN-001 with stable idempotency keys", async () => {
    const run = await runScenario("default-storyline");
    expect(run.messages.length).toBeGreaterThan(0);
    for (const m of run.messages) {
      expect(m.runId).toBe(RUN_ID);
      expect(m.idempotencyKey).toBe(`${RUN_ID}:${m.correlationId}`);
      expect(m.mode).toBe("simulated");
      expect(m.simulated).toBe(true);
      expect(m.durationMs).toBeGreaterThan(0);
    }
  });

  it("matches the script exactly: two negatives, two recovered chains, everything else succeeds", async () => {
    const run = await runScenario("default-storyline");
    const statuses = statusByCorrelation(run);
    const expected: Record<string, string> = {
      "s2-authorize-restricted#1": "failed",
      "s8-missing-key#1": "failed",
      "s6-readiness#1": "failed",
      "s6-readiness#2": "succeeded",
      "s9-timeout-probe#1": "timed-out",
      "s9-timeout-probe#2": "succeeded"
    };
    // Everything not listed above must have succeeded.
    const expectedNonSucceeded = Object.entries(expected).filter(([, s]) => s !== "succeeded");
    const nonSucceeded = [...statuses.entries()].filter(([, status]) => status !== "succeeded");
    expect(new Map(nonSucceeded)).toEqual(new Map(expectedNonSucceeded));
  });

  it("preserves the first failure of each recovered chain", async () => {
    const run = await runScenario("default-storyline");
    const readiness = run.messages.filter((m) => m.correlationId === "s6-readiness");
    expect(readiness.map((m) => m.status)).toEqual(["failed", "succeeded"]);
    const probe = run.messages.filter((m) => m.correlationId === "s9-timeout-probe");
    expect(probe.map((m) => m.status)).toEqual(["timed-out", "succeeded"]);
  });

  it("yields exactly the script's three recovery warnings and passes everything else", async () => {
    const run = await runScenario("default-storyline");
    const counts = countStatuses(run.results);
    expect(counts).toEqual<Record<AssertionStatus, number>>({
      passed: 46,
      failed: 0,
      warning: 3,
      "not-tested": 0,
      "not-configured": 0
    });
    const warnings = run.results.filter((r) => r.status === "warning").map((r) => r.assertionId);
    expect(warnings.sort()).toEqual(["A-6-4", "A-9-2", "A-9-3"]);
    // The queued-not-delivered caveat is preserved in the actual text.
    const advisory = resultById(run).get("A-7-5");
    expect(advisory?.status).toBe("passed");
    expect(advisory?.actual).toContain("queued");
  });

  it("ends passed-with-warnings — never a bare pass", async () => {
    const run = await runScenario("default-storyline");
    expect(verdictOf(run)).toBe("passed-with-warnings");
  });
});

describe("the 14 selectable scenarios", () => {
  // The full outcome table — each row is a tested contract with the UI.
  const EXPECTED_VERDICTS: Record<string, ReturnType<typeof computeOverall>["status"]> = {
    "default-storyline": "passed-with-warnings",
    "auth-succeeds": "passed-with-warnings",
    "auth-fails": "failed",
    "authz-denied": "failed",
    "data-read-succeeds": "passed-with-warnings",
    "data-write-fails": "failed",
    "dependency-unavailable": "incomplete",
    "deploy-ok-readiness-fails": "failed",
    "monitor-detects-error": "passed-with-warnings",
    "upload-ok-retrieval-fails": "failed",
    "notification-rejected": "failed",
    "translation-missing": "failed",
    "timeout-recovers": "passed-with-warnings",
    "idempotency-repeat": "passed-with-warnings",
    "not-configured": "not-configured-only"
  };

  it("exposes the default plus 14 scenarios", () => {
    expect(SCENARIOS).toHaveLength(15);
    expect(new Set(SCENARIOS.map((s) => s.id))).toEqual(new Set(Object.keys(EXPECTED_VERDICTS)));
  });

  it.each(Object.entries(EXPECTED_VERDICTS))("%s → %s", async (id, expected) => {
    const run = await runScenario(id);
    expect(verdictOf(run), `scenario ${id}`).toBe(expected);
  });

  it("scenario 2 (auth-fails) fails the authentication assertion itself", async () => {
    const run = await runScenario("auth-fails");
    expect(resultById(run).get("A-2-1")?.status).toBe("failed");
  });

  it("scenario 3 (authz-denied) denies the permitted read but still passes the negative test", async () => {
    const run = await runScenario("authz-denied");
    expect(resultById(run).get("A-2-2")?.status).toBe("failed");
    expect(resultById(run).get("A-2-3")?.status).toBe("passed");
  });

  it("scenario 6 (dependency-unavailable) blocks dependents instead of faking them", async () => {
    const run = await runScenario("dependency-unavailable");
    expect(run.messages.find((m) => m.correlationId === "s5-deploy-job")).toBeUndefined();
    expect(run.messages.find((m) => m.correlationId === "s6-readiness")).toBeUndefined();
    const results = resultById(run);
    expect(results.get("A-5-3")?.status).toBe("not-tested");
    expect(results.get("A-6-1")?.status).toBe("not-tested");
    expect(results.get("A-4-2")?.status).toBe("passed");
  });

  it("scenario 7 (deploy-ok-readiness-fails) keeps both failed readiness attempts and fails", async () => {
    const run = await runScenario("deploy-ok-readiness-fails");
    const readiness = run.messages.filter((m) => m.correlationId === "s6-readiness");
    expect(readiness.map((m) => m.status)).toEqual(["failed", "failed"]);
    const a64 = resultById(run).get("A-6-4");
    expect(a64?.status).toBe("failed");
    expect(a64?.attempts).toHaveLength(2);
  });

  it("scenario 14 (not-configured) marks nothing as passed", async () => {
    const run = await runScenario("not-configured");
    const messageResults = run.results.filter(
      (r) => r.kind === "message" && r.status !== "not-tested"
    );
    expect(messageResults.length).toBeGreaterThan(0);
    expect(messageResults.every((r) => r.status === "not-configured")).toBe(true);
    expect(run.messages.every((m) => m.status === "not-configured")).toBe(true);
  });
});

describe("verdict rules (explicit, unit-tested invariants)", () => {
  const makeResult = (
    assertionId: string,
    status: AssertionStatus,
    correlationId?: string,
    kind: "message" | "process" = correlationId ? "message" : "process"
  ): TestResult => ({
    assertionId,
    runId: RUN_ID,
    kind,
    status,
    mode: "simulated" as ExecutionMode,
    expected: "expected",
    actual: "actual",
    attempts: [],
    correlationId
  });

  it("any failed result dominates everything", () => {
    const results = [
      makeResult("A", "failed", "c1"),
      makeResult("B", "warning", "c2"),
      makeResult("C", "not-tested"),
      makeResult("D", "not-configured", "c3")
    ];
    expect(computeOverall(results, countStatuses(results)).status).toBe("failed");
  });

  it("not-configured-only wins over incomplete when every executed integration is unconfigured", () => {
    const results = [
      makeResult("A", "not-configured", "c1"),
      makeResult("B", "not-tested") // blocked dependent
    ];
    const { status, rationale } = computeOverall(results, countStatuses(results));
    expect(status).toBe("not-configured-only");
    expect(rationale[0]).toContain("blocked");
  });

  it("a passed process rule with an evidence correlationId never counts as message-kind", () => {
    const results = [
      makeResult("A", "not-configured", "c1"),
      makeResult("P", "passed", "c1", "process") // e.g. dependents-blocked evidence link
    ];
    expect(computeOverall(results, countStatuses(results)).status).toBe("not-configured-only");
  });

  it("not-tested dominates warnings — an unfinished run is never 'passed'", () => {
    const results = [makeResult("A", "warning", "c1"), makeResult("B", "not-tested")];
    expect(computeOverall(results, countStatuses(results)).status).toBe("incomplete");
  });

  it("warnings alone produce passed-with-warnings", () => {
    const results = [makeResult("A", "warning", "c1"), makeResult("B", "passed", "c2")];
    expect(computeOverall(results, countStatuses(results)).status).toBe("passed-with-warnings");
  });

  it("not-tested without any other signal is incomplete", () => {
    const results = [makeResult("A", "passed"), makeResult("B", "not-tested")];
    expect(computeOverall(results, countStatuses(results)).status).toBe("incomplete");
  });

  it("a clean run passes; a single not-configured row blocks a bare pass", () => {
    const clean = [makeResult("A", "passed"), makeResult("B", "passed", "c1")];
    expect(computeOverall(clean, countStatuses(clean)).status).toBe("passed");

    const tainted = [makeResult("A", "passed"), makeResult("B", "not-configured", "c1")];
    expect(computeOverall(tainted, countStatuses(tainted)).status).toBe("not-configured-only");
  });
});

describe("run-driven timeline compilation", () => {
  it("places the run's real messages — no placeholders when a run exists", async () => {
    const run = await runScenario("default-storyline");
    const timeline = buildTimeline(SCENES, run);
    expect(timeline.messages.length).toBeGreaterThan(0);
    for (const message of timeline.messages) {
      expect(run.messages).toContain(message);
      expect(message.runId).toBe(RUN_ID);
    }
  });

  it("emits an assertion-result event for every assertion, at the right moment", async () => {
    const run = await runScenario("default-storyline");
    const timeline = buildTimeline(SCENES, run);
    const assertionEvents = timeline.events.filter((e) => e.kind === "assertion-result");
    expect(new Set(assertionEvents.map((e) => e.assertionId))).toEqual(
      new Set(ASSERTIONS.map((a) => a.id))
    );

    // A message-kind result lands exactly at the final resolve of its chain.
    const probeFinal = run.messages.find(
      (m) => m.correlationId === "s9-timeout-probe" && m.attempt === 2
    );
    expect(probeFinal).toBeDefined();
    const resolve = timeline.events.find(
      (e) => e.kind === "message-resolve" && e.messageId === probeFinal!.requestId
    );
    const a92 = assertionEvents.find((e) => e.assertionId === "A-9-2");
    expect(a92?.time).toBe(resolve?.time);
  });

  it("skips blocked dependents entirely — no packets, no fake resolves", async () => {
    const run = await runScenario("dependency-unavailable");
    const timeline = buildTimeline(SCENES, run);
    expect(
      timeline.events.some(
        (e) => e.kind === "message-dispatch" && e.message.correlationId === "s5-deploy-job"
      )
    ).toBe(false);
    // The rest of the story still plays.
    expect(
      timeline.events.some(
        (e) => e.kind === "message-dispatch" && e.message.correlationId === "s7-notification"
      )
    ).toBe(true);
  });
});
