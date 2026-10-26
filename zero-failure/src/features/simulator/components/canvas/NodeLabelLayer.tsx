// The bodies' names and roles, painted beneath the body layer: each label
// sits below its own planet like always, and when two planets drift
// close, the one in front (lower on screen, painted later) naturally
// covers the one behind's name — sky depth, not floating chrome. Same
// y-sort as the bodies, so a label stack reads in the same order as its
// planets. Pure chrome: never catches the pointer.

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

  // Plates must be stable per body — indexed by cast order, never by the
  // y-sort below, or a planet's number would reshuffle as it drifts.
  const castIndex = new Map(CAST.map((c, i) => [c.id, i]));

  return (
    <g className="sim-labels">
      {members.map(({ character, point }) => {
        const isSun = character.id === "os";
        // Catalog designation: cast order, zero-padded — the same numbers
        // the deck's registry prints, so chart and console agree.
        const plate = `PLT-${String((castIndex.get(character.id) ?? 0) + 1).padStart(2, "0")}`;
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
            {/* observatory leader: a hairline drops from the body to its plate */}
            <line className="sim-node-tick" y1={isSun ? 84 : 54} y2={isSun ? 96 : 66} />
            <text className="sim-node-name" y={isSun ? 110 : 80} dx={1.5} textAnchor="middle">
              {character.name}
            </text>
            <text className="sim-node-role" y={isSun ? 124 : 94} dx={1} textAnchor="middle">
              {plate} · {character.role}
            </text>
          </g>
        );
      })}
    </g>
  );
}
