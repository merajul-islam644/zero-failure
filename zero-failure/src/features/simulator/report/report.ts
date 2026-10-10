// Report builders: the typed RunReport plus JSON and Markdown exports.
// Deterministic when the clock inputs are fixed — same run, same bytes.
//
// assertExportable refuses any live-mode report whose results include
// not-configured rows: an unconfigured integration must never leave the
// building dressed as a test result.

import { ASSERTIONS, assertionById } from "../run/assertions";
import { countStatuses, computeOverall, REPORT_DISCLAIMER } from "../run/verdict";
import { CAST_BY_ID } from "../script/cast";
import type { PlatformId, RunReport, RunResult } from "../engine/types";

export function buildReport(
  run: RunResult,
  presentationDurationMs: number,
  now: string = new Date().toISOString()
): RunReport {
  return {
    reportVersion: 1,
    runId: run.runId,
    mode: run.mode,
    scenarioId: run.scenarioId,
    startedAt: now,
    completedAt: now,
    presentationDurationMs,
    executionDurationMs: null,
    disclaimer: REPORT_DISCLAIMER,
    counts: countStatuses(run.results),
    overall: computeOverall(run.results, countStatuses(run.results)),
    results: run.results,
    messages: run.messages
  };
}

/** Live reports may not export while any integration is unconfigured. */
export function assertExportable(report: RunReport): void {
  if (report.mode !== "live") return;
  const unconfigured = report.results.filter((r) => r.status === "not-configured");
  if (unconfigured.length > 0) {
    throw new Error(
      `Refusing to export: live-mode report contains ${unconfigured.length} not-configured result(s). Configure the live connectors or export the simulated report.`
    );
  }
}

export function toJSON(report: RunReport): string {
  return JSON.stringify(report, null, 2);
}

function formatMs(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}m ${String(total % 60).padStart(2, "0")}s (${ms} ms)`;
}

const STATUS_LABEL: Record<string, string> = {
  passed: "PASSED",
  failed: "FAILED",
  warning: "WARNING",
  "not-tested": "NOT TESTED",
  "not-configured": "NOT CONFIGURED"
};

const OVERALL_LABEL: Record<string, string> = {
  passed: "PASSED",
  "passed-with-warnings": "PASSED WITH WARNINGS",
  failed: "FAILED",
  incomplete: "INCOMPLETE",
  "not-configured-only": "NOT CONFIGURED ONLY"
};

const PLATFORM_ORDER: PlatformId[] = [
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
];

export function toMarkdown(report: RunReport): string {
  const lines: string[] = [];
  const push = (text = "") => lines.push(text);

  push(`# Operation Zero Failure — Integration Test Report`);
  push();
  push(`> ${report.disclaimer}`);
  push();
  push(`| Field | Value |`);
  push(`| --- | --- |`);
  push(`| Run | ${report.runId} |`);
  push(`| Mode | ${report.mode} |`);
  push(`| Scenario | ${report.scenarioId} |`);
  push(`| Started | ${report.startedAt} |`);
  push(`| Completed | ${report.completedAt} |`);
  push(`| Presentation duration | ${formatMs(report.presentationDurationMs)} |`);
  push(
    `| Execution duration | ${report.executionDurationMs === null ? "n/a (simulation)" : formatMs(report.executionDurationMs)} |`
  );
  push();
  push(`## Overall status: ${OVERALL_LABEL[report.overall.status] ?? report.overall.status}`);
  push();
  for (const line of report.overall.rationale) push(`- ${line}`);
  push();
  push(`## Counts`);
  push();
  push(`| Status | Count |`);
  push(`| --- | --- |`);
  for (const [status, label] of Object.entries(STATUS_LABEL)) {
    push(`| ${label} | ${report.counts[status as keyof RunReport["counts"]] ?? 0} |`);
  }
  push();

  // Results grouped by the assertion's platform, in cast order.
  push(`## Results by platform`);
  const byPlatform = new Map<PlatformId, typeof report.results>();
  for (const result of report.results) {
    const platform = assertionById(result.assertionId)?.platform;
    if (!platform) continue;
    const list = byPlatform.get(platform) ?? [];
    list.push(result);
    byPlatform.set(platform, list);
  }
  for (const platform of PLATFORM_ORDER) {
    const results = byPlatform.get(platform);
    if (!results || results.length === 0) continue;
    push();
    push(`### ${CAST_BY_ID[platform].name} (${platform})`);
    push();
    push(`| Assertion | Checkpoint | Status | Expected | Actual |`);
    push(`| --- | --- | --- | --- | --- |`);
    for (const result of results) {
      const def = assertionById(result.assertionId);
      const actual = result.actual.replace(/\|/g, "\\|");
      const expected = result.expected.replace(/\|/g, "\\|");
      push(
        `| ${result.assertionId} ${def?.title ?? ""} | ${def?.checkpointId ?? ""} | ${STATUS_LABEL[result.status] ?? result.status} | ${expected} | ${actual} |`
      );
    }
    const retried = results.filter((r) => r.attempts.length > 1);
    if (retried.length > 0) {
      push();
      for (const result of retried) {
        const history = result.attempts
          .map((a) => `attempt ${a.attempt}=${a.status} (${a.durationMs} ms)`)
          .join(", ");
        push(`- ${result.assertionId} retry history (${result.correlationId}): ${history}`);
      }
    }
  }

  // Evidence appendix grouped by correlation.
  push();
  push(`## Appendix — Evidence (message history)`);
  const byCorrelation = new Map<string, typeof report.messages>();
  for (const message of report.messages) {
    const list = byCorrelation.get(message.correlationId) ?? [];
    list.push(message);
    byCorrelation.set(message.correlationId, list);
  }
  for (const [correlationId, messages] of byCorrelation) {
    push();
    push(`### ${correlationId}`);
    push();
    push(`| Attempt | Operation | From → To | Status | Duration | Response |`);
    push(`| --- | --- | --- | --- | --- | --- |`);
    for (const message of messages) {
      const response = (message.errorDetails
        ? `${message.errorDetails.code}: ${message.errorDetails.message}`
        : (message.responseSummary ?? "")
      ).replace(/\|/g, "\\|");
      push(
        `| ${message.attempt} | ${message.operation} | ${message.sourcePlatform} → ${message.targetPlatform} | ${message.status} | ${message.durationMs} ms | ${response} |`
      );
    }
  }

  push();
  push(`---`);
  push();
  push(report.disclaimer);
  push();
  return lines.join("\n");
}

/** All assertion ids grouped by platform — used by the report view. */
export function platformSections(): { platform: PlatformId; assertionIds: string[] }[] {
  return PLATFORM_ORDER.map((platform) => ({
    platform,
    assertionIds: ASSERTIONS.filter((a) => a.platform === platform).map((a) => a.id)
  })).filter((section) => section.assertionIds.length > 0);
}

/** Trigger a browser download for an already-built export string. */
export function downloadText(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
