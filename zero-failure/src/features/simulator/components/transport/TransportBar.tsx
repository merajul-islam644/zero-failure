// Transport controls. The buttons are discrete (playing flag only); the
// scrubber + clock readout are the designated per-frame subscriber.
//
// Every transport action goes through BroadcastActions (useBroadcastActions):
// with Broadcast off those are plain clock calls, with it on each action is
// published to the shared head.

import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, Pause, Play, RotateCcw, ChevronsLeft, ChevronsRight, Volume2, VolumeX } from "lucide-react";
import { usePlaybackRate, usePlaybackTime, usePlayer } from "../../state/PlayerContext";
import { useSettings } from "../../state/SettingsContext";
import { NARRATION_MAX_RATE } from "../../state/audio";
import { formatTime } from "../../engine/format";
import { SceneNav } from "./SceneNav";
import { TimelineStrip } from "./TimelineStrip";
import type { Timeline, TimelineScene } from "../../engine/timeline";
import type { BroadcastActions } from "../../live/broadcast/useBroadcastActions";

export const SPEEDS = [0.5, 1, 2, 4, 8, 16] as const;
const SKIP_MS = 10000;

export function TransportBar({
  timeline,
  actions,
  zoomed,
  onToggleZoom,
  onCopyPart,
  onDeletePart,
  canDeletePart,
  onReorderPart,
  onPlayPart,
  soloKey,
  onEditPart,
  mutedKeys,
  onToggleMutePart,
  lockedKeys,
  onToggleLockPart,
  onResetOrder
}: {
  timeline: Timeline;
  actions: BroadcastActions;
  /** Full-display zoom, where the host page has one (the deck show). The
   *  simulator stage has no zoom — absent props, no zoom button renders. */
  zoomed?: boolean;
  onToggleZoom?: () => void;
  /** Strip part sequencer — copy/delete/drag flow straight to the strip. */
  onCopyPart?: (scene: TimelineScene) => void;
  onDeletePart?: (scene: TimelineScene) => void;
  canDeletePart?: (scene: TimelineScene) => boolean;
  onReorderPart?: (nextOrder: string[]) => void;
  /** Play ONLY this part — its words, its bubble, then the show holds. */
  onPlayPart?: (scene: TimelineScene) => void;
  /** Part key of the live solo run — the strip's pill turns its button
   *  into pause/resume while its own part is that run. */
  soloKey?: string | null;
  /** The ⋮ menu's extra commands, all optional — absent, the item sits
   *  disabled: edit the part's speech, mute/unmute it, lock it against
   *  drags, reset the whole arrangement. */
  onEditPart?: (scene: TimelineScene) => void;
  mutedKeys?: string[];
  onToggleMutePart?: (scene: TimelineScene) => void;
  lockedKeys?: string[];
  onToggleLockPart?: (scene: TimelineScene) => void;
  onResetOrder?: () => void;
}) {
  const { clock, playing } = usePlayer();
  const { narration, setNarration } = useSettings();
  const rate = usePlaybackRate();
  const duration = timeline.totalMs;
  // The bar hides until the pointer comes down to it: hovering the window's
  // bottom band — or the bar itself — slides it in, moving away slides it
  // out. Keyboard focus inside it keeps it up too (Tab lands on a hidden
  // button and lights the bar around it). No timers: the rule is purely
  // where the pointer is, so it can never flicker or dangle open. Playback
  // keys are window-level, so a hidden bar never blocks the story.
  const barRef = useRef<HTMLDivElement | null>(null);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const inZone = (clientY: number) => clientY >= window.innerHeight - 84;
    const inBar = (target: EventTarget | null) =>
      target instanceof Node && barRef.current?.contains(target) === true;
    const onMove = (event: PointerEvent) =>
      setRevealed(inZone(event.clientY) || inBar(event.target));
    const onDown = (event: PointerEvent) =>
      setRevealed(inZone(event.clientY) || inBar(event.target));
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
    };
  }, []);
  // Narration auto-mutes above 2× (speech cannot keep up); say so on the
  // button instead of leaving the silence unexplained.
  const mutedByRate = narration && rate > NARRATION_MAX_RATE;
  const voiceTitle = !narration
    ? "Narration off — click to hear the dialogue"
    : mutedByRate
      ? "Narration on — muted above 2× speed"
      : "Narration on — the story pauses while each line is spoken";

  return (
    <div
      ref={barRef}
      className="sim-transport"
      data-revealed={revealed ? "" : undefined}
      onFocusCapture={() => setRevealed(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setRevealed(false);
        }
      }}
    >
      <TimelineStrip
        timeline={timeline}
        actions={actions}
        onCopyPart={onCopyPart}
        onDeletePart={onDeletePart}
        canDeletePart={canDeletePart}
        onReorderPart={onReorderPart}
        onPlayPart={onPlayPart}
        soloKey={soloKey}
        onEditPart={onEditPart}
        mutedKeys={mutedKeys}
        onToggleMutePart={onToggleMutePart}
        lockedKeys={lockedKeys}
        onToggleLockPart={onToggleLockPart}
        onResetOrder={onResetOrder}
      />
      <Scrubber duration={duration} actions={actions} />
      <div className="sim-transport-row">
        <div className="sim-transport-buttons">
          <button
            type="button"
            className="sim-btn"
            onClick={actions.restart}
            aria-label="Restart from beginning"
            title="Restart"
          >
            <RotateCcw size={18} aria-hidden />
          </button>
          <button
            type="button"
            className="sim-btn"
            onClick={() => actions.step(-SKIP_MS)}
            aria-label="Back 10 seconds"
            title="Back 10s"
          >
            <ChevronsLeft size={18} aria-hidden />
          </button>
          <button
            type="button"
            className="sim-btn sim-btn-primary"
            onClick={actions.togglePlay}
            aria-label={playing ? "Pause" : "Play"}
            title={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause size={20} aria-hidden /> : <Play size={20} aria-hidden />}
          </button>
          <button
            type="button"
            className="sim-btn"
            onClick={() => actions.step(SKIP_MS)}
            aria-label="Forward 10 seconds"
            title="Forward 10s"
          >
            <ChevronsRight size={18} aria-hidden />
          </button>
          <button
            type="button"
            className={`sim-btn sim-voice-btn${narration ? "" : " sim-voice-off"}${mutedByRate ? " sim-voice-muted" : ""}`}
            onClick={() => setNarration(!narration)}
            aria-pressed={narration}
            aria-label={narration ? "Narration on" : "Narration off"}
            title={voiceTitle}
          >
            {narration ? <Volume2 size={18} aria-hidden /> : <VolumeX size={18} aria-hidden />}
          </button>
          <SceneNav timeline={timeline} seek={actions.seek} />
          {onToggleZoom && (
            <button
              type="button"
              className="sim-btn"
              onClick={onToggleZoom}
              aria-pressed={zoomed}
              aria-label={zoomed ? "Exit full-display zoom" : "Zoom — show the solar system across the display"}
              title={zoomed ? "Exit zoom (Esc)" : "Zoom to full display"}
            >
              {zoomed ? <Minimize2 size={18} aria-hidden /> : <Maximize2 size={18} aria-hidden />}
            </button>
          )}
        </div>
        <label className="sim-speed">
          <span>Speed</span>
          <select
            value={String(clock.playbackRate)}
            onChange={(e) => actions.setRate(Number(e.target.value))}
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
function Scrubber({ duration, actions }: { duration: number; actions: BroadcastActions }) {
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
        // the track paints its elapsed fill from this var — the input is
        // the one per-frame element, so the gradient tracks the playhead
        style={{ "--progress": `${Math.min(100, ((dragTime ?? time) / (duration || 1)) * 100)}%` } as React.CSSProperties}
        onChange={(e) => {
          const next = Number(e.target.value);
          actions.seek(next);
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
