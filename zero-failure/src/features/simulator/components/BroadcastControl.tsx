// Broadcast control: the topbar on/off switch for shared viewing plus an
// honest status line. Everything it can't do is said plainly — no tenant
// collection, no permission, a failed write — because a quietly dead sync
// toggle reads as a bug, not as a setup step.

import { RadioTower } from "lucide-react";
import type { BroadcastApi } from "../live/broadcast/useBroadcast";

export function BroadcastControl({ broadcast }: { broadcast: BroadcastApi }) {
  const { enabled, setEnabled, readiness, broadcast: doc, writeError, displayName } = broadcast;

  const status = !enabled
    ? "Off — playback is yours alone"
    : !readiness
      ? "Checking the tenant…"
      : !readiness.ready
        ? (readiness.reason ?? "Unavailable on this tenant")
        : doc
          ? doc.updatedBy === displayName
            ? "Presenting — others follow your head"
            : `Following ${doc.updatedBy} — ${doc.playing ? "playing" : "paused"}`
          : "Waiting for someone to move the shared head…";

  return (
    <div className="sim-broadcast" title={writeError ? `Last write failed: ${writeError}` : status}>
      <button
        type="button"
        className={`sim-mode-toggle${enabled ? " sim-mode-live" : ""}`}
        onClick={() => setEnabled(!enabled)}
        aria-pressed={enabled}
        title={
          enabled
            ? "Stop following the shared playback head"
            : "Follow (and publish) the shared playback head"
        }
      >
        <RadioTower size={14} aria-hidden />
        <span>Broadcast</span>
      </button>
      <span className="sim-broadcast-status" data-state={writeError ? "error" : enabled ? "on" : "off"}>
        {writeError ? `Write failed — ${writeError}` : status}
      </span>
    </div>
  );
}
