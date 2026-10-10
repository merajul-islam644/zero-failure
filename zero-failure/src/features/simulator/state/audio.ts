// Optional audio: WebAudio blips for packet events and speechSynthesis
// narration for dialogue. Both default OFF and both are gesture-gated — the
// AudioContext is only created from the settings toggle's user activation.
// Narration auto-mutes above 2× playback (speech cannot keep up and would
// desync from the story).

const NARRATION_MAX_RATE = 2;

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

export function speak(text: string, playbackRate: number): boolean {
  if (playbackRate > NARRATION_MAX_RATE) return false;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = Math.min(2, Math.max(0.6, playbackRate === 0.5 ? 0.8 : playbackRate));
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
