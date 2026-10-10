// "Replay one request": find an operation's window on the timeline and have
// the clock play exactly from slightly before its dispatch to its resolution.

import type { Timeline } from "./timeline";
import type { StructuredMessage } from "./types";

const PRE_ROLL_MS = 750;

export interface ReplayTarget {
  correlationId: string;
  requestId: string;
  fromMs: number;
  untilMs: number;
  attempt: number;
}

/** All attempts of one correlation, in dispatch order. */
export function attemptsFor(timeline: Timeline, correlationId: string): StructuredMessage[] {
  return timeline.messageWindows
    .filter((w) => w.message.correlationId === correlationId)
    .map((w) => w.message)
    .sort((a, b) => a.timestamp - b.timestamp);
}

/** Play window for the full chain of one correlation (dispatch of first attempt). */
export function replayWindow(timeline: Timeline, correlationId: string): ReplayTarget | null {
  const windows = timeline.messageWindows.filter(
    (w) => w.message.correlationId === correlationId
  );
  if (windows.length === 0) return null;
  const firstDispatch = Math.min(...windows.map((w) => w.dispatchMs));
  const lastResolve = Math.max(...windows.map((w) => w.resolveMs));
  const chain = attemptsFor(timeline, correlationId);
  const last = chain[chain.length - 1];
  return {
    correlationId,
    requestId: last?.requestId ?? correlationId,
    fromMs: Math.max(0, firstDispatch - PRE_ROLL_MS),
    untilMs: lastResolve,
    attempt: last?.attempt ?? 1
  };
}

/** Distinct correlations in dispatch order — the Inspector's request list. */
export function correlationIds(timeline: Timeline): string[] {
  const seen: string[] = [];
  for (const w of timeline.messageWindows) {
    if (!seen.includes(w.message.correlationId)) seen.push(w.message.correlationId);
  }
  return seen;
}
