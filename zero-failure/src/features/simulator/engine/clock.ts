// SequencerClock — presentation-time engine for the simulator.
// Plain TypeScript, no React imports: instance lives in a ref inside
// PlayerContext; React effects only subscribe. Time advances on a single
// rAF loop from performance.now() deltas (no setInterval drift); large
// deltas (background tab, breakpoint) are clamped so the story never
// fast-forwards silently.
//
// Modeled after the sequencer pattern in good-time-manager / soundquest,
// simplified to a one-dimensional playback head.

export interface ClockStop {
  /** Resolve with the final time when the head reaches stopAt (or null = stopped early). */
  time: number | null;
}

export type ClockListener = (timeMs: number, playing: boolean) => void;

const MAX_FRAME_DELTA_MS = 250;
const MIN_RATE = 0.25;
const MAX_RATE = 16;

export class SequencerClock {
  private timeMs: number;
  private playing = false;
  private rate = 1;
  private rafId = 0;
  private lastFrame = 0;
  /** Pause automatically when the head crosses this time (replay-one-request). */
  private stopAt: number | null = null;
  private stopResolve: ((stop: ClockStop) => void) | null = null;
  private listeners = new Set<ClockListener>();
  /**
   * While paused, the sky's drift may advance up to here (ms) and no
   * further — the narration pause's target: the spoken line's window tail.
   * The orbit loop clamps its paused drift to this, so by the time the
   * voice ends the sky already stands at the story's resume point and
   * resuming never snaps the planets. play() and seek() clear it: the
   * target only binds the pause it was set for.
   */
  pausedDriftTargetMs: number | null = null;

  constructor(private durationMs: number) {
    this.timeMs = 0;
  }

  get time(): number {
    return this.timeMs;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  get playbackRate(): number {
    return this.rate;
  }

  get duration(): number {
    return this.durationMs;
  }

  /** Resize the canvas (timeline rebuilt); clamps the head inside the new span. */
  setDuration(durationMs: number): void {
    this.durationMs = Math.max(1, durationMs);
    if (this.timeMs > this.durationMs) {
      this.timeMs = this.durationMs;
      this.emit();
    }
  }

  subscribe(listener: ClockListener): () => void {
    this.listeners.add(listener);
    listener(this.timeMs, this.playing);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.timeMs, this.playing);
  }

  play(): void {
    if (this.playing) return;
    this.pausedDriftTargetMs = null;
    // Finished story: Play replays from the top (standard transport
    // convention) — an enabled Play button must never be a silent no-op.
    if (this.timeMs >= this.durationMs) {
      this.resolveStop(null);
      this.seek(0);
    }
    this.playing = true;
    this.lastFrame = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
    this.emit();
  }

  pause(): void {
    if (!this.playing) return;
    this.playing = false;
    cancelAnimationFrame(this.rafId);
    this.resolveStop(this.timeMs);
    this.emit();
  }

  toggle(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  seek(timeMs: number): void {
    const next = clamp(timeMs, 0, this.durationMs);
    if (next === this.timeMs) return;
    this.timeMs = next;
    this.pausedDriftTargetMs = null;
    // Crossing the stop point while scrubbing cancels a pending replay stop.
    if (this.stopAt !== null && next !== this.stopAt) {
      this.resolveStop(null);
    }
    if (next >= this.durationMs && this.playing) this.pause();
    this.emit();
  }

  /** Advance the head; does not change playing state. */
  step(deltaMs: number): void {
    this.seek(this.timeMs + deltaMs);
  }

  setRate(rate: number): void {
    this.rate = clamp(rate, MIN_RATE, MAX_RATE);
    this.emit();
  }

  restart(): void {
    this.resolveStop(null);
    this.seek(0);
    this.play();
  }

  /**
   * Seek back and play until `untilMs`, then pause and resolve — used by
   * "replay one request". A second call before resolution replaces the first.
   */
  playUntil(fromMs: number, untilMs: number): Promise<ClockStop> {
    this.resolveStop(null);
    const promise = new Promise<ClockStop>((resolve) => {
      this.stopResolve = resolve;
    });
    // Seek BEFORE installing the new stop window: seek() cancels any stop
    // target that exists at seek time (the user-scrub-cancels-replay rule),
    // so the new target must not be visible to its own seek.
    this.seek(fromMs);
    this.stopAt = clamp(untilMs, 0, this.durationMs);
    this.play();
    return promise;
  }

  private resolveStop(time: number | null): void {
    if (this.stopResolve) {
      const resolve = this.stopResolve;
      this.stopResolve = null;
      this.stopAt = null;
      resolve({ time });
    } else {
      this.stopAt = null;
    }
  }

  private tick = (now: number): void => {
    if (!this.playing) return;
    const delta = Math.min(now - this.lastFrame, MAX_FRAME_DELTA_MS);
    this.lastFrame = now;
    this.timeMs = clamp(this.timeMs + delta * this.rate, 0, this.durationMs);

    if (this.stopAt !== null && this.timeMs >= this.stopAt) {
      const stop = this.stopAt;
      this.timeMs = stop;
      this.playing = false;
      cancelAnimationFrame(this.rafId);
      this.resolveStop(stop);
      this.emit();
      return;
    }
    if (this.timeMs >= this.durationMs) {
      this.playing = false;
      cancelAnimationFrame(this.rafId);
      this.resolveStop(this.timeMs);
      this.emit();
      return;
    }
    this.rafId = requestAnimationFrame(this.tick);
    this.emit();
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
