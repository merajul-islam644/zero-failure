// Explicit verdict rules — unit-tested invariants. Never a health score.
//
// - any failed -> failed
// - every executed message-kind result not-configured (and at least one) -> not-configured-only
// - any not-tested -> incomplete   (never summarize unfinished runs as "passed")
// - any warning (incl. recovered-after-retry) -> passed-with-warnings
// - else -> passed
//
// `passed` requires zero not-configured and zero not-tested. Process results
// may carry evidence correlationIds — the kind field, not the correlationId,
// decides what the not-configured-only rule inspects. Presentation duration
// and execution duration are never merged into one number.

import type { AssertionStatus, OverallStatus, TestResult } from "../engine/types";

export const REPORT_DISCLAIMER =
  "Simulation only: these results come from deterministic simulated connectors, not from real SELISE Blocks services. Not-configured integrations are never marked as passed.";

export const LIVE_REPORT_DISCLAIMER =
  "Live mode: results were recorded from real SELISE Blocks services reached read-only from the browser. Write operations were refused by design (LIVE_READ_ONLY), and the default storyline runs without scenario injections, so its outcomes are what the services actually returned. Not-configured integrations are never marked as passed.";

export const EMPTY_COUNTS: Record<AssertionStatus, number> = {
  passed: 0,
  failed: 0,
  warning: 0,
  "not-tested": 0,
  "not-configured": 0
};

export function countStatuses(results: TestResult[]): Record<AssertionStatus, number> {
  const counts = { ...EMPTY_COUNTS };
  for (const result of results) counts[result.status] += 1;
  return counts;
}

export function computeOverall(
  results: TestResult[],
  counts: Record<AssertionStatus, number>
): { status: OverallStatus; rationale: string[] } {
  const rationale: string[] = [];

  if (counts.failed > 0) {
    const failed = results.filter((r) => r.status === "failed").map((r) => r.assertionId);
    rationale.push(`${counts.failed} required assertion(s) failed: ${failed.join(", ")}`);
    return { status: "failed", rationale };
  }

  // Message-kind results that actually produced a message. Blocked dependents
  // stay not-tested and do not disqualify: they are blocked *because* the
  // integration is not configured.
  const executed = results.filter((r) => r.kind === "message" && r.status !== "not-tested");
  const allNotConfigured =
    executed.length > 0 && executed.every((r) => r.status === "not-configured");
  if (allNotConfigured) {
    rationale.push(
      counts["not-tested"] > 0
        ? `Every executed integration reported Not Configured (${counts["not-tested"]} dependent step(s) blocked); nothing is claimed as passed.`
        : "Every executed integration reported Not Configured; nothing is claimed as passed."
    );
    return { status: "not-configured-only", rationale };
  }

  if (counts["not-tested"] > 0) {
    rationale.push(`${counts["not-tested"]} assertion(s) have no conclusive result — the run is incomplete, not passing.`);
    return { status: "incomplete", rationale };
  }

  if (counts.warning > 0) {
    const warned = results.filter((r) => r.status === "warning").map((r) => r.assertionId);
    rationale.push(`${counts.warning} warning(s) (including recovered-after-retry chains): ${warned.join(", ")}`);
    return { status: "passed-with-warnings", rationale };
  }

  rationale.push(`All ${counts.passed} assertion(s) passed with zero warnings, failures, not-tested or not-configured results.`);
  return { status: "passed", rationale };
}
