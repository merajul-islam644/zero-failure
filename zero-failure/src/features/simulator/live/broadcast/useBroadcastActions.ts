// Transport wrappers that publish each local action to the shared head.
// When Broadcast is off (or the tenant isn't ready) `publish` no-ops inside
// useBroadcast, so these wrappers are plain clock calls — zero behavior
// change, one code path. Consumers: TransportBar, the keyboard handler,
// ConfigPanel (scenario + rerun) and LiveModeControl (mode flips).

import { useMemo } from "react";
import { usePlayer } from "../../state/PlayerContext";
import { useRun } from "../../run/RunContext";
import type { ExecutionMode } from "../../engine/types";
import type { BroadcastApi } from "./useBroadcast";
export interface BroadcastActions {
  togglePlay: () => void;
  seek: (headMs: number) => void;
  step: (deltaMs: number) => void;
  setRate: (rate: number) => void;
  restart: () => void;
  playUntil: (fromMs: number, untilMs: number) => Promise<unknown>;
  selectScenario: (id: string) => void;
  rerun: () => void;
  /** Publishes a mode change to the room; the LOCAL flip stays with the settings store. */
  publishMode: (mode: ExecutionMode) => void;
  /**
   * Narration's audiobook pauses/resumes — published so the room shares the
   * story's real rhythm and a follower's own narration pause is never
   * overridden by a "playing" doc mid-line.
   */
  narrationPause: () => void;
  narrationResume: () => void;
}

export function useBroadcastActions(broadcast: BroadcastApi): BroadcastActions {
  const { clock, restart } = usePlayer();
  const { selectScenario, rerun } = useRun();
  const { publish } = broadcast;

  return useMemo<BroadcastActions>(
    () => ({
      togglePlay: () => {
        clock.toggle();
        publish({ playing: clock.isPlaying, headMs: clock.time, force: true });
      },
      seek: (headMs) => {
        clock.seek(headMs);
        publish({ headMs: clock.time });
      },
      step: (deltaMs) => {
        clock.step(deltaMs);
        publish({ headMs: clock.time, force: true });
      },
      setRate: (rate) => {
        clock.setRate(rate);
        publish({ rate, force: true });
      },
      restart: () => {
        restart();
        publish({ headMs: 0, playing: true, force: true });
      },
      playUntil: (fromMs, untilMs) => {
        const stopped = clock.playUntil(fromMs, untilMs);
        publish({ headMs: fromMs, playing: true, force: true });
        return stopped;
      },
      selectScenario: (id) => {
        selectScenario(id);
        clock.restart();
        publish({ scenarioId: id, headMs: 0, playing: true, force: true });
      },
      rerun: () => {
        rerun();
        clock.restart();
        publish({ headMs: 0, playing: true, force: true });
      },
      publishMode: (mode) => {
        publish({ mode, force: true });
      },
      narrationPause: () => {
        // Rhythm is the presenter's to share. A follower's own narration
        // loop runs a beat off the room's (4s polls can't phase-lock two
        // speech engines) — publishing it would flip-flop the room's
        // play/pause at every dialogue line. And a hidden tab's audio is
        // interrupted by the browser every few seconds; publishing that
        // churn would fill the room with pauses nobody authored.
        const doc = broadcast.broadcast;
        if (!doc || doc.updatedBy === broadcast.displayName) {
          if (document.visibilityState !== "visible") return;
          publish({ playing: false, headMs: clock.time, force: true });
        }
      },
      narrationResume: () => {
        const doc = broadcast.broadcast;
        if (!doc || doc.updatedBy === broadcast.displayName) {
          if (document.visibilityState !== "visible") return;
          publish({ playing: true, headMs: clock.time, force: true });
        }
      }
    }),
    [broadcast, clock, restart, selectScenario, rerun, publish]
  );
}
