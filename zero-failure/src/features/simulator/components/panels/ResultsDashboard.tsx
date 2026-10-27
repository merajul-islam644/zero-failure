// Results dashboard: the 49 checkpoint assertions revealed progressively —
// every row renders NOT TESTED until its assertion-result event fires, then
// shows its honest outcome. The overall banner is computed from the revealed
// subset only, so it converges to the final verdict exactly when the story
// does. Never a health score.

import { useMemo, useState } from "react";
import type { Timeline } from "../../engine/timeline";
import { useRun } from "../../run/RunContext";
import { assertionById } from "../../run/assertions";
import { countStatuses, computeOverall } from "../../run/verdict";
import { useReveal } from "./reveal";
import { ASSERTION_STATUS_LABEL } from "./statusLabels";

type Filter = "all" | "passed" | "failed" | "warning" | "pending";

const FILTER_LABEL: Record<Filter, string> = {
  all: "All",
  passed: "Passed",
  failed: "Failed",
  warning: "Warnings",
  pending: "Pending"
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

  // assertionId -> position in the sorted events array, on the same scale as
  // eventIndex. event.seq is wrong here: assertion-result events are pushed
  // after every scene event, but the time-sort lands them mid-timeline, so
  // their seq sits far above their array position and comparing against seq
  // hides every result until the finale.
  const revealIndex = useMemo(() => {
    const map = new Map<string, number>();
    timeline.events.forEach((event, index) => {
      if (event.kind === "assertion-result") map.set(event.assertionId, index);
    });
    return map;
  }, [timeline]);

  if (!run) {
    return <p className="sim-scenario-hint">Executing scenario…</p>;
  }

  const revealed = run.results.filter((r) => {
    const index = revealIndex.get(r.assertionId);
    return index !== undefined && eventIndex >= index;
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
            aria-pressed={filter === key}
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
                <span className="sim-status-chip">{ASSERTION_STATUS_LABEL[status]}</span>
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
