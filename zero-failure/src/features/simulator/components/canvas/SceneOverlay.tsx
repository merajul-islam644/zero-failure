// Scene heading (number, title, environment) + the current animation-action
// note as a stage-direction chip. Discrete: re-renders only when the visible
// scene/note changes.

import { useSimSnapshot } from "../../state/PlayerContext";
import type { Timeline } from "../../engine/timeline";

export function SceneOverlay({ timeline }: { timeline: Timeline }) {
  const snapshot = useSimSnapshot(timeline.events);
  const scene = snapshot.scene;
  const sceneCount = timeline.scenes.length;

  return (
    <div className="sim-scene-overlay">
      {scene ? (
        <div className="sim-scene-heading">
          <span className="sim-scene-kicker">
            Scene {scene.index} / {sceneCount}
          </span>
          <h1 className="sim-scene-title">{scene.title}</h1>
          <span className="sim-scene-env">{scene.environment}</span>
        </div>
      ) : (
        <div className="sim-scene-heading">
          <span className="sim-scene-kicker">Operation Zero Failure</span>
          <h1 className="sim-scene-title">SELISE Blocks Integration Simulator</h1>
        </div>
      )}
      {snapshot.note && (
        <p className="sim-note" role="status">
          <span className="sim-note-kicker">Stage</span>
          {snapshot.note}
        </p>
      )}
    </div>
  );
}
