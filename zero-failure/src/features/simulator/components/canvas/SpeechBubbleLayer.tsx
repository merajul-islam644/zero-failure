// The speaking platform's speech bubble, painted as the canvas's topmost
// layer so no orbit neighbor can ever cover the words — a tooltip floats
// above the scene, not under it. Follows the speaker's orbit position frame
// by frame with the same sky-time math as SolarNodeLayer; the fade stays
// CSS via data-show.

import { useRef } from "react";
import { CAST_BY_ID } from "../../script/cast";
import type { ActiveDialogue, CharacterState, PlatformId } from "../../engine/types";
import { useOrbitTime } from "../../state/PlayerContext";
import { useMotionReduced } from "../../state/SettingsContext";
import { CartoonAvatar, moodFor } from "./CartoonAvatar";
import { ORBIT_CENTER, orbitPosition } from "./orbits";

interface SpeechBubbleLayerProps {
  dialogue: ActiveDialogue | null;
  states: Record<PlatformId, CharacterState>;
}

/**
 * Wrap a spoken line beside the avatar: fixed-width rows, at most three,
 * ellipsis when it does not fit. Pure text math — no DOM measuring.
 */
function wrapSpeech(text: string, maxChars = 42, maxLines = 3): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const rows: string[] = [];
  let current = "";
  let truncated = false;
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && candidate.length > maxChars) {
      rows.push(current);
      current = word;
      if (rows.length === maxLines) {
        truncated = true;
        current = "";
        break;
      }
    } else {
      current = candidate;
    }
  }
  if (current) rows.push(current);
  if (truncated) rows[maxLines - 1] += "…";
  return rows;
}

export function SpeechBubbleLayer({ dialogue, states }: SpeechBubbleLayerProps) {
  // Sky time, not story time — identical to SolarNodeLayer so the bubble
  // rides the same orbit math as the node its arrow points at.
  const t = useOrbitTime();
  const tOrbit = useMotionReduced() ? 0 : t;
  // Hold the last speaker so a finished line fades out in place instead of
  // teleporting back to the sun.
  const lastSpeaker = useRef<PlatformId>("os");
  const speaker = dialogue ? (dialogue.speaker === "all-cast" ? "os" : dialogue.speaker) : null;
  if (speaker) lastSpeaker.current = speaker;
  const id = lastSpeaker.current;

  const character = CAST_BY_ID[id];
  const isSun = id === "os";
  const point = isSun ? ORBIT_CENTER : orbitPosition(id, tOrbit);
  const line = dialogue?.text ?? null;
  const show = Boolean(line) && states[id] === "speaking";

  const boxW = 360;
  const rows = show && line ? wrapSpeech(line) : [];
  // The avatar fixes the minimum height; long wraps grow the box a row at a time.
  const boxH = Math.max(84, 56 + rows.length * 16);
  // Tip reaches toward the halo; the sun's bigger radius shifts everything up.
  const boxBottom = isSun ? -124 : -66;
  const boxTop = boxBottom - boxH;
  // The cartoon re-expresses with the room: success on the floor → a grin,
  // a failure → worry, a retry → alarm, someone processing → thought.
  const mood = moodFor(states);
  const textX = -boxW / 2 + 84;

  return (
    <g transform={`translate(${point.x} ${point.y})`}>
      {/* inner g owns the CSS fade: a CSS transform here would override the
          positioning attribute if they shared one element */}
      <g
        className="sim-node-speech"
        data-show={show || undefined}
        data-sun={isSun || undefined}
        aria-hidden
        style={{ "--node-hue": character.hue } as React.CSSProperties}
      >
        <rect
          className="sim-node-speech-box"
          x={-boxW / 2}
          y={boxTop}
          width={boxW}
          height={boxH}
          rx={9}
        />
        {/* arrow — the speaker's hue, breaking out of the box's bottom border
            and pointing straight down at the platform */}
        <path
          className="sim-node-speech-tip"
          d={`M-9 ${boxBottom - 2} L9 ${boxBottom - 2} L0 ${boxBottom + 14} Z`}
        />
        {/* the platform's own cartoon, re-expressing with the situation */}
        <svg
          x={-boxW / 2 + 10}
          y={boxTop + 10}
          width={64}
          height={64}
          viewBox="0 0 64 64"
          aria-hidden
        >
          <CartoonAvatar character={character} mood={mood} />
        </svg>
        <text className="sim-node-speech-name" x={textX} y={boxTop + 26}>
          {character.name}
        </text>
        {rows.map((row, i) => (
          <text
            key={i}
            className="sim-node-speech-text"
            x={textX}
            y={boxTop + 46 + i * 16}
          >
            {row}
          </text>
        ))}
      </g>
    </g>
  );
}
