// The command-center canvas: fixed 1600x900 viewBox, scales with its
// container. M1 renders cast + static edges; packets and edge highlighting
// arrive with PacketLayer in M2. One useSimSnapshot subscription for the
// whole canvas keeps re-renders discrete.

import { useMemo } from "react";
import { CAST } from "../../script/cast";
import { SCENES } from "../../script/scenes";
import { useSimSnapshot } from "../../state/PlayerContext";
import type { PlatformId } from "../../engine/types";
import type { Timeline } from "../../engine/timeline";
import { CharacterNode } from "./CharacterNode";

const sceneCastMap = new Map<number, PlatformId[]>(SCENES.map((s) => [s.index, s.cast]));

interface CommandCanvasProps {
  timeline: Timeline;
}

export function CommandCanvas({ timeline }: CommandCanvasProps) {
  const snapshot = useSimSnapshot(timeline.events);
  const castIds = useMemo(() => new Set<PlatformId>(CAST.map((c) => c.id)), []);

  const visibleCast = useMemo(() => {
    const scene = snapshot.scene;
    if (!scene) return [];
    const def = timeline.scenes.find((s) => s.index === scene.index);
    // Scene cast arrives with the scene definition; before the first
    // scene-start event the whole ensemble is dark.
    return def ? sceneCast(def.index) : [];
  }, [snapshot.scene, timeline.scenes]);

  const edges = useMemo(() => {
    // Stage direction (scene 1): "connections between characters become
    // visible" — the leader fans out to every other present character.
    const os = CAST.find((c) => c.id === "os");
    if (!os || !visibleCast.includes("os")) return [];
    return visibleCast
      .filter((id) => id !== "os")
      .map((id) => {
        const target = CAST.find((c) => c.id === id);
        if (!target) return null;
        return { from: os, to: target, key: `edge-os-${id}` };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);
  }, [visibleCast]);

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
      </defs>
      <rect className="sim-room" x={0} y={0} width={1600} height={900} fill="url(#sim-room-glow)" />

      <g className="sim-edges">
        {edges.map((edge) => (
          <path
            key={edge.key}
            className="sim-edge"
            d={quadPath(edge.from.x, edge.from.y, edge.to.x, edge.to.y)}
          />
        ))}
      </g>

      <g className="sim-nodes">
        {CAST.map((character) => (
          <CharacterNode
            key={character.id}
            character={character}
            state={snapshot.states[character.id]}
            dimmed={!castIds.has(character.id) || !visibleCast.includes(character.id)}
          />
        ))}
      </g>
    </svg>
  );
}

/** Quadratic arc between two nodes, bowed slightly for readability. */
function quadPath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  // Perpendicular offset ~8% of length, always bending away from center.
  const bow = len * 0.08 * (mx < 800 ? 1 : -1);
  const cx = mx + (-dy / len) * bow;
  const cy = my + (dx / len) * bow;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

function sceneCast(sceneIndex: number): PlatformId[] {
  // Cast membership comes from the scene definitions via the timeline's
  // scene-start; kept as a lookup so the canvas never imports scenes directly.
  return sceneCastMap.get(sceneIndex) ?? [];
}
