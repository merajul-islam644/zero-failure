// The deck's seats in the simulator's own orbit geometry: the first nine
// match the canvas cast's rings and base angles exactly, extras cycle the
// rings on golden-angle spacing, and the sweep is the sim's Kepler law.

import { describe, expect, it } from "vitest";
import { ORBIT_RINGS } from "../simulator/components/canvas/orbits";
import { orbitAngle, orbitSlots } from "./liveSky";

describe("orbitSlots", () => {
  it("is deterministic — same count, same seats", () => {
    expect(orbitSlots(5)).toEqual(orbitSlots(5));
  });

  it("mirrors the sim cast's ring pattern for the first nine", () => {
    const seats = orbitSlots(9);
    expect(seats.map((s) => s.ringIndex)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 3]);
    expect((seats[0]!.baseAngle * 180) / Math.PI).toBeCloseTo(200, 6);
    expect((seats[8]!.baseAngle * 180) / Math.PI).toBeCloseTo(300, 6);
  });

  it("keeps every seat on a real ring", () => {
    for (let count = 1; count <= 14; count++) {
      for (const slot of orbitSlots(count)) {
        expect(ORBIT_RINGS[slot.ringIndex]).toBeDefined();
      }
    }
  });
});

describe("orbitAngle", () => {
  it("advances exactly one lap per ring period", () => {
    const slot = orbitSlots(1)[0]!;
    const period = ORBIT_RINGS[slot.ringIndex]!.periodMs;
    expect(orbitAngle(slot, period, period) - orbitAngle(slot, period, 0)).toBeCloseTo(
      2 * Math.PI,
      9
    );
  });

  it("sweeps inner rings faster — Kepler ordering survives", () => {
    const seats = orbitSlots(9);
    const innerPeriod = ORBIT_RINGS[seats[0]!.ringIndex]!.periodMs;
    const outerPeriod = ORBIT_RINGS[seats[8]!.ringIndex]!.periodMs;
    expect(innerPeriod).toBeLessThan(outerPeriod);
  });
});
