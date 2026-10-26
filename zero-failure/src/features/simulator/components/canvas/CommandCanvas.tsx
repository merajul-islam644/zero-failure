// The command-center canvas: fixed 1600x900 viewBox, scales with its
// container. A solar system — OS is the sun at the center, the faint
// orbit rings below are static, and the designated per-frame layers
// (SolarNodeLayer, PacketLayer, LivePulseLayer) ride the clock. One
// useSimSnapshot subscription keeps everything discrete off the 60fps path.

import { useMemo } from "react";
import { CAST } from "../../script/cast";
import { useSimSnapshot } from "../../state/PlayerContext";
import type { Timeline } from "../../engine/timeline";
import type { LiveActivityEvent } from "../../live/activity";
import { ORBIT_CENTER, ORBIT_RINGS } from "./orbits";
import { GalaxyLayer } from "./GalaxyLayer";
import { SolarNodeLayer } from "./SolarNodeLayer";
import { NodeLabelLayer } from "./NodeLabelLayer";
import { SpeechBubbleLayer } from "./SpeechBubbleLayer";
import { PacketLayer } from "./PacketLayer";
import { LivePulseLayer } from "./LivePulseLayer";

interface CommandCanvasProps {
  timeline: Timeline;
  liveEvents?: LiveActivityEvent[];
}

export function CommandCanvas({
  timeline,
  liveEvents
}: CommandCanvasProps) {
  const snapshot = useSimSnapshot(timeline.events);

  const viewBox = `${ORBIT_CENTER.x - 800} ${ORBIT_CENTER.y - 450} 1600 900`;

  // The solar system is the full cast: every platform stays fully visible
  // in every scene. Scene-based dimming left the early story nearly empty —
  // only the sun was lit until each platform's scene arrived.
  const visibleCast = useMemo(() => CAST.map((c) => c.id), []);

  return (
    <svg
      className="sim-canvas"
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="SELISE Blocks command center"
    >
      <defs>
        {/* Sun colors are literal, not theme variables: a real star is
            white-hot at the core and — limb darkening — falls off through
            yellow to burnt orange at the rim in every theme. */}
        <radialGradient id="sim-sun-fill" cx="50%" cy="42%" r="62%">
          <stop offset="0%" stopColor="#fffef2" />
          <stop offset="22%" stopColor="#fff6c4" />
          <stop offset="45%" stopColor="#ffd66e" />
          <stop offset="68%" stopColor="#ffab35" />
          <stop offset="86%" stopColor="#ff8420" />
          <stop offset="100%" stopColor="#f26512" />
        </radialGradient>
        {/* radiation hugging the limb, breathing slowly */}
        <radialGradient id="sim-sun-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff6d8" stopOpacity={0.55} />
          <stop offset="30%" stopColor="#ffd27a" stopOpacity={0.38} />
          <stop offset="62%" stopColor="#ff9433" stopOpacity={0.16} />
          <stop offset="100%" stopColor="#ff8c1f" stopOpacity={0} />
        </radialGradient>
        {/* the wide faint haze a star carries for hundreds of pixels */}
        <radialGradient id="sim-sun-bloom" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffb75e" stopOpacity={0.2} />
          <stop offset="55%" stopColor="#ff8c1f" stopOpacity={0.07} />
          <stop offset="100%" stopColor="#ff8c1f" stopOpacity={0} />
        </radialGradient>
        {/* the turning photosphere is clipped to just inside the limb, so
            drifting cells and spots disappear around the edge of the disk */}
        <clipPath id="sim-sun-surface-clip">
          <circle r={70} />
        </clipPath>
        {/* the baked photosphere's disk clip — same trick as the planets:
            userSpaceOnUse resolves in the sun node's own space */}
        <clipPath id="sim-sun-disk-clip">
          <circle r={74} />
        </clipPath>
        {/* one shared planet disk clip: userSpaceOnUse resolves in each
            referencing element's own node space, where every body's disk
            is r44 at the local origin — so all nine planets share it */}
        <clipPath id="sim-planet-disk-clip">
          <circle r={44} />
        </clipPath>
        {/* day/night shading for the planets: highlight pools on the
            sun-facing limb, the terminator crosses soft, and the far limb
            falls fully to night. The overlay circle rotates to the sun's
            bearing as the orbit carries it. */}
        <radialGradient id="sim-planet-shade" cx="0.3" cy="0.5" r="0.78">
          <stop offset="0%" stopColor="#010208" stopOpacity={0} />
          <stop offset="34%" stopColor="#010208" stopOpacity={0} />
          <stop offset="50%" stopColor="#010208" stopOpacity={0.16} />
          <stop offset="68%" stopColor="#010208" stopOpacity={0.42} />
          <stop offset="85%" stopColor="#010208" stopOpacity={0.7} />
          <stop offset="100%" stopColor="#010208" stopOpacity={0.92} />
        </radialGradient>
        {/* limb darkening: unbiased, all the way around — real spheres
            dim at every edge, lit or not */}
        <radialGradient id="sim-planet-limb">
          <stop offset="68%" stopColor="#010208" stopOpacity={0} />
          <stop offset="92%" stopColor="#010208" stopOpacity={0.26} />
          <stop offset="100%" stopColor="#010208" stopOpacity={0.5} />
        </radialGradient>
      </defs>
      {/* The room glow lives on the surrounding band (.sim-canvas-area in
          simulator.css): one gradient continues under this transparent-backed
          SVG, so the 16:9 frame edge never reads as a black seam against the
          letterbox. */}

      {/* deep-sky backdrop sits behind everything on the canvas */}
      <GalaxyLayer />

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

      {/* Names and roles paint beneath the bodies: each label sits below
          its own planet, and when two planets drift close the one in
          front (painted later) covers the one behind's name — sky depth.
          A label never meets its own body, so nothing hides its own
          name. */}
      <NodeLabelLayer states={snapshot.states} visibleCast={visibleCast} />
      <SolarNodeLayer
        states={snapshot.states}
        visibleCast={visibleCast}
      />
      <PacketLayer timeline={timeline} />
      {liveEvents && liveEvents.length > 0 && <LivePulseLayer events={liveEvents} />}
      {/* The speaking bubble outranks every body here. */}
      <SpeechBubbleLayer dialogue={snapshot.dialogue} states={snapshot.states} />
    </svg>
  );
}
