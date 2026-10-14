// Per-frame layer: every canvas body positioned by its orbit. Wraps the
// memo'd CharacterNodes in cheap positioning <g> transforms so the node
// props (character/state/dimmed) never change per frame and the memo
// holds — only these transforms update at 60fps. Same designated
// usePlaybackTime pattern as PacketLayer. Clicks bubble up as planet
// toggles; the open menu itself paints above everything in
// PlanetMenuLayer, rendered after the speech bubbles.

import { CAST, CAST_BY_ID } from "../../script/cast";
import type { CharacterState, PlatformId } from "../../engine/types";
import { useOrbitTime } from "../../state/PlayerContext";
import { useMotionReduced } from "../../state/SettingsContext";
import { ORBIT_CENTER, orbitPosition } from "./orbits";
import { CharacterNode } from "./CharacterNode";

interface SolarNodeLayerProps {
  states: Record<PlatformId, CharacterState>;
  visibleCast: PlatformId[];
  /** A body was clicked — open, close or switch its menu. The sun
   *  toggles too: it carries the console's own navigation. */
  onPlanetToggle: (id: PlatformId) => void;
  /** The body whose menu is open, if any — it paints above every
   *  neighbor so orbit drift can never walk another planet across the
   *  selection. */
  selectedId?: PlatformId | null;
}

export function SolarNodeLayer({ states, visibleCast, onPlanetToggle, selectedId }: SolarNodeLayerProps) {
  // Sky time, not story time: orbits keep drifting through dialogue pauses.
  const t = useOrbitTime();
  // Reduced motion freezes the sky at the designed base-angle layout no
  // matter where the story head is; packets keep tracking, as today.
  const tOrbit = useMotionReduced() ? 0 : t;

  // The sun is fixed at the center; planets revolve. Sort by y so the
  // visually lower planet draws in front where neighboring rings cross —
  // then lift the selected planet to the very end of that order: the
  // menu fan is already topmost, and the body it springs from must be
  // above its neighbors too.
  const ordered = CAST.filter((c) => c.id !== "os")
    .map((c) => ({ character: c, point: orbitPosition(c.id, tOrbit) }))
    .sort((a, b) => a.point.y - b.point.y);
  const picked = ordered.findIndex(({ character }) => character.id === selectedId);
  if (picked >= 0) ordered.push(...ordered.splice(picked, 1));
  // Same courtesy for whoever is speaking — the story focus must never be
  // covered by a drifting body. Speakers lift last, so speech outranks
  // the menu selection if they ever land on different planets.
  for (let i = ordered.length - 1; i >= 0; i--) {
    if (states[ordered[i]!.character.id] === "speaking") {
      ordered.push(...ordered.splice(i, 1));
    }
  }

  return (
    <g className="sim-nodes">
      <g
        transform={`translate(${ORBIT_CENTER.x} ${ORBIT_CENTER.y})`}
        data-clickable=""
        onClick={() => onPlanetToggle("os")}
      >
        <CharacterNode character={CAST_BY_ID.os} state={states.os} dimmed={!visibleCast.includes("os")} />
      </g>
      {ordered.map(({ character, point }) => (
        <g
          key={character.id}
          transform={`translate(${point.x} ${point.y})`}
          data-clickable=""
          onClick={() => onPlanetToggle(character.id)}
        >
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
