// SequencerClock math under a controllable rAF: delta clamping, rate,
// stop-at replay window, seek during replay, duration resize.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SequencerClock } from "./clock";

/** Deterministic fake rAF: frames advance only when this test fires them. */
class FakeRaf {
  private id = 0;
  private callbacks = new Map<number, (now: number) => void>();
  now = 1000;

  install(): void {
    vi.stubGlobal("requestAnimationFrame", (cb: (now: number) => void) => {
      const id = ++this.id;
      this.callbacks.set(id, cb);
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      this.callbacks.delete(id);
    });
    vi.stubGlobal("performance", { now: () => this.now });
  }

  /** Fire the oldest pending frame after `ms` of wall time. */
  tick(ms: number): void {
    this.now += ms;
    const pending = [...this.callbacks.values()];
    this.callbacks.clear();
    for (const cb of pending) cb(this.now);
  }

  get pending(): number {
    return this.callbacks.size;
  }
}

let raf: FakeRaf;

beforeEach(() => {
  raf = new FakeRaf();
  raf.install();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SequencerClock", () => {
  it("starts paused at zero and does not schedule frames", () => {
    const clock = new SequencerClock(570000);
    expect(clock.time).toBe(0);
    expect(clock.isPlaying).toBe(false);
    expect(raf.pending).toBe(0);
  });

  it("advances by frame deltas while playing", () => {
    const clock = new SequencerClock(570000);
    clock.play();
    raf.tick(16);
    raf.tick(16);
    expect(clock.time).toBe(32);
    clock.pause();
    expect(clock.isPlaying).toBe(false);
    expect(raf.pending).toBe(0);
  });

  it("clamps huge deltas (background tab) to 250ms", () => {
    const clock = new SequencerClock(570000);
    clock.play();
    raf.tick(30000); // tab was hidden for 30s
    expect(clock.time).toBe(250);
  });

  it("applies playback rate to frame deltas", () => {
    const clock = new SequencerClock(570000);
    clock.setRate(4);
    clock.play();
    raf.tick(100);
    expect(clock.time).toBe(400);
  });

  it("clamps rate into [0.25, 16]", () => {
    const clock = new SequencerClock(570000);
    clock.setRate(100);
    expect(clock.playbackRate).toBe(16);
    clock.setRate(0.01);
    expect(clock.playbackRate).toBe(0.25);
  });

  it("stops exactly at duration and pauses", () => {
    const clock = new SequencerClock(1000);
    clock.play();
    // Every frame is clamped to 250ms max, so 1000ms takes 4 frames.
    raf.tick(600);
    raf.tick(600);
    raf.tick(600);
    raf.tick(600); // nominal 2400 -> clamped per frame -> exactly 1000
    expect(clock.time).toBe(1000);
    expect(clock.isPlaying).toBe(false);
    expect(raf.pending).toBe(0);
  });

  it("seek clamps into [0, duration] and works while paused", () => {
    const clock = new SequencerClock(570000);
    clock.seek(-5);
    expect(clock.time).toBe(0);
    clock.seek(999999);
    expect(clock.time).toBe(570000);
    clock.seek(120000);
    expect(clock.time).toBe(120000);
  });

  it("playUntil pauses at the stop point and resolves with that time", async () => {
    const clock = new SequencerClock(570000);
    const promise = clock.playUntil(10000, 10500);
    expect(clock.time).toBe(10000);
    expect(clock.isPlaying).toBe(true);
    raf.tick(200);
    raf.tick(200);
    raf.tick(200); // reaches 10600 -> stops at 10500
    const stop = await promise;
    expect(stop.time).toBe(10500);
    expect(clock.isPlaying).toBe(false);
  });

  it("a second playUntil replaces the first (first resolves null)", async () => {
    const clock = new SequencerClock(570000);
    const first = clock.playUntil(0, 3000);
    raf.tick(100);
    const second = clock.playUntil(20000, 21000);
    const firstStop = await first;
    expect(firstStop.time).toBeNull();
    // Keep firing frames until the second window resolves (max 250ms/frame).
    let stop = await Promise.race([second, Promise.resolve("pending")]);
    let guard = 0;
    while (stop === "pending" && guard++ < 40) {
      raf.tick(250);
      stop = await Promise.race([second, Promise.resolve("pending")]);
    }
    expect(stop).toEqual({ time: 21000 });
    expect(clock.time).toBe(21000);
    expect(clock.isPlaying).toBe(false);
  });

  it("manual pause resolves a pending playUntil with the paused time", async () => {
    const clock = new SequencerClock(570000);
    const promise = clock.playUntil(0, 5000);
    raf.tick(100);
    clock.pause();
    const stop = await promise;
    expect(stop.time).toBe(100);
  });

  it("setDuration clamps an out-of-range head", () => {
    const clock = new SequencerClock(1000);
    clock.seek(900);
    clock.setDuration(500);
    expect(clock.time).toBe(500);
    expect(clock.duration).toBe(500);
  });

  it("restart resets to zero and plays", () => {
    const clock = new SequencerClock(570000);
    clock.seek(400000);
    clock.pause();
    clock.restart();
    expect(clock.time).toBe(0);
    expect(clock.isPlaying).toBe(true);
  });

  it("play at the end of the timeline is a no-op", () => {
    const clock = new SequencerClock(1000);
    clock.seek(1000);
    clock.play();
    expect(clock.isPlaying).toBe(false);
  });
});
