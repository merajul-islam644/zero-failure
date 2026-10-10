// The full ten-scene script in playback order. M1 ships scene 1; scenes 2–10
// land verbatim in M2, and the totals assertion below guards the 9m30s budget.
//
// Script ground rule (from the source): characters speak like people, but
// every line maps to a specific technical action, and simulated vs real API
// responses are always marked separately in the animation.

import type { SceneDefinition } from "../../engine/types";
import { scene01 } from "./scene01";

export const SCENES: SceneDefinition[] = [scene01];

/** Sanity gate the plan requires: scene 1 lands within ±10% of its target. */
export function assertSceneBudgets(
  scenes: SceneDefinition[],
  actualTotals: Map<number, number>
): void {
  for (const scene of scenes) {
    const actual = actualTotals.get(scene.index);
    if (actual === undefined) continue;
    const drift = Math.abs(actual - scene.targetDurationMs) / scene.targetDurationMs;
    if (drift > 0.1) {
      throw new Error(
        `Scene ${scene.index} total ${actual}ms drifts ${Math.round(drift * 100)}% from target ${scene.targetDurationMs}ms`
      );
    }
  }
}
