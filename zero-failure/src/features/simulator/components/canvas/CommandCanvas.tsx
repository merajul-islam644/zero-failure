// The command-center canvas: fixed 1600x900 viewBox, scales with its
// container. Edges + nodes are discrete (one useSimSnapshot); packets are
// the per-frame layer. One useSimSnapshot subscription for the whole canvas
// keeps re-renders off the 60fps path.

import { useMemo } from "react";
import { CAST } from "../../script/cast";
import { SCENES } from "../../script/scenes";
import { useSimSnapshot } from "../../state/PlayerContext";
import type { PlatformId } from "../../engine/types";
import type { Timeline } from "../../engine/timeline";
import { quadPath } from "./geometry";
import { CharacterNode } from "./CharacterNode";
import { PacketLayer } from "./PacketLayer";

const sceneCastMap = new Map<number, PlatformId[]>(SCENES.map((s) => [s.index, s.cast]));

interface CommandCanvasProps {
  timeline: Timeline;
}

export function CommandCanvas({ timeline }: CommandCanvasProps) {
  const snapshot = useSimSnapshot(timeline.events);

  const visibleCast = useMemo(() => {
    const scene = snapshot.scene;
    if (!scene) return [];
    return sceneCastMap.get(scene.index) ?? [];
  }, [snapshot.scene]);

  const edges = useMemo(() => {
    // Stage direction (scene 1): "connections between characters become
    // visible" — the leader fans out to every other present character.
    const os = CAST.find((c) => c.id === "os");
    if (!os || !visibleCast.includes("os")) return [];
    return visibleCast
      .filter((id) => id !== "os")
      .map((id) => {
        const target = CAST.find((c) => c.id === id);
        return target ? { from: os, to: target, key: `edge-os-${id}` } : null;
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
          <path key={edge.key} className="sim-edge" d={quadPath(edge.from, edge.to)} />
        ))}
      </g>

      <g className="sim-nodes">
        {CAST.map((character) => (
          <CharacterNode
            key={character.id}
            character={character}
            state={snapshot.states[character.id]}
            dimmed={!visibleCast.includes(character.id)}
          />
        ))}
      </g>

      <PacketLayer timeline={timeline} />
    </svg>
  );
}
