// Scene heading (top-left) + the current animation-action note (top-right),
// both anchored to .sim-canvas-frame — the exactly-16:9 box the canvas SVG
// fills, so overlay positions share one coordinate space with the
// constellation at every window size. The top-right quadrant of the viewBox
// is node-free (OS is top-center, Logic starts at y 310), so a width-capped
// chip there never covers a character. `compact` drops the chip when the
// canvas box is too small for any overlay text to fit without covering the
// cast. Discrete: re-renders only when the visible scene/note changes.

import { useSimSnapshot } from "../../state/PlayerContext";
import type { Timeline } from "../../engine/timeline";

export function SceneOverlay({
  timeline,
  compact = false
}: {
  timeline: Timeline;
  compact?: boolean;
}) {
  const snapshot = useSimSnapshot(timeline.events);
  const scene = snapshot.scene;
  const sceneCount = timeline.scenes.length;

  return (
    <>
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
      </div>
      {snapshot.note && !compact && (
        <p className="sim-note" role="status">
          <span className="sim-note-kicker">Stage</span>
          {snapshot.note}
        </p>
      )}
    </>
  );
}
