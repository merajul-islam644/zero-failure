import { describe, expect, it } from "vitest";
import { buildGalaxyField } from "./GalaxyLayer";
import { SKY_BOUNDS } from "./orbits";

const field = buildGalaxyField();

describe("buildGalaxyField", () => {
  it("is deterministic — every viewer sees the identical sky", () => {
    expect(buildGalaxyField()).toEqual(field);
  });

  it("draws the real galactic neighborhood — named, sun-clear, inside the sky", () => {
    expect(field.galaxies.length).toBeGreaterThanOrEqual(18);
    for (const g of field.galaxies) {
      expect(g.name.length).toBeGreaterThan(0);
      expect(g.distLy).toBeGreaterThan(0);
      // every neighbor clears the sun's disk and flare fan
      expect(Math.hypot(g.x - 800, g.y - 450)).toBeGreaterThanOrEqual(240);
      expect(g.x).toBeGreaterThanOrEqual(SKY_BOUNDS.x + 30);
      expect(g.x).toBeLessThanOrEqual(SKY_BOUNDS.x + SKY_BOUNDS.w - 30);
      expect(g.y).toBeGreaterThanOrEqual(SKY_BOUNDS.y + 30);
      expect(g.y).toBeLessThanOrEqual(SKY_BOUNDS.y + SKY_BOUNDS.h - 30);
    }
  });

  it("nearer neighbors render bigger and brighter — size and fade by distance", () => {
    const byDist = [...field.galaxies].sort((a, b) => a.distLy - b.distLy);
    for (let i = 1; i < byDist.length; i++) {
      expect(byDist[i]!.radius).toBeLessThanOrEqual(byDist[i - 1]!.radius + 1e-9);
      expect(byDist[i]!.alpha).toBeLessThanOrEqual(byDist[i - 1]!.alpha + 1e-9);
    }
  });

  it("fills the sky: the Milky Way's own stars are out there", () => {
    expect(field.stars.length).toBeGreaterThanOrEqual(40);
  });

  it("keeps stars inside the padded sky with sane twinkle timings", () => {
    for (const s of field.stars) {
      expect(s.x).toBeGreaterThanOrEqual(SKY_BOUNDS.x + 12);
      expect(s.x).toBeLessThanOrEqual(SKY_BOUNDS.x + SKY_BOUNDS.w - 12);
      expect(s.y).toBeGreaterThanOrEqual(SKY_BOUNDS.y + 12);
      expect(s.y).toBeLessThanOrEqual(SKY_BOUNDS.y + SKY_BOUNDS.h - 12);
      expect(s.durationSecs).toBeGreaterThanOrEqual(2.8);
      expect(s.delaySecs).toBeLessThan(4);
    }
  });

  it("sends comets on rare chords — past the sun, never through it", () => {
    expect(field.comets.length).toBeGreaterThanOrEqual(2);
    const antiSunDeg = (x: number, y: number) => (Math.atan2(y - 450, x - 800) * 180) / Math.PI;
    for (const c of field.comets) {
      // both ends inside the padded sky
      for (const [x, y] of [[c.x1, c.y1], [c.x2, c.y2]] as const) {
        expect(x).toBeGreaterThanOrEqual(SKY_BOUNDS.x);
        expect(x).toBeLessThanOrEqual(SKY_BOUNDS.x + SKY_BOUNDS.w);
        expect(y).toBeGreaterThanOrEqual(SKY_BOUNDS.y);
        expect(y).toBeLessThanOrEqual(SKY_BOUNDS.y + SKY_BOUNDS.h);
      }
      // a long straight chord whose closest approach clears the sun's flare fan
      expect(Math.hypot(c.x1 - c.x2, c.y1 - c.y2)).toBeGreaterThan(1200);
      const px = c.x2 - c.x1, py = c.y2 - c.y1;
      const t = Math.max(0, Math.min(1, ((800 - c.x1) * px + (450 - c.y1) * py) / (px * px + py * py)));
      expect(Math.hypot(c.x1 + t * px - 800, c.y1 + t * py - 450)).toBeGreaterThanOrEqual(150);
      // the tail points anti-sunward at both ends — physics, not decoration
      expect(c.angleStart).toBeCloseTo(antiSunDeg(c.x1, c.y1), 6);
      expect(c.angleEnd).toBeCloseTo(antiSunDeg(c.x2, c.y2), 6);
      // a rare schedule: minutes-long cycle, phased start, small in size
      expect(c.cycleSecs).toBeGreaterThanOrEqual(140);
      expect(c.delaySecs).toBeLessThanOrEqual(0);
      expect(c.delaySecs).toBeGreaterThan(-c.cycleSecs);
      expect(c.scale).toBeGreaterThanOrEqual(0.5);
      expect(c.scale).toBeLessThanOrEqual(0.9);
    }
  });

  it("keeps the next arrival unguessable — no two passes share a direction", () => {
    // orientation of each chord, folded onto [0, 180) because a line's
    // direction of travel may be reversed between passes
    const bearingOf = (c: (typeof field.comets)[number]) =>
      (((Math.atan2(c.y2 - c.y1, c.x2 - c.x1) * 180) / Math.PI) % 180 + 180) % 180;
    const bearings = field.comets.map(bearingOf);
    expect(bearings.length).toBeGreaterThanOrEqual(5);
    for (let i = 0; i < bearings.length; i++) {
      for (let j = i + 1; j < bearings.length; j++) {
        const sep = Math.abs(bearings[i]! - bearings[j]!);
        const spread = Math.min(sep, 180 - sep);
        expect(spread).toBeGreaterThanOrEqual(20);
      }
    }
  });
});
