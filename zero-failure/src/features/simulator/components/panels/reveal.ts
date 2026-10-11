// Shared playhead-reveal logic: a message becomes visible when its dispatch
// event has fired, and its final status only after the resolve event — the
// inspector never leaks the ending early.

import { useMemo } from "react";
import type { MessageStatus, StructuredMessage } from "../../engine/types";
import type { Timeline } from "../../engine/timeline";
import { useEventIndex } from "../../state/PlayerContext";

export interface RevealWindow {
  message: StructuredMessage;
  // Positions in the sorted timeline.events array — the same scale as
  // eventIndexAt/useEventIndex. Never compare those against event.seq: the
  // sort by time reorders events (assertion-result events are pushed last
  // but land mid-timeline), so seq and array position diverge.
  dispatchIndex: number;
  arriveIndex: number;
  resolveIndex: number;
}

/** Status shown before the exchange resolves — never leak the final answer. */
export function revealStatus(window: RevealWindow, eventIndex: number): MessageStatus {
  if (eventIndex >= window.resolveIndex) return window.message.status;
  if (eventIndex >= window.arriveIndex) return "processing";
  return "in-flight";
}

export function buildRevealWindows(timeline: Timeline): RevealWindow[] {
  const byRequest = new Map<string, RevealWindow>();
  timeline.events.forEach((event, index) => {
    if (event.kind === "message-dispatch") {
      byRequest.set(event.message.requestId, {
        message: event.message,
        dispatchIndex: index,
        arriveIndex: Number.MAX_SAFE_INTEGER,
        resolveIndex: Number.MAX_SAFE_INTEGER
      });
    } else if (event.kind === "message-arrive") {
      const window = byRequest.get(event.messageId);
      if (window) window.arriveIndex = index;
    } else if (event.kind === "message-resolve") {
      const window = byRequest.get(event.messageId);
      if (window) window.resolveIndex = index;
    }
  });
  return [...byRequest.values()].sort((a, b) => a.dispatchIndex - b.dispatchIndex);
}

/** Memoized windows + the current event index for a panel. */
export function useReveal(timeline: Timeline): { windows: RevealWindow[]; eventIndex: number } {
  const windows = useMemo(() => buildRevealWindows(timeline), [timeline]);
  const eventIndex = useEventIndex(timeline.events);
  return { windows, eventIndex };
}
