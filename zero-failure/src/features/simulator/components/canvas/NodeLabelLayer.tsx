// Per-frame layer: every body's name and role, floating above all the
// scene traffic. Labels sit here — above planets, packets and pulses —
// so an orbiting body can never cover them; speech bubbles and the menu
// fan stay above even this, as the deliberate chrome. Same y-sort as the
// bodies, so a label stack reads in the same order as its planets.

import { CAST } from "../../script/cast";
import type { CharacterState, PlatformId } from "../../engine/types";
import { useOrbitTime } from "../../state/PlayerContext";
import { useMotionReduced } from "../../state/SettingsContext";
import { orbitPosition } from "./orbits";

interface NodeLabelLayerProps {
  states: Record<PlatformId, CharacterState>;
  visibleCast: PlatformId[];
}

export function NodeLabelLayer({ states, visibleCast }: NodeLabelLayerProps) {
  // Sky time, not story time — labels ride the same drifted sky as the
  // bodies they name, frozen under reduced motion.
  const t = useOrbitTime();
  const tOrbit = useMotionReduced() ? 0 : t;

  const members = CAST.map((c) => ({ character: c, point: orbitPosition(c.id, tOrbit) })).sort(
    (a, b) => a.point.y - b.point.y
  );

  return (
    <g className="sim-labels">
      {members.map(({ character, point }) => {
        const isSun = character.id === "os";
        return (
          <g
            key={character.id}
            className="sim-node sim-node-label"
            data-state={states[character.id]}
            data-sun={isSun || undefined}
            data-dimmed={!visibleCast.includes(character.id) || undefined}
            style={{ "--node-hue": character.hue } as React.CSSProperties}
            transform={`translate(${point.x} ${point.y})`}
          >
            <text className="sim-node-name" y={isSun ? 104 : 74} textAnchor="middle">
              {character.name}
            </text>
            <text className="sim-node-role" y={isSun ? 122 : 92} dx={16} textAnchor="middle">
              {character.role}
            </text>
          </g>
        );
      })}
    </g>
  );
}
