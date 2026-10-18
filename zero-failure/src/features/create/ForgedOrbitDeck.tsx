// The forged system, screened on the simulator's own canvas: the real
// 1600x900 design frame with its zoom-grown viewBox, the real deep sky
// (GalaxyLayer — galaxies, twinkles, comets), the real orbit rings and
// Kepler periods (orbits.ts), the real label plates, and the bodies at
// the sim's own design units — the star's turning photosphere included.
// Only the cast differs: the forged planets ride the sim's ring seats,
// swept by the same angular motion, y-sorted and painted in the same
// order. Reduced motion freezes the sky at the designed base layout,
// exactly as the canvas does.

import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { GalaxyLayer } from "../simulator/components/canvas/GalaxyLayer";
import { CartoonAvatar } from "../simulator/components/canvas/CartoonAvatar";
import { CAST } from "../simulator/script/cast";
import { ORBIT_CENTER, ORBIT_RINGS, ringPoint } from "../simulator/components/canvas/orbits";
import type { ForgedSystem } from "./systemsDoc";
import { orbitAngle, orbitSlots } from "./liveSky";
import { useSkyClock } from "./skyClock";
import {
  ForgeBody,
  ForgeStar,
  SkyDefs,
  forgedBodyId,
  planetHues,
  sunBearingDeg,
  SUN_ACCENT_HUE,
  useReducedMotion
} from "./SystemSky";

// The static sky never re-renders: only the body transforms sweep per
// frame, the way the canvas keeps its per-frame work in the leaf layers.
const DeepSky = memo(GalaxyLayer);

const OrbitRings = memo(function OrbitRings() {
  return (
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
  );
});

/** The panel's live box, measured — the canvas's own "stretch the sky,
 *  never the story" grows the viewBox along one axis until it matches
 *  the frame's shape, so the sky reaches every edge with nothing
 *  cropped and nothing distorted. */
function useStageFrame() {
  const ref = useRef<SVGSVGElement | null>(null);
  const [frame, setFrame] = useState({ w: 1600, h: 900 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 1 && rect.height > 1) setFrame({ w: rect.width, h: rect.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, frame };
}

interface DeckBody {
  planet: ForgedSystem["planets"][number];
  index: number;
  hue: number;
  ringIndex: number;
  x: number;
  y: number;
}

/** One label plate: the sim's own observatory plate — tick, name, the
 *  mono catalog line — riding beneath the bodies in the same y-order. */
function ForgedPlate({
  x,
  y,
  name,
  role,
  plate,
  hue,
  isSun
}: {
  x: number;
  y: number;
  name: string;
  role: string;
  plate: string;
  hue: string;
  isSun?: boolean;
}) {
  return (
    <g
      className="sim-node sim-node-label"
      data-sun={isSun || undefined}
      style={{ "--node-hue": hue } as React.CSSProperties}
      transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}
    >
      <line
        className="sim-node-tick"
        y1={isSun ? 84 : 54}
        y2={isSun ? 96 : 66}
      />
      <text className="sim-node-name" y={isSun ? 110 : 80} dx={1.5} textAnchor="middle">
        {name}
      </text>
      <text className="sim-node-role" y={isSun ? 124 : 94} dx={1} textAnchor="middle">
        {role ? `${plate} · ${role}` : plate}
      </text>
    </g>
  );
}

interface ForgedOrbitDeckProps {
  system: ForgedSystem;
  /** When set, every forged world becomes a button — the playwright
   *  sector's repository consoles hang off this click. Presentation and
   *  the view modal never pass it and their skies stay read-only. */
  onPlanetClick?: (planet: ForgedSystem["planets"][number], index: number) => void;
  /** The action a planet click promises in its hover title — the
   *  repository console by default; the presentation sector rewords it. */
  planetTitleSuffix?: string;
  /** When set, the star itself is a button too — the system's own
   *  console, the way the playwright sector anchors cargo to the sun. */
  onSunClick?: () => void;
  /** One line under the heading telling the viewer the bodies answer
   *  the pointer (why they glow and what a click opens). */
  skyHint?: string;
  /** When set, the header carries a zoom control beside the note — the
   *  page re-homes the deck into a full-display overlay. */
  onZoom?: () => void;
  /** When set — inside the full-display overlay — the header carries
   *  the exit control in the very seat the zoom button held, so the
   *  control never changes address when the display grows. */
  onExitZoom?: () => void;
  /** The sky's time from the page's own clock — the presentation show
   *  rides the transport's head (pause freezes, speed scales, scrub
   *  positions the sweep). Absent, the deck runs its shared page clock.
   *  Reduced motion still pins the designed base layout. */
  t?: number;
  /** The world speaking right now — its ring index, the words the sky
   *  holds above it, and the speaker's name and cartoon face the bubble
   *  wears. Null (or absent) and the sky keeps quiet. */
  speaker?: { index: number; text: string; name?: string; avatar?: string } | null;
}

export function ForgedOrbitDeck({
  system,
  onPlanetClick,
  onSunClick,
  skyHint,
  onZoom,
  onExitZoom,
  t,
  planetTitleSuffix,
  speaker,
}: ForgedOrbitDeckProps) {
  const reduced = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const count = system.planets.length;
  // App base: the first app takes the sun's seat — an app at the
  // center, the rest ride the rings. Menu base keeps the star (its sun
  // is the app itself).
  const appCenter = system.base === "app" && count > 0 ? system.planets[0] : null;
  const orbiting = appCenter ? count - 1 : count;
  const hues = planetHues(count, system.sun);
  const slots = useMemo(() => orbitSlots(orbiting), [orbiting]);
  const skyT = useSkyClock(reduced);
  const time = t === undefined ? skyT : reduced ? 0 : t;
  const { ref, frame } = useStageFrame();

  // The canvas's exact viewBox growth: max(1600, 900·ratio) × max(900,
  // 1600/ratio), centered on the sun.
  const ratio = frame.w / frame.h;
  const vw = Math.max(1600, 900 * ratio);
  const vh = Math.max(900, 1600 / ratio);
  const viewBox = `${ORBIT_CENTER.x - vw / 2} ${ORBIT_CENTER.y - vh / 2} ${vw} ${vh}`;

  // Every body at its Kepler sweep — the sim's orbitState math via its
  // own ringPoint, reduced motion pinning t at the base layout. The
  // center app parks at the middle; its bubble and plates read it there.
  const bodies: DeckBody[] = system.planets.map((planet, index) => {
    if (appCenter && index === 0) {
      return { planet, index, hue: hues[index]!, ringIndex: -1, x: ORBIT_CENTER.x, y: ORBIT_CENTER.y };
    }
    const slot = slots[appCenter ? index - 1 : index]!;
    const point = ringPoint(slot.ringIndex, orbitAngle(slot, ORBIT_RINGS[slot.ringIndex]!.periodMs, time));
    return { planet, index, hue: hues[index]!, ringIndex: slot.ringIndex, x: point.x, y: point.y };
  });
  // Same y-sort as the canvas: the lower body paints in front, and the
  // labels stack in the same order as their planets. The center app is
  // not in this loop — it has already taken the sun's seat above; a
  // second copy here would paint a planet ball right over its fire.
  const ordered = [...bodies]
    .filter((body) => !(appCenter && body.index === 0))
    .sort((a, b) => a.y - b.y);
  const plateOrder = [
    appCenter
      ? {
          key: "sun",
          x: ORBIT_CENTER.x,
          y: ORBIT_CENTER.y,
          name: appCenter.name,
          role: appCenter.label ?? "Center app",
          plate: "PLT-01",
          hue: `${hues[0]} 58% 60%`,
          isSun: true
        }
      : {
          key: "sun",
          x: ORBIT_CENTER.x,
          y: ORBIT_CENTER.y,
          name: system.sun,
          role: system.base === "app" ? "App base" : "Menu base",
          plate: "PLT-01",
          hue: "232 89% 62%",
          isSun: true
        },
    ...[...bodies]
      .filter((body) => !(appCenter && body.index === 0))
      .sort((a, b) => a.y - b.y)
      .map((body) => ({
        key: `planet-${body.index}`,
        x: body.x,
        y: body.y,
        name: body.planet.name,
        role: body.planet.label ?? "",
        plate: `PLT-${String(body.index + 2).padStart(2, "0")}`,
        hue: `${body.hue} 58% 60%`,
        isSun: false
      }))
  ];

  return (
    <section className="dash-live-panel">
      <header className="dash-live-head">
        <div>
          <p className="dash-kicker">{system.base === "app" ? "App base" : "Menu base"}</p>
          <h2>{system.sun}</h2>
          {skyHint && <p className="dash-live-hint">{skyHint}</p>}
        </div>
                   {/* the header's right: the zoom control sits immediately left
              of the note, the pair riding as one group — and inside the
              full-display overlay the same seat carries the exit arrow,
              so the control keeps its address when the display grows */}
          {onZoom || onExitZoom ? (
            <div className="dash-live-side">
              {onZoom && (
                <button
                  type="button"
                  className="dash-zoom-btn"
                  aria-label="Open the full-display view"
                  title="Full-display zoom"
                  onClick={onZoom}
                >
                  <Maximize2 size={15} aria-hidden />
                </button>
              )}
              {onExitZoom && (
                <button
                  type="button"
                  className="dash-zoom-btn"
                  aria-label="Exit the full-display view"
                  title="Exit zoom (Esc)"
                  onClick={onExitZoom}
                >
                  <Minimize2 size={15} aria-hidden />
                </button>
              )}
              {system.note && <p className="dash-system-note">{system.note}</p>}
            </div>
          ) : (
            system.note && <p className="dash-system-note">{system.note}</p>
          )}
        </header>
      <svg
        ref={ref}
        className="dash-live-sky"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`${system.sun} — live solar system with ${count} planets`}
      >
        <SkyDefs uid={uid} />
        {/* the deep sky, identical: real galaxies, twinkles, comets */}
        <DeepSky />
        <OrbitRings />
        {/* names and roles paint beneath the bodies, canvas order */}
        <g className="sim-labels">
          {plateOrder.map(({ key, ...entry }) => (
            <ForgedPlate key={key} {...entry} />
          ))}
        </g>
        <g
          className={onSunClick ? "dash-deck-sun" : undefined}
          role={onSunClick ? "button" : undefined}
          tabIndex={onSunClick ? 0 : undefined}
          transform={`translate(${ORBIT_CENTER.x} ${ORBIT_CENTER.y})`}
          onClick={onSunClick}
          onKeyDown={
            onSunClick
              ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSunClick();
                  }
                }
              : undefined
          }
        >
          {/* the hover tooltip and the accessible name in one — the
              center app's name on an app base, the system's under the
              star on a menu base; the suffix follows the sector's own
              promise (the presentation's sun speaks, the deck's opens
              its console) */}
          {onSunClick && (
            <title>{`${appCenter ? appCenter.name : system.sun} — ${planetTitleSuffix ?? "open the repository console"}`}</title>
          )}
          {/* a generous invisible target riding the star — it reads as
              the whole fireball, not a 74-unit disk */}
          {onSunClick && <circle className="dash-sky-hit" r={84} />}
          {/* the center seat always wears the sun's fire outright — no
              sigil; on an app base the sun plate carries the first
              app's name */}
          <ForgeStar uid={uid} scale={1} />
        </g>
        {ordered.map((body) => (
          <g
            key={body.index}
            className={onPlanetClick ? "dash-deck-planet" : undefined}
            role={onPlanetClick ? "button" : undefined}
            tabIndex={onPlanetClick ? 0 : undefined}
            transform={`translate(${body.x.toFixed(1)} ${body.y.toFixed(1)})`}
            onClick={onPlanetClick ? () => onPlanetClick(body.planet, body.index) : undefined}
            onKeyDown={
              onPlanetClick
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onPlanetClick(body.planet, body.index);
                    }
                  }
                : undefined
            }
          >
            {/* the hover tooltip and the accessible name in one */}
            {onPlanetClick && (
              <title>{`${body.planet.name} — ${planetTitleSuffix ?? "open the repository console"}`}</title>
            )}
            {/* a generous invisible target riding the body — a sweeping
                world is a small thing to hit */}
            {onPlanetClick && <circle className="dash-sky-hit" r={56} />}
            <ForgeBody
              uid={uid}
              bodyId={forgedBodyId(system.sun, body.planet.name)}
              hue={body.hue}
              logo={body.planet.logo}
              bearing={sunBearingDeg(body.x - ORBIT_CENTER.x, body.y - ORBIT_CENTER.y)}
              scale={1}
              reduced={reduced}
            />
          </g>
        ))}
        {/* The speaking world's own words, a bubble riding above it —
            topmost, so a planet crossing in front never covers a voice.
            The speaker's cartoon (the cast face its level picked) sits
            beside the words; the tail touches the balloon's bottom
            edge; the wrap anchors the text there whatever its length. */}
        {speaker &&
          (() => {
            // the menu base's sun speaks from the center — index -1 is
            // the identity's own seat, no ring slot of its own
            const spot =
              speaker.index === -1
                ? { x: ORBIT_CENTER.x, y: ORBIT_CENTER.y }
                : bodies[speaker.index];
            if (!spot) return null;
            const face = speaker.avatar ? CAST.find((c) => c.id === speaker.avatar) : undefined;
            const sunSeat = speaker.index === -1 || (appCenter && speaker.index === 0);
            return (
              <g
                className="dash-speech"
                transform={`translate(${spot.x.toFixed(1)} ${spot.y.toFixed(1)})`}
                style={
                  {
                    "--node-hue": `${sunSeat ? SUN_ACCENT_HUE : hues[speaker.index]} 58% 60%`
                  } as React.CSSProperties
                }
              >
                <path className="dash-speech-tail" d="M -9 -56 L 0 -44 L 9 -56 Z" />
                <foreignObject x={-150} y={-186} width={300} height={132}>
                  <div className="dash-speech-wrap">
                    <div className="dash-speech-card">
                      {face && (
                        <svg className="dash-speech-avatar" viewBox="0 0 64 64" aria-hidden>
                          <CartoonAvatar character={face} mood="talk" />
                        </svg>
                      )}
                      <div className="dash-speech-body">
                        {speaker.name && <span className="dash-speech-name">{speaker.name}</span>}
                        <p className="dash-speech-balloon">{speaker.text}</p>
                      </div>
                    </div>
                  </div>
                </foreignObject>
              </g>
            );
          })()}
      </svg>
    </section>
  );
}
