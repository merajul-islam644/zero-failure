// In-flight packets riding orbit-hugging curves — per-frame subscriber
// (designated). Pure math positions from the same curve the highlighted
// edge draws, so pause / seek / scrub show the packet exactly where it
// should be, and moving planets carry their packets along.

import { useOrbitTime, usePlaybackTime } from "../../state/PlayerContext";
import { useMotionReduced } from "../../state/SettingsContext";
import type { MessageStatus } from "../../engine/types";
import type { Timeline } from "../../engine/timeline";
import { cubicPointAt } from "./geometry";
import { orbitPath, orbitPosition } from "./orbits";

const STATUS_COLOR: Record<MessageStatus, string> = {
  "in-flight": "hsl(var(--sim-accent))",
  processing: "hsl(var(--sim-accent))",
  succeeded: "hsl(var(--sim-good))",
  failed: "hsl(var(--sim-bad))",
  "timed-out": "hsl(var(--sim-timeout))",
  "not-configured": "hsl(220 12% 60%)"
};

export function PacketLayer({ timeline }: { timeline: Timeline }) {
  // Progress and phase windows ride the story head; the curve geometry
  // rides sky time so packets stay glued to planets that drift through
  // dialogue pauses (reduced motion freezes the geometry at base layout).
  const t = usePlaybackTime();
  const tOrbit = useOrbitTime();
  const tSky = useMotionReduced() ? 0 : tOrbit;

  const active = [];
  for (const window of timeline.messageWindows) {
    if (t < window.dispatchMs || t >= window.resolveMs + 400) continue;

    const path = orbitPath(window.message.sourcePlatform, window.message.targetPlatform, tSky);
    if (t < window.arriveMs) {
      const progress = (t - window.dispatchMs) / Math.max(1, window.arriveMs - window.dispatchMs);
      const point = cubicPointAt(path.start, path.c1, path.c2, path.end, progress);
      active.push({
        key: window.message.requestId,
        path,
        point,
        color: STATUS_COLOR["in-flight"],
        label: window.message.operation,
        attempt: window.message.attempt,
        phase: "travel" as const
      });
    } else {
      // Processing at the receiver: dot pulses on the (moving) target node.
      const remaining = (window.resolveMs - t) / Math.max(1, window.resolveMs - window.arriveMs);
      active.push({
        key: window.message.requestId,
        path,
        point: orbitPosition(window.message.targetPlatform, tSky),
        color: STATUS_COLOR[window.message.status],
        label: window.message.operation,
        attempt: window.message.attempt,
        phase: "processing" as const,
        remaining
      });
    }
  }

  return (
    <g className="sim-packets" aria-hidden>
      {active.map((p) => (
        <g key={p.key} className={`sim-packet sim-packet-${p.phase}`}>
          {/* highlighted curve while this message is in flight */}
          <path className="sim-edge-active" d={p.path.d} stroke={p.color} />
          {p.phase === "processing" && (
            <circle
              className="sim-packet-ring"
              cx={p.point.x}
              cy={p.point.y}
              r={50}
              stroke={p.color}
              strokeDasharray={`${267 * (1 - (p.remaining ?? 0))} 267`}
              transform={`rotate(-90 ${p.point.x} ${p.point.y})`}
            />
          )}
          <circle className="sim-packet-dot" cx={p.point.x} cy={p.point.y} r={9} fill={p.color} />
          {p.attempt > 1 && (
            <text className="sim-packet-retry" x={p.point.x + 14} y={p.point.y - 12}>
              ×{p.attempt}
            </text>
          )}
          <g transform={`translate(${p.point.x} ${p.point.y - 26})`}>
            <rect className="sim-packet-chip" x={-70} y={-12} width={140} height={20} rx={6} />
            <text className="sim-packet-label" textAnchor="middle" y={2}>
              {truncate(p.label, 20)}
            </text>
          </g>
        </g>
      ))}
    </g>
  );
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
