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
   * Called once the utterance leaves the engine — completed=true when it
   * finished speaking, false when cancelled/interrupted. The audiobook
   * flow resumes the paused story from here.
   */
  onDone?: (completed: boolean) => void;
}

/**
 * Effective utterance rate: the playback rate times the character's own
 * speed profile. Lines are never rushed to fit a window — however long
 * the words, the voice speaks at its natural pace and the stage waits.
 */
export function narrationRateFor(playbackRate: number, charRate: number): number {
  const base = playbackRate === 0.5 ? 0.8 : playbackRate;
  return Math.min(2, Math.max(0.6, base * charRate));
}

// One deferred start may exist at a time. Cancel followed by a speak in
// the same tick is silently dropped by Chrome/Edge — the enqueue waits a
// beat, and stopSpeech retracts it so a pause never leaves a voice behind.
let pendingStart: number | null = null;

export function speak(text: string, { playbackRate, voice, pitch, rate, onDone }: SpeakOptions): boolean {
  if (playbackRate > NARRATION_MAX_RATE) return false;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const synth = window.speechSynthesis;
  const start = () => {
    try {
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = voice?.lang ?? "en-US";
      if (voice) utterance.voice = voice;
      utterance.pitch = Math.min(2, Math.max(0, pitch ?? 1));
      utterance.rate = narrationRateFor(playbackRate, rate ?? 1);
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
      synth.speak(utterance);
    } catch {
      // the engine refused this line — the caller's own failsafe carries on
    }
  };
  try {
    if (synth.speaking || synth.pending) {
      synth.cancel();
      if (pendingStart !== null) window.clearTimeout(pendingStart);
      pendingStart = window.setTimeout(() => {
        pendingStart = null;
        start();
      }, 80);
    } else {
      start();
    }
    return true;
  } catch {
    return false;
  }
}

export function stopSpeech(): void {
  if (pendingStart !== null) {
    window.clearTimeout(pendingStart);
    pendingStart = null;
  }
  try {
    window.speechSynthesis?.cancel();
  } catch {
    // No speech engine — nothing to stop.
  }
}
