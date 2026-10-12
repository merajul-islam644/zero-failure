// Pure tenant-change differ: compares two consecutive probe observations and
// returns what changed, as human-readable activity events. No React, no
// timers — useLiveActivity feeds it probe snapshots and owns the event list.
// The first observation is a baseline and never emits: "changed" needs a
// previous value.

import type { PlatformId } from "../engine/types";
import { PLATFORM_FOR_PROBE } from "./capabilities";
import type { LiveProbeState, ProbeKey } from "./types";
import type { ProbeResults } from "./probes";

export type LiveActivityTone = "ok" | "warn";

export interface LiveActivityEvent {
  /** Stable identity for keyed rendering: probe, kind and observed-at. */
  id: string;
  /** When the change was observed (ms epoch). */
  at: number;
  probe: ProbeKey;
  /** The canvas platform whose node pulses — derived via PLATFORM_FOR_PROBE. */
  platform: PlatformId;
  tone: LiveActivityTone;
  /** One human sentence; shown verbatim in the Inspector activity list. */
  label: string;
}

/** The per-probe noun a count change is phrased with ("3 → 5 data schemas visible"). */
const PROBE_NOUN: Record<ProbeKey, string> = {
  "iam-me": "session",
  "data-schemas": "data schemas visible",
  "localization-languages": "languages configured",
  "storage-objects": "storage objects at root",
  "notifier-inbox": "notifications in inbox"
};

function describe(state: LiveProbeState): string {
  if (state.status === "configured") return state.detail;
  if (state.status === "unknown") return "no observation yet";
  return state.reason;
}

/**
 * Diff two probe snapshots. `prev === undefined` (first poll, or the query
 * just appeared) yields no events. Count changes and availability flips on
 * any of the five probes surface; a same-status same-count poll yields none.
 */
export function diffActivity(
  prev: ProbeResults | undefined,
  next: ProbeResults,
  nowMs: number
): LiveActivityEvent[] {
  if (!prev) return [];
  const events: LiveActivityEvent[] = [];
  for (const probe of Object.keys(PROBE_NOUN) as ProbeKey[]) {
    const before = prev[probe];
    const after = next[probe];
    // An unknown side (probe still warming up) means nothing comparable yet.
    if (!before || !after || before.status === "unknown" || after.status === "unknown") continue;

    if (before.status !== after.status) {
      const reached = after.status === "configured";
      events.push({
        id: `${probe}:availability:${after.checkedAt}`,
        at: nowMs,
        probe,
        platform: PLATFORM_FOR_PROBE[probe],
        tone: reached ? "ok" : "warn",
        label: reached
          ? `${PLATFORM_FOR_PROBE[probe]} reached again — ${describe(after)}`
          : `${PLATFORM_FOR_PROBE[probe]} not reachable right now — ${describe(after)}`
      });
      continue;
    }

    // Same status: only count-bearing probes can drift.
    const beforeCount = before.status === "configured" ? before.count : undefined;
    const afterCount = after.status === "configured" ? after.count : undefined;
    if (beforeCount !== undefined && afterCount !== undefined && beforeCount !== afterCount) {
      events.push({
        id: `${probe}:count:${after.checkedAt}`,
        at: nowMs,
        probe,
        platform: PLATFORM_FOR_PROBE[probe],
        tone: "ok",
        label: `${beforeCount} → ${afterCount} ${PROBE_NOUN[probe]}`
      });
    }
  }
  return events;
}
