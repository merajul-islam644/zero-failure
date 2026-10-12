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

/** Ray streaks around the sun: thin wedges fanning out at even angles,
 *  filled with the sun-centered #sim-sun-rays falloff. */
const SUN_RAY_COUNT = 12;
const SUN_RAY_STEP = 360 / SUN_RAY_COUNT;
const SUN_RAY_WEDGE = "M0 -74 L5 -150 L-5 -150 Z";

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
      {/* radiation glow + ray streaks — sun only, painted behind the body */}
      {isSun && <circle className="sim-sun-glow" r={140} fill="url(#sim-sun-glow)" />}
      {isSun && (
        <g className="sim-sun-rays" fill="url(#sim-sun-rays)">
          {Array.from({ length: SUN_RAY_COUNT }, (_, i) => (
            <path key={i} d={SUN_RAY_WEDGE} transform={`rotate(${i * SUN_RAY_STEP})`} />
          ))}
        </g>
      )}
      {/* halo ring — state-colored by CSS */}
      <circle className="sim-node-halo" r={isSun ? 84 : 52} />
      {/* corona — slow dashed rotation, sun only */}
      {isSun && <circle className="sim-sun-corona" r={94} />}
      {/* processing sweep ring */}
      {state === "processing" && <circle className="sim-node-sweep" r={isSun ? 84 : 52} />}
      <circle className="sim-node-body" r={isSun ? 74 : 44} />
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
