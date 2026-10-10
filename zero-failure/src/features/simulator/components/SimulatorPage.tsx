// The simulator screen — public route ("/"). RunProvider pre-executes the
// selected scenario up-front; the timeline compiles from its structured
// messages, so playback is a pure fold over real results. Composes the
// engine: clock via PlayerProvider, canvas, overlay, subtitles, transport,
// audio (opt-in) and the panel deck.

import { useEffect, useMemo } from "react";
import { SCENES } from "../script/scenes";
import { buildTimeline } from "../engine/timeline";
import type { Timeline } from "../engine/timeline";
import { PlayerProvider, usePlayer } from "../state/PlayerContext";
import { RunProvider, useRun } from "../run/RunContext";
import { SettingsProvider } from "../state/SettingsContext";
import { CommandCanvas } from "./canvas/CommandCanvas";
import { SceneOverlay } from "./canvas/SceneOverlay";
import { SimulationBadge } from "./SimulationBadge";
import { SubtitleBar } from "./SubtitleBar";
import { TransportBar, SPEEDS } from "./transport/TransportBar";
import { AudioLayer } from "./AudioLayer";
import { PanelDeck } from "./panels/PanelDeck";
import "../styles/simulator.css";

const SKIP_MS = 10000;

export function SimulatorPage() {
  return (
    <SettingsProvider>
      <RunProvider>
        <SimulatorScreen />
      </RunProvider>
    </SettingsProvider>
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
  const { clock, restart } = usePlayer();

  // Full playback map. Ignored while typing in form fields and never with
  // modifier keys (no hijacking browser shortcuts).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
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
      switch (e.code) {
        case "Space":
          e.preventDefault();
          clock.toggle();
          break;
        case "ArrowLeft":
          e.preventDefault();
          clock.step(-SKIP_MS);
          break;
        case "ArrowRight":
          e.preventDefault();
          clock.step(SKIP_MS);
          break;
        case "ArrowUp":
        case "ArrowDown": {
          e.preventDefault();
          const current = nearestSpeedIndex(clock.playbackRate);
          const next = e.code === "ArrowUp" ? current + 1 : current - 1;
          const clamped = Math.min(SPEEDS.length - 1, Math.max(0, next));
          clock.setRate(SPEEDS[clamped] ?? 1);
          break;
        }
        case "PageDown":
        case "PageUp": {
          e.preventDefault();
          const targetMs = sceneJumpMs(timeline, clock.time, e.code === "PageDown");
          clock.seek(targetMs);
          break;
        }
        case "Home":
          e.preventDefault();
          clock.seek(0);
          break;
        case "End":
          e.preventDefault();
          clock.seek(timeline.totalMs);
          break;
        case "KeyR":
          e.preventDefault();
          restart();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clock, restart, timeline]);

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
      <AudioLayer timeline={timeline} />
    </div>
  );
}

function nearestSpeedIndex(rate: number): number {
  let best = 0;
  let bestDelta = Number.POSITIVE_INFINITY;
  SPEEDS.forEach((speed, i) => {
    const delta = Math.abs(speed - rate);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = i;
    }
  });
  return best;
}

/** Next/previous scene start; "previous" returns to this scene's start first. */
function sceneJumpMs(timeline: Timeline, time: number, forward: boolean): number {
  const scenes = timeline.scenes;
  if (scenes.length === 0) return time;
  let index = 0;
  for (let i = 0; i < scenes.length; i += 1) {
    const scene = scenes[i];
    if (scene && scene.startMs <= time) index = i;
    else break;
  }
  if (forward) {
    const next = scenes[index + 1];
    return next ? next.startMs : timeline.totalMs;
  }
  const scene = scenes[index];
  if (scene && time - scene.startMs > 2000) return scene.startMs;
  const previous = scenes[index - 1];
  return previous ? previous.startMs : 0;
}
