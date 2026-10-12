// Scene jump controls — discrete. Numbers jump straight to a scene's start.
// Jumps go through the injected seek (BroadcastActions.seek), so a scene
// change reaches the shared head too.

import { sceneWindowByIndex } from "../../engine/select";
import type { Timeline } from "../../engine/timeline";
import { useSimSnapshot } from "../../state/PlayerContext";

export function SceneNav({ timeline, seek }: { timeline: Timeline; seek: (headMs: number) => void }) {
  const snapshot = useSimSnapshot(timeline.events);
  const current = snapshot.scene?.index ?? 1;
  const count = timeline.scenes.length;

  const jump = (sceneIndex: number) => {
    const window = sceneWindowByIndex(timeline.sceneTable, sceneIndex);
    if (window) seek(window.startMs + 1);
  };

  return (
    <div className="sim-scene-nav" role="navigation" aria-label="Scenes">
      <button
        type="button"
        className="sim-btn sim-btn-small"
        onClick={() => jump(Math.max(1, current - 1))}
        disabled={current <= 1}
        aria-label="Previous scene"
        title="Previous scene"
      >
        ‹
      </button>
      <div className="sim-scene-chips">
        {timeline.scenes.map((scene) => (
          <button
            key={scene.index}
            type="button"
            className={`sim-chip${scene.index === current ? " sim-chip-active" : ""}`}
            onClick={() => jump(scene.index)}
            aria-label={`Go to scene ${scene.index}: ${scene.title}`}
            aria-current={scene.index === current || undefined}
            title={`${scene.index}. ${scene.title}`}
          >
            {scene.index}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="sim-btn sim-btn-small"
        onClick={() => jump(Math.min(count, current + 1))}
        disabled={current >= count}
        aria-label="Next scene"
        title="Next scene"
      >
        ›
      </button>
    </div>
  );
}
