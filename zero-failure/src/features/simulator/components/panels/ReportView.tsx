// Full-screen report takeover: meta, verdict with rationale, counts,
// per-platform assertion tables with retry histories, and the evidence
// appendix — exportable as JSON or Markdown. Exports of a live report are
// refused while any integration is unconfigured (assertExportable).

import { useMemo, useState } from "react";
import type { Timeline } from "../../engine/timeline";
import { useRun } from "../../run/RunContext";
import { assertionById } from "../../run/assertions";
import {
  assertExportable,
  buildReport,
  downloadText,
  platformSections,
  toJSON,
  toMarkdown
} from "../../report/report";
import { ASSERTION_STATUS_LABEL } from "./statusLabels";

export function ReportView({
  timeline,
  onClose
}: {
  timeline: Timeline;
  onClose: () => void;
}) {
  const { run } = useRun();
  // Surfaced when assertExportable refuses a live report that still has
  // not-configured rows — the refusal reason belongs in the UI, not just
  // the console.
  const [exportError, setExportError] = useState<string | null>(null);

  const report = useMemo(
    () => (run ? buildReport(run, timeline.totalMs) : null),
    [run, timeline.totalMs]
  );

  if (!report) {
    return (
      <div className="sim-report-overlay">
        <p className="sim-scenario-hint">Executing scenario…</p>
      </div>
    );
  }

  const resultsById = new Map(report.results.map((r) => [r.assertionId, r]));

  const guardedExport = (download: () => void) => {
    try {
      assertExportable(report);
      setExportError(null);
      download();
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export refused.");
    }
  };
  const exportJson = () =>
    guardedExport(() =>
      downloadText(`${report.runId}-${report.scenarioId}.json`, toJSON(report), "application/json")
    );
  const exportMarkdown = () =>
    guardedExport(() =>
      downloadText(`${report.runId}-${report.scenarioId}.md`, toMarkdown(report), "text/markdown")
    );

  return (
    <div className="sim-report-overlay" role="dialog" aria-label="Full test report">
      <div className="sim-report-toolbar">
        <h2 className="sim-report-title">
          Report {report.runId} · {report.scenarioId}
        </h2>
        <div className="sim-report-actions">
          <button type="button" className="sim-btn sim-btn-small sim-report-export" onClick={exportJson}>
            Export JSON
          </button>
          <button type="button" className="sim-btn sim-btn-small sim-report-export" onClick={exportMarkdown}>
            Export Markdown
          </button>
          <button type="button" className="sim-btn sim-btn-small" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <div className="sim-report-body">
        {exportError && (
          <p className="sim-report-export-error" role="alert">
            {exportError}
          </p>
        )}
        <p className="sim-report-disclaimer">{report.disclaimer}</p>

        <section className="sim-report-section">
          <div className="sim-verdict sim-verdict-large" data-verdict={report.overall.status}>
            <span className="sim-verdict-label">
              {report.overall.status.toUpperCase().replace(/-/g, " ")}
            </span>
            <ul className="sim-verdict-rationale">
              {report.overall.rationale.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="sim-report-section">
          <h3 className="sim-inspector-heading">Counts</h3>
          <div className="sim-report-counts">
            {(Object.entries(ASSERTION_STATUS_LABEL) as [string, string][]).map(([status, label]) => (
              <span key={status} className="sim-report-count" data-status={status}>
                {report.counts[status as keyof typeof report.counts]} {label}
              </span>
            ))}
          </div>
        </section>

        {platformSections().map((section) => (
          <section key={section.platform} className="sim-report-section">
            <h3 className="sim-inspector-heading">{section.platform}</h3>
            <ul className="sim-result-list">
              {section.assertionIds.map((assertionId) => {
                const result = resultsById.get(assertionId);
                const def = assertionById(assertionId);
                if (!result) return null;
                return (
                  <li key={assertionId} className="sim-result-row" data-status={result.status}>
                    <div className="sim-result-head">
                      <span className="sim-id">
                        {assertionId} · {def?.checkpointId}
                      </span>
                      <span className="sim-result-title">{def?.title}</span>
                      <span className="sim-status-chip">{ASSERTION_STATUS_LABEL[result.status]}</span>
                    </div>
                    <div className="sim-result-actual">
                      Expected: {result.expected} — Actual: {result.actual}
                    </div>
                    {result.attempts.length > 1 && (
                      <div className="sim-result-attempts">
                        {result.attempts
                          .map((a) => `attempt ${a.attempt}: ${a.status} (${a.durationMs} ms)`)
                          .join(" → ")}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <section className="sim-report-section">
          <h3 className="sim-inspector-heading">Evidence appendix ({report.messages.length} messages)</h3>
          <details>
            <summary>Show structured message history</summary>
            <ul className="sim-msg-list">
              {report.messages.map((m) => (
                <li key={m.requestId} className="sim-msg-row" data-status={m.status}>
                  <div className="sim-msg-head">
                    <span className="sim-id">{m.correlationId}</span>
                    {m.attempt > 1 && <span className="sim-attempt">attempt {m.attempt}</span>}
                    <span className="sim-status-chip">{m.status}</span>
                  </div>
                  <div className="sim-msg-op">
                    {m.operation} · {m.sourcePlatform} → {m.targetPlatform}
                  </div>
                  <div className="sim-msg-detail">
                    {m.errorDetails ? `${m.errorDetails.code}: ${m.errorDetails.message}` : m.responseSummary}
                    <span className="sim-msg-duration">{m.durationMs} ms</span>
                  </div>
                </li>
              ))}
            </ul>
          </details>
        </section>
      </div>
    </div>
  );
}
