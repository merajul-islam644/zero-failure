// Story strip: scene blocks proportionally sized on the 570s canvas with a
// playhead. Per-frame subscriber (designated); click seeks (through the
// injected seek, so it reaches the shared head), and each block doubles as
// a scene tooltip.

import { usePlaybackTime } from "../../state/PlayerContext";
import { formatTime } from "../../engine/format";
import type { Timeline } from "../../engine/timeline";

export function TimelineStrip({ timeline, seek }: { timeline: Timeline; seek: (headMs: number) => void }) {
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
            onClick={() => seek(scene.startMs + 1)}
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
