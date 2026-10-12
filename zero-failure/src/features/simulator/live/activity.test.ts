// The activity differ's contract: the first observation is a silent
// baseline, only real drift emits, and every event names the canvas platform
// that owns the probe. Pure module — no React, no timers.

import { describe, expect, it } from "vitest";
import { diffActivity } from "./activity";
import type { ProbeResults } from "./probes";
import type { LiveProbeState, ProbeKey } from "./types";

const NOW = 1_700_000_000_000;

function ok(detail: string, count?: number): LiveProbeState {
  return { status: "configured", detail, ...(count === undefined ? {} : { count }), latencyMs: 100, checkedAt: NOW };
}
function dark(reason: string): LiveProbeState {
  return { status: "not-configured", reason, checkedAt: NOW };
}

/** All six probes configured with the given schema count as the variable. */
function snapshot(counts: { schemas: number; languages: number; objects: number; inbox: number }): ProbeResults {
  return {
    "os-session": ok("Platform session live for demo@example.test"),
    "iam-me": ok("Session confirmed for Demo User"),
    "data-schemas": ok(`${counts.schemas} data schemas visible`, counts.schemas),
    "localization-languages": ok(`${counts.languages} languages configured`, counts.languages),
    "storage-objects": ok(`${counts.objects} storage objects at root`, counts.objects),
    "notifier-inbox": ok(`${counts.inbox} notifications in inbox`, counts.inbox)
  };
}

describe("diffActivity", () => {
  it("treats the first observation as a baseline and emits nothing", () => {
    expect(diffActivity(undefined, snapshot({ schemas: 3, languages: 2, objects: 3, inbox: 12 }), NOW)).toEqual([]);
  });

  it("emits nothing when nothing drifted", () => {
    const before = snapshot({ schemas: 3, languages: 2, objects: 3, inbox: 12 });
    const after = snapshot({ schemas: 3, languages: 2, objects: 3, inbox: 12 });
    expect(diffActivity(before, after, NOW)).toEqual([]);
  });

  it("emits one event per changed count, addressed to the owning platform", () => {
    const before = snapshot({ schemas: 3, languages: 2, objects: 3, inbox: 12 });
    const after = snapshot({ schemas: 5, languages: 2, objects: 3, inbox: 13 });
    const events = diffActivity(before, after, NOW);
    expect(events).toHaveLength(2);
    const [schemaEvent, inboxEvent] = events;
    expect(schemaEvent).toMatchObject({
      probe: "data-schemas",
      platform: "data-gateway",
      tone: "ok",
      label: "3 → 5 data schemas visible"
    });
    expect(inboxEvent).toMatchObject({
      probe: "notifier-inbox",
      platform: "logic",
      tone: "ok",
      label: "12 → 13 notifications in inbox"
    });
    for (const event of events) {
      expect(event.id).toMatch(/^[\w-]+:(count|availability):\d+$/);
      expect(event.at).toBe(NOW);
    }
  });

  it("emits an availability event when a probe goes dark", () => {
    const before = snapshot({ schemas: 3, languages: 2, objects: 3, inbox: 12 });
    const after: ProbeResults = {
      ...before,
      "localization-languages": dark("Signed-in account lacks permission for this block")
    };
    const events = diffActivity(before, after, NOW);
    expect(events).toHaveLength(1);
    const [event] = events;
    expect(event).toMatchObject({
      probe: "localization-languages",
      platform: "localization",
      tone: "warn"
    });
    expect(event?.label).toContain("not reachable right now");
  });

  it("emits a recovery event when a dark probe is reached again", () => {
    const before: ProbeResults = {
      ...snapshot({ schemas: 3, languages: 2, objects: 3, inbox: 12 }),
      "storage-objects": dark("Block or collection not available on this tenant")
    };
    const after = snapshot({ schemas: 3, languages: 2, objects: 3, inbox: 12 });
    const events = diffActivity(before, after, NOW);
    expect(events).toHaveLength(1);
    const [event] = events;
    expect(event).toMatchObject({ probe: "storage-objects", platform: "storage", tone: "ok" });
    expect(event?.label).toContain("reached again");
  });

  it("never emits for the identity probe — it has no tenant count to drift", () => {
    const before = snapshot({ schemas: 3, languages: 2, objects: 3, inbox: 12 });
    const after: ProbeResults = { ...before, "iam-me": ok("Session confirmed for Someone Else") };
    expect(diffActivity(before, after, NOW)).toEqual([]);
  });

  it("skips probes still unknown on either side", () => {
    const before = snapshot({ schemas: 3, languages: 2, objects: 3, inbox: 12 });
    const after: ProbeResults = {
      ...before,
      "data-schemas": { status: "unknown" },
      "notifier-inbox": { status: "unknown" }
    };
    expect(diffActivity(before, after, NOW)).toEqual([]);
  });

  it("does not invent a baseline when the previous observation carried no count", () => {
    const before: ProbeResults = {
      ...snapshot({ schemas: 3, languages: 2, objects: 3, inbox: 12 }),
      "data-schemas": ok("data schemas visible")
    };
    const after = snapshot({ schemas: 4, languages: 2, objects: 3, inbox: 12 });
    expect(diffActivity(before, after, NOW)).toEqual([]);
  });

  it("covers every probe key the poller can return", () => {
    // Every ProbeKey must have a noun and a platform mapping — a new probe
    // added to types.ts without an activity entry would silently never emit.
    const keys: ProbeKey[] = ["os-session", "iam-me", "data-schemas", "localization-languages", "storage-objects", "notifier-inbox"];
    const before = snapshot({ schemas: 1, languages: 1, objects: 1, inbox: 1 });
    const after = snapshot({ schemas: 2, languages: 2, objects: 2, inbox: 2 });
    const events = diffActivity(before, after, NOW);
    const probes = new Set(events.map((e) => e.probe));
    for (const key of keys) {
      // The identity-style probes carry no tenant count, so nothing to drift.
      if (key !== "iam-me" && key !== "os-session") expect(probes.has(key)).toBe(true);
    }
  });
});
