// Transport controls. The buttons are discrete (playing flag only); the
// scrubber + clock readout are the designated per-frame subscriber.

import { useRef, useState } from "react";
import { Pause, Play, RotateCcw, ChevronsLeft, ChevronsRight } from "lucide-react";
import { usePlaybackTime, usePlayer } from "../../state/PlayerContext";
import { formatTime } from "../../engine/format";
import { SceneNav } from "./SceneNav";
import { TimelineStrip } from "./TimelineStrip";
import type { Timeline } from "../../engine/timeline";

export const SPEEDS = [0.5, 1, 2, 4, 8, 16] as const;
const SKIP_MS = 10000;

export function TransportBar({ timeline }: { timeline: Timeline }) {
  const { clock, playing, restart } = usePlayer();
  const duration = timeline.totalMs;

  return (
    <div className="sim-transport">
      <TimelineStrip timeline={timeline} />
      <Scrubber duration={duration} />
      <div className="sim-transport-row">
        <div className="sim-transport-buttons">
          <button
            type="button"
            className="sim-btn"
            onClick={restart}
            aria-label="Restart from beginning"
            title="Restart"
          >
            <RotateCcw size={18} aria-hidden />
          </button>
          <button
            type="button"
            className="sim-btn"
            onClick={() => clock.step(-SKIP_MS)}
            aria-label="Back 10 seconds"
            title="Back 10s"
          >
            <ChevronsLeft size={18} aria-hidden />
          </button>
          <button
            type="button"
            className="sim-btn sim-btn-primary"
            onClick={() => clock.toggle()}
            aria-label={playing ? "Pause" : "Play"}
            title={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause size={20} aria-hidden /> : <Play size={20} aria-hidden />}
          </button>
          <button
            type="button"
            className="sim-btn"
            onClick={() => clock.step(SKIP_MS)}
            aria-label="Forward 10 seconds"
            title="Forward 10s"
          >
            <ChevronsRight size={18} aria-hidden />
          </button>
          <SceneNav timeline={timeline} />
        </div>
        <label className="sim-speed">
          <span>Speed</span>
          <select
            value={String(clock.playbackRate)}
            onChange={(e) => clock.setRate(Number(e.target.value))}
          >
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

/** Range input + clock readout; the one per-frame element in the transport. */
function Scrubber({ duration }: { duration: number }) {
  const { clock } = usePlayer();
  const time = usePlaybackTime();
  // While a pointer drag is live, hold the thumb at the dragged position —
  // otherwise the per-frame `time` snaps it back to the playhead mid-drag.
  const pointerDownRef = useRef(false);
  const [dragTime, setDragTime] = useState<number | null>(null);

  return (
    <div className="sim-scrubber">
      <span className="sim-clock" role="timer" aria-label="Playback time">
        {formatTime(dragTime ?? time)}
      </span>
      <input
        type="range"
        className="sim-range"
        min={0}
        max={duration}
        step={100}
        value={dragTime ?? time}
        onChange={(e) => {
          const next = Number(e.target.value);
          clock.seek(next);
          if (pointerDownRef.current) setDragTime(next);
        }}
        onPointerDown={() => {
          pointerDownRef.current = true;
        }}
        onPointerUp={() => {
          pointerDownRef.current = false;
          setDragTime(null);
        }}
        onBlur={() => {
          pointerDownRef.current = false;
          setDragTime(null);
        }}
        aria-label="Seek"
      />
      <span className="sim-clock sim-clock-total">{formatTime(duration)}</span>
    </div>
  );
}
