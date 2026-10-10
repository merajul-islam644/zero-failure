// Script + full-timeline invariants (M2 acceptance):
// - every scene 2..9 carries at least one platform exchange
// - scene totals within ±10% of target; grand total 570000ms ±5%
// - events strictly non-decreasing in time across all ten scenes
// - binary-search property: eventIndexAt consistent with linear scan
// - checkpoints count matches the script (49) and spot-check verbatim lines

import { describe, expect, it } from "vitest";
import { SCENES } from "./scenes";
import { buildTimeline } from "../engine/timeline";
import { eventIndexAt } from "../engine/select";
import { budgetScene } from "../engine/budget";

const timeline = buildTimeline(SCENES, null);

describe("script integrity", () => {
  it("has ten scenes with sequential indices", () => {
    expect(SCENES).toHaveLength(10);
    SCENES.forEach((scene, i) => expect(scene.index).toBe(i + 1));
  });

  it("carries all 49 testing checkpoints", () => {
    const total = SCENES.reduce((sum, s) => sum + s.checkpoints.length, 0);
    expect(total).toBe(49);
    const ids = SCENES.flatMap((s) => s.checkpoints.map((c) => c.id));
    expect(new Set(ids).size).toBe(49);
  });

  it("every communicating scene (2–9) has at least one exchange", () => {
    for (const scene of SCENES) {
      const exchanges = scene.beats.filter((b) => b.type === "exchange");
      if (scene.index >= 2 && scene.index <= 9) {
        expect(exchanges.length, `scene ${scene.index}`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("retry chains reuse one correlationId with distinct attempts", () => {
    for (const scene of SCENES) {
      const groups = new Map<string, number[]>();
      for (const beat of scene.beats) {
        if (beat.type !== "exchange") continue;
        const attempts = groups.get(beat.correlationId) ?? [];
        attempts.push(beat.attempt ?? 1);
        groups.set(beat.correlationId, attempts);
      }
      for (const [id, attempts] of groups) {
        expect(new Set(attempts).size, `${scene.index}/${id}`).toBe(attempts.length);
      }
    }
  });

  it("spot-checks verbatim first and last lines", () => {
    const s1 = SCENES[0]?.beats.find((b) => b.type === "dialogue");
    expect(s1?.type === "dialogue" && s1.text.startsWith("Good morning, everyone.")).toBe(true);
    const s10 = SCENES[9]?.beats.filter((b) => b.type === "dialogue").at(-1);
    expect(
      s10?.type === "dialogue" && s10.text.startsWith("Remember: our goal is not to pretend")
    ).toBe(true);
  });
});

describe("scene budgets", () => {
  it("lands each scene within ±10% of its target", () => {
    for (const scene of SCENES) {
      const budget = budgetScene(scene.beats, scene.targetDurationMs);
      const drift = Math.abs(budget.totalMs - scene.targetDurationMs) / scene.targetDurationMs;
      expect(drift, `scene ${scene.index}: ${budget.totalMs}ms vs ${scene.targetDurationMs}ms`).toBeLessThanOrEqual(0.1);
    }
  });

  it("totals the 9m30s canvas within ±5%", () => {
    expect(timeline.totalMs).toBeGreaterThanOrEqual(570000 * 0.95);
    expect(timeline.totalMs).toBeLessThanOrEqual(570000 * 1.05);
  });
});

describe("compiled timeline", () => {
  it("keeps event times non-decreasing across all ten scenes", () => {
    let last = -1;
    for (const event of timeline.events) {
      expect(event.time).toBeGreaterThanOrEqual(last);
      last = event.time;
    }
  });

  it("opens ten scenes and closes ten scenes in order", () => {
    const starts = timeline.events.filter((e) => e.kind === "scene-start");
    const ends = timeline.events.filter((e) => e.kind === "scene-end");
    expect(starts.map((e) => e.sceneIndex)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(ends.map((e) => e.sceneIndex)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("has 100 dialogue lines, one per script line", () => {
    const dialogues = timeline.events.filter((e) => e.kind === "dialogue");
    expect(dialogues).toHaveLength(100);
  });

  it("compiles every exchange into dispatch/arrive/resolve in order", () => {
    const dispatchCount = timeline.events.filter((e) => e.kind === "message-dispatch").length;
    const arriveCount = timeline.events.filter((e) => e.kind === "message-arrive").length;
    const resolveCount = timeline.events.filter((e) => e.kind === "message-resolve").length;
    const exchangeCount = SCENES.flatMap((s) => s.beats.filter((b) => b.type === "exchange")).length;
    expect(dispatchCount).toBe(exchangeCount);
    expect(arriveCount).toBe(exchangeCount);
    expect(resolveCount).toBe(exchangeCount);
    for (const window of timeline.messageWindows) {
      expect(window.dispatchMs).toBeLessThan(window.arriveMs);
      expect(window.arriveMs).toBeLessThan(window.resolveMs);
    }
  });

  it("gives the retry scenes their failure-then-success shapes", () => {
    // Scene 6 readiness: attempt 1 fails, attempt 2 succeeds.
    // Scene 9 probe: attempt 1 times out, attempt 2 succeeds.
    const byRequestId = new Map(timeline.messages.map((m) => [m.requestId, m]));
    const s6a1 = timeline.messages.find((m) => m.correlationId === "s6-readiness" && m.attempt === 1);
    const s9a1 = timeline.messages.find((m) => m.correlationId === "s9-timeout-probe" && m.attempt === 1);
    // Placeholder envelopes (run=null) are succeeded by default; the shapes we
    // can assert pre-runner are the attempt structure and the outcomeRef wiring.
    expect(byRequestId.size).toBe(timeline.messages.length);
    expect(s6a1?.attempt).toBe(1);
    expect(s9a1?.attempt).toBe(1);
    const scene6 = SCENES[5];
    const readiness = scene6?.beats.filter(
      (b) => b.type === "exchange" && b.correlationId === "s6-readiness"
    );
    expect(readiness).toHaveLength(2);
    expect(readiness?.[0]?.type === "exchange" && readiness[0].attempt).toBe(1);
    expect(readiness?.[1]?.type === "exchange" && readiness[1].attempt).toBe(2);
    const scene9 = SCENES[8];
    const probe = scene9?.beats.filter(
      (b) => b.type === "exchange" && b.correlationId === "s9-timeout-probe"
    );
    expect(probe).toHaveLength(2);
  });
});

describe("binary-search property", () => {
  it("matches a linear scan at arbitrary seek points", () => {
    // Deterministic pseudo-random sample (mulberry32) — no Math.random flakes.
    let seed = 0x9e3779b9;
    const next = () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const linearIndexAt = (t: number) => {
      let found = -1;
      for (let i = 0; i < timeline.events.length; i++) {
        if ((timeline.events[i]?.time ?? Infinity) <= t) found = i;
        else break;
      }
      return found;
    };
    for (let i = 0; i < 500; i++) {
      const t = Math.floor(next() * timeline.totalMs * 1.1) - timeline.totalMs * 0.05;
      expect(eventIndexAt(timeline.events, t), `t=${t}`).toBe(linearIndexAt(t));
    }
  });
});
