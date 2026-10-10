// Shared quadratic edge geometry for the command canvas. Pure math so the
// static edges (CommandCanvas) and the per-frame packets (PacketLayer) ride
// exactly the same curve — no DOM getPointAtLength needed.

export interface Point {
  x: number;
  y: number;
}

/** Control point: perpendicular bow away from the canvas center. */
export function quadControlPoint(a: Point, b: Point): Point {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const bow = len * 0.08 * (mx < 800 ? 1 : -1);
  return { x: mx + (-dy / len) * bow, y: my + (dx / len) * bow };
}

export function quadPath(a: Point, b: Point): string {
  const c = quadControlPoint(a, b);
  return `M ${a.x} ${a.y} Q ${c.x} ${c.y} ${b.x} ${b.y}`;
}

/** Quadratic bezier point at parameter t in [0,1]. */
export function quadPointAt(a: Point, b: Point, t: number): Point {
  const c = quadControlPoint(a, b);
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y
  };
}
