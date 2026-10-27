// The forge's sky parts: worlds built the simulator's way, at card and
// view scale. The baked textures come straight from the simulator's own
// baker (planetTextures / sunTexture) and the world traits — moon, cloud
// speed, settlement lights — from its worlds module; both are read-only
// imports, the simulator files untouched. The layered paint around them
// (halo, terrain, clouds, the night shade, limb darkening, atmosphere,
// the star's glow stack) mirrors CharacterNode + SolarNodeLayer with
// dash-scoped classes and forge-prefixed defs, so the create sector owns
// its copy and can never move the simulator's paint.

import { useMemo } from "react";
import { planetTextures, sunTexture } from "../simulator/components/canvas/planetTexture";
import { lightsFor, worldFor } from "../simulator/components/canvas/worlds";
import type { BodyLogo } from "./iconCatalog";

/** A body's id in the baker's cache: stable per system + name, so the
 *  terrain bakes once and every later render returns instantly. */
export function forgedBodyId(sun: string, name: string): string {
  return `forge·${sun}·${name}`;
}

/** One guaranteed-unique hue per body: an even walk around the wheel —
 *  no two bodies of a system can ever land on the same color — rotated
 *  by a hash of the sun's name, so two systems never share a palette. */
export function planetHues(count: number, sun: string): number[] {
  let hash = 0;
  for (let i = 0; i < sun.length; i++) hash = (Math.imul(hash, 31) + sun.charCodeAt(i)) | 0;
  const offset = (hash >>> 0) % 360;
  return Array.from({ length: count }, (_, i) => (offset + Math.round((i * 360) / count)) % 360);
}

/** prefers-reduced-motion, read once per mount — the SMIL moon arm
 *  freezes along with the CSS-driven motion. */
export function useReducedMotion(): boolean {
  return useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
}

/** The bearing from the star (the origin) out to a body at x/y — the
 *  night side turns to face away from it, exactly as the canvas does. */
export function sunBearingDeg(x: number, y: number): number {
  return (Math.atan2(-y, -x) * 180) / Math.PI;
}

export interface SkyStar {
  x: number;
  y: number;
  r: number;
  o: number;
}

/** A deterministic scatter of backdrop stars for the view's sky — the
 *  same seeded discipline as the canvas's field, so every look at a
 *  system shows the identical constellations. */
export function starField(seed: string, count: number, rx: number, ry: number): SkyStar[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (Math.imul(hash, 1103515245) + seed.charCodeAt(i)) | 0;
  const rnd = () => {
    hash = (Math.imul(hash, 1103515245) + 12345) | 0;
    return ((hash >>> 16) & 1023) / 1023;
  };
  rnd();
  return Array.from({ length: count }, () => ({
    x: Math.round((rnd() * 2 - 1) * rx),
    y: Math.round((rnd() * 2 - 1) * ry),
    r: 0.5 + rnd() * 1.2,
    o: 0.14 + rnd() * 0.5,
  }));
}

/** The paint both skies reference: the canvas defs' same ramps and
 *  clips — the star's fill, glow and bloom, the disk clips, the
 *  day-night shade, limb darkening — under this sky's own id prefix.
 *  Bodies are drawn at the simulator's design units (planet r44, star
 *  r74); callers scale the whole node. */
export function SkyDefs({ uid }: { uid: string }) {
  return (
    <defs>
      {/* the star's fill — white-hot core out through the ember rim */}
      <radialGradient id={`${uid}-sunfill`} cx="50%" cy="42%" r="62%">
        <stop offset="0%" stopColor="#fffef2" />
        <stop offset="22%" stopColor="#fff6c4" />
        <stop offset="45%" stopColor="#ffd66e" />
        <stop offset="68%" stopColor="#ffab35" />
        <stop offset="86%" stopColor="#ff8420" />
        <stop offset="100%" stopColor="#f26512" />
      </radialGradient>
      {/* radiation hugging the limb, breathing slowly */}
      <radialGradient id={`${uid}-sunglow`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#fff6d8" stopOpacity={0.55} />
        <stop offset="30%" stopColor="#ffd27a" stopOpacity={0.38} />
        <stop offset="62%" stopColor="#ff9433" stopOpacity={0.16} />
        <stop offset="100%" stopColor="#ff8c1f" stopOpacity={0} />
      </radialGradient>
      {/* the wide faint haze a star carries for hundreds of pixels */}
      <radialGradient id={`${uid}-sunbloom`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#ffb75e" stopOpacity={0.2} />
        <stop offset="55%" stopColor="#ff8c1f" stopOpacity={0.07} />
        <stop offset="100%" stopColor="#ff8c1f" stopOpacity={0} />
      </radialGradient>
      <clipPath id={`${uid}-sundisk`}>
        <circle r={74} />
      </clipPath>
      {/* the turning photosphere is clipped to just inside the limb, so
          drifting cells and spots disappear around the edge of the disk */}
      <clipPath id={`${uid}-surface`}>
        <circle r={70} />
      </clipPath>
      {/* one shared planet disk clip: userSpaceOnUse resolves in each
          referencing element's own node space, where every body's disk
          is r44 at the local origin — so a whole ring shares it */}
      <clipPath id={`${uid}-disk`}>
        <circle r={44} />
      </clipPath>
      {/* day/night shading: the highlight pools on the sun-facing limb,
          the terminator crosses soft, the far limb falls to night */}
      <radialGradient id={`${uid}-shade`} cx="0.3" cy="0.5" r="0.78">
        <stop offset="0%" stopColor="#010208" stopOpacity={0} />
        <stop offset="34%" stopColor="#010208" stopOpacity={0} />
        <stop offset="50%" stopColor="#010208" stopOpacity={0.16} />
        <stop offset="68%" stopColor="#010208" stopOpacity={0.42} />
        <stop offset="85%" stopColor="#010208" stopOpacity={0.7} />
        <stop offset="100%" stopColor="#010208" stopOpacity={0.92} />
      </radialGradient>
      {/* limb darkening: unbiased, all the way around — the pass that
          turns a disc into a ball */}
      <radialGradient id={`${uid}-limb`}>
        <stop offset="68%" stopColor="#010208" stopOpacity={0} />
        <stop offset="92%" stopColor="#010208" stopOpacity={0.26} />
        <stop offset="100%" stopColor="#010208" stopOpacity={0.5} />
      </radialGradient>
    </defs>
  );
}

interface ForgeBodyProps {
  uid: string;
  /** The baker's cache key — stable per system + name. */
  bodyId: string;
  /** This body's own hue — unique within its system by construction. */
  hue: number;
  logo: BodyLogo;
  /** Bearing from the star, degrees — the night side faces away. */
  bearing: number;
  /** Design units are the simulator's (r44); scale down for minis. */
  scale: number;
  reduced: boolean;
}

/** One forged world: the same stack the canvas wears — terrain in the
 *  body's own hue, the drifting cloud deck, night shade with the
 *  settlements' lights, limb darkening, the atmosphere — and, where a
 *  sim node wears its sigil, this body wears the chosen logo. No belt:
 *  the canvas halo only lights for speech and signals, idle skies none. */
export function ForgeBody({ uid, bodyId, hue, logo, bearing, scale, reduced }: ForgeBodyProps) {
  const textures = planetTextures(bodyId, hue);
  const world = worldFor(bodyId);
  const lights = lightsFor(bodyId);
  return (
    <g
      transform={scale === 1 ? undefined : `scale(${scale})`}
      /* the full "H S% L%" triple the dash chrome paints with — hsl()
         needs the lightness (a two-part value falls back to white), and
         the saturation rides the sim cast's own vivid range so the
         sigil, its halo and the body's rim glow the way the canvas's do */
      style={{ "--node-hue": `${hue} 72% 60%` } as React.CSSProperties}
      aria-hidden
    >
      <circle className="dash-body-ball" r={44} />
      {/* the baked world: noise terrain, then the cloud deck shuttling
          over it, both clipped to the disk */}
      <g clipPath={`url(#${uid}-disk)`}>
        <image
          className="dash-body-terrain"
          href={textures.surface}
          x={-44}
          y={-44}
          width={88}
          height={88}
          preserveAspectRatio="xMidYMid slice"
        />
        <image
          className="dash-body-clouds"
          href={textures.clouds}
          x={-53}
          y={-44}
          width={106}
          height={88}
          preserveAspectRatio="xMidYMid slice"
          style={{ "--drift-dur": `${world.cloudDur}s` } as React.CSSProperties}
        />
      </g>
      {/* the night side turned away from the star, settlements glowing */}
      <g transform={`rotate(${bearing - 180})`}>
        <circle r={44} fill={`url(#${uid}-shade)`} />
        <g className="dash-body-lights">
          {lights.map((light, i) => (
            <circle key={i} cx={light.x} cy={light.y} r={light.r} />
          ))}
        </g>
      </g>
      <circle r={44} fill={`url(#${uid}-limb)`} />
      <circle className="dash-body-atmo" r={47} />
      {/* the chosen logo rides its own dark disc — the canvas's sigil
          seat, sized up so the mark reads as the body's hero at every
          scale the forged skies render at (deck panel, cards, modals) */}
      <circle className="dash-body-sigil-disc" r={23} />
      <g className="dash-body-sigil" transform="translate(-19 -19)">
        {logo.kind === "icon" ? (
          <logo.icon size={38} strokeWidth={1.9} aria-hidden />
        ) : (
          <image href={logo.src} width={38} height={38} preserveAspectRatio="xMidYMid meet" />
        )}
      </g>
      {/* the world's own moon, when its id hashes one — SMIL turns the
          arm about the body's local origin, as on the canvas */}
      {world.moon && (
        <g transform="rotate(-14) scale(1 0.42)">
          <g>
            <circle className="dash-body-moon" cx={57} r={4.4} transform="scale(1 2.38)" />
            {!reduced && (
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0"
                to="360"
                dur="26s"
                repeatCount="indefinite"
              />
            )}
          </g>
        </g>
      )}
    </g>
  );
}

/** The forged star: the canvas sun's own stack — glow, bloom, the
 *  baked photosphere with its white-hot core, the bright chromosphere
 *  rim — at the simulator's design units, scaled by the caller. */

/** Latitude circles project squashed, like the orbit rings (ry/rx = 1/1.6):
 *  the whole scene is viewed from above the orbital plane. */
const CELL_SQUASH = 0.625;

/** The photosphere's visible rotation — front to back, not around like a
 *  clock. Cells and spots emerge at one limb, sweep across the face,
 *  foreshorten and fade around the far limb, then re-emerge. Verbatim
 *  from CharacterNode (not imported — the sim's node stays untouched);
 *  the sim's own CSS classes drive the identical drift animations. */
interface SunCell {
  id: string;
  kind: "granule" | "spot";
  lat: number;
  rx: number;
  amp: number;
  arc: number;
  peak: number;
  driftSecs: number;
  phaseSecs: number;
}

const SUN_CELLS: SunCell[] = [
  { id: "g1", kind: "granule", lat: -26, rx: 8, amp: 62, arc: 20, peak: 0.4, driftSecs: 4, phaseSecs: 5 },
  { id: "g2", kind: "granule", lat: -8, rx: 6.5, amp: 64, arc: 18, peak: 0.32, driftSecs: 4, phaseSecs: 17 },
  { id: "g3", kind: "granule", lat: 6, rx: 9, amp: 63, arc: 16, peak: 0.36, driftSecs: 4.5, phaseSecs: 11 },
  { id: "g4", kind: "granule", lat: 22, rx: 7, amp: 60, arc: 15, peak: 0.3, driftSecs: 4.5, phaseSecs: 23 },
  { id: "g5", kind: "granule", lat: 34, rx: 5.5, amp: 55, arc: 12, peak: 0.26, driftSecs: 5, phaseSecs: 8 },
  { id: "g6", kind: "granule", lat: -38, rx: 6, amp: 52, arc: 12, peak: 0.28, driftSecs: 5, phaseSecs: 19 },
  { id: "g7", kind: "granule", lat: 40, rx: 6.5, amp: 50, arc: 10, peak: 0.24, driftSecs: 5, phaseSecs: 27 },
  { id: "g8", kind: "granule", lat: -16, rx: 5, amp: 63, arc: 17, peak: 0.22, driftSecs: 4, phaseSecs: 30 },
  { id: "g9", kind: "granule", lat: -48, rx: 4.5, amp: 40, arc: 8, peak: 0.2, driftSecs: 6, phaseSecs: 14 },
  { id: "g10", kind: "granule", lat: 50, rx: 4, amp: 38, arc: 7, peak: 0.18, driftSecs: 6, phaseSecs: 2 },
  { id: "sp1", kind: "spot", lat: 12, rx: 4.6, amp: 60, arc: 16, peak: 0.75, driftSecs: 8, phaseSecs: 9 },
  { id: "sp2", kind: "spot", lat: -20, rx: 3.4, amp: 62, arc: 17, peak: 0.65, driftSecs: 8.5, phaseSecs: 33 }
];

/** Prominences: plasma blooms riding the limb at fixed bearings — a
 *  star doesn't wheel them around like a pinwheel. Static and
 *  deterministic, half-spilled past the disk edge. */
const SUN_PROMS = [
  { angle: 18, r: 9 },
  { angle: 74, r: 6 },
  { angle: 131, r: 11 },
  { angle: 203, r: 7 },
  { angle: 259, r: 10 },
  { angle: 316, r: 5.5 }
];

function cellStyle(cell: SunCell): React.CSSProperties {
  return {
    "--amp": cell.amp,
    "--arc": cell.arc,
    "--peak": cell.peak,
    "--drift": `${cell.driftSecs}s`,
    "--delay": `${-cell.phaseSecs}s`
  } as React.CSSProperties;
}

/** The sun's own stack — bloom, glow, the baked photosphere with its
 *  white-hot core, the bright chromosphere rim, the turning surface and
 *  the prominences — shared by the menu base's star and the app base's
 *  center app, so both seats wear the identical fire. */
function SunStack({ uid }: { uid: string }) {
  const photosphere = sunTexture();
  return (
    <>
      <circle className="dash-star-bloom" r={205} fill={`url(#${uid}-sunbloom)`} />
      <circle className="dash-star-glow" r={140} fill={`url(#${uid}-sunglow)`} />
      <circle className="dash-star-ball" r={74} fill={`url(#${uid}-sunfill)`} />
      {/* the baked photosphere IS the surface — the fill under it is only
          edge insurance at the limb */}
      <image
        className="dash-star-photosphere"
        href={photosphere}
        x={-74}
        y={-74}
        width={148}
        height={148}
        clipPath={`url(#${uid}-sundisk)`}
        preserveAspectRatio="xMidYMid slice"
      />
      <circle className="dash-star-rim" r={74} />
      {/* the drifting cells — clipped to the disk so they vanish around
          the limb */}
      <g className="sim-sun-surface" clipPath={`url(#${uid}-surface)`}>
        {SUN_CELLS.map((cell) =>
          cell.kind === "spot" ? (
            <g key={cell.id} className="sim-sun-spot" style={cellStyle(cell)}>
              <ellipse
                className="sim-sun-spot-penumbra"
                cy={cell.lat}
                rx={cell.rx * 1.9}
                ry={cell.rx * 1.9 * CELL_SQUASH}
              />
              <ellipse
                className="sim-sun-spot-umbra"
                cy={cell.lat}
                rx={cell.rx}
                ry={cell.rx * CELL_SQUASH}
              />
            </g>
          ) : (
            <ellipse
              key={cell.id}
              className="sim-sun-granule"
              cy={cell.lat}
              rx={cell.rx}
              ry={cell.rx * CELL_SQUASH}
              style={cellStyle(cell)}
            />
          )
        )}
      </g>
      {/* prominences: blurred plasma blooms half-spilled over the limb */}
      <g className="sim-sun-proms">
        {SUN_PROMS.map((prom) => (
          <circle key={prom.angle} cx={74} r={prom.r} transform={`rotate(${prom.angle})`} />
        ))}
      </g>
    </>
  );
}

export function ForgeStar({ uid, scale }: { uid: string; scale: number }) {
  return (
    <g transform={scale === 1 ? undefined : `scale(${scale})`} aria-hidden>
      <SunStack uid={uid} />
    </g>
  );
}

/** The sun's own accent — the fireball's mid-orange, for chrome that
 *  must match the star it names (the narration console opened from the
 *  sun's seat, the bubble riding above it). */
export const SUN_ACCENT_HUE = 28;
