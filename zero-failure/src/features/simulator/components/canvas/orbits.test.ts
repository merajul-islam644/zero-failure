// Solar-system geometry: determinism (same t, same sky), Kepler periods,
// layout bounds, and orbit-hugging packet paths.

import { describe, expect, it } from "vitest";
import type { PlatformId } from "../../engine/types";
import { cubicPointAt } from "./geometry";
import {
  ORBIT_CENTER,
  ORBIT_RINGS,
  PLANET_IDS,
  orbitPath,
  orbitPosition,
  orbitState,
  ringPoint
} from "./orbits";

const SAMPLED_T = [0, 5_000, 91_313, 250_000, 600_000];
const LABEL_CLEARANCE = 104; // planet halo (52) vs the sun's label ring worst case
const ALL_IDS: PlatformId[] = ["os", ...PLANET_IDS];

describe("orbitPosition", () => {
  it("keeps the sun fixed at the center", () => {
    for (const t of SAMPLED_T) {
      expect(orbitPosition("os", t)).toEqual(ORBIT_CENTER);
    }
  });

  it("is deterministic — same t, same point", () => {
    for (const id of PLANET_IDS) {
      for (const t of SAMPLED_T) {
        expect(orbitPosition(id, t)).toEqual(orbitPosition(id, t));
      }
    }
  });

  it("keeps every planet clear of the sun at any time", () => {
    for (const id of PLANET_IDS) {
      for (const t of SAMPLED_T) {
        const p = orbitPosition(id, t);
        const dist = Math.hypot(p.x - ORBIT_CENTER.x, p.y - ORBIT_CENTER.y);
        expect(dist).toBeGreaterThan(LABEL_CLEARANCE);
      }
    }
  });

  it("keeps bodies and labels inside the viewBox", () => {
    for (const id of ALL_IDS) {
      for (const t of SAMPLED_T) {
        const p = orbitPosition(id, t);
        expect(p.x).toBeGreaterThanOrEqual(140);
        expect(p.x).toBeLessThanOrEqual(1460);
        // bottom margin covers the role label (~y+122 on the sun)
        expect(p.y).toBeGreaterThanOrEqual(40);
        expect(p.y).toBeLessThanOrEqual(845);
      }
    }
  });

  it("repeats after one ring period (within float tolerance)", () => {
    for (const ring of ORBIT_RINGS) {
      const id = PLANET_IDS.find((pid) => orbitState(pid, 0).ringIndex === ring.index)!;
      const a = orbitPosition(id, 123_456);
      const b = orbitPosition(id, 123_456 + ring.periodMs);
      expect(a.x).toBeCloseTo(b.x, 6);
      expect(a.y).toBeCloseTo(b.y, 6);
    }
  });

  it("spins inner rings faster (Kepler ordering)", () => {
    for (let i = 1; i < ORBIT_RINGS.length; i++) {
      expect(ORBIT_RINGS[i]!.periodMs).toBeGreaterThan(ORBIT_RINGS[i - 1]!.periodMs);
    }
  });

  it("starts same-ring planets far apart", () => {
    for (const ring of ORBIT_RINGS) {
      const angles = PLANET_IDS.filter((id) => orbitState(id, 0).ringIndex === ring.index).map(
        (id) => orbitState(id, 0).angle
      );
      for (let i = 1; i < angles.length; i++) {
        const gap = Math.abs(angles[i]! - angles[i - 1]!);
        expect(Math.min(gap, 2 * Math.PI - gap)).toBeGreaterThanOrEqual(Math.PI / 2);
      }
    }
  });
});

describe("orbitPath", () => {
  it("starts at the sun when the sun is the source", () => {
    const path = orbitPath("os", "monitor", 91_313);
    expect(path.start).toEqual(ORBIT_CENTER);
    expect(Number.isFinite(path.c1.x)).toBe(true);
    expect(Number.isFinite(path.c2.y)).toBe(true);
  });

  it("rides the short-way arc for same-ring pairs", () => {
    // utilities(60deg) and storage(300deg) share ring 3 and its period, so
    // their 240deg gap always wraps to the short way: -120deg (-2pi/3,
    // under MAX_ARC, unclamped). Controls sit at the arc thirds.
    const t = 91_313;
    const from = orbitState("utilities", t);
    const to = orbitState("storage", t);
    const delta = -(2 * Math.PI) / 3; // -120deg, see comment
    const path = orbitPath("utilities", "storage", t);
    expect(to.angle - from.angle).toBeCloseTo((4 * Math.PI) / 3, 6);
    expect(path.c1).toEqual(ringPoint(from.ringIndex, from.angle + delta / 3));
    expect(path.c2).toEqual(ringPoint(to.ringIndex, to.angle - delta / 3));
  });

  it("evaluates the cubic from start to end", () => {
    const path = orbitPath("iam", "logic", 40_000);
    expect(cubicPointAt(path.start, path.c1, path.c2, path.end, 0)).toEqual(path.start);
    expect(cubicPointAt(path.start, path.c1, path.c2, path.end, 1)).toEqual(path.end);
  });

  it("stays finite for every ordered pair at every sampled time", () => {
    for (const from of ALL_IDS) {
      for (const to of ALL_IDS) {
        if (from === to) continue;
        for (const t of SAMPLED_T) {
          const path = orbitPath(from, to, t);
          expect(path.d.startsWith("M")).toBe(true);
          expect(path.d).toContain("C");
          for (const p of [path.start, path.c1, path.c2, path.end]) {
            expect(Number.isFinite(p.x)).toBe(true);
            expect(Number.isFinite(p.y)).toBe(true);
          }
        }
      }
    }
  });
});
