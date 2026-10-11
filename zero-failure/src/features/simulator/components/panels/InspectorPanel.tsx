// Read-only inspector: the structured message history revealed by the
// playhead, plus the connector tables for both modes. Correlation IDs are
// always visible — they are the traceability anchors between animation,
// dashboard and report. Nothing here executes; the registries are static
// description data.

import type { Timeline } from "../../engine/timeline";
import { useRun } from "../../run/RunContext";
import { CAST_BY_ID } from "../../script/cast";
import { revealStatus, useReveal } from "./reveal";

export function InspectorPanel({ timeline }: { timeline: Timeline }) {
  const { simulatedRegistry, liveRegistry, scenario, run } = useRun();
  const { windows, eventIndex } = useReveal(timeline);
  const revealed = windows.filter((w) => eventIndex >= w.dispatchIndex);

  return (
    <>
      <section className="sim-inspector-section">
        <h3 className="sim-inspector-heading">Scenario</h3>
        <p className="sim-scenario-title">{scenario.title}</p>
        <p className="sim-scenario-hint">
          {run ? `Run ${run.runId} executed up-front (deterministic, simulated)` : "Executing scenario…"}
        </p>
      </section>

      <section className="sim-inspector-section">
        <h3 className="sim-inspector-heading">
          Simulated connectors <span className="sim-count">({Object.keys(simulatedRegistry).length})</span>
        </h3>
        <ul className="sim-conn-list">
          {Object.values(simulatedRegistry).map((connector) => (
            <li key={connector.platform} className="sim-conn-row" data-configured={connector.configStatus}>
              <span className="sim-conn-name">{connector.displayName}</span>
              <span className="sim-conn-status">configured · simulated</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="sim-inspector-section">
        <h3 className="sim-inspector-heading">
          Live connectors <span className="sim-count">({Object.keys(liveRegistry).length})</span>
        </h3>
        <ul className="sim-conn-list">
          {Object.values(liveRegistry).map((connector) => (
            <li key={connector.platform} className="sim-conn-row" data-configured={connector.configStatus}>
              <span className="sim-conn-name">{connector.displayName}</span>
              <span className="sim-conn-status">Not Configured</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="sim-inspector-section">
        <h3 className="sim-inspector-heading">
          Message history <span className="sim-count">({revealed.length}/{windows.length})</span>
        </h3>
        {revealed.length === 0 ? (
          <p className="sim-scenario-hint">No messages dispatched yet.</p>
        ) : (
          <ul className="sim-msg-list">
            {revealed.map((window) => {
              const m = window.message;
              const status = revealStatus(window, eventIndex);
              return (
                <li key={m.requestId} className="sim-msg-row" data-status={status}>
                  <div className="sim-msg-head">
                    <span className="sim-id">{m.correlationId}</span>
                    {m.attempt > 1 && <span className="sim-attempt">attempt {m.attempt}</span>}
                    <span className="sim-status-chip">{status}</span>
                  </div>
                  <div className="sim-msg-op">
                    {CAST_BY_ID[m.sourcePlatform].name} → {CAST_BY_ID[m.targetPlatform].name} · {m.operation}
                  </div>
                  {eventIndex >= window.resolveIndex && (
                    <div className="sim-msg-detail">
                      {m.errorDetails ? (
                        <span className="sim-msg-error">
                          {m.errorDetails.code}: {m.errorDetails.message}
                        </span>
                      ) : (
                        <span>{m.responseSummary}</span>
                      )}
                      <span className="sim-msg-duration">{m.durationMs} ms</span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
