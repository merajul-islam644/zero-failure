// Budget math: dialogue duration formula, scene scaling with the readability
// floor, leftover distribution, and the Scene 1 total within ±10% of target
// (the plan's acceptance check for M1).

import { describe, expect, it } from "vitest";
import {
  budgetScene,
  clampProcessingMs,
  dialogueDurationMs,
  EXCHANGE_RESOLVE_MS,
  EXCHANGE_TRAVEL_MS,
  MAX_STRETCH,
  PROCESSING_UNIT_MS,
  READABILITY_FLOOR
} from "./budget";
import type { Beat } from "./types";

const dialogue = (text: string): Beat => ({ type: "dialogue", speaker: "os", text });
const exchange = (): Beat => ({
  type: "exchange",
  from: "os",
  to: "iam",
  operation: "op",
  correlationId: "c1",
  requestSummary: "req"
});

describe("dialogueDurationMs", () => {
  it("uses 3.6 words/second plus a 700ms tail", () => {
    // 36 words -> 10s + 0.7s = 10.7s
    const text = Array.from({ length: 36 }, () => "word").join(" ");
    expect(dialogueDurationMs(text)).toBe(10700);
  });

  it("never drops below the 2600ms floor", () => {
    expect(dialogueDurationMs("short line")).toBe(2600);
  });
});

describe("clampProcessingMs", () => {
  it("clamps into [900, 2200]", () => {
    expect(clampProcessingMs(10)).toBe(900);
    expect(clampProcessingMs(1500)).toBe(1500);
    expect(clampProcessingMs(99999)).toBe(2200);
  });
});

describe("budgetScene", () => {
  it("emits items in beat order with contiguous non-zero durations", () => {
    const beats: Beat[] = [dialogue("one two three four five"), exchange(), dialogue("a longer line of words here")];
    const budget = budgetScene(beats, 20000);
    expect(budget.items).toHaveLength(3);
    let cursor = 0;
    for (const item of budget.items) {
      expect(item.startMs).toBe(cursor);
      if (item.durationMs > 0) cursor += item.durationMs;
    }
  });

  it("hits the target when content is shorter (stretch, bounded)", () => {
    const beats: Beat[] = [dialogue("one two three"), exchange()];
    const budget = budgetScene(beats, 12000);
    expect(budget.totalMs).toBeLessThanOrEqual(12000);
    expect(budget.scale).toBeLessThanOrEqual(MAX_STRETCH);
  });

  it("applies the 0.72x readability floor when content overruns", () => {
    const beats: Beat[] = Array.from({ length: 40 }, () => dialogue("word ".repeat(40)));
    const target = 10000; // absurdly small for 40 long lines
    const budget = budgetScene(beats, target);
    expect(budget.compressed).toBe(true);
    expect(budget.scale).toBe(READABILITY_FLOOR);
    expect(budget.totalMs).toBeGreaterThan(target);
  });

  it("gives notes their own readable caption window", () => {
    const beats: Beat[] = [
      dialogue("some words in a line"),
      { type: "note", text: "lights up" },
      dialogue("more words follow here")
    ];
    const budget = budgetScene(beats, 30000);
    const note = budget.items[1];
    expect(note?.beat.type).toBe("note");
    expect(note?.durationMs).toBeGreaterThan(0);
    const first = budget.items[0];
    const last = budget.items[2];
    expect(note?.startMs).toBe((first?.startMs ?? 0) + (first?.durationMs ?? 0));
    expect(last?.startMs).toBe((note?.startMs ?? 0) + (note?.durationMs ?? 0));
  });

  it("scene 1 total lands within 10% of its 55000ms target", async () => {
    // Imported here to avoid a cycle with scenes/index at module scope.
    const { SCENES } = await import("../script/scenes");
    const scene = SCENES[0];
    if (!scene) throw new Error("scene 1 missing");
    const budget = budgetScene(scene.beats, scene.targetDurationMs);
    const drift = Math.abs(budget.totalMs - scene.targetDurationMs) / scene.targetDurationMs;
    expect(drift).toBeLessThanOrEqual(0.1);
    expect(budget.totalMs).toBeCloseTo(scene.targetDurationMs, -3);
  });

  it("exchange raw cost is travel + clamped processing + resolve", () => {
    const budget = budgetScene([exchange()], 0);
    const item = budget.items[0];
    const expected =
      EXCHANGE_TRAVEL_MS + clampProcessingMs(1400) + EXCHANGE_RESOLVE_MS;
    expect(item?.durationMs).toBe(Math.round(expected * READABILITY_FLOOR));
  });

  it("processing beats scale by weight", () => {
    const beats: Beat[] = [
      { type: "processing", platform: "logic", weight: 2, label: "waiting" },
      { type: "processing", platform: "os", label: "quick" }
    ];
    const budget = budgetScene(beats, 3 * PROCESSING_UNIT_MS);
    expect(budget.items[0]?.durationMs).toBe(2 * PROCESSING_UNIT_MS);
    expect(budget.items[1]?.durationMs).toBe(PROCESSING_UNIT_MS);
  });
});
