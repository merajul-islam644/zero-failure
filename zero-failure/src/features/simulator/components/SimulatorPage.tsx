// The simulator screen — mounted at "/" behind RequireAuth. RunProvider
// pre-executes the
// selected scenario up-front; the timeline compiles from its structured
// messages, so playback is a pure fold over real results. Composes the
// engine: clock via PlayerProvider, canvas, overlay, subtitles, transport,
// audio (opt-in) and the panel deck.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { SCENES } from "../script/scenes";
import { buildTimeline } from "../engine/timeline";
import type { Timeline } from "../engine/timeline";
import type { LiveActivityEvent } from "../live/activity";
import { useLiveActivity } from "../live/useLiveActivity";
import { useBroadcast } from "../live/broadcast/useBroadcast";
import { useBroadcastActions } from "../live/broadcast/useBroadcastActions";
import { PlayerProvider, usePlayer } from "../state/PlayerContext";
import { RunProvider, useRun } from "../run/RunContext";
import { SettingsProvider } from "../state/SettingsContext";
import { CommandCanvas } from "./canvas/CommandCanvas";
import { SceneOverlay } from "./canvas/SceneOverlay";
import { AccountBar } from "./AccountBar";
import { SimulationBadge } from "./SimulationBadge";
import { LiveHonestyStrip, LiveModeToggle } from "./LiveModeControl";
import { BroadcastControl } from "./BroadcastControl";
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
  const { run, mode } = useRun();
  // Compiled from the pre-executed run: same envelopes the dashboard and
  // report see. Budgets depend only on the beats, so the span is identical
  // whether run has landed yet or not — the clock never jumps.
  const timeline = useMemo(() => buildTimeline(SCENES, run), [run]);
  // One live-activity instance for the whole page: it owns the 20s tenant
  // poll; the canvas and the Inspector both render from its event list.
  const activity = useLiveActivity(mode === "live");

  return (
    <PlayerProvider duration={timeline.totalMs}>
      <SimulatorStage timeline={timeline} liveEvents={activity.events} />
    </PlayerProvider>
  );
}

function SimulatorStage({ timeline, liveEvents }: { timeline: Timeline; liveEvents: LiveActivityEvent[] }) {
  const { clock } = usePlayer();
  const { mode } = useRun();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const box = useMeetBox(stageRef);
  // Broadcast owns the room (poll + publish); actions wraps every transport
  // call so local moves reach the shared head. Off, they are plain clock
  // calls — zero behavior change.
  const broadcast = useBroadcast();
  const actions = useBroadcastActions(broadcast);

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
          actions.togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          actions.step(-SKIP_MS);
          break;
        case "ArrowRight":
          e.preventDefault();
          actions.step(SKIP_MS);
          break;
        case "ArrowUp":
        case "ArrowDown": {
          e.preventDefault();
          const current = nearestSpeedIndex(clock.playbackRate);
          const next = e.code === "ArrowUp" ? current + 1 : current - 1;
          const clamped = Math.min(SPEEDS.length - 1, Math.max(0, next));
          const rate = SPEEDS[clamped];
          if (rate !== undefined) actions.setRate(rate);
          break;
        }
        case "PageDown":
        case "PageUp": {
          e.preventDefault();
          const targetMs = sceneJumpMs(timeline, clock.time, e.code === "PageDown");
          actions.seek(targetMs);
          break;
        }
        case "Home":
          e.preventDefault();
          actions.seek(0);
          break;
        case "End":
          e.preventDefault();
          actions.seek(timeline.totalMs);
          break;
        case "KeyR":
          e.preventDefault();
          actions.restart();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions, clock, timeline]);

  return (
    <div className="simulator-root">
      <div className="sim-topbar">
        {/* Exactly one honesty strip: the live strip replaces this one while
            live, whose "no real services are contacted" claim would be false. */}
        {mode === "live" ? <LiveHonestyStrip /> : <SimulationBadge />}
        <LiveModeToggle onModeChange={actions.publishMode} />
        <BroadcastControl broadcast={broadcast} />
        <AccountBar />
      </div>
      <div className="sim-main">
        <main className="sim-stage">
          <SceneOverlay timeline={timeline} />
          {/* Exactly 16:9, centered in the area below the header strip. The
              scene heading and stage note live in that strip — flow content,
              never floating over the constellation. */}
          <div className="sim-canvas-area" ref={stageRef}>
            <div className="sim-canvas-frame" style={{ width: box.w, height: box.h }}>
              <CommandCanvas timeline={timeline} liveEvents={liveEvents} />
            </div>
          </div>
        </main>
        <PanelDeck timeline={timeline} liveEvents={liveEvents} actions={actions} />
      </div>
      <SubtitleBar timeline={timeline} />
      <TransportBar timeline={timeline} actions={actions} />
      {/* Narration's audiobook pauses/resumes publish too: the presenter's
          speech rhythm is the room's rhythm, and a follower's own narration
          pause is never overridden by a stale "playing" doc mid-line. */}
      <AudioLayer
        timeline={timeline}
        onNarrationPause={actions.narrationPause}
        onNarrationResume={actions.narrationResume}
      />
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

/**
 * The stage's "xMidYMid meet" box: the largest 16:9 rectangle that fits.
 * Pure layout math via ResizeObserver — no container queries, which misresolve
 * against flex columns mid-layout. Measured in a layout effect so the first
 * paint is already correct.
 */
function useMeetBox(ref: RefObject<HTMLElement | null>): { w: number; h: number } {
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const stage = ref.current;
    if (!stage) return;
    const measure = () => {
      const { width, height } = stage.getBoundingClientRect();
      // Floor both: rounding up could exceed the stage by a pixel and spawn
      // scrollbars (margin:auto centering amplifies any excess).
      const w = Math.floor(Math.min(width, (height * 16) / 9));
      const h = Math.floor((w * 9) / 16);
      setBox((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [ref]);
  return box;
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
