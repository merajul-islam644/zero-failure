// Live-activity pulses: one expanding ring per fresh tenant event, centered
// on the owning platform's current orbital position. Strictly additive
// overlay — it takes only the activity events, never the timeline, so
// seek/deriveStateAt/replay remain pure folds. Ring lifetime runs on the
// wall clock; ring position rides the story clock (per-frame subscriber).

import { useEffect, useState } from "react";
import type { LiveActivityEvent } from "../../live/activity";
import { useOrbitTime } from "../../state/PlayerContext";
import { useMotionReduced } from "../../state/SettingsContext";
import { orbitPosition } from "./orbits";

const PULSE_LIFETIME_MS = 2_800;

export function LivePulseLayer({ events }: { events: LiveActivityEvent[] }) {
  // Ring positions ride sky time so pulses follow planets that drift
  // through dialogue pauses; ring lifetime stays on the wall clock.
  const tOrbit = useOrbitTime();
  const tSky = useMotionReduced() ? 0 : tOrbit;
  const [now, setNow] = useState(() => Date.now());

  // Prune expired rings: one re-render per lifetime while anything is active.
  const hasFresh = events.some((e) => now - e.at < PULSE_LIFETIME_MS);
  useEffect(() => {
    if (!hasFresh) return;
    const timer = setTimeout(() => setNow(Date.now()), PULSE_LIFETIME_MS);
    return () => clearTimeout(timer);
  }, [hasFresh, events]);

  const fresh = events.filter((e) => now - e.at < PULSE_LIFETIME_MS);

  return (
    <g className="sim-live-pulses" aria-hidden>
      {fresh.map((event) => {
        const point = orbitPosition(event.platform, tSky);
        return (
          <g key={event.id} transform={`translate(${point.x} ${point.y})`} data-tone={event.tone}>
            <circle className="sim-live-pulse" r={52} />
          </g>
        );
      })}
    </g>
  );
}
