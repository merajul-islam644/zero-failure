// The broadcast clock's contract: projection from the epoch, the three drift
// bands, play/pause/rate mismatches overriding position, and whole-document
// writes that bump rev. The visibilitychange case (Provider auto-pauses a
// hidden tab; the broadcast kept playing) must reconcile as a play command
// with a projected head — never as a pause of the room.

import { describe, expect, it } from "vitest";
import {
  SYNC_NUDGE_BAND_MS,
  buildBroadcastWrite,
  headAt,
  isBroadcastRate,
  reconcile
} from "./broadcast-clock";
import { parseBroadcastState, type BroadcastState } from "./schema";

const NOW = 1_700_000_100_000;
const DURATION = 572_000;

function broadcast(overrides: Partial<BroadcastState> = {}): BroadcastState {
  return {
    epochMs: NOW - 1_000,
    headMs: 100_000,
    playing: true,
    rate: 1,
    scenarioId: "default-storyline",
    mode: "simulated",
    updatedAt: NOW - 1_000,
    updatedBy: "presenter",
    rev: 7,
    ...overrides
  };
}

const baseInput = (broadcastState: BroadcastState) => ({
  localHeadMs: 100_000,
  localPlaying: true,
  localRate: 1,
  broadcast: broadcastState,
  nowMs: NOW,
  durationMs: DURATION
});

describe("headAt", () => {
  it("projects a playing head from the epoch at the broadcast rate", () => {
    // 1s ago at head 100_000, rate 2 → 102_000.
    expect(headAt(broadcast({ rate: 2 }), NOW)).toBe(102_000);
  });

  it("holds a paused head still — no projection", () => {
    const state = broadcast({ playing: false, headMs: 250_000, epochMs: NOW - 60_000 });
    expect(headAt(state, NOW)).toBe(250_000);
  });

  it("clamps a past-the-end master to the duration", () => {
    const state = broadcast({ headMs: DURATION - 500, epochMs: NOW - 10_000 });
    expect(headAt(state, NOW, DURATION)).toBe(DURATION);
  });

  it("never projects before zero", () => {
    const state = broadcast({ headMs: 200, epochMs: NOW + 5_000, playing: true });
    expect(headAt(state, NOW)).toBe(0);
  });
});

describe("reconcile", () => {
  it("is a no-op inside the jitter band", () => {
    // Broadcast projects to 101_000 (1s of drift at rate 1); local at 101_200.
    const command = reconcile({ ...baseInput(broadcast()), localHeadMs: 101_200 });
    expect(command).toEqual({ type: "noop" });
  });

  it("nudges halfway inside the wander band", () => {
    // Broadcast projects to 101_000; local sits at 102_000 → drift 1_000 →
    // seek to 101_500.
    const command = reconcile({ ...baseInput(broadcast()), localHeadMs: 102_000 });
    expect(command).toEqual({ type: "seek", headMs: 101_500 });
  });

  it("hard-seeks beyond the wander band", () => {
    const command = reconcile({
      ...baseInput(broadcast({ headMs: 50_000, epochMs: NOW - 1_000 })),
      localHeadMs: 100_000 + SYNC_NUDGE_BAND_MS - 1
    });
    expect(command).toEqual({ type: "seek", headMs: 51_000 });
  });

  it("sends play with a projected head when the local clock is paused but the room plays", () => {
    // The visibilitychange case: the provider paused this hidden tab; the
    // broadcast kept moving. Recovery is a play AT the shared head, and the
    // drift bands never get a say — playing-state mismatches win first.
    const state = broadcast({ epochMs: NOW - 30_000, headMs: 100_000 });
    const command = reconcile({
      localHeadMs: 100_000,
      localPlaying: false,
      localRate: 1,
      broadcast: state,
      nowMs: NOW,
      durationMs: DURATION
    });
    expect(command).toEqual({ type: "play", headMs: 130_000 });
  });

  it("sends pause when the room is paused but the local clock plays", () => {
    const command = reconcile({
      ...baseInput(broadcast({ playing: false, headMs: 100_000 })),
      localHeadMs: 130_000
    });
    expect(command).toEqual({ type: "pause" });
  });

  it("treats a rate mismatch while playing as a rate command at the projected head", () => {
    // 1s ago at head 100_000, rate 16 → projected 116_000.
    const command = reconcile({ ...baseInput(broadcast({ rate: 16 })), localHeadMs: 101_000 });
    expect(command).toEqual({ type: "rate", rate: 16, headMs: 116_000 });
  });

  it("seeks a paused clock that drifted beyond the band — to the stored head, not a projection", () => {
    const state = broadcast({ playing: false, headMs: 80_000 });
    const command = reconcile({
      ...baseInput(state),
      localPlaying: false,
      localHeadMs: 80_000 + SYNC_NUDGE_BAND_MS * 2
    });
    expect(command).toEqual({ type: "seek", headMs: 80_000 });
  });

  it("is a no-op for a paused clock inside the band", () => {
    const state = broadcast({ playing: false, headMs: 80_000 });
    const command = reconcile({ ...baseInput(state), localPlaying: false, localHeadMs: 80_200 });
    expect(command).toEqual({ type: "noop" });
  });
});

describe("buildBroadcastWrite", () => {
  it("authors a complete first document with rev 1", () => {
    const doc = buildBroadcastWrite({
      current: null,
      headMs: 12_345,
      playing: true,
      rate: 2,
      scenarioId: "default-storyline",
      mode: "live",
      nowMs: NOW,
      displayName: "Meraj"
    });
    expect(doc).toEqual({
      epochMs: NOW,
      headMs: 12_345,
      playing: true,
      rate: 2,
      scenarioId: "default-storyline",
      mode: "live",
      updatedAt: NOW,
      updatedBy: "Meraj",
      rev: 1
    });
  });

  it("bumps rev from the current document and carries every field", () => {
    const current = broadcast({ rev: 41 });
    const doc = buildBroadcastWrite({
      current,
      headMs: 0,
      playing: false,
      rate: 1,
      scenarioId: "2-authentication-fails",
      mode: "simulated",
      nowMs: NOW,
      displayName: "Viewer Two"
    });
    expect(doc.rev).toBe(42);
    expect(parseBroadcastState(doc)).toEqual(doc);
  });
});

describe("isBroadcastRate", () => {
  it("accepts exactly the transport speeds and nothing else", () => {
    for (const rate of [0.5, 1, 2, 4, 8, 16]) expect(isBroadcastRate(rate)).toBe(true);
    for (const rate of [0, 3, 1.5, -1, Number.NaN]) expect(isBroadcastRate(rate)).toBe(false);
  });
});

describe("parseBroadcastState", () => {
  it("round-trips a valid document", () => {
    const doc = broadcast();
    expect(parseBroadcastState(doc)).toEqual(doc);
  });

  it("accepts the gateway wire form — epochs stored as numeric strings", () => {
    const doc = broadcast();
    const wire = {
      ...doc,
      epochMs: String(doc.epochMs),
      updatedAt: String(doc.updatedAt)
    };
    expect(parseBroadcastState(wire)).toEqual(doc);
  });

  it("rejects epochs that are neither finite numbers nor numeric strings", () => {
    const bad: unknown[] = ["", "not-a-number", true, null];
    for (const value of bad) {
      expect(parseBroadcastState(broadcast({ epochMs: value as unknown as number }))).toBeNull();
      expect(parseBroadcastState(broadcast({ updatedAt: value as unknown as number }))).toBeNull();
    }
  });

  it("rejects documents that are not broadcast state", () => {
    const bad: unknown[] = [
      null,
      "nope",
      {},
      broadcast({ headMs: -1 }),
      broadcast({ rate: 0 }),
      broadcast({ playing: 1 as unknown as boolean }),
      broadcast({ scenarioId: "" }),
      broadcast({ mode: "other" as unknown as BroadcastState["mode"] }),
      broadcast({ rev: -3 }),
      broadcast({ epochMs: Number.NaN })
    ];
    for (const doc of bad) expect(parseBroadcastState(doc)).toBeNull();
  });

  it("tolerates a missing author by naming it unknown", () => {
    const doc = broadcast() as unknown as Record<string, unknown>;
    delete doc.updatedBy;
    expect(parseBroadcastState(doc)?.updatedBy).toBe("unknown");
  });
});
