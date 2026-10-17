// The story rail's content: scene heading, the current animation-action
// note, and the sticky menu showcase. Rendered inside the shared drawer
// (SimDrawer) — opened from the command rail's orbit icon — so it overlays
// the stage like every other sheet and never reshapes the canvas. The cast
// fills the whole 1600x900 viewBox (OS's halo reaches y 68), so floating
// this over the constellation would eventually collide with a node; the
// drawer sits beside the sky instead. Discrete: re-renders only when the
// visible scene/note changes.

import { useSimSnapshot } from "../../state/PlayerContext";
import type { Timeline } from "../../engine/timeline";
import type { OpenPlanetMenu } from "../../script/platformMenus";
import { MenuShowcase } from "./MenuShowcase";

interface SceneOverlayProps {
  timeline: Timeline;
  /** The sticky showcase selection — the last planet or menu planet the
   *  viewer picked, surviving reloads until another pick replaces it. */
  showcase: OpenPlanetMenu | null;
}

export function SceneOverlay({ timeline, showcase }: SceneOverlayProps) {
  const snapshot = useSimSnapshot(timeline.events);
  const scene = snapshot.scene;
  const sceneCount = timeline.scenes.length;

  return (
    <div className="sim-story">
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
      {/* the sticky showcase below the rail's heading — the last pick,
          display only, surviving reloads until another pick replaces it.
          Keyed by the pick so each new selection re-arms its dial at the
          canonical top-spread instead of inheriting the old twist. */}
      <MenuShowcase
        key={showcase ? `${showcase.planet}>${showcase.path.join(">")}` : "none"}
        menu={showcase}
      />
    </div>
  );
}
