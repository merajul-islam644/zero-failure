// The run-panel deck's right-rail seat for every page outside the
// simulator. The PANEL button is the shared face — the simulator's own
// StatusRail uses it too, wired to the stage deck — but here the control
// provisions its own stack on open: settings, the pre-executed run, the
// clock and the broadcast actions, exactly the providers the simulator
// mounts around its stage. The deck therefore unfolds in place on any
// page with nothing mounted beneath it, and closing folds the whole
// stack away again.

import { useMemo, useState } from "react";
import { Settings } from "lucide-react";
import { SCENES } from "../../script/scenes";
import { buildTimeline } from "../../engine/timeline";
import type { Timeline } from "../../engine/timeline";
import type { LiveActivityEvent } from "../../live/activity";
import { SettingsProvider } from "../../state/SettingsContext";
import { PlayerProvider } from "../../state/PlayerContext";
import { RunProvider, useRun } from "../../run/RunContext";
import { useLiveActivity } from "../../live/useLiveActivity";
import { useBroadcast } from "../../live/broadcast/useBroadcast";
import { useBroadcastActions } from "../../live/broadcast/useBroadcastActions";
import { PanelDeck } from "./PanelDeck";

/** The PANEL seat's shared face: the simulator's StatusRail toggles the
 *  stage deck with it; every other page toggles this control's own
 *  provisioned stack. */
export function RunPanelsButton({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={`sim-rail-btn${on ? " sim-rail-btn-on" : ""}`}
      aria-pressed={on}
      aria-label="Toggle the run panels"
      title="Run panels — Inspector, Results, Evidence, Config"
      onClick={onToggle}
    >
      <span className="sim-rail-btn-face">
        <Settings size={17} strokeWidth={1.8} aria-hidden />
        <span className="sim-rail-btn-tag">PANEL</span>
      </span>
    </button>
  );
}

export function RunPanelsControl() {
  const [open, setOpen] = useState(false);
  return (
    <div className="sim-rail-slot">
      <RunPanelsButton on={open} onToggle={() => setOpen((cur) => !cur)} />
      {open && (
        <SettingsProvider>
          <RunProvider>
            <RunPanelsSheet onClose={() => setOpen(false)} />
          </RunProvider>
        </SettingsProvider>
      )}
    </div>
  );
}

function RunPanelsSheet({ onClose }: { onClose: () => void }) {
  const { run, mode } = useRun();
  // Same fold as the simulator: budgets depend only on the beats, so the
  // span is identical whether the run has landed yet or not — the deck
  // never renders against a jumping clock.
  const timeline = useMemo(() => buildTimeline(SCENES, run), [run]);
  const activity = useLiveActivity(mode === "live");
  return (
    <PlayerProvider duration={timeline.totalMs}>
      <RunPanelsDeck timeline={timeline} liveEvents={activity.events} onClose={onClose} />
    </PlayerProvider>
  );
}

function RunPanelsDeck({
  timeline,
  liveEvents,
  onClose
}: {
  timeline: Timeline;
  liveEvents: LiveActivityEvent[];
  onClose: () => void;
}) {
  const broadcast = useBroadcast();
  const actions = useBroadcastActions(broadcast);
  // Open for its whole mounted life: the button owns open/close here —
  // the drawer's ✕ and Escape fold the whole provisioned stack away.
  return (
    <PanelDeck timeline={timeline} liveEvents={liveEvents} actions={actions} open onClose={onClose} />
  );
}
