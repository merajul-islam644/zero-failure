// Pure broadcast-sync math: project the shared head from a broadcast
// document, decide what a slave clock should do about its drift, and build
// whole-document writes. No React, no timers, no network — useBroadcast feeds
// it the local clock and the latest doc and applies the returned command.

import type { ExecutionMode } from "../../engine/types";import { BROADCAST_RATES, type BroadcastState } from "./schema";

/** |drift| at or below this is left alone — polling jitter, not intent. */
export const SYNC_NOOP_BAND_MS = 400;
/** Drift up to this is corrected gently (halfway toward the broadcast head). */
export const SYNC_NUDGE_BAND_MS = 2_500;

export type ReconcileCommand =
  | { type: "noop" }
  | { type: "seek"; headMs: number }
  | { type: "play"; headMs: number }
  | { type: "pause" }
  | { type: "rate"; rate: number; headMs: number };

function clampHead(headMs: number, durationMs: number | undefined): number {
  let clamped = Math.max(0, headMs);
  if (durationMs !== undefined) clamped = Math.min(clamped, durationMs);
  return clamped;
}

/**
 * Where the shared head stands at nowMs. Playing docs project from the
 * epoch; paused docs hold still. Clamps to [0, durationMs] when a duration
 * is given — a master parked at the end must not drag slaves past it.
 */
export function headAt(state: BroadcastState, nowMs: number, durationMs?: number): number {
  if (!state.playing) return clampHead(state.headMs, durationMs);
  return clampHead(state.headMs + (nowMs - state.epochMs) * state.rate, durationMs);
}

export interface ReconcileInput {
  localHeadMs: number;
  localPlaying: boolean;
  localRate: number;
  broadcast: BroadcastState;
  /** The reader's wall clock at the moment of comparison. */
  nowMs: number;
  durationMs: number;
}

/**
 * Compare the local clock against a broadcast document and return one
 * command. Playing-state mismatches win first (that is what play/pause
 * buttons mean); then rate, then position — noop inside the jitter band, a
 * half-way nudge inside the wander band, a hard seek beyond it.
 */
export function reconcile(input: ReconcileInput): ReconcileCommand {
  const { localHeadMs, localPlaying, localRate, broadcast, nowMs, durationMs } = input;

  if (broadcast.playing !== localPlaying) {
    return broadcast.playing
      ? { type: "play", headMs: headAt(broadcast, nowMs, durationMs) }
      : { type: "pause" };
  }

  const target = headAt(broadcast, nowMs, durationMs);

  if (localPlaying && Math.abs(broadcast.rate - localRate) > 1e-9) {
    // Seek too: the projection origin moves under us once the rate changes.
    return { type: "rate", rate: broadcast.rate, headMs: target };
  }

  const drift = localHeadMs - target;
  if (Math.abs(drift) <= SYNC_NOOP_BAND_MS) return { type: "noop" };
  if (localPlaying && Math.abs(drift) <= SYNC_NUDGE_BAND_MS) {
    return { type: "seek", headMs: localHeadMs - drift / 2 };
  }
  // Paused drift beyond the band, or playing drift beyond the wander band:
  // jump straight to the shared head.
  return { type: "seek", headMs: target };
}

export interface BroadcastWriteInput {
  /** The doc currently known (null before the first read) — only its rev is reused. */
  current: BroadcastState | null;
  headMs: number;
  playing: boolean;
  rate: number;
  scenarioId: string;
  mode: ExecutionMode;
  nowMs: number;
  /** The writer's display name — the only identity this doc carries. */
  displayName: string;
}

/**
 * Author a complete replacement document. Whole-doc on purpose: a partial
 * write could not express "everything else unchanged" over last-writer-wins,
 * and a missing field would read as corruption on the other side.
 */
export function buildBroadcastWrite(input: BroadcastWriteInput): BroadcastState {
  return {
    epochMs: input.nowMs,
    headMs: input.headMs,
    playing: input.playing,
    rate: input.rate,
    scenarioId: input.scenarioId,
    mode: input.mode,
    updatedAt: input.nowMs,
    updatedBy: input.displayName,
    rev: (input.current?.rev ?? 0) + 1
  };
}

/** True when the rate is one the TransportBar offers — guards remote writes. */
export function isBroadcastRate(rate: number): boolean {
  return BROADCAST_RATES.includes(rate);
}
