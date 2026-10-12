// Deep-sky backdrop behind the solar system: distant galaxies sized and
// faded by their distance from the sun, a twinkle star field, and faint
// nebula washes. Purely decorative — static DOM whose only motion is CSS
// (slow spin, twinkle), so there is no per-frame subscription here and the
// broadcast head never waits on it. Field data is generated once at module
// load from a fixed seed: every viewer sees the identical sky.

const VIEW_W = 1600;
const VIEW_H = 900;
const SUN = { x: 800, y: 450 };

/** Galaxies keep outside this ellipse (slightly past the outer orbit ring
 *  rx=470 / ry=294 plus halo and label margin). */
export const CLEARANCE = { rx: 530, ry: 360 };

const GALAXY_COUNT = 18;
const STAR_COUNT = 56;
const NEBULA_COUNT = 3;

export type GalaxyKind = "spiral" | "elliptical" | "irregular";
export type GalaxyTint = "blue" | "warm" | "pink";

export interface GalaxySpec {
  id: string;
  x: number;
  y: number;
  kind: GalaxyKind;
  tint: GalaxyTint;
  /** Halo radius in px — shrinks with distance from the sun. */
  radius: number;
  /** Static tilt of the disk, degrees. */
  tilt: number;
  /** Distance-faded opacity, 0..1. */
  alpha: number;
  /** Full-turn spin duration (CSS animation), seconds. */
  spinSecs: number;
}

export interface StarSpec {
  id: string;
  x: number;
  y: number;
  r: number;
  alpha: number;
  twinkle: boolean;
  delaySecs: number;
  durationSecs: number;
}

export interface NebulaSpec {
  id: string;
  x: number;
  y: number;
  rx: number;
  ry: number;
  tilt: number;
  tint: "blue" | "violet";
}

export interface GalaxyField {
  galaxies: GalaxySpec[];
  stars: StarSpec[];
  nebulae: NebulaSpec[];
}

/** Small seeded PRNG — deterministic field, same sky for everyone. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Normalized distance from the clearance edge: 0 = just outside the orbit
 *  region (near), 1 = farthest sky corner. Elliptical to match the orbits. */
function distanceIndex(x: number, y: number): number {
  const ex = (x - SUN.x) / CLEARANCE.rx;
  const ey = (y - SUN.y) / CLEARANCE.ry;
  const norm = Math.sqrt(ex * ex + ey * ey);
  const corner = Math.sqrt(
    ((VIEW_W - 30 - SUN.x) / CLEARANCE.rx) ** 2 + ((VIEW_H - 30 - SUN.y) / CLEARANCE.ry) ** 2
  );
  return clamp((norm - 1) / (corner - 1), 0, 1);
}

const KINDS: GalaxyKind[] = ["spiral", "spiral", "elliptical", "irregular"];
const TINTS: GalaxyTint[] = ["blue", "blue", "warm", "pink"];
const NEBULA_TINTS: NebulaSpec["tint"][] = ["blue", "violet", "blue"];

export function buildGalaxyField(): GalaxyField {
  const rnd = mulberry32(0x51eedd);
  const galaxies: GalaxySpec[] = [];

  for (let i = 0; i < GALAXY_COUNT; i++) {
    // Rejection-sample a spot outside the orbit clearance, inside the frame.
    let x = 0;
    let y = 0;
    let ok = false;
    for (let attempt = 0; attempt < 80 && !ok; attempt++) {
      x = 30 + rnd() * (VIEW_W - 60);
      y = 30 + rnd() * (VIEW_H - 60);
      const ex = (x - SUN.x) / CLEARANCE.rx;
      const ey = (y - SUN.y) / CLEARANCE.ry;
      ok = ex * ex + ey * ey >= 1.02;
    }
    if (!ok) continue;

    // Near galaxies read bigger and brighter; far ones shrink into specks.
    const d = distanceIndex(x, y);
    const radius = (20 - 14 * d) * (0.8 + 0.4 * rnd());
    galaxies.push({
      id: `galaxy-${i}`,
      x,
      y,
      kind: KINDS[Math.floor(rnd() * KINDS.length)]!,
      tint: TINTS[Math.floor(rnd() * TINTS.length)]!,
      radius,
      tilt: rnd() * 180,
      alpha: 0.85 - 0.4 * d,
      spinSecs: 180 + rnd() * 160
    });
  }

  const stars: StarSpec[] = Array.from({ length: STAR_COUNT }, (_, i) => ({
    id: `star-${i}`,
    x: 12 + rnd() * (VIEW_W - 24),
    y: 12 + rnd() * (VIEW_H - 24),
    r: 0.7 + rnd() * 0.9,
    alpha: 0.22 + rnd() * 0.5,
    twinkle: rnd() < 0.4,
    delaySecs: rnd() * 4,
    durationSecs: 2.8 + rnd() * 2.4
  }));

  const nebulae: NebulaSpec[] = Array.from({ length: NEBULA_COUNT }, (_, i) => {
    const corner = [
      { x: 210, y: 150 },
      { x: 1400, y: 740 },
      { x: 1310, y: 170 }
    ][i]!;
    return {
      id: `nebula-${i}`,
      ...corner,
      rx: 260 + rnd() * 120,
      ry: 150 + rnd() * 80,
      tilt: rnd() * 90,
      tint: NEBULA_TINTS[i]!
    };
  });

  return { galaxies, stars, nebulae };
}

const FIELD = buildGalaxyField();
const TINT_ID: Record<GalaxyTint, string> = {
  blue: "url(#sim-galaxy-blue)",
  warm: "url(#sim-galaxy-warm)",
  pink: "url(#sim-galaxy-pink)"
};

/** One distant galaxy: layered tilted halos + a bright core. Spirals get an
 *  extra crossed pair of ellipses that reads as arms at this size. */
function Galaxy({ g }: { g: GalaxySpec }) {
  const arms = g.kind === "spiral";
  const halo = (
    <>
      <ellipse rx={g.radius * 1.9} ry={g.radius * 0.85} fill={TINT_ID[g.tint]} />
      <ellipse
        rx={g.radius * 1.15}
        ry={g.radius * 0.42}
        fill={TINT_ID[g.tint]}
        transform="rotate(52)"
        opacity={0.75}
      />
      {arms && (
        <ellipse
          rx={g.radius * 1.5}
          ry={g.radius * 0.3}
          fill={TINT_ID[g.tint]}
          transform="rotate(-38)"
          opacity={0.6}
        />
      )}
    </>
  );
  return (
    <g transform={`translate(${g.x} ${g.y})`} className="sim-galaxy" style={{ "--gal-alpha": g.alpha } as React.CSSProperties}>
      <g
        className="sim-galaxy-spin"
        style={{ "--spin": `${g.spinSecs}s` } as React.CSSProperties}
        transform={`rotate(${g.tilt})`}
      >
        {halo}
        <circle className="sim-galaxy-core" r={g.radius * 0.3} />
      </g>
      {g.kind === "irregular" && (
        <g fill={TINT_ID[g.tint]}>
          <circle cx={g.radius * 1.4} cy={g.radius * 0.7} r={g.radius * 0.16} />
          <circle cx={-g.radius * 1.1} cy={-g.radius * 0.8} r={g.radius * 0.13} />
          <circle cx={g.radius * 0.6} cy={-g.radius * 1.2} r={g.radius * 0.1} />
        </g>
      )}
    </g>
  );
}

export function GalaxyLayer() {
  return (
    <g className="sim-galaxies" aria-hidden>
      <defs>
        <radialGradient id="sim-galaxy-blue" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#cfe0ff" stopOpacity={0.85} />
          <stop offset="45%" stopColor="#9db8ff" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#9db8ff" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="sim-galaxy-warm" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffe9c4" stopOpacity={0.85} />
          <stop offset="45%" stopColor="#ffca7a" stopOpacity={0.32} />
          <stop offset="100%" stopColor="#ffca7a" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="sim-galaxy-pink" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffd9e8" stopOpacity={0.85} />
          <stop offset="45%" stopColor="#ff9dc0" stopOpacity={0.3} />
          <stop offset="100%" stopColor="#ff9dc0" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="sim-nebula-blue" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#6f9cff" stopOpacity={0.1} />
          <stop offset="100%" stopColor="#6f9cff" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="sim-nebula-violet" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#9a6fff" stopOpacity={0.09} />
          <stop offset="100%" stopColor="#9a6fff" stopOpacity={0} />
        </radialGradient>
      </defs>

      {FIELD.nebulae.map((n) => (
        <ellipse
          key={n.id}
          cx={n.x}
          cy={n.y}
          rx={n.rx}
          ry={n.ry}
          transform={`rotate(${n.tilt} ${n.x} ${n.y})`}
          fill={n.tint === "blue" ? "url(#sim-nebula-blue)" : "url(#sim-nebula-violet)"}
        />
      ))}

      {FIELD.stars.map((s) => (
        <circle
          key={s.id}
          className="sim-star"
          cx={s.x}
          cy={s.y}
          r={s.r}
          data-twinkle={s.twinkle || undefined}
          style={
            {
              "--star-alpha": s.alpha,
              "--tw-delay": `${s.delaySecs}s`,
              "--tw-dur": `${s.durationSecs}s`
            } as React.CSSProperties
          }
        />
      ))}

      {FIELD.galaxies.map((g) => (
        <Galaxy key={g.id} g={g} />
      ))}
    </g>
  );
}
