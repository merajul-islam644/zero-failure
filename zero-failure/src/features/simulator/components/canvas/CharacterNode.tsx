// One platform character on the command-center canvas. Pure presentation:
// all behavior arrives via the `state` prop; styling lives in simulator.css
// keyed by data-state.

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
  return (
    <g
      className="sim-node"
      data-state={state}
      data-dimmed={dimmed || undefined}
      transform={`translate(${character.x} ${character.y})`}
      style={{ "--node-hue": character.hue } as React.CSSProperties}
      aria-label={`${character.name} — ${character.role} (${state})`}
      role="img"
    >
      {/* halo ring — state-colored by CSS */}
      <circle className="sim-node-halo" r={52} />
      {/* processing sweep ring */}
      {state === "processing" && <circle className="sim-node-sweep" r={52} />}
      <circle className="sim-node-body" r={44} />
      <g className="sim-node-glyph" transform="translate(-14 -14)">
        <Glyph size={28} strokeWidth={1.8} aria-hidden />
      </g>
      <text className="sim-node-name" y={74} textAnchor="middle">
        {character.name}
      </text>
      <text className="sim-node-role" y={92} textAnchor="middle">
        {character.role}
      </text>
    </g>
  );
});
