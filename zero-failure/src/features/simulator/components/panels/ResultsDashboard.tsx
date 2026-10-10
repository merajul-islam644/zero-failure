// Results dashboard: the 49 checkpoint assertions revealed progressively —
// every row renders NOT TESTED until its assertion-result event fires, then
// shows its honest outcome. The overall banner is computed from the revealed
// subset only, so it converges to the final verdict exactly when the story
// does. Never a health score.

import { useMemo, useState } from "react";
import type { Timeline } from "../../engine/timeline";
import type { AssertionStatus } from "../../engine/types";
import { useRun } from "../../run/RunContext";
import { assertionById } from "../../run/assertions";
import { countStatuses, computeOverall } from "../../run/verdict";
import { useReveal } from "./reveal";

type Filter = "all" | "passed" | "failed" | "warning" | "pending";

const FILTER_LABEL: Record<Filter, string> = {
  all: "All",
  passed: "Passed",
  failed: "Failed",
  warning: "Warnings",
  pending: "Pending"
};

const STATUS_LABEL: Record<AssertionStatus, string> = {
  passed: "passed",
  failed: "failed",
  warning: "warning",
  "not-tested": "not tested",
  "not-configured": "not configured"
};

export function ResultsDashboard({
  timeline,
  onOpenReport
}: {
  timeline: Timeline;
  onOpenReport: () => void;
}) {
  const { run } = useRun();
  const { eventIndex } = useReveal(timeline);
  const [filter, setFilter] = useState<Filter>("all");

  // assertionId -> reveal seq, driven by the run's assertion-result events.
  const revealSeq = useMemo(() => {
    const map = new Map<string, number>();
    for (const event of timeline.events) {
      if (event.kind === "assertion-result") map.set(event.assertionId, event.seq);
    }
    return map;
  }, [timeline]);

  if (!run) {
    return <p className="sim-scenario-hint">Executing scenario…</p>;
  }

  const revealed = run.results.filter((r) => {
    const seq = revealSeq.get(r.assertionId);
    return seq !== undefined && eventIndex >= seq;
  });
  const revealedIds = new Set(revealed.map((r) => r.assertionId));

  const counts = countStatuses(revealed);
  const verdict =
    revealed.length > 0 ? computeOverall(revealed, counts) : null;

  const visible = run.results.filter((r) => {
    if (filter === "all") return true;
    if (filter === "pending") return r.status === "not-tested" || r.status === "not-configured" || !revealedIds.has(r.assertionId);
    return revealedIds.has(r.assertionId) && r.status === filter;
  });

  return (
    <div className="sim-dashboard">
      <div className="sim-verdict" data-verdict={verdict?.status ?? "pending"}>
        <span className="sim-verdict-label">
          {verdict ? verdict.status.toUpperCase().replace(/-/g, " ") : "NOT TESTED"}
        </span>
        <span className="sim-verdict-count">
          {revealed.length}/{run.results.length} assertions evaluated
        </span>
        {verdict && (
          <ul className="sim-verdict-rationale">
            {verdict.rationale.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="sim-filters" role="group" aria-label="Filter results">
        {(Object.keys(FILTER_LABEL) as Filter[]).map((key) => (
          <button
            key={key}
            type="button"
            className={`sim-filter-chip${filter === key ? " sim-filter-active" : ""}`}
            onClick={() => setFilter(key)}
          >
            {FILTER_LABEL[key]}
          </button>
        ))}
      </div>

      <ul className="sim-result-list">
        {visible.map((result) => {
          const def = assertionById(result.assertionId);
          const isRevealed = revealedIds.has(result.assertionId);
          const status = isRevealed ? result.status : "not-tested";
          return (
            <li key={result.assertionId} className="sim-result-row" data-status={status}>
              <div className="sim-result-head">
                <span className="sim-id">{result.assertionId}</span>
                <span className="sim-result-title">{def?.title}</span>
                <span className="sim-status-chip">{STATUS_LABEL[status]}</span>
              </div>
              {isRevealed && <div className="sim-result-actual">{result.actual}</div>}
            </li>
          );
        })}
      </ul>

      <button type="button" className="sim-report-btn" onClick={onOpenReport}>
        View full report
      </button>
    </div>
  );
}
