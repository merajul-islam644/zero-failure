// The full ten-scene script in playback order, transcribed verbatim from the
// approved script. Totals must land within ±10% per scene and ±5% overall —
// guarded by scenes.test.ts.
//
// Script ground rule (from the source): characters speak like people, but
// every line maps to a specific technical action, and simulated vs real API
// responses are always marked separately in the animation.

import type { SceneDefinition } from "../../engine/types";
import { scene01 } from "./scene01";
import { scene02 } from "./scene02";
import { scene03 } from "./scene03";
import { scene04 } from "./scene04";
import { scene05 } from "./scene05";
import { scene06 } from "./scene06";
import { scene07 } from "./scene07";
import { scene08 } from "./scene08";
import { scene09 } from "./scene09";
import { scene10 } from "./scene10";

export const SCENES: SceneDefinition[] = [
  scene01,
  scene02,
  scene03,
  scene04,
  scene05,
  scene06,
  scene07,
  scene08,
  scene09,
  scene10
];

/** Sanity gate the plan requires: scene totals within ±10% of target. */
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
