// Solar-system geometry for the cast canvas: OS is the sun at the center,
// the other nine platforms revolve on elliptical orbit rings. Pure math, no
// React — positions are a pure function of timeline time, so pause / seek /
// scrub show the same sky, and every broadcast viewer at the same playback
// head sees identical orbits.

import type { PlatformId } from "../../engine/types";
import { cubicPath, type Point } from "./geometry";

/** Canvas center in the 1600x900 viewBox — the sun sits here. */
export const ORBIT_CENTER: Point = { x: 800, y: 450 };

/** How far past the 1600x900 design frame the deep sky keeps drawing, so
 *  the letterbox bands around the frame stay starry instead of empty. */
export const SKY_PAD = { x: 900, y: 900 };

export const SKY_BOUNDS = {
  x: -SKY_PAD.x,
  y: -SKY_PAD.y,
  w: 1600 + SKY_PAD.x * 2,
  h: 900 + SKY_PAD.y * 2
};

/** rx = ry * SQUASH: squashed circles read as a tilted-view solar system
 *  and fill the 16:9 viewBox instead of wasting the horizontal frame. */
const SQUASH = 1.6;
/** Kepler normalization: the outer ring takes this long per revolution. */
const OUTER_PERIOD_MS = 120_000;

export interface OrbitRing {
  index: number;
  rx: number;
  ry: number;
  periodMs: number;
}

const RING_RY = [148, 200, 248, 294];
const OUTER_RY = RING_RY[RING_RY.length - 1]!;

// Kepler's third law: T ∝ a^1.5, normalized to the outer ring — inner
// planets visibly lap the outer ones without per-ring hand tuning.
export const ORBIT_RINGS: OrbitRing[] = RING_RY.map((ry, index) => ({
  index,
  ry,
  rx: ry * SQUASH,
  periodMs: OUTER_PERIOD_MS * Math.pow(ry / OUTER_RY, 1.5)
}));

function ringAt(index: number): OrbitRing {
  const ring = ORBIT_RINGS[index];
  if (!ring) throw new Error(`Unknown orbit ring ${index}`);
  return ring;
}

interface PlanetOrbit {
  ring: OrbitRing;
  /** Angle at t=0, radians. Spread so planets never start clumped. */
  baseAngle: number;
}

// Ring assignment follows the old row seniority: OS's closest coordinators
// orbit tightest, the services ring is outermost. Same-ring planets share a
// period, so their spacing is rigid forever.
const PLANET_ORBITS: Record<Exclude<PlatformId, "os">, PlanetOrbit> = {
  "data-gateway": { ring: ringAt(0), baseAngle: rad(200) },
  logic: { ring: ringAt(0), baseAngle: rad(340) },
  iam: { ring: ringAt(1), baseAngle: rad(110) },
  monitor: { ring: ringAt(1), baseAngle: rad(290) },
  "ai-agent": { ring: ringAt(2), baseAngle: rad(30) },
  release: { ring: ringAt(2), baseAngle: rad(210) },
  utilities: { ring: ringAt(3), baseAngle: rad(60) },
  localization: { ring: ringAt(3), baseAngle: rad(180) },
  storage: { ring: ringAt(3), baseAngle: rad(300) }
};

/** The nine orbiting platform ids (everyone except the sun). */
export const PLANET_IDS = Object.keys(PLANET_ORBITS) as Exclude<PlatformId, "os">[];

export interface OrbitState {
  point: Point;
  /** Ring index, or -1 for the sun (fixed at the center). */
  ringIndex: number;
  angle: number;
}

/** Current polar orbit state of a body at timeline time tMs. */
export function orbitState(id: PlatformId, tMs: number): OrbitState {
  if (id === "os") return { point: { ...ORBIT_CENTER }, ringIndex: -1, angle: 0 };
  const orbit = PLANET_ORBITS[id];
  const angle = orbit.baseAngle + (2 * Math.PI * tMs) / orbit.ring.periodMs;
  return { point: ringPoint(orbit.ring.index, angle), ringIndex: orbit.ring.index, angle };
}

/** Cartesian position of a body at timeline time tMs. Planets revolve; the
 *  sun never moves. */
export function orbitPosition(id: PlatformId, tMs: number): Point {
  return orbitState(id, tMs).point;
}

/** Point on ring `ringIndex` at absolute angle `angle`. */
export function ringPoint(ringIndex: number, angle: number): Point {
  const ring = ringAt(ringIndex);
  return {
    x: ORBIT_CENTER.x + ring.rx * Math.cos(angle),
    y: ORBIT_CENTER.y + ring.ry * Math.sin(angle)
  };
}

export interface OrbitPath {
  d: string;
  start: Point;
  c1: Point;
  c2: Point;
  end: Point;
}

// How far control points swing along the rings toward the other body, and
// the longest arc a single cubic may span — past ~π the bezier starts
// cutting visibly through the ellipse, so long arcs read as slingshots.
const BOW = 0.35;
const MAX_ARC = 2.2;

/** Cubic bezier between two bodies at time tMs whose control points ride
 *  the orbit rings, so packets bend along the orbital direction instead of
 *  cutting straight across the sky. Endpoints move with the planets —
 *  callers recompute every frame and the packet stays glued to them. */
export function orbitPath(fromId: PlatformId, toId: PlatformId, tMs: number): OrbitPath {
  const from = orbitState(fromId, tMs);
  const to = orbitState(toId, tMs);
  const delta = clamp(normalizeAngle(to.angle - from.angle), -MAX_ARC, MAX_ARC);

  // Sun as source or target: one control rides the planet's ring, the other
  // hangs 30% of the way out from the center — the packet slingshots out of
  // (or falls into) the star.
  if (from.ringIndex < 0) {
    const c2 = ringPoint(to.ringIndex, to.angle - delta * BOW);
    const c1 = lerpPoint(ORBIT_CENTER, c2, 0.3);
    return toCubic(from.point, c1, c2, to.point);
  }
  if (to.ringIndex < 0) {
    const c1 = ringPoint(from.ringIndex, from.angle + delta * BOW);
    const c2 = lerpPoint(ORBIT_CENTER, c1, 0.3);
    return toCubic(from.point, c1, c2, to.point);
  }
  if (from.ringIndex === to.ringIndex) {
    // Same ring: control points at the arc thirds so the cubic hugs the ellipse.
    const c1 = ringPoint(from.ringIndex, from.angle + delta / 3);
    const c2 = ringPoint(to.ringIndex, to.angle - delta / 3);
    return toCubic(from.point, c1, c2, to.point);
  }
  // Cross-ring: leave along the source ring, arrive along the target ring.
  const c1 = ringPoint(from.ringIndex, from.angle + delta * BOW);
  const c2 = ringPoint(to.ringIndex, to.angle - delta * BOW);
  return toCubic(from.point, c1, c2, to.point);
}

function rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Wrap to (-PI, PI] — the short way around the circle. */
function normalizeAngle(angle: number): number {
  return ((((angle + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function toCubic(start: Point, c1: Point, c2: Point, end: Point): OrbitPath {
  return { d: cubicPath(start, c1, c2, end), start, c1, c2, end };
}
