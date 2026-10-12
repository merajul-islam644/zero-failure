// Shared cubic bezier geometry for the command canvas. Pure math so the
// orbit-hugging packet paths (orbits.ts) and the per-frame packets
// (PacketLayer) ride exactly the same curve — no DOM getPointAtLength needed.

export interface Point {
  x: number;
  y: number;
}

export function cubicPath(a: Point, c1: Point, c2: Point, b: Point): string {
  return `M ${a.x} ${a.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${b.x} ${b.y}`;
}

/** Cubic bezier point at parameter t in [0,1]. */
export function cubicPointAt(a: Point, c1: Point, c2: Point, b: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
    y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y
  };
}
