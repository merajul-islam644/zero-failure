// Optional audio: WebAudio blips for packet events and speechSynthesis
// narration for dialogue. Both are gesture-gated — the AudioContext is only
// created from a user-initiated path (Play, the transport voice toggle).
// Narration auto-mutes above 2× playback (speech cannot keep up and would
// desync from the story).

/** Narration refuses to speak above this playback rate. */
export const NARRATION_MAX_RATE = 2;

export type BlipKind = "dispatch" | "resolve" | "fail";

export class SfxController {
  private ctx: AudioContext | null = null;

  /** Must be called from a user-gesture-initiated path. */
  ensure(): boolean {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext;
        if (!Ctor) return false;
        this.ctx = new Ctor();
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return true;
    } catch {
      this.ctx = null;
      return false;
    }
  }

  blip(kind: BlipKind): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    switch (kind) {
      case "dispatch":
        osc.frequency.value = 660;
        osc.type = "sine";
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
        osc.start(now);
        osc.stop(now + 0.1);
        break;
      case "resolve":
        osc.frequency.value = 880;
        osc.type = "sine";
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.13);
        break;
      case "fail":
        osc.frequency.value = 200;
        osc.type = "sawtooth";
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.19);
        break;
    }
    osc.connect(gain).connect(ctx.destination);
  }

  dispose(): void {
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }
}

export interface SpeakOptions {
  playbackRate: number;
  /** Chosen voice; null/undefined = the engine's default for en-US. */
  voice?: SpeechSynthesisVoice | null;
  /** Per-character pitch (0–2 per the spec); default 1. */
  pitch?: number;
  /** Per-character speed multiplier (e.g. brisk assistant, calm watchtower). */
  rate?: number;
  /**
   * The line's on-screen display window (ms). When the engine would need
   * longer than that to say the line at the requested rate, the rate is
   * scaled up so narration finishes roughly with the subtitle.
   */
  fitMs?: number;
  /**
   * Called once the utterance leaves the engine — completed=true when it
   * finished speaking, false when cancelled/interrupted. The audiobook
   * flow resumes the paused story from here.
   */
  onDone?: (completed: boolean) => void;
}

/** Engines speak ≈155 wpm at rate 1; lines are authored at ~3.6 wps. */
const WORDS_PER_SECOND_AT_RATE_1 = 2.6;
/** Safety margin: engines drift slower than requested — finish ~15% early. */
const FIT_MARGIN = 1.15;

/**
 * Effective utterance rate: the playback rate times the character's own
 * speed profile, sped up just enough to fit the line's display window
 * (with margin, so the voice ends before the subtitle changes).
 */
export function narrationRateFor(
  text: string,
  playbackRate: number,
  charRate: number,
  fitMs: number | undefined
): number {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const naturalMs = (words / WORDS_PER_SECOND_AT_RATE_1) * 1000;
  const fit =
    fitMs && fitMs > 0 && naturalMs > fitMs ? (naturalMs / fitMs) * FIT_MARGIN : 1;
  const base = playbackRate === 0.5 ? 0.8 : playbackRate;
  return Math.min(2, Math.max(0.6, base * charRate * fit));
}

export function speak(text: string, { playbackRate, voice, pitch, rate, fitMs, onDone }: SpeakOptions): boolean {
  if (playbackRate > NARRATION_MAX_RATE) return false;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice?.lang ?? "en-US";
    if (voice) utterance.voice = voice;
    utterance.pitch = Math.min(2, Math.max(0, pitch ?? 1));
    utterance.rate = narrationRateFor(text, playbackRate, rate ?? 1, fitMs);
    if (onDone) {
      // Some engines never start an utterance (voice list still empty right
      // after load, suspended engine) and never fire onend — the audiobook
      // pause would freeze the story mid-line. If onstart hasn't arrived
      // within the window, release the story as interrupted.
      const START_TIMEOUT_MS = 3500;
      let started = false;
      let finished = false;
      const finish = (completed: boolean) => {
        if (finished) return;
        finished = true;
        window.clearTimeout(guard);
        onDone(completed);
      };
      const guard = window.setTimeout(() => {
        if (!started) finish(false);
      }, START_TIMEOUT_MS);
      utterance.onstart = () => {
        started = true;
      };
      utterance.onend = () => finish(true);
      utterance.onerror = () => finish(false);
    }
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

export function stopSpeech(): void {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    // No speech engine — nothing to stop.
  }
}
