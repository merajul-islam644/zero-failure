// The simulator screen — public route ("/"). Composes the engine: compile
// the timeline once (memo), own the clock via PlayerProvider, render canvas,
// overlay, subtitles and transport. Panel stack (dashboard/inspector/config)
// joins in M3/M4.

import { useEffect, useMemo } from "react";
import { SCENES } from "../script/scenes";
import { buildTimeline } from "../engine/timeline";
import type { Timeline } from "../engine/timeline";
import { PlayerProvider, usePlayer } from "../state/PlayerContext";
import { CommandCanvas } from "./canvas/CommandCanvas";
import { SceneOverlay } from "./canvas/SceneOverlay";
import { SimulationBadge } from "./SimulationBadge";
import { SubtitleBar } from "./SubtitleBar";
import { TransportBar } from "./transport/TransportBar";
import "../styles/simulator.css";

const SKIP_MS = 10000;

export function SimulatorPage() {
  // run=null until M3: exchange envelopes are placeholders the runner replaces.
  const timeline = useMemo(() => buildTimeline(SCENES, null), []);

  return (
    <PlayerProvider duration={timeline.totalMs}>
      <SimulatorStage timeline={timeline} />
    </PlayerProvider>
  );
}

function SimulatorStage({ timeline }: { timeline: Timeline }) {
  const { clock } = usePlayer();

  // Playback keys (M5 adds the full map): Space toggles, ←/→ skip ±10 s.
  // Ignored while typing in form fields.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "SELECT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        clock.toggle();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        clock.step(-SKIP_MS);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        clock.step(SKIP_MS);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clock]);

  return (
    <div className="simulator-root">
      <SimulationBadge />
      <main className="sim-stage">
        <CommandCanvas timeline={timeline} />
        <SceneOverlay timeline={timeline} />
      </main>
      <SubtitleBar timeline={timeline} />
      <TransportBar timeline={timeline} />
    </div>
  );
}
