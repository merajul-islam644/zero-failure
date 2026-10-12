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
import { SpeechBubbleLayer } from "./SpeechBubbleLayer";
import { PacketLayer } from "./PacketLayer";
import { LivePulseLayer } from "./LivePulseLayer";

interface CommandCanvasProps {
  timeline: Timeline;
  liveEvents?: LiveActivityEvent[];
  /** Frame aspect (w/h) while zoomed: the viewBox grows past the 1600x900
   *  design frame — centered on the sun — until it matches, so a wide or
   *  tall window fills edge to edge instead of letterboxing. */
  aspect?: number;
}

export function CommandCanvas({ timeline, liveEvents, aspect }: CommandCanvasProps) {
  const snapshot = useSimSnapshot(timeline.events);

  // Stretch the sky, never the story: grow one axis into the padded sky
  // bounds until the viewBox matches the frame's shape. Content stays
  // centered and undistorted; meet then fills the frame exactly.
  const ratio = aspect && Number.isFinite(aspect) && aspect > 0 ? aspect : 16 / 9;
  const vw = Math.max(1600, 900 * ratio);
  const vh = Math.max(900, 1600 / ratio);
  const viewBox = `${ORBIT_CENTER.x - vw / 2} ${ORBIT_CENTER.y - vh / 2} ${vw} ${vh}`;

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
          <stop offset="0%" stopColor="#fffef5" />
          <stop offset="28%" stopColor="#fff3a1" />
          <stop offset="52%" stopColor="#ffc23d" />
          <stop offset="76%" stopColor="#ff8c1f" />
          <stop offset="100%" stopColor="#e04e0e" />
        </radialGradient>
        {/* soft radiation spreading off the limb in every direction */}
        <radialGradient id="sim-sun-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffb75e" stopOpacity={0.6} />
          <stop offset="40%" stopColor="#ff9433" stopOpacity={0.3} />
          <stop offset="100%" stopColor="#ff8c1f" stopOpacity={0} />
        </radialGradient>
        {/* ray streaks: fades from the limb (r≈74) out to the tips (r=170);
            userSpaceOnUse so every wedge shares the sun-centered falloff */}
        <radialGradient id="sim-sun-rays" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="170">
          <stop offset="0%" stopColor="#ffd27a" stopOpacity={0} />
          <stop offset="0.44" stopColor="#ffc46a" stopOpacity={0.5} />
          <stop offset="100%" stopColor="#ffb14e" stopOpacity={0} />
        </radialGradient>
        {/* the turning photosphere is clipped to just inside the limb, so
            drifting cells and spots disappear around the edge of the disk */}
        <clipPath id="sim-sun-surface-clip">
          <circle r={70} />
        </clipPath>
      </defs>
      {/* The room glow now lives on the surrounding band (.sim-canvas-area /
          .sim-zoom-overlay in simulator.css): one gradient continues under
          this transparent-backed SVG, so the 16:9 frame edge never reads as
          a black seam against the letterbox — in the stage or full-display
          zoom alike. */}

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

      <SolarNodeLayer states={snapshot.states} visibleCast={visibleCast} />
      <PacketLayer timeline={timeline} />
      {liveEvents && liveEvents.length > 0 && <LivePulseLayer events={liveEvents} />}
      {/* the speaker's bubble paints above everything — neighbors and
          packets can never cover the words */}
      <SpeechBubbleLayer dialogue={snapshot.dialogue} states={snapshot.states} />
    </svg>
  );
}
