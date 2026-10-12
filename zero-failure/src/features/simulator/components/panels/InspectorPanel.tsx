// Read-only inspector: the structured message history revealed by the
// playhead, plus the connector tables for both modes. Correlation IDs are
// always visible — they are the traceability anchors between animation,
// dashboard and report. Nothing here executes; the registries are static
// description data, and the live table renders probe observations, which the
// Refresh button re-runs on demand.

import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import type { Timeline } from "../../engine/timeline";
import { useRun } from "../../run/RunContext";
import { CAST_BY_ID } from "../../script/cast";
import type { LiveActivityEvent } from "../../live/activity";
import { capabilityFor } from "../../live/capabilities";
import type { LiveProbeState } from "../../live/types";
import { LIVE_PROBES_KEY, useLiveProbes } from "../../live/useLiveProbes";
import { revealStatus, useReveal } from "./reveal";

/** Probe observation → row text. `title` carries the honest detail. */
function liveStatusText(state: LiveProbeState | undefined): { text: string; tone: string; title?: string } {
  if (!state || state.status === "unknown") return { text: "probing…", tone: "unknown" };
  switch (state.status) {
    case "configured":
      return { text: `configured · ${state.latencyMs} ms`, tone: "ok", title: state.detail };
    case "not-configured":
      return { text: "Not configured", tone: "bad", title: state.reason };
    case "unreachable":
      return { text: "Unreachable", tone: "warn", title: state.reason };
  }
}

/** Observed-at clock time, shown alongside each activity line. */
function clockTime(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

export function InspectorPanel({ timeline, liveEvents }: { timeline: Timeline; liveEvents: LiveActivityEvent[] }) {
  const { simulatedRegistry, liveRegistry, scenario, run, mode } = useRun();
  const probes = useLiveProbes();
  const queryClient = useQueryClient();
  const { windows, eventIndex } = useReveal(timeline);
  const revealed = windows.filter((w) => eventIndex >= w.dispatchIndex);

  return (
    <>
      <section className="sim-inspector-section">
        <h3 className="sim-inspector-heading">Scenario</h3>
        <p className="sim-scenario-title">{scenario.title}</p>
        <p className="sim-scenario-hint">
          {run
            ? mode === "live"
              ? `Run ${run.runId} executed against live SELISE Blocks services (read-only)`
              : `Run ${run.runId} executed up-front (deterministic, simulated)`
            : "Executing scenario…"}
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
              <span className="sim-conn-status">{connector.configStatus} · simulated</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="sim-inspector-section">
        <div className="sim-live-head">
          <h3 className="sim-inspector-heading">
            Live connectors <span className="sim-count">({Object.keys(liveRegistry).length})</span>
          </h3>
          <button
            type="button"
            className="sim-conn-refresh"
            onClick={() => queryClient.invalidateQueries({ queryKey: LIVE_PROBES_KEY })}
            disabled={probes.isFetching}
            aria-label="Refresh live connector status"
            title="Re-probe live connectors now"
          >
            <RefreshCw size={12} aria-hidden />
            {probes.isFetching ? "Probing…" : "Refresh"}
          </button>
        </div>
        <ul className="sim-conn-list">
          {Object.values(liveRegistry).map((connector) => {
            const capability = capabilityFor(connector.platform);
            const status =
              capability.kind === "sdk-read"
                ? liveStatusText(probes.data?.[capability.probe])
                : {
                    text: "no live API — simulated",
                    tone: "no-api",
                    title: "No SELISE Blocks API backs this platform — it always runs simulated."
                  };
            return (
              <li key={connector.platform} className="sim-conn-row" data-tone={status.tone} title={status.title}>
                <span className="sim-conn-name">{connector.displayName}</span>
                <span className="sim-conn-status">{status.text}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {mode === "live" && (
        <section className="sim-inspector-section">
          <h3 className="sim-inspector-heading">Live activity</h3>
          {liveEvents.length === 0 ? (
            <p className="sim-scenario-hint">
              Watching the tenant every 20s — schema, language, storage and inbox changes appear here.
            </p>
          ) : (
            <ul className="sim-activity-list">
              {liveEvents.slice(0, 5).map((event) => (
                <li key={event.id} className="sim-activity-row" data-tone={event.tone}>
                  <span className="sim-activity-time">{clockTime(event.at)}</span>
                  <span className="sim-activity-label">{event.label}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

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
