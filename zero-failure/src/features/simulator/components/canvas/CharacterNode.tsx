// One platform body on the solar-system canvas. Pure presentation: all
// behavior arrives via the `state` prop; styling lives in simulator.css
// keyed by data-state. Positioning is the parent layer's job — OS renders
// as the sun (bigger, warm fill, corona) via data-sun.

import { memo } from "react";
import {
  Activity,
  Bell,
  Brain,
  Database,
  HardDrive,
  Languages,
  RadioTower,
  Rocket,
  ShieldCheck,
  Workflow
} from "lucide-react";
import type { CharacterDef, CharacterState } from "../../engine/types";
import { useMotionReduced } from "../../state/SettingsContext";
import { planetTextures, sunTexture } from "./planetTexture";
import { worldFor } from "./worlds";

const GLYPHS = {
  RadioTower,
  ShieldCheck,
  Database,
  Workflow,
  Rocket,
  Activity,
  Brain,
  Bell,
  Languages,
  HardDrive
} as const;

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

/** Latitude circles project squashed, like the orbit rings (ry/rx = 1/1.6):
 *  the whole scene is viewed from above the orbital plane. */
const CELL_SQUASH = 0.625;

/** The photosphere's visible rotation — front to back, not around like a
 *  clock. Each granulation cell or sunspot group emerges at one limb,
 *  sweeps across the face while rising toward the far side (we look down
 *  on the system, so "away from the viewer" is up), foreshortens and fades
 *  around the far limb, then re-emerges. Hand-tuned and deterministic, so
 *  every viewer sees the identical sun; the equator spins faster than the
 *  poles (differential rotation) and spots ride slower than granules. */
interface SunCell {
  id: string;
  kind: "granule" | "spot";
  /** Vertical base offset on the disk (+ = toward the viewer). */
  lat: number;
  /** Horizontal radius; height follows CELL_SQUASH. */
  rx: number;
  /** Horizontal travel half-distance — reaching the limb at r≈70. */
  amp: number;
  /** Rise toward the far side mid-sweep. */
  arc: number;
  /** Peak opacity mid-face. */
  peak: number;
  driftSecs: number;
  /** Phase offset, applied as a negative animation delay. */
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

function cellStyle(cell: SunCell): React.CSSProperties {
  return {
    "--amp": cell.amp,
    "--arc": cell.arc,
    "--peak": cell.peak,
    "--drift": `${cell.driftSecs}s`,
    "--delay": `${-cell.phaseSecs}s`
  } as React.CSSProperties;
}

interface CharacterNodeProps {
  character: CharacterDef;
  state: CharacterState;
  dimmed: boolean;
}

export const CharacterNode = memo(function CharacterNode({
  character,
  state,
  dimmed
}: CharacterNodeProps) {
  const Glyph = GLYPHS[character.glyph as keyof typeof GLYPHS];
  const isSun = character.id === "os";
  // The world's own surface — noise terrain and a drifting cloud deck,
  // baked once from its id. Motion-reduced skies becalm the deck and
  // freeze the moon on its rail.
  const world = isSun ? null : worldFor(character.id);
  // --node-hue is "H S%" — the generator wants the hue number alone. A hue
  // of 0 is legitimate (IAM's crimson): only NaN falls back, never 0.
  const parsedHue = parseInt(String(character.hue), 10);
  const textures = isSun ? null : planetTextures(character.id, Number.isNaN(parsedHue) ? 200 : parsedHue);
  // the star bakes its own mottled photosphere once
  const photosphere = isSun ? sunTexture() : null;
  const motionReduced = useMotionReduced();
  return (
    <g
      className="sim-node"
      data-state={state}
      data-sun={isSun || undefined}
      data-dimmed={dimmed || undefined}
      style={{ "--node-hue": character.hue } as React.CSSProperties}
      aria-label={`${character.name} — ${character.role} (${state})`}
      role="img"
    >
      {/* radiation glow + outer bloom — sun only, painted behind the body */}
      {isSun && <circle className="sim-sun-bloom" r={205} fill="url(#sim-sun-bloom)" />}
      {isSun && <circle className="sim-sun-glow" r={140} fill="url(#sim-sun-glow)" />}
      {/* the belt — hidden at idle, lit by state CSS only when the body
          speaks or a signal runs through it */}
      <circle className="sim-node-halo" r={isSun ? 84 : 52} />
      <circle className="sim-node-body" r={isSun ? 74 : 44} />
      {/* the star's baked photosphere: granulation cells and burnt lanes
          with a white-hot core, under a thin bright chromosphere rim */}
      {photosphere && (
        <image
          className="sim-sun-photosphere"
          href={photosphere}
          x={-74}
          y={-74}
          width={148}
          height={148}
          clipPath="url(#sim-sun-disk-clip)"
          preserveAspectRatio="xMidYMid slice"
        />
      )}
      {isSun && <circle className="sim-sun-rim" r={74} />}
      {/* the baked world: noise terrain in the body's own hue, then the
          cloud deck shuttling over it. Clipped to the disk; the night-side
          shade and limb darkening painted by the positioning layer round
          it into a sphere. */}
      {textures && (
        <g className="sim-node-surface" clipPath="url(#sim-planet-disk-clip)">
          <image
            className="sim-node-terrain"
            href={textures.surface}
            x={-44}
            y={-44}
            width={88}
            height={88}
            preserveAspectRatio="xMidYMid slice"
          />
          <image
            className="sim-node-clouds"
            href={textures.clouds}
            x={-53}
            y={-44}
            width={106}
            height={88}
            preserveAspectRatio="xMidYMid slice"
            style={{ "--drift-dur": `${world?.cloudDur ?? 50}s` } as React.CSSProperties}
          />
        </g>
      )}
      {/* the turning photosphere — granules and sunspots ride the sphere's
          rotation, clipped to the disk so they vanish around the limb */}
      {isSun && (
        <g className="sim-sun-surface" clipPath="url(#sim-sun-surface-clip)">
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
      )}
      {/* prominences: blurred plasma blooms half-spilled over the limb */}
      {isSun && (
        <g className="sim-sun-proms">
          {SUN_PROMS.map((prom) => (
            <circle key={prom.angle} cx={74} r={prom.r} transform={`rotate(${prom.angle})`} />
          ))}
        </g>
      )}
      {/* processing sweep ring */}
      {state === "processing" && <circle className="sim-node-sweep" r={isSun ? 84 : 52} />}
      {/* the sigil rides its own dark disc, so the platform mark reads
          clearly over whatever the surface is doing beneath it. The sun
          wears no sigil — OS is the star itself, not a marked world. */}
      {!isSun && <circle className="sim-node-glyph-disc" r={19} />}
      {!isSun && (
        <g className="sim-node-glyph" transform="translate(-15 -15)">
          <Glyph size={30} strokeWidth={1.9} aria-hidden />
        </g>
      )}
      {/* a small moon on a squashed rail — the scene looks down on the
          orbital plane, so the orbit renders as an ellipse; SMIL turns the
          arm about the body's local origin (CSS can't: the origin must be
          this node's own frame, which moves with every drift) */}
      {world?.moon && (
        <g transform="rotate(-14) scale(1 0.42)">
          <g className="sim-moon-arm">
            <circle className="sim-moon" cx={57} r={4.4} transform="scale(1 2.38)" />
            {!motionReduced && (
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
      {/* name/role labels deliberately live elsewhere: they ride the
          topmost NodeLabelLayer, so an overlapping body can never hide them */}
    </g>
  );
});
