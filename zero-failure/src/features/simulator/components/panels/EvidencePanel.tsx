// Evidence panel: the revealed message history grouped by correlation ID,
// attempts in order — the same evidence the report appendix exports.

import type { Timeline } from "../../engine/timeline";
import { useReveal, revealStatus, type RevealWindow } from "./reveal";

const STATUS_LABEL: Record<string, string> = {
  "in-flight": "in flight",
  processing: "processing",
  succeeded: "succeeded",
  failed: "failed",
  "timed-out": "timed out",
  "not-configured": "not configured"
};

export function EvidencePanel({ timeline }: { timeline: Timeline }) {
  const { windows, eventIndex } = useReveal(timeline);
  const revealed = windows.filter((w) => eventIndex >= w.dispatchIndex);

  const groups = new Map<string, RevealWindow[]>();
  for (const window of revealed) {
    const list = groups.get(window.message.correlationId) ?? [];
    list.push(window);
    groups.set(window.message.correlationId, list);
  }

  if (groups.size === 0) {
    return <p className="sim-scenario-hint">No evidence collected yet.</p>;
  }

  return (
    <ul className="sim-evidence-list">
      {[...groups.entries()].map(([correlationId, group]) => (
        <li key={correlationId} className="sim-evidence-group">
          <div className="sim-id">{correlationId}</div>
          <ul className="sim-evidence-attempts">
            {group.map((window) => {
              const m = window.message;
              const status = revealStatus(window, eventIndex);
              return (
                <li key={m.requestId} className="sim-evidence-attempt" data-status={status}>
                  <span className="sim-evidence-meta">
                    attempt {m.attempt} · {m.operation} · {m.sourcePlatform} → {m.targetPlatform}
                  </span>
                  <span className="sim-status-chip">{STATUS_LABEL[status]}</span>
                  {eventIndex >= window.resolveIndex && (
                    <span className="sim-evidence-detail">
                      {m.errorDetails
                        ? `${m.errorDetails.code}: ${m.errorDetails.message}`
                        : m.responseSummary}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}
