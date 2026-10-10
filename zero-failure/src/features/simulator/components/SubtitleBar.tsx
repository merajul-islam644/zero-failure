// The subtitle line — current dialogue with speaker attribution.
// Discrete: useSimSnapshot re-renders it only when the line changes.

import { CAST_BY_ID } from "../script/cast";
import { useSimSnapshot } from "../state/PlayerContext";
import type { Timeline } from "../engine/timeline";

export function SubtitleBar({ timeline }: { timeline: Timeline }) {
  const snapshot = useSimSnapshot(timeline.events);
  const dialogue = snapshot.dialogue;

  if (!dialogue) {
    return <div className="sim-subtitle sim-subtitle-empty" aria-hidden />;
  }

  const speakerName =
    dialogue.speaker === "all-cast" ? "ALL" : CAST_BY_ID[dialogue.speaker].name;
  const speakerHue =
    dialogue.speaker === "all-cast" ? "220 15% 70%" : CAST_BY_ID[dialogue.speaker].hue;

  return (
    <div className="sim-subtitle" aria-live="polite">
      <span
        className="sim-subtitle-speaker"
        style={{ "--node-hue": speakerHue } as React.CSSProperties}
      >
        {speakerName}
      </span>
      <p className="sim-subtitle-text">“{dialogue.text}”</p>
    </div>
  );
}
