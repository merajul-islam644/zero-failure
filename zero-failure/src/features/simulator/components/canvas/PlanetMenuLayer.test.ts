// Planet-menu ring sizing: every mini sits on a circle around the body
// it circles — the host planet for a root menu, the opened parent mini
// for a submenu — all at the same distance, and the circle widens with
// the item count.

import { describe, expect, it } from "vitest";
import { ringsForLevels } from "./PlanetMenuLayer";

describe("ringsForLevels", () => {
  it("keeps the base circle for a comfortable three-item fan", () => {
    expect(ringsForLevels([3])).toEqual([{ rx: 130, ry: 130 }]);
  });

  it("tucks a sparse fan in at the same base", () => {
    expect(ringsForLevels([2])).toEqual(ringsForLevels([3]));
  });

  it("widens the ring as the item count grows", () => {
    const [four] = ringsForLevels([4]);
    const [six] = ringsForLevels([6]);
    expect(four!.rx).toBeGreaterThan(130);
    expect(six!.rx).toBeGreaterThan(four!.rx);
  });

  it("circles a submenu around its opened mini with the same rule", () => {
    // A submenu ring is the same count-scaled circle as a root ring —
    // just centered on the opened parent mini instead of the host.
    expect(ringsForLevels([3, 2])[1]!).toEqual(ringsForLevels([2])[0]!);
    expect(ringsForLevels([3, 13])[1]!.rx).toBe(130 + 10 * 14);
  });

  it("keeps every mini equidistant — rx equals ry on every ring", () => {
    for (const counts of [[2], [3], [5], [3, 2], [6, 4, 2], [2, 6]]) {
      for (const ring of ringsForLevels(counts)) {
        expect(ring.ry).toBe(ring.rx);
      }
    }
  });
});
