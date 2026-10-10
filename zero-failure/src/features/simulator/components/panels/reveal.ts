// Shared playhead-reveal logic: a message becomes visible when its dispatch
// event has fired, and its final status only after the resolve event — the
// inspector never leaks the ending early.

import { useMemo } from "react";
import type { MessageStatus, StructuredMessage } from "../../engine/types";
import type { Timeline } from "../../engine/timeline";
import { useEventIndex } from "../../state/PlayerContext";

export interface RevealWindow {
  message: StructuredMessage;
  dispatchSeq: number;
  arriveSeq: number;
  resolveSeq: number;
}

/** Status shown before the exchange resolves — never leak the final answer. */
export function revealStatus(window: RevealWindow, eventIndex: number): MessageStatus {
  if (eventIndex >= window.resolveSeq) return window.message.status;
  if (eventIndex >= window.arriveSeq) return "processing";
  return "in-flight";
}

export function buildRevealWindows(timeline: Timeline): RevealWindow[] {
  const byRequest = new Map<string, RevealWindow>();
  for (const event of timeline.events) {
    if (event.kind === "message-dispatch") {
      byRequest.set(event.message.requestId, {
        message: event.message,
        dispatchSeq: event.seq,
        arriveSeq: Number.MAX_SAFE_INTEGER,
        resolveSeq: Number.MAX_SAFE_INTEGER
      });
    } else if (event.kind === "message-arrive") {
      const window = byRequest.get(event.messageId);
      if (window) window.arriveSeq = event.seq;
    } else if (event.kind === "message-resolve") {
      const window = byRequest.get(event.messageId);
      if (window) window.resolveSeq = event.seq;
    }
  }
  return [...byRequest.values()].sort((a, b) => a.dispatchSeq - b.dispatchSeq);
}

/** Memoized windows + the current event index for a panel. */
export function useReveal(timeline: Timeline): { windows: RevealWindow[]; eventIndex: number } {
  const windows = useMemo(() => buildRevealWindows(timeline), [timeline]);
  const eventIndex = useEventIndex(timeline.events);
  return { windows, eventIndex };
}
