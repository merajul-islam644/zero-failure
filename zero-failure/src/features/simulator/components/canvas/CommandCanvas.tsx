// The command-center canvas: fixed 1600x900 viewBox, scales with its
// container. A solar system — OS is the sun at the center, the faint
// orbit rings below are static, and the designated per-frame layers
// (SolarNodeLayer, PacketLayer, LivePulseLayer) ride the clock. One
// useSimSnapshot subscription keeps everything discrete off the 60fps path.

import { useMemo } from "react";
import { SCENES } from "../../script/scenes";
import { useSimSnapshot } from "../../state/PlayerContext";
import type { PlatformId } from "../../engine/types";
import type { Timeline } from "../../engine/timeline";
import type { LiveActivityEvent } from "../../live/activity";
import { ORBIT_CENTER, ORBIT_RINGS } from "./orbits";
import { GalaxyLayer } from "./GalaxyLayer";
import { SolarNodeLayer } from "./SolarNodeLayer";
import { PacketLayer } from "./PacketLayer";
import { LivePulseLayer } from "./LivePulseLayer";

const sceneCastMap = new Map<number, PlatformId[]>(SCENES.map((s) => [s.index, s.cast]));

interface CommandCanvasProps {
  timeline: Timeline;
  liveEvents?: LiveActivityEvent[];
}

export function CommandCanvas({ timeline, liveEvents }: CommandCanvasProps) {
  const snapshot = useSimSnapshot(timeline.events);

  const visibleCast = useMemo(() => {
    const scene = snapshot.scene;
    if (!scene) return [];
    return sceneCastMap.get(scene.index) ?? [];
  }, [snapshot.scene]);

  return (
    <svg
      className="sim-canvas"
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="SELISE Blocks command center"
    >
      <defs>
        <radialGradient id="sim-room-glow" cx="50%" cy="18%" r="80%">
          <stop offset="0%" stopColor="hsl(var(--sim-accent) / 0.14)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        {/* Sun colors are literal, not theme variables: a real star is
            white-hot at the core and falls off through yellow to deep
            orange-red in every theme. */}
        <radialGradient id="sim-sun-fill" cx="50%" cy="42%" r="62%">
          <stop offset="0%" stopColor="#fffef5" />
          <stop offset="30%" stopColor="#fff3a1" />
          <stop offset="55%" stopColor="#ffc23d" />
          <stop offset="78%" stopColor="#ff8c1f" />
          <stop offset="100%" stopColor="#f25c16" />
        </radialGradient>
        {/* soft radiation spreading off the limb in every direction */}
        <radialGradient id="sim-sun-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffb75e" stopOpacity={0.6} />
          <stop offset="40%" stopColor="#ff9433" stopOpacity={0.3} />
          <stop offset="100%" stopColor="#ff8c1f" stopOpacity={0} />
        </radialGradient>
        {/* ray streaks: fades from the limb (r≈74) out to the tips (r=150);
            userSpaceOnUse so every wedge shares the sun-centered falloff */}
        <radialGradient id="sim-sun-rays" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="150">
          <stop offset="0%" stopColor="#ffd27a" stopOpacity={0} />
          <stop offset="0.5" stopColor="#ffc46a" stopOpacity={0.55} />
          <stop offset="100%" stopColor="#ffb14e" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect className="sim-room" x={0} y={0} width={1600} height={900} fill="url(#sim-room-glow)" />

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
    </svg>
  );
}
