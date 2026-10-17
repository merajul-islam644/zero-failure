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
import { lightsFor } from "./worlds";
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

export function SolarNodeLayer({
  states,
  visibleCast,
  onPlanetToggle,
  selectedId
}: SolarNodeLayerProps) {
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
      {ordered.map(({ character, point }) => {
        // Day side faces the star: the bearing from body to sun, recomputed
        // out here each frame so the memo'd node never re-renders. The lit
        // zone lives on the overlay's local -x, hence the half-turn offset.
        const sunBearing =
          (Math.atan2(ORBIT_CENTER.y - point.y, ORBIT_CENTER.x - point.x) * 180) / Math.PI;
        return (
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
            {/* the night side, rotated to always face away from the star:
                the day/night shade and the settlements' lights glowing on
                the dark hemisphere */}
            <g className="sim-node-night" transform={`rotate(${sunBearing - 180})`}>
              <circle className="sim-node-shade" r={44} fill="url(#sim-planet-shade)" />
              <g className="sim-node-lights">
                {lightsFor(character.id).map((light, i) => (
                  <circle key={i} cx={light.x} cy={light.y} r={light.r} />
                ))}
              </g>
            </g>
            {/* limb darkening — every sphere dims toward its own edge, day
                side and night alike; this is what turns a disc into a ball */}
            <circle className="sim-node-limb" r={44} fill="url(#sim-planet-limb)" />
            {/* the atmosphere: a soft hue ring hugging the limb, brightest
                where the day side begins */}
            <circle className="sim-node-atmo" r={47} />
          </g>
        );
      })}
    </g>
  );
}
