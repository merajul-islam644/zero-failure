// The simulator screen — public route ("/"). Composes the engine: compile
// the timeline once (memo), own the clock via PlayerProvider, render canvas,
// overlay, subtitles and transport. Panel stack (dashboard/inspector/config)
// joins in M3/M4.

import { useMemo } from "react";
import { SCENES } from "../script/scenes";
import { buildTimeline } from "../engine/timeline";
import { PlayerProvider } from "../state/PlayerContext";
import { CommandCanvas } from "./canvas/CommandCanvas";
import { SceneOverlay } from "./canvas/SceneOverlay";
import { SimulationBadge } from "./SimulationBadge";
import { SubtitleBar } from "./SubtitleBar";
import { TransportBar } from "./transport/TransportBar";
import "../styles/simulator.css";

export function SimulatorPage() {
  // run=null in M1: placeholder envelopes. M3 passes the RunRunner result.
  const timeline = useMemo(() => buildTimeline(SCENES, null), []);

  return (
    <PlayerProvider duration={timeline.totalMs}>
      <div className="simulator-root">
        <SimulationBadge />
        <main className="sim-stage">
          <CommandCanvas timeline={timeline} />
          <SceneOverlay timeline={timeline} />
        </main>
        <SubtitleBar timeline={timeline} />
        <TransportBar duration={timeline.totalMs} />
      </div>
    </PlayerProvider>
  );
}
