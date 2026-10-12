import { describe, expect, it } from "vitest";
import { CLEARANCE, buildGalaxyField } from "./GalaxyLayer";

const field = buildGalaxyField();

describe("buildGalaxyField", () => {
  it("is deterministic — every viewer sees the identical sky", () => {
    expect(buildGalaxyField()).toEqual(field);
  });

  it("keeps every galaxy clear of the orbit region and inside the frame", () => {
    for (const g of field.galaxies) {
      const ex = (g.x - 800) / CLEARANCE.rx;
      const ey = (g.y - 450) / CLEARANCE.ry;
      expect(ex * ex + ey * ey).toBeGreaterThanOrEqual(1.02);
      expect(g.x).toBeGreaterThanOrEqual(30);
      expect(g.x).toBeLessThanOrEqual(1570);
      expect(g.y).toBeGreaterThanOrEqual(30);
      expect(g.y).toBeLessThanOrEqual(870);
    }
  });

  it("fills the sky: galaxies, stars and nebulae all present", () => {
    expect(field.galaxies.length).toBeGreaterThanOrEqual(14);
    expect(field.stars.length).toBeGreaterThanOrEqual(40);
    expect(field.nebulae.length).toBeGreaterThanOrEqual(2);
  });

  it("near galaxies are bigger and brighter than far ones", () => {
    const byDistance = [...field.galaxies].sort(
      (a, b) =>
        ((a.x - 800) / CLEARANCE.rx) ** 2 + ((a.y - 450) / CLEARANCE.ry) ** 2 -
        ((b.x - 800) / CLEARANCE.rx) ** 2 - ((b.y - 450) / CLEARANCE.ry) ** 2
    );
    const near = byDistance.slice(0, Math.floor(byDistance.length / 3));
    const far = byDistance.slice(-Math.floor(byDistance.length / 3));
    const avg = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
    expect(avg(near.map((g) => g.radius))).toBeGreaterThan(avg(far.map((g) => g.radius)));
    expect(avg(near.map((g) => g.alpha))).toBeGreaterThan(avg(far.map((g) => g.alpha)));
  });

  it("keeps stars inside the frame with sane twinkle timings", () => {
    for (const s of field.stars) {
      expect(s.x).toBeGreaterThanOrEqual(12);
      expect(s.x).toBeLessThanOrEqual(1588);
      expect(s.y).toBeGreaterThanOrEqual(12);
      expect(s.y).toBeLessThanOrEqual(888);
      expect(s.durationSecs).toBeGreaterThanOrEqual(2.8);
      expect(s.delaySecs).toBeLessThan(4);
    }
  });
});
