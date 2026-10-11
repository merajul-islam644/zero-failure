// Scene heading (left) + the current animation-action note (right), in a
// header strip ABOVE the canvas. The cast fills the whole 1600x900 viewBox
// (OS's halo reaches y 68), so any block floating inside the canvas can
// collide with a node or label at some window size; flow placement above
// the frame makes overlap with the constellation impossible by
// construction. Discrete: re-renders only when the visible scene/note
// changes.

import { useSimSnapshot } from "../../state/PlayerContext";
import type { Timeline } from "../../engine/timeline";

export function SceneOverlay({ timeline }: { timeline: Timeline }) {
  const snapshot = useSimSnapshot(timeline.events);
  const scene = snapshot.scene;
  const sceneCount = timeline.scenes.length;

  return (
    <div className="sim-stage-header">
      <div className="sim-scene-heading">
        {scene ? (
          <>
            <span className="sim-scene-kicker">
              Scene {scene.index} / {sceneCount}
            </span>
            <h1 className="sim-scene-title">{scene.title}</h1>
            <span className="sim-scene-env">{scene.environment}</span>
          </>
        ) : (
          <>
            <span className="sim-scene-kicker">Operation Zero Failure</span>
            <h1 className="sim-scene-title">
              SELISE Blocks Integration Simulator
            </h1>
          </>
        )}
      </div>
      {snapshot.note && (
        <p className="sim-note" role="status">
          <span className="sim-note-kicker">Stage</span>
          {snapshot.note}
        </p>
      )}
    </div>
  );
}
