// Deep-sky backdrop behind the solar system: the REAL galactic neighborhood.
// Every entry is a known neighbor of the Milky Way, placed at its true
// bearing from us — the top-down galactic-plane bearing (galactic longitude)
// — on a log-scaled radius: real distances span 25 thousand to 21 million
// light-years, and no linear scale fits a canvas. Per the design ask,
// farther neighbors render smaller and dimmer than near ones. The scattered
// star field is our own Milky Way seen from inside; nothing else decorates
// the sky — every galaxy-shaped object on this canvas is a real, named
// neighbor. Comets are occasional deterministic visitors whose tails always
// stream anti-sunward, as the solar wind forces. Field data is generated
// once at module load from a fixed seed: every viewer sees the identical sky.

import { SKY_BOUNDS } from "./orbits";

const SUN = { x: 800, y: 450 };

// Counts cover the padded sky (SKY_BOUNDS): the Milky Way's own stars fill
// the frame and the letterbox bands around it.
const STAR_COUNT = 260;

export type GalaxyKind = "spiral" | "elliptical" | "irregular";
export type GalaxyTint = "blue" | "warm" | "pink";

/** Radial map for the neighborhood: true bearing, log-compressed distance.
 *  Real distances span 172x — a linear scale would push every far neighbor
 *  off the canvas — so the log radius is tuned to land the nearest at r0
 *  (inside the orbit field: it draws behind the rings, as background sky)
 *  and the farthest just inside the 16:9 design frame, keeping the whole
 *  neighborhood in view at once. Bearing and order stay exact. */
const RADII = { r0: 260, k: 80, d0: 25_000 };

/** Comet passes — rare and spaced out on purpose: long cycles mean minutes
 *  can pass between arrivals. Still one per direction slot, so the next
 *  arrival's bearing is never guessable. Half fly their chord in reverse. */
const COMET_COUNT = 5;

interface NeighborGalaxy {
  name: string;
  /** Galactic longitude (deg) — true bearing on the galactic plane. */
  lonDeg: number;
  /** Approximate distance from the solar system, light-years. */
  distLy: number;
  kind: GalaxyKind;
  tint: GalaxyTint;
}

/** The Milky Way's nearest neighbors — published approximate values,
 *  ordered nearest first. Sizes and fades derive from distLy below. Toward
 *  l≈0 (right, the galactic center) the Milky Way's own dust hides the
 *  sky — the Zone of Avoidance — so Dwingeloo 1, found hiding there in
 *  1994, stands nearly alone on that side of the map. */
const NEIGHBORS: NeighborGalaxy[] = [
  { name: "Canis Major Dwarf", lonDeg: 240, distLy: 25_000, kind: "irregular", tint: "blue" },
  { name: "Sagittarius dSph", lonDeg: 5.6, distLy: 70_000, kind: "elliptical", tint: "warm" },
  { name: "Large Magellanic Cloud", lonDeg: 280.5, distLy: 163_000, kind: "irregular", tint: "blue" },
  { name: "Small Magellanic Cloud", lonDeg: 302.8, distLy: 200_000, kind: "irregular", tint: "blue" },
  { name: "Ursa Minor Dwarf", lonDeg: 104.9, distLy: 200_000, kind: "elliptical", tint: "warm" },
  { name: "Draco Dwarf", lonDeg: 86.4, distLy: 280_000, kind: "elliptical", tint: "warm" },
  { name: "Sculptor Dwarf", lonDeg: 287.5, distLy: 290_000, kind: "elliptical", tint: "warm" },
  { name: "Fornax Dwarf", lonDeg: 237.1, distLy: 620_000, kind: "elliptical", tint: "warm" },
  { name: "Leo II", lonDeg: 220, distLy: 700_000, kind: "elliptical", tint: "warm" },
  { name: "Leo I", lonDeg: 226, distLy: 820_000, kind: "elliptical", tint: "warm" },
  { name: "Antlia Dwarf", lonDeg: 189, distLy: 1_300_000, kind: "elliptical", tint: "warm" },
  { name: "Phoenix Dwarf", lonDeg: 237.1, distLy: 1_400_000, kind: "irregular", tint: "pink" },
  { name: "Sextans B", lonDeg: 233.2, distLy: 1_400_000, kind: "irregular", tint: "blue" },
  { name: "Sextans A", lonDeg: 246.1, distLy: 1_450_000, kind: "irregular", tint: "blue" },
  { name: "Barnard's Galaxy", lonDeg: 25.3, distLy: 1_600_000, kind: "irregular", tint: "pink" },
  { name: "IC 10", lonDeg: 109, distLy: 2_200_000, kind: "irregular", tint: "blue" },
  { name: "IC 1613", lonDeg: 129.6, distLy: 2_400_000, kind: "irregular", tint: "pink" },
  { name: "Andromeda · M31", lonDeg: 121.2, distLy: 2_500_000, kind: "spiral", tint: "warm" },
  { name: "Leo A", lonDeg: 173.4, distLy: 2_600_000, kind: "irregular", tint: "blue" },
  { name: "Triangulum · M33", lonDeg: 133.6, distLy: 2_730_000, kind: "spiral", tint: "blue" },
  { name: "Maffei 1", lonDeg: 135.4, distLy: 2_850_000, kind: "elliptical", tint: "warm" },
  { name: "Wolf–Lundmark–Melotte", lonDeg: 76.2, distLy: 3_000_000, kind: "irregular", tint: "blue" },
  { name: "NGC 3109", lonDeg: 262.1, distLy: 4_300_000, kind: "irregular", tint: "blue" },
  { name: "IC 5152", lonDeg: 343.9, distLy: 5_800_000, kind: "irregular", tint: "blue" },
  { name: "Dwingeloo 1", lonDeg: 4.5, distLy: 9_500_000, kind: "spiral", tint: "warm" },
  { name: "IC 342", lonDeg: 150.5, distLy: 11_000_000, kind: "spiral", tint: "warm" },
  { name: "NGC 253 · Sculptor Galaxy", lonDeg: 240.9, distLy: 11_400_000, kind: "spiral", tint: "blue" },
  { name: "Messier 82", lonDeg: 141.4, distLy: 11_400_000, kind: "irregular", tint: "blue" },
  { name: "Messier 81", lonDeg: 142.1, distLy: 11_800_000, kind: "spiral", tint: "warm" },
  { name: "Centaurus A · NGC 5128", lonDeg: 309.5, distLy: 12_000_000, kind: "elliptical", tint: "warm" },
  { name: "Messier 101 · Pinwheel", lonDeg: 157.9, distLy: 21_000_000, kind: "spiral", tint: "blue" }
];

export interface GalaxySpec {
  id: string;
  name: string;
  x: number;
  y: number;
  kind: GalaxyKind;
  tint: GalaxyTint;
  /** Halo radius in px — shrinks with distance from us. */
  radius: number;
  /** Static tilt of the disk, degrees. */
  tilt: number;
  /** Distance-faded opacity, 0..1. */
  alpha: number;
  /** Full-turn spin duration (CSS animation), seconds. */
  spinSecs: number;
  /** Vertical label offset from the galaxy center (px), de-cluttered. */
  labelDy: number;
  /** Approximate distance from the solar system, light-years. */
  distLy: number;
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
  /** Real stars span colors: cool white default, warm giants, blue hot. */
  tint: "" | "warm" | "blue";
}

export interface CometSpec {
  id: string;
  /** Straight-chord endpoints across the padded sky. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Anti-sun tail bearing at each endpoint, degrees. */
  angleStart: number;
  angleEnd: number;
  /** Full schedule length; the crossing itself takes the first 6%. */
  cycleSecs: number;
  /** Negative phase into the schedule. */
  delaySecs: number;
  scale: number;
}

export interface GalaxyField {
  galaxies: GalaxySpec[];
  stars: StarSpec[];
  comets: CometSpec[];
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

function rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function buildGalaxyField(): GalaxyField {
  const rnd = mulberry32(0x51eedd);

  // The real neighborhood: exact bearing, log-scaled radius, and — per the
  // design ask — size and fade strictly by distance from our solar system.
  const galaxies: GalaxySpec[] = NEIGHBORS.map((n, i) => {
    const r = RADII.r0 + RADII.k * Math.log10(n.distLy / RADII.d0);
    const radius = Math.max(5.5, 22 * Math.pow(RADII.d0 / n.distLy, 0.25));
    return {
      id: `galaxy-${i}`,
      name: n.name,
      x: SUN.x + r * Math.cos(rad(n.lonDeg)),
      y: SUN.y - r * Math.sin(rad(n.lonDeg)),
      kind: n.kind,
      tint: n.tint,
      radius,
      tilt: (i * 137) % 180,
      alpha: clamp(0.9 - 0.22 * Math.log10(n.distLy / RADII.d0), 0.45, 0.9),
      spinSecs: 180 + ((i * 53) % 160),
      labelDy: i % 2 === 0 ? radius * 1.9 + 16 : -(radius * 1.9 + 8),
      distLy: n.distLy
    };
  });

  // De-clutter the names: walk the field in index order and, when a name's
  // box would cover an already-placed name, slide it along the depth
  // candidates (preferred side first). Deterministic, so every viewer sees
  // the same layout.
  const placed: { x: number; hw: number; y: number }[] = [];
  for (const g of galaxies) {
    const hw = g.name.length * 3.3 + 6;
    const clear = (y: number) =>
      y > 14 && y < 886 &&
      placed.every((p) => Math.abs(p.y - y) >= 16 || Math.abs(p.x - g.x) > p.hw + hw);
    const below = g.labelDy > 0;
    const candidates = (below ? [16, 42, 68, -8, -34, -60] : [-8, -34, -60, 16, 42, 68])
      .map((off) => g.y + g.radius * 1.9 + off);
    const y = candidates.find(clear) ?? g.y + g.radius * 1.9 + (below ? 16 : -8);
    g.labelDy = y - g.y;
    placed.push({ x: g.x, hw, y });
  }

  const stars: StarSpec[] = Array.from({ length: STAR_COUNT }, (_, i) => {
    const tintRoll = rnd();
    return {
      id: `star-${i}`,
      x: SKY_BOUNDS.x + 12 + rnd() * (SKY_BOUNDS.w - 24),
      y: SKY_BOUNDS.y + 12 + rnd() * (SKY_BOUNDS.h - 24),
      r: 0.7 + rnd() * 0.9,
      alpha: 0.22 + rnd() * 0.5,
      twinkle: rnd() < 0.4,
      delaySecs: rnd() * 4,
      durationSecs: 2.8 + rnd() * 2.4,
      tint: tintRoll < 0.14 ? "warm" : tintRoll < 0.26 ? "blue" : ""
    };
  });

  // Comet passes — occasional visitors. A fresh seeded stream, so the star
  // field above is untouched. Each pass is a straight chord picked by its
  // closest approach to the sun (never through it). Orientations come from
  // evenly spread slots with a small jitter — every pass sits a guaranteed
  // 20°+ away from every other, so the next arrival's direction is never
  // guessable from the last ones. Half fly their chord in reverse.
  const cometRnd = mulberry32(0xc0ffee7);
  const comets: CometSpec[] = Array.from({ length: COMET_COUNT }, (_, i) => {
    let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
    const inside = (x: number, y: number) =>
      x > SKY_BOUNDS.x + 60 && x < SKY_BOUNDS.x + SKY_BOUNDS.w - 60 &&
      y > SKY_BOUNDS.y + 60 && y < SKY_BOUNDS.y + SKY_BOUNDS.h - 60;
    for (let tries = 0; tries < 80; tries++) {
      const d = 170 + cometRnd() * 190; // closest approach: clears the sun's flare fan
      // slot i of 180/COMET_COUNT degrees, jittered ±5° — adjacent slots can
      // never close past 20°, however the draws land
      const phi = ((i + 0.5) * (180 / COMET_COUNT) + (cometRnd() - 0.5) * 10) * (Math.PI / 180);
      const L = 950 + cometRnd() * 300; // half-length: always crosses the frame
      const cos = Math.cos(phi), sin = Math.sin(phi);
      x1 = SUN.x + (-L * cos - d * sin);
      y1 = SUN.y + (-L * sin + d * cos);
      x2 = SUN.x + (L * cos - d * sin);
      y2 = SUN.y + (L * sin + d * cos);
      if (inside(x1, y1) && inside(x2, y2)) break;
    }
    if (cometRnd() < 0.5) {
      [x1, x2] = [x2, x1];
      [y1, y2] = [y2, y1];
    }
    const antiSunDeg = (x: number, y: number) => (Math.atan2(y - SUN.y, x - SUN.x) * 180) / Math.PI;
    const cycleSecs = 150 + cometRnd() * 70;
    return {
      id: `comet-${i}`,
      x1, y1, x2, y2,
      angleStart: antiSunDeg(x1, y1),
      angleEnd: antiSunDeg(x2, y2),
      cycleSecs,
      delaySecs: -cometRnd() * cycleSecs,
      scale: 0.55 + cometRnd() * 0.3
    };
  });

  return { galaxies, stars, comets };
}

const FIELD = buildGalaxyField();
const TINT_ID: Record<GalaxyTint, string> = {
  blue: "url(#sim-galaxy-blue)",
  warm: "url(#sim-galaxy-warm)",
  pink: "url(#sim-galaxy-pink)"
};

/** One real galactic neighbor: layered tilted halos + a bright core, named
 *  underneath (the label sits outside the spinning group so it holds
 *  still; buildGalaxyField already de-cluttered the depths). The label
 *  stays in this backdrop layer — planets cross in front of it, never the
 *  other way around. Spirals get an extra crossed pair of ellipses that
 *  reads as arms at this size. */
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
          <circle cx={g.radius * 1.15} cy={g.radius * 0.6} r={g.radius * 0.11} />
          <circle cx={-g.radius * 0.95} cy={-g.radius * 0.7} r={g.radius * 0.09} />
          <circle cx={g.radius * 0.5} cy={-g.radius} r={g.radius * 0.07} />
        </g>
      )}
      <text className="sim-galaxy-name" y={g.labelDy} textAnchor="middle">
        {g.name}
      </text>
    </g>
  );
}

/** One scheduled comet pass: the head rides its chord — CSS translates it
 *  start → end across the first 6% of the schedule and keeps it dark the
 *  rest — while the inner group swings the tail between the anti-sun
 *  bearings at each end. A real comet's tail streams away from the sun
 *  wherever it flies, so the swing is physics, not decoration. */
function Comet({ c }: { c: CometSpec }) {
  const fly = {
    "--x1": c.x1, "--y1": c.y1, "--x2": c.x2, "--y2": c.y2,
    "--cycle": `${c.cycleSecs}s`, "--delay": `${c.delaySecs}s`
  } as React.CSSProperties;
  const swing = {
    "--a1": `${c.angleStart}deg`, "--a2": `${c.angleEnd}deg`,
    "--cycle": `${c.cycleSecs}s`, "--delay": `${c.delaySecs}s`
  } as React.CSSProperties;
  return (
    <g className="sim-comet" style={fly}>
      <g className="sim-comet-swing" style={swing}>
        <g transform={`scale(${c.scale})`}>
          <path className="sim-comet-tail" d="M0 -2.6 C 24 -4.6, 62 -3.4, 98 0 C 62 3.4, 24 4.6, 0 2.6 Z" />
          <path className="sim-comet-tail-inner" d="M0 -1.3 C 16 -2.2, 42 -1.7, 66 0 C 42 1.7, 16 2.2, 0 1.3 Z" />
          <circle className="sim-comet-glow" r={7} fill="url(#sim-comet-glow)" />
          <circle className="sim-comet-head" r={1.8} />
        </g>
      </g>
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
        <radialGradient id="sim-comet-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e4f0ff" stopOpacity={0.9} />
          <stop offset="45%" stopColor="#a8c8ff" stopOpacity={0.32} />
          <stop offset="100%" stopColor="#a8c8ff" stopOpacity={0} />
        </radialGradient>
        <linearGradient id="sim-comet-tail-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#cfe2ff" stopOpacity={0.5} />
          <stop offset="100%" stopColor="#cfe2ff" stopOpacity={0} />
        </linearGradient>
        <linearGradient id="sim-comet-tail-inner-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#eef5ff" stopOpacity={0.8} />
          <stop offset="100%" stopColor="#eef5ff" stopOpacity={0} />
        </linearGradient>
        {/* nebula haze: three vast, barely-there drifts of dust that give
            the deep sky photographic depth behind the star field */}
        <radialGradient id="sim-nebula-teal" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3fd2c7" stopOpacity={0.1} />
          <stop offset="100%" stopColor="#3fd2c7" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="sim-nebula-violet" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#8f7bff" stopOpacity={0.09} />
          <stop offset="100%" stopColor="#8f7bff" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="sim-nebula-warm" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffb26b" stopOpacity={0.05} />
          <stop offset="100%" stopColor="#ffb26b" stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* the dust drifts sit behind everything on the sky */}
      <g className="sim-nebula" aria-hidden>
        <ellipse cx={400} cy={640} rx={520} ry={210} fill="url(#sim-nebula-teal)" transform="rotate(-14 400 640)" />
        <ellipse cx={1230} cy={220} rx={470} ry={190} fill="url(#sim-nebula-violet)" transform="rotate(9 1230 220)" />
        <ellipse cx={820} cy={480} rx={700} ry={330} fill="url(#sim-nebula-warm)" />
      </g>

      {FIELD.stars.map((s) => {
        const vars = {
          "--star-alpha": s.alpha,
          "--tw-delay": `${s.delaySecs}s`,
          "--tw-dur": `${s.durationSecs}s`
        } as React.CSSProperties;
        // The brightest few carry diffraction spikes — the cross flare a
        // long-exposure astrophoto shows on its hottest points.
        if (s.r >= 1.5) {
          return (
            <g key={s.id} className="sim-star" data-twinkle={s.twinkle || undefined} style={vars}>
              <path
                className="sim-star-spike"
                d={`M${s.x - 4.5} ${s.y}H${s.x + 4.5}M${s.x} ${s.y - 4.5}V${s.y + 4.5}`}
              />
              <circle cx={s.x} cy={s.y} r={s.r} />
            </g>
          );
        }
        return (
          <circle
            key={s.id}
            className="sim-star"
            cx={s.x}
            cy={s.y}
            r={s.r}
            data-twinkle={s.twinkle || undefined}
            data-tint={s.tint || undefined}
            style={vars}
          />
        );
      })}

      {/* comets stream in front of the far sky but behind every neighbor */}
      {FIELD.comets.map((c) => (
        <Comet key={c.id} c={c} />
      ))}

      {FIELD.galaxies.map((g) => (
        <Galaxy key={g.id} g={g} />
      ))}
    </g>
  );
}
