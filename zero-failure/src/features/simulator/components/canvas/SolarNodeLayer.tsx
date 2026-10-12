// Per-frame layer: every canvas body positioned by its orbit. Wraps the
// memo'd CharacterNodes in cheap positioning <g> transforms so the node
// props (character/state/dimmed) never change per frame and the memo
// holds — only these transforms update at 60fps. Same designated
// usePlaybackTime pattern as PacketLayer.

import { CAST, CAST_BY_ID } from "../../script/cast";
import type { CharacterState, PlatformId } from "../../engine/types";
import { useOrbitTime } from "../../state/PlayerContext";
import { useMotionReduced } from "../../state/SettingsContext";
import { ORBIT_CENTER, orbitPosition } from "./orbits";
import { CharacterNode } from "./CharacterNode";

interface SolarNodeLayerProps {
  states: Record<PlatformId, CharacterState>;
  visibleCast: PlatformId[];
}

export function SolarNodeLayer({ states, visibleCast }: SolarNodeLayerProps) {
  // Sky time, not story time: orbits keep drifting through dialogue pauses.
  const t = useOrbitTime();
  // Reduced motion freezes the sky at the designed base-angle layout no
  // matter where the story head is; packets keep tracking, as today.
  const tOrbit = useMotionReduced() ? 0 : t;

  // The sun is fixed at the center; planets revolve. Sort by y so the
  // visually lower planet draws in front where neighboring rings cross.
  const planets = CAST.filter((c) => c.id !== "os")
    .map((c) => ({ character: c, point: orbitPosition(c.id, tOrbit) }))
    .sort((a, b) => a.point.y - b.point.y);

  return (
    <g className="sim-nodes">
      <g transform={`translate(${ORBIT_CENTER.x} ${ORBIT_CENTER.y})`}>
        <CharacterNode character={CAST_BY_ID.os} state={states.os} dimmed={!visibleCast.includes("os")} />
      </g>
      {planets.map(({ character, point }) => (
        <g key={character.id} transform={`translate(${point.x} ${point.y})`}>
          <CharacterNode
            character={character}
            state={states[character.id]}
            dimmed={!visibleCast.includes(character.id)}
          />
        </g>
      ))}
    </g>
  );
}
