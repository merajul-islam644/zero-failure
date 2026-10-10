// The simulator screen — public route ("/"). RunProvider pre-executes the
// selected scenario up-front; the timeline compiles from its structured
// messages, so playback is a pure fold over real results. Composes the
// engine: clock via PlayerProvider, canvas, overlay, subtitles, transport
// and the read-only inspector.

import { useEffect, useMemo } from "react";
import { SCENES } from "../script/scenes";
import { buildTimeline } from "../engine/timeline";
import type { Timeline } from "../engine/timeline";
import { PlayerProvider, usePlayer } from "../state/PlayerContext";
import { RunProvider, useRun } from "../run/RunContext";
import { CommandCanvas } from "./canvas/CommandCanvas";
import { SceneOverlay } from "./canvas/SceneOverlay";
import { SimulationBadge } from "./SimulationBadge";
import { SubtitleBar } from "./SubtitleBar";
import { TransportBar } from "./transport/TransportBar";
import { PanelDeck } from "./panels/PanelDeck";
import "../styles/simulator.css";

const SKIP_MS = 10000;

export function SimulatorPage() {
  return (
    <RunProvider>
      <SimulatorScreen />
    </RunProvider>
  );
}

function SimulatorScreen() {
  const { run } = useRun();
  // Compiled from the pre-executed run: same envelopes the dashboard and
  // report see. Budgets depend only on the beats, so the span is identical
  // whether run has landed yet or not — the clock never jumps.
  const timeline = useMemo(() => buildTimeline(SCENES, run), [run]);

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
      <div className="sim-main">
        <main className="sim-stage">
          <CommandCanvas timeline={timeline} />
          <SceneOverlay timeline={timeline} />
        </main>
        <PanelDeck timeline={timeline} />
      </div>
      <SubtitleBar timeline={timeline} />
      <TransportBar timeline={timeline} />
    </div>
  );
}
