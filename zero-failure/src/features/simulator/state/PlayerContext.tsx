// Player state: owns the SequencerClock instance for the app lifetime of the
// timeline. StrictMode-safety rule: the clock is created once in a ref and
// every effect only subscribes/unsubscribes — the double-mounted effect never
// creates, seeks or starts anything.
//
// Per-frame consumers (PacketLayer, TimelineStrip playhead, progress bar) use
// usePlaybackTime(); discrete UI (subtitle, scene title, buttons) uses
// useEventIndex() which re-renders only when the visible event changes.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode
} from "react";
import { SequencerClock } from "../engine/clock";
import { deriveStateAt, eventIndexAt } from "../engine/select";
import type { DerivedState, TimelineEvent } from "../engine/types";
import { PLATFORMS } from "../script/cast";

interface PlayerContextValue {
  clock: SequencerClock;
  playing: boolean;
  duration: number;
  restart: () => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({
  duration,
  children
}: {
  duration: number;
  children: ReactNode;
}) {
  const clockRef = useRef<SequencerClock | null>(null);
  if (clockRef.current === null) {
    clockRef.current = new SequencerClock(duration);
  }
  const clock = clockRef.current;

  const [playing, setPlaying] = useState(false);

  // Resize-safe: if the timeline is rebuilt with a different span, keep the
  // head sane. Runs on every duration change only.
  useEffect(() => {
    clock.setDuration(duration);
  }, [clock, duration]);

  // Subscribe once; React state only flips when playing flips.
  useEffect(() => {
    return clock.subscribe((_, isPlaying) => {
      setPlaying((prev) => (prev === isPlaying ? prev : isPlaying));
    });
  }, [clock]);

  // Never keep playing through a hidden tab — the rAF loop stops firing and
  // the story would desync from any live counterpart later.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") clock.pause();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [clock]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      clock,
      playing,
      duration: clock.duration,
      restart: () => clock.restart()
    }),
    [clock, playing]
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return ctx;
}

/** Per-frame playback head. Only for the designated per-frame layers:
 *  SolarNodeLayer, PacketLayer and LivePulseLayer. */
export function usePlaybackTime(): number {
  const { clock } = usePlayer();
  return useSyncExternalStore(
    (onChange) => clock.subscribe(() => onChange()),
    () => clock.time,
    () => 0
  );
}

// ---- orbit time ----
// The sky rides the story head while it plays, and keeps advancing on wall
// time whenever the head is parked — dialogue beats, checkpoints, manual
// pause — so the planets never freeze mid-sentence. Seeking snaps the sky
// back onto the story head; a hidden tab pauses the drift (rAF stops, same
// rule as the clock's own frame clamp).
//
// The rAF loop deliberately has no listener-count teardown: React re-runs
// subscribe effects around commits (and StrictMode double-mounts), and a
// momentary empty listener set must not discard the accumulated drift —
// the loop just keeps ticking until the clock itself is garbage collected.

interface OrbitLoop {
  listeners: Set<() => void>;
  raf: number;
  lastWall: number;
  lastPlaying: boolean;
  /** Story head at the moment the clock paused. */
  pausedFrom: number;
  /** Wall ms accumulated while paused (per-frame clamped like the clock). */
  credit: number;
  cached: number;
}

const orbitLoops = new WeakMap<SequencerClock, OrbitLoop>();

function orbitSnapshot(clock: SequencerClock): number {
  return orbitLoops.get(clock)?.cached ?? clock.time;
}

function orbitSubscribe(clock: SequencerClock, onChange: () => void): () => void {
  let existing = orbitLoops.get(clock);
  if (!existing) {
    existing = {
      listeners: new Set(),
      raf: 0,
      lastWall: performance.now(),
      lastPlaying: clock.isPlaying,
      pausedFrom: clock.time,
      credit: 0,
      cached: clock.time
    };
    orbitLoops.set(clock, existing);
    const loop = existing;
    const frame = (now: number) => {
      const delta = Math.min(now - loop.lastWall, 250);
      loop.lastWall = now;
      if (clock.isPlaying) {
        loop.credit = 0;
        loop.cached = clock.time;
      } else {
        if (loop.lastPlaying) loop.pausedFrom = clock.time;
        loop.credit += delta;
        loop.cached = loop.pausedFrom + loop.credit;
      }
      loop.lastPlaying = clock.isPlaying;
      loop.raf = requestAnimationFrame(frame);
      for (const listener of loop.listeners) listener();
    };
    loop.raf = requestAnimationFrame(frame);
  }
  const loop = existing;
  loop.listeners.add(onChange);
  return () => {
    orbitLoops.get(clock)?.listeners.delete(onChange);
  };
}

/** Per-frame sky time for the designated canvas layers: story head while
 *  playing, story head + paused-wall-drift otherwise. */
export function useOrbitTime(): number {
  const { clock } = usePlayer();
  // Stable identities: a fresh arrow here would resubscribe (and, before the
  // no-teardown rule, tear down the loop) around every commit.
  const subscribe = useCallback((onChange: () => void) => orbitSubscribe(clock, onChange), [clock]);
  const getSnapshot = useCallback(() => orbitSnapshot(clock), [clock]);
  return useSyncExternalStore(subscribe, getSnapshot, () => 0);
}

/** Playback rate — re-renders only when the speed actually changes
 * (Speed select, keyboard ↑/↓). */
export function usePlaybackRate(): number {
  const { clock } = usePlayer();
  return useSyncExternalStore(
    (onChange) => clock.subscribe(() => onChange()),
    () => clock.playbackRate,
    () => 1
  );
}

/**
 * Re-renders only when the event under the head changes — for subtitle,
 * scene title, state-driven node styling and the transport's discrete UI.
 */
export function useEventIndex(events: TimelineEvent[]): number {
  const { clock } = usePlayer();
  const indexRef = useRef(-2);
  const [index, setIndex] = useState(() => eventIndexAt(events, clock.time));
  indexRef.current = index;

  useEffect(() => {
    return clock.subscribe((t) => {
      const next = eventIndexAt(events, t);
      if (next !== indexRef.current) {
        indexRef.current = next;
        setIndex(next);
      }
    });
    // events identity is stable per compiled timeline (memoized upstream)
  }, [clock, events]);

  return index;
}

/**
 * Full derived snapshot with change-gating: deriveStateAt runs per frame
 * (cheap fold) but React re-renders only when anything visible differs —
 * scene, subtitle, note or any character state. Canvas and panels share one
 * subscription instead of each holding their own per-frame loop.
 */
export function useSimSnapshot(events: TimelineEvent[]): DerivedState {
  const { clock } = usePlayer();
  const sigRef = useRef("");
  const [snapshot, setSnapshot] = useState(() => deriveStateAt(events, clock.time, PLATFORMS));

  useEffect(() => {
    return clock.subscribe((t) => {
      const next = deriveStateAt(events, t, PLATFORMS);
      const sig = [
        next.eventIndex,
        next.dialogue?.id ?? "-",
        next.note ?? "-",
        next.scene?.index ?? -1,
        Object.values(next.states).join("")
      ].join("|");
      if (sig !== sigRef.current) {
        sigRef.current = sig;
        setSnapshot(next);
      }
    });
  }, [clock, events]);

  return snapshot;
}
