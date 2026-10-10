// Compiler + selection invariants: monotonic event times, scene table
// integrity, deterministic derivation at arbitrary seek points.

import { describe, expect, it } from "vitest";
import { buildTimeline } from "./timeline";
import { buildSceneTable, deriveStateAt, eventIndexAt, sceneAt } from "./select";
import { SCENES } from "../script/scenes";
import { PLATFORMS } from "../script/cast";
import { SCENARIOS } from "../scenarios/registry";
import { executeScenario } from "../run/runner";

const timeline = buildTimeline(SCENES, null);

describe("buildTimeline (scene 1)", () => {
  it("produces strictly ordered events", () => {
    let last = -1;
    for (const event of timeline.events) {
      expect(event.time).toBeGreaterThanOrEqual(last);
      last = event.time;
    }
  });

  it("opens and closes every scene with matching indices", () => {
    const starts = timeline.events.filter((e) => e.kind === "scene-start");
    const ends = timeline.events.filter((e) => e.kind === "scene-end");
    expect(starts.map((e) => e.sceneIndex)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(ends.map((e) => e.sceneIndex)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("opens with scene-start, holds the light-up note, then the first line", () => {
    const first = timeline.events[0];
    expect(first?.kind).toBe("scene-start");
    const note = timeline.events.find((e) => e.kind === "note");
    expect(note?.time).toBe(first?.time); // stage direction accompanies the scene open
    const firstDialogue = timeline.events.find((e) => e.kind === "dialogue");
    expect(firstDialogue?.time).toBeGreaterThan(note?.time ?? -1);
  });

  it("adds a tail so the finale stays on screen", () => {
    const scene = timeline.scenes[0];
    expect(timeline.totalMs).toBeGreaterThan(scene?.endMs ?? 0);
  });
});

describe("eventIndexAt", () => {
  it("returns -1 before the first event", () => {
    expect(eventIndexAt(timeline.events, -1)).toBe(-1);
  });

  it("returns the last event at or before t (boundary inclusive)", () => {
    // Ties share the same ms (scene-start + note at t=0), so pick a boundary
    // where times actually differ.
    let i = -1;
    for (let k = 0; k < timeline.events.length - 1; k++) {
      const cur = timeline.events[k];
      const nxt = timeline.events[k + 1];
      if (cur && nxt && nxt.time > cur.time) {
        i = k;
        break;
      }
    }
    expect(i).toBeGreaterThanOrEqual(0);
    const cur = timeline.events[i];
    const nxt = timeline.events[i + 1];
    if (!cur || !nxt) throw new Error("timeline too short");
    expect(eventIndexAt(timeline.events, cur.time)).toBe(i);
    expect(eventIndexAt(timeline.events, nxt.time - 1)).toBe(i);
    // Later events may share nxt's millisecond (emitted batches); the search
    // must land on the last of the tie group.
    const idx = eventIndexAt(timeline.events, nxt.time);
    expect(idx).toBeGreaterThan(i);
    expect(timeline.events[idx]?.time).toBe(nxt.time);
  });

  it("returns the final index past the end", () => {
    expect(eventIndexAt(timeline.events, timeline.totalMs + 99999)).toBe(
      timeline.events.length - 1
    );
  });
});

describe("sceneAt", () => {
  it("finds the scene window for interior times", () => {
    const scene = timeline.scenes[0];
    if (!scene) throw new Error("no scenes");
    const mid = (scene.startMs + scene.endMs) / 2;
    const found = sceneAt(timeline.sceneTable, mid);
    expect(found?.index).toBe(1);
  });

  it("returns null before the first scene", () => {
    expect(sceneAt(timeline.sceneTable, -1000)).toBeNull();
  });
});

describe("deriveStateAt", () => {
  it("reports idle everywhere at t=0 before the first scene event", () => {
    const state = deriveStateAt(timeline.events, -1, PLATFORMS);
    expect(state.scene).toBeNull();
    expect(state.dialogue).toBeNull();
    for (const platform of PLATFORMS) {
      expect(state.states[platform]).toBe("idle");
    }
  });

  it("marks the speaker speaking and the cast listening during a line", () => {
    // First dialogue is OS's opening line.
    const dialogueEvent = timeline.events.find((e) => e.kind === "dialogue");
    if (!dialogueEvent || dialogueEvent.kind !== "dialogue") {
      throw new Error("no dialogue compiled");
    }
    const mid = dialogueEvent.time + 1000;
    const state = deriveStateAt(timeline.events, mid, PLATFORMS);
    expect(state.states.os).toBe("speaking");
    expect(state.states.monitor).toBe("listening");
    expect(state.states.storage).toBe("idle"); // not in scene 1 cast
  });

  it("expires states once no beat covers the moment", () => {
    // Dialogue beats are laid out back-to-back, so right after one line the
    // next speaker's window begins (previous speaker drops to listening).
    // Only the tail after the LAST line is truly uncovered.
    const dialogues = timeline.events.filter((e) => e.kind === "dialogue");
    const last = dialogues[dialogues.length - 1];
    if (!last || last.kind !== "dialogue") throw new Error("no dialogue compiled");
    const after = last.time + last.durationMs + 1;
    const state = deriveStateAt(timeline.events, after, PLATFORMS);
    expect(state.dialogue).toBeNull();
    for (const platform of PLATFORMS) {
      expect(state.states[platform]).toBe("idle");
    }
  });

  it("hands the floor to the next speaker when lines are contiguous", () => {
    const dialogues = timeline.events.filter((e) => e.kind === "dialogue");
    const first = dialogues[0];
    if (!first || first.kind !== "dialogue") throw new Error("no dialogue compiled");
    const second = dialogues[1];
    if (!second || second.kind !== "dialogue") throw new Error("only one line");
    expect(second.time).toBe(first.time + first.durationMs);
    const state = deriveStateAt(timeline.events, first.time + first.durationMs + 1, PLATFORMS);
    expect(state.states.os).toBe("listening");
    expect(state.states.monitor).toBe("speaking");
  });

  it("is deterministic: same t, same snapshot", () => {
    const a = deriveStateAt(timeline.events, 37123, PLATFORMS);
    const b = deriveStateAt(timeline.events, 37123, PLATFORMS);
    expect(a).toEqual(b);
  });
});

describe("buildSceneTable", () => {
  it("builds monotonic, non-overlapping windows in scene order", () => {
    const table = buildSceneTable(timeline.events);
    expect(table.map((w) => w.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (let i = 0; i < table.length; i++) {
      const window = table[i];
      expect(window?.endMs).toBeGreaterThan(window?.startMs ?? 0);
      const prev = table[i - 1];
      if (prev) expect(window?.startMs).toBe(prev.endMs);
    }
  });
});

describe("buildTimeline (with a compiled run)", () => {
  it("gives every result an assertion-result event, even blocked exchanges", async () => {
    const scenario = SCENARIOS.find((s) => s.id === "dependency-unavailable");
    if (!scenario) throw new Error("dependency-unavailable scenario missing");
    const run = await executeScenario(scenario, "simulated");
    const compiled = buildTimeline(SCENES, run);

    // The blocker fails, so dependent exchanges are skipped and never
    // resolve — their assertion events must still land (at the finale),
    // or the dashboard could never converge to all results revealed.
    const fired = new Set(
      compiled.events
        .filter((e) => e.kind === "assertion-result")
        .map((e) => e.assertionId)
    );
    expect(fired.size).toBe(run.results.length);
    for (const result of run.results) {
      expect(fired.has(result.assertionId), result.assertionId).toBe(true);
    }

    // And they land at the finale, not in the middle of an earlier scene.
    const lastSceneEnd = Math.max(
      ...compiled.events.filter((e) => e.kind === "scene-end").map((e) => e.time)
    );
    const blocked = run.results.filter((r) => r.status === "not-tested");
    expect(blocked.length).toBeGreaterThan(0);
    for (const result of blocked) {
      const event = compiled.events.find(
        (e) => e.kind === "assertion-result" && e.assertionId === result.assertionId
      );
      expect(event?.time).toBeGreaterThanOrEqual(lastSceneEnd);
    }
  });
});
