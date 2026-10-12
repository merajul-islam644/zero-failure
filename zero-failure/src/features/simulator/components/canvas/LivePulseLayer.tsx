// Live-activity pulses: one expanding ring per fresh tenant event, centered
// on the owning platform's canvas node. Strictly additive overlay — it takes
// only the activity events, never the timeline, so seek/deriveStateAt/replay
// remain pure folds. Rings animate via CSS and prune themselves after their
// lifetime; the same information persists in the Inspector activity list.

import { useEffect, useState } from "react";
import type { LiveActivityEvent } from "../../live/activity";
import { CAST_BY_ID } from "../../script/cast";

const PULSE_LIFETIME_MS = 2_800;

export function LivePulseLayer({ events }: { events: LiveActivityEvent[] }) {
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
        const character = CAST_BY_ID[event.platform];
        return (
          <g key={event.id} transform={`translate(${character.x} ${character.y})`} data-tone={event.tone}>
            <circle className="sim-live-pulse" r={52} />
          </g>
        );
      })}
    </g>
  );
}
