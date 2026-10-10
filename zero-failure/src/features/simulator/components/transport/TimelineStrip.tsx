// Story strip: scene blocks proportionally sized on the 570s canvas with a
// playhead. Per-frame subscriber (designated); click seeks, and each block
// doubles as a scene tooltip.

import { usePlaybackTime, usePlayer } from "../../state/PlayerContext";
import { formatTime } from "../../engine/format";
import type { Timeline } from "../../engine/timeline";

export function TimelineStrip({ timeline }: { timeline: Timeline }) {
  const { clock } = usePlayer();
  const t = usePlaybackTime();
  const duration = timeline.totalMs || 1;

  return (
    <div className="sim-strip" role="group" aria-label="Story timeline">
      <div className="sim-strip-track">
        {timeline.scenes.map((scene) => (
          <button
            key={scene.index}
            type="button"
            className="sim-strip-block"
            style={{ width: `${((scene.endMs - scene.startMs) / duration) * 100}%` }}
            onClick={() => clock.seek(scene.startMs + 1)}
            title={`${scene.index}. ${scene.title} (${formatTime(scene.startMs)})`}
            aria-label={`Scene ${scene.index}: ${scene.title}`}
          >
            <span>{scene.index}</span>
          </button>
        ))}
      </div>
      <div
        className="sim-strip-playhead"
        style={{ left: `${(t / duration) * 100}%` }}
        aria-hidden
      />
    </div>
  );
}
