// The showcase rail's own slice of deep sky, so the mirrored fan sits in
// the same universe as the canvas: a star scatter, two faint orbit rings
// echoing the canvas's tilted-view rings, and a few real neighbor galaxies.
// Same sky rule as GalaxyLayer enforces on the canvas: every galaxy-shaped
// object is a real, named one — the three names here are deliberately
// absent from the canvas's Local-Group field, so no body appears twice.
// Stars and smudges reuse the canvas classes (.sim-star, .sim-galaxy,
// .sim-galaxy-spin), so twinkle, spin, reduced motion and the light-theme
// dimming are governed by the very same CSS. Decorative only: rendered
// aria-hidden inside an svg that never catches the pointer. The field is
// pure math from a fixed seed, so every viewer sees the identical sky.

interface ShowcaseSkyProps {
  bounds: { left: number; top: number; width: number; height: number };
  /** Radius of the showcased content — the backdrop rings echo it. */
  contentR: number;
}

type Tint = "blue" | "warm" | "pink";

interface Smudge {
  name: string;
  kind: "elliptical" | "irregular";
  tint: Tint;
  /** Position as a fraction across the bounds — adapts to any viewBox. */
  fx: number;
  fy: number;
  radius: number;
  tilt: number;
  spinSecs: number;
  /** Label offset from center: positive below, negative above. */
  labelDy: number;
}

const SMUDGES: Smudge[] = [
  { name: "Leo T", kind: "irregular", tint: "blue", fx: 0.12, fy: 0.2, radius: 9, tilt: -24, spinSecs: 260, labelDy: 24 },
  { name: "NGC 6822", kind: "irregular", tint: "pink", fx: 0.86, fy: 0.4, radius: 7.5, tilt: 38, spinSecs: 300, labelDy: -18 },
  { name: "NGC 185", kind: "elliptical", tint: "warm", fx: 0.76, fy: 0.88, radius: 8.5, tilt: 10, spinSecs: 280, labelDy: -16 }
];

const TINT_ID: Record<Tint, string> = {
  blue: "url(#sim-sky-galaxy-blue)",
  warm: "url(#sim-sky-galaxy-warm)",
  pink: "url(#sim-sky-galaxy-pink)"
};

const STAR_COUNT = 34;
/** Same tilt illusion as the canvas's orbit rings (orbits.ts SQUASH). */
const SQUASH = 1.6;

/** One far neighbor: the canvas Galaxy's halo structure — crossed tilted
 *  ellipses around a bright core, the whole disk slowly spinning — scaled
 *  down and dimmed for the rail, and named like its canvas kin. */
function GalaxySmudge({ s, x, y }: { s: Smudge; x: number; y: number }) {
  return (
    <g
      className="sim-galaxy"
      transform={`translate(${x} ${y})`}
      style={{ "--gal-alpha": 0.42 } as React.CSSProperties}
    >
      <g
        className="sim-galaxy-spin"
        style={{ "--spin": `${s.spinSecs}s` } as React.CSSProperties}
        transform={`rotate(${s.tilt})`}
      >
        <ellipse rx={s.radius * 1.9} ry={s.radius * 0.85} fill={TINT_ID[s.tint]} />
        <ellipse
          rx={s.radius * 1.15}
          ry={s.radius * 0.42}
          fill={TINT_ID[s.tint]}
          transform="rotate(52)"
          opacity={0.75}
        />
        <circle className="sim-galaxy-core" r={s.radius * 0.3} />
      </g>
      {s.kind === "irregular" && (
        <g fill={TINT_ID[s.tint]}>
          <circle cx={s.radius * 1.15} cy={s.radius * 0.6} r={s.radius * 0.11} />
          <circle cx={-s.radius * 0.95} cy={-s.radius * 0.7} r={s.radius * 0.09} />
        </g>
      )}
      <text className="sim-galaxy-name" y={s.labelDy} textAnchor="middle">
        {s.name}
      </text>
    </g>
  );
}

export function ShowcaseSky({ bounds, contentR }: ShowcaseSkyProps) {
  // Same PRNG as GalaxyLayer: a fixed field, identical for every viewer.
  const rnd = (() => {
    let a = 0x5a2e >>> 0;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();

  const margin = 8;
  const stars = Array.from({ length: STAR_COUNT }, (_, i) => ({
    id: `showcase-star-${i}`,
    x: bounds.left + margin + rnd() * (bounds.width - margin * 2),
    y: bounds.top + margin + rnd() * (bounds.height - margin * 2),
    r: 0.5 + rnd() * 0.7,
    alpha: 0.18 + rnd() * 0.45,
    twinkle: rnd() < 0.4,
    delaySecs: rnd() * 4,
    durationSecs: 2.8 + rnd() * 2.4
  }));

  // Concentric rings around the showcased body, canvas-squashed: the inner
  // one passes behind the fan, the outer one flows off-frame — the sky
  // continues past the rail's edge.
  const innerRy = Math.max(22, contentR * 0.52);
  const outerRy = contentR + 42;

  return (
    <g className="sim-menu-showcase-sky" aria-hidden>
      <defs>
        <radialGradient id="sim-sky-galaxy-blue" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#cfe0ff" stopOpacity={0.85} />
          <stop offset="45%" stopColor="#9db8ff" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#9db8ff" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="sim-sky-galaxy-warm" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffe9c4" stopOpacity={0.85} />
          <stop offset="45%" stopColor="#ffca7a" stopOpacity={0.32} />
          <stop offset="100%" stopColor="#ffca7a" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="sim-sky-galaxy-pink" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffd9e8" stopOpacity={0.85} />
          <stop offset="45%" stopColor="#ff9dc0" stopOpacity={0.3} />
          <stop offset="100%" stopColor="#ff9dc0" stopOpacity={0} />
        </radialGradient>
      </defs>

      {stars.map((s) => (
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

      {SMUDGES.map((s) => (
        <GalaxySmudge
          key={s.name}
          s={s}
          x={bounds.left + s.fx * bounds.width}
          y={bounds.top + s.fy * bounds.height}
        />
      ))}

      <ellipse
        className="sim-menu-showcase-orbit"
        rx={innerRy * SQUASH}
        ry={innerRy}
      />
      <ellipse
        className="sim-menu-showcase-orbit"
        rx={outerRy * SQUASH}
        ry={outerRy}
        opacity={0.6}
      />
    </g>
  );
}
