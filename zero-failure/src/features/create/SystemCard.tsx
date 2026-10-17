// One forged system's card: a static portrait of the simulator's own
// sky — the real deep sky, the real four rings, worlds parked at their
// designed base seats — shared by the create bay, the presentation and
// the playwright sectors. A click opens the system's live view; the
// authoring bay also hands it a pencil and a two-press trash, the
// other sectors read only.

import { memo, useEffect, useId, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { GalaxyLayer } from "../simulator/components/canvas/GalaxyLayer";
import { ORBIT_CENTER, ORBIT_RINGS, ringPoint } from "../simulator/components/canvas/orbits";
import type { ForgedSystem } from "./systemsDoc";
import { orbitAngle, orbitSlots } from "./liveSky";
import { ForgeBody, ForgeStar, SkyDefs, forgedBodyId, planetHues, sunBearingDeg } from "./SystemSky";

// The static deep sky never re-renders: the canvas keeps its per-frame
// work in the leaf layers, and so do the cards.
const DeepSky = memo(GalaxyLayer);

export function SystemCard({
  system,
  onOpen,
  onEdit,
  onDelete,
}: {
  system: ForgedSystem;
  onOpen: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  // The trash arms on the first press and fires on the second — a
  // system should not vanish to a stray click. Disarm after a beat.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = window.setTimeout(() => setArmed(false), 3500);
    return () => window.clearTimeout(id);
  }, [armed]);
  const count = system.planets.length;
  // App base: the first app IS the center — it takes the sun's seat and
  // plays an app's part there; the rest ride the rings. Menu base keeps
  // the star (its sun is the app itself).
  const appCenter = system.base === "app" && count > 0 ? system.planets[0] : null;
  const orbiting = appCenter ? count - 1 : count;
  const uid = useId().replace(/:/g, "");
  // Each body's own hue — unique within the system by construction.
  const hues = planetHues(count, system.sun);
  // The card is a static portrait: the sim's real ring seats at their
  // designed base layout (t = 0). The live sweep lives in the view a
  // click opens.
  const slots = useMemo(() => orbitSlots(orbiting), [orbiting]);
  const t = 0;
  return (
    <article
      className="dash-system-card"
      role="button"
      tabIndex={0}
      aria-label={`Open ${system.sun} — the full solar-system view`}
      title="Open the solar-system view"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <header className="dash-system-head">
        <div>
          <p className="dash-kicker">{system.base === "app" ? "App base" : "Menu base"}</p>
          <h3>{system.sun}</h3>
        </div>
        {system.note && <p className="dash-system-note">{system.note}</p>}
        {/* the pencil reopens the forge on this system — it must not read
            as a click on the card itself, which raises the full view */}
        {onEdit && (
          <button
            type="button"
            className="dash-system-edit"
            aria-label={`Edit ${system.sun}`}
            title="Edit this system"
            onClick={(event) => {
              event.stopPropagation();
              onEdit();
            }}
          >
            <Pencil size={14} aria-hidden />
          </button>
        )}
        {/* the trash: one press arms it, a second confirms */}
        {onDelete && (
          <button
            type="button"
            className={`dash-system-edit dash-system-delete${armed ? " armed" : ""}`}
            aria-label={armed ? `Confirm delete ${system.sun}` : `Delete ${system.sun}`}
            title={armed ? "Click again to delete" : "Delete this system"}
            onClick={(event) => {
              event.stopPropagation();
              if (armed) {
                setArmed(false);
                onDelete();
              } else {
                setArmed(true);
              }
            }}
          >
            {armed ? <span className="dash-system-delete-word">SURE?</span> : <Trash2 size={14} aria-hidden />}
          </button>
        )}
      </header>
      {/* the frame hugs the sky's true content — the rings, the riding
          moons, the label lines — so no band of the card sits empty */}
      <svg
        className="dash-system-sky"
        viewBox={`${ORBIT_CENTER.x - 544} ${ORBIT_CENTER.y - 360} 1088 759`}
        role="img"
        aria-label={`${system.sun} — mini solar system with ${count} planets`}
      >
        <SkyDefs uid={uid} />
        {/* the real deep sky: Milky Way stars, the named neighbor
            galaxies — the deck's own backdrop (comets are the live
            view's visitors, not a portrait's) */}
        <DeepSky />
        {/* the simulator's own four rings, dash for dash */}
        <g className="sim-orbits" aria-hidden>
          {ORBIT_RINGS.map((ring) => (
            <ellipse
              key={ring.index}
              className="sim-orbit"
              cx={ORBIT_CENTER.x}
              cy={ORBIT_CENTER.y}
              rx={ring.rx}
              ry={ring.ry}
            />
          ))}
        </g>
        {/* the center's name paints beneath the traffic, canvas order —
            the center app's own name on an app base, the system's name
            under the star on a menu base */}
        <text className="dash-system-sun-name" x={ORBIT_CENTER.x} y={ORBIT_CENTER.y + 120}>
          {appCenter ? appCenter.name : system.sun}
        </text>
        <g transform={`translate(${ORBIT_CENTER.x} ${ORBIT_CENTER.y})`}>
          {/* the center seat always wears the sun's fire outright — no
              sigil; on an app base the sun-name text carries the first
              app's name beneath it */}
          <ForgeStar uid={uid} scale={1} />
        </g>
        {system.planets.map((planet, index) => {
          if (appCenter && index === 0) return null; // the center app took the sun's seat
          const slot = slots[appCenter ? index - 1 : index]!;
          const point = ringPoint(
            slot.ringIndex,
            orbitAngle(slot, ORBIT_RINGS[slot.ringIndex]!.periodMs, t)
          );
          return (
            <g key={index} transform={`translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`}>
              <ForgeBody
                uid={uid}
                bodyId={forgedBodyId(system.sun, planet.name)}
                hue={hues[index]!}
                logo={planet.logo}
                bearing={sunBearingDeg(point.x - ORBIT_CENTER.x, point.y - ORBIT_CENTER.y)}
                scale={1}
                reduced={true}
              />
              <text className="dash-system-planet-name" y={74}>
                {planet.name}
              </text>
              {planet.label && (
                <text className="dash-system-planet-label" y={92}>
                  {planet.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </article>
  );
}
