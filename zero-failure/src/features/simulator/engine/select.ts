// Selection primitives over the compiled timeline. Everything is a binary
// search or a small linear scan over precompiled arrays — safe to call every
// frame, pure, and identical results under seek/jump (no hidden state).

import type { DerivedState, PlatformId, TimelineEvent } from "./types";

/** Index of the last event with time <= t; -1 before the first event. */
export function eventIndexAt(events: TimelineEvent[], t: number): number {
  let low = 0;
  let high = events.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const candidate = events[mid];
    if (candidate && candidate.time <= t) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}

export interface SceneWindow {
  index: number;
  startMs: number;
  endMs: number;
}

/**
 * Scene table compiled from scene-start/scene-end events — monotonic,
 * non-overlapping. Building it once per timeline beats re-deriving per frame.
 */
export function buildSceneTable(events: TimelineEvent[]): SceneWindow[] {
  const windows: SceneWindow[] = [];
  let open: { index: number; startMs: number } | null = null;
  for (const event of events) {
    if (event.kind === "scene-start") {
      if (open) windows.push({ index: open.index, startMs: open.startMs, endMs: event.time });
      open = { index: event.sceneIndex, startMs: event.time };
    } else if (event.kind === "scene-end" && open) {
      windows.push({ index: open.index, startMs: open.startMs, endMs: event.time });
      open = null;
    }
  }
  if (open) {
    const last = events[events.length - 1];
    windows.push({
      index: open.index,
      startMs: open.startMs,
      endMs: last ? last.time : open.startMs
    });
  }
  return windows;
}

export function sceneAt(table: SceneWindow[], t: number): SceneWindow | null {
  let low = 0;
  let high = table.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const w = table[mid];
    if (!w) return null;
    if (t < w.startMs) {
      high = mid - 1;
    } else if (t >= w.endMs && mid < table.length - 1) {
      low = mid + 1;
    } else {
      return w;
    }
  }
  const last = table[table.length - 1];
  return last && t >= last.endMs ? last : null;
}

/** Scene window by 1-based index (for SceneNav jumps), or null. */
export function sceneWindowByIndex(table: SceneWindow[], sceneIndex: number): SceneWindow | null {
  return table.find((w) => w.index === sceneIndex) ?? null;
}

interface StateSlot {
  state: DerivedState["states"][PlatformId];
  until: number;
}

/**
 * Derived state fold: replays character-state/dialogue/note/scene events up
 * to t. A character state expires after its durationMs unless a later event
 * replaced it (latest active event wins). Deterministic in t by construction.
 */
export function deriveStateAt(
  events: TimelineEvent[],
  t: number,
  platforms: readonly PlatformId[]
): DerivedState {
  const idx = eventIndexAt(events, t);
  const slots = Object.fromEntries(
    platforms.map((p) => [p, { state: "idle", until: -1 } satisfies StateSlot])
  ) as Record<PlatformId, StateSlot>;

  let scene: DerivedState["scene"] = null;
  let dialogue: DerivedState["dialogue"] = null;
  let note: string | null = null;

  for (const e of events.slice(0, idx + 1)) {
    switch (e.kind) {
      case "scene-start":
        scene = { index: e.sceneIndex, title: e.title, environment: e.environment, startMs: e.time };
        break;
      case "dialogue":
        dialogue =
          t < e.time + e.durationMs
            ? { id: e.id, speaker: e.speaker, text: e.text, startMs: e.time, durationMs: e.durationMs }
            : null;
        break;
      case "character-state": {
        if (t >= e.time + e.durationMs) break;
        const slot = slots[e.platform];
        // Later event wins only if it stays active at least as long.
        if (!slot || e.time >= slot.until || e.time + e.durationMs > slot.until) {
          slots[e.platform] = { state: e.state, until: e.time + e.durationMs };
        }
        break;
      }
      case "note":
        note = e.text;
        break;
      default:
        break;
    }
  }

  const states = Object.fromEntries(
    platforms.map((p) => [p, t < slots[p].until ? slots[p].state : ("idle" as const)])
  ) as DerivedState["states"];

  return { time: t, eventIndex: idx, scene, dialogue, note, states };
}
