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

/** Flare streaks around the sun: static in bearing — a real star doesn't
 *  wheel its flares around like a pinwheel — with varied lengths and a
 *  slow per-ray shimmer only. */
const SUN_RAYS = [
  { angle: 0, len: 168, w: 4.5, secs: 4.2, delay: 0 },
  { angle: 30, len: 138, w: 3.4, secs: 5.1, delay: -1.3 },
  { angle: 60, len: 158, w: 4.1, secs: 4.7, delay: -2.6 },
  { angle: 90, len: 132, w: 3.2, secs: 5.6, delay: -0.7 },
  { angle: 120, len: 162, w: 4.3, secs: 4.4, delay: -3.1 },
  { angle: 150, len: 136, w: 3.5, secs: 5.3, delay: -1.9 },
  { angle: 180, len: 172, w: 4.6, secs: 4.9, delay: -2.2 },
  { angle: 210, len: 140, w: 3.6, secs: 4.1, delay: -0.4 },
  { angle: 240, len: 156, w: 4, secs: 5.8, delay: -2.9 },
  { angle: 270, len: 134, w: 3.3, secs: 4.6, delay: -1.6 },
  { angle: 300, len: 164, w: 4.4, secs: 5.2, delay: -3.4 },
  { angle: 330, len: 142, w: 3.7, secs: 4.3, delay: -2.4 }
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
      {/* radiation glow + flare streaks — sun only, painted behind the body */}
      {isSun && <circle className="sim-sun-glow" r={140} fill="url(#sim-sun-glow)" />}
      {isSun && (
        <g className="sim-sun-rays" fill="url(#sim-sun-rays)">
          {SUN_RAYS.map((ray) => (
            <path
              key={ray.angle}
              className="sim-sun-ray"
              d={`M${-ray.w / 2} -74 L${ray.w / 2} -74 L${ray.w} ${-ray.len} L${-ray.w} ${-ray.len} Z`}
              transform={`rotate(${ray.angle})`}
              style={{ "--flick": `${ray.secs}s`, "--fdelay": `${ray.delay}s` } as React.CSSProperties}
            />
          ))}
        </g>
      )}
      {/* halo ring — state-colored by CSS */}
      <circle className="sim-node-halo" r={isSun ? 84 : 52} />
      <circle className="sim-node-body" r={isSun ? 74 : 44} />
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
      {/* processing sweep ring */}
      {state === "processing" && <circle className="sim-node-sweep" r={isSun ? 84 : 52} />}
      <g className="sim-node-glyph" transform={isSun ? "translate(-20 -20)" : "translate(-14 -14)"}>
        <Glyph size={isSun ? 40 : 28} strokeWidth={1.8} aria-hidden />
      </g>
      <text className="sim-node-name" y={isSun ? 104 : 74} textAnchor="middle">
        {character.name}
      </text>
      <text className="sim-node-role" y={isSun ? 122 : 92} dx={16} textAnchor="middle">
        {character.role}
      </text>
    </g>
  );
});
