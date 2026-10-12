// Narration-voice helpers: cast pitch table, picker sorting, and the
// no-speech-engine guards (jsdom has no speechSynthesis — exactly the
// degradation path real headless/embedded contexts hit).

import { describe, expect, it, vi } from "vitest";
import { CAST, PLATFORMS } from "../script/cast";
import { narrationRateFor, speak, stopSpeech } from "./audio";
import {
  CAST_SETTING,
  castPlan,
  listNarrationVoices,
  pitchForPlatform,
  rateForPlatform,
  resolveSpeakerVoice,
  resolveVoice,
  sortVoices,
  type NarrationVoice
} from "./voices";

describe("cast sound profile", () => {
  it("gives every character a distinct pitch in the utterance-safe range", () => {
    const pitches = PLATFORMS.map((platform) => pitchForPlatform(platform));
    expect(new Set(pitches).size).toBe(PLATFORMS.length); // all distinct — a cast, not a choir
    for (const pitch of pitches) {
      expect(pitch).toBeGreaterThanOrEqual(0);
      expect(pitch).toBeLessThanOrEqual(2);
    }
  });

  it("gives every character a distinct pitch+speed pair — identity is voice × pitch × speed", () => {
    const profiles = PLATFORMS.map((platform) => `${pitchForPlatform(platform)}/${rateForPlatform(platform)}`);
    expect(new Set(profiles).size).toBe(PLATFORMS.length);
    for (const platform of PLATFORMS) {
      expect(rateForPlatform(platform)).toBeGreaterThanOrEqual(0.5);
      expect(rateForPlatform(platform)).toBeLessThanOrEqual(1.5);
    }
  });

  it("keeps characters sharing an engine voice far apart (auto-cast cycles voices 3 slots apart)", () => {
    // With three installed voices, castPlan assigns CAST[i % 3] — so these
    // groups share an engine voice and must differ by pitch alone, clearly.
    for (let group = 0; group < 3; group += 1) {
      const pitches = CAST.filter((_, i) => i % 3 === group).map((c) => pitchForPlatform(c.id));
      expect(Math.max(...pitches) - Math.min(...pitches)).toBeGreaterThanOrEqual(0.6);
    }
  });

  it("is deterministic, defaults unknown platforms to neutral, and keeps chorus lines neutral", () => {
    expect(pitchForPlatform("monitor")).toBe(pitchForPlatform("monitor"));
    expect(pitchForPlatform("all-cast")).toBe(1);
    expect(rateForPlatform("all-cast")).toBe(1);
    expect(pitchForPlatform("nobody" as never)).toBe(1);
    expect(rateForPlatform("nobody" as never)).toBe(1);
  });
});

describe("narrationRateFor (voice/subtitle sync)", () => {
  it("lets a short line in a wide window speak at natural speed", () => {
    // 10 words ≈ 3.85 s natural; window 6 s — no speedup needed.
    expect(narrationRateFor("one two three four five six seven eight nine ten", 1, 1, 6000)).toBe(1);
  });

  it("speeds up when the line would overrun its display window", () => {
    // 26 words ≈ 10 s natural; 5 s window → ~2× — clamped at 2.
    const text = Array.from({ length: 26 }, (_, i) => `w${i}`).join(" ");
    expect(narrationRateFor(text, 1, 1, 5000)).toBe(2);
  });

  it("scales the fit factor on top of playback rate and character speed", () => {
    // 13 words ≈ 5 s natural; 5 s window → fit 1; base 1 × char 0.95.
    const text = Array.from({ length: 13 }, (_, i) => `w${i}`).join(" ");
    expect(narrationRateFor(text, 1, 0.95, 5000)).toBeCloseTo(0.95, 5);
    // same line at 2× playback with 2.5 s window → base 2 × fit 1 → clamp 2
    expect(narrationRateFor(text, 2, 1, 2500)).toBe(2);
  });

  it("keeps the 0.5× playback floor at 0.8 and empty text neutral", () => {
    expect(narrationRateFor("hi", 0.5, 1, undefined)).toBe(0.8);
    expect(narrationRateFor("", 1.5, 1.2, undefined)).toBeCloseTo(1.5 * 1.2, 5);
  });
});

describe("sortVoices", () => {
  const voices: NarrationVoice[] = [
    { voiceURI: "b", name: "Zulu", lang: "bn-BD" },
    { voiceURI: "a", name: "Aaron", lang: "en-US" },
    { voiceURI: "d", name: "Beta", lang: "de-DE" },
    { voiceURI: "c", name: "Amelia", lang: "en-GB" }
  ];

  it("lists English voices first, then by language and name", () => {
    // bn-BD sorts before de-DE under localeCompare.
    expect(sortVoices(voices).map((v) => v.voiceURI)).toEqual(["c", "a", "b", "d"]);
  });

  it("does not mutate the input", () => {
    sortVoices(voices);
    expect(voices.map((v) => v.voiceURI)).toEqual(["b", "a", "d", "c"]);
  });
});

describe("no-speech-engine degradation", () => {
  it("speak() reports failure instead of throwing", () => {
    expect(speak("hello", { playbackRate: 1 })).toBe(false);
  });

  it("stopSpeech and the enumerators are safe no-ops", () => {
    expect(() => stopSpeech()).not.toThrow();
    expect(listNarrationVoices()).toEqual([]);
    expect(resolveVoice("auto")).toBeNull();
    expect(resolveVoice("some-voice-uri")).toBeNull();
  });
});

describe("speak() stuck-utterance watchdog", () => {
  /**
   * A speechSynthesis that accepts utterances but stays silent unless poked.
   * The suite runs in node (no window / no engine) — the stub must install
   * the globals speak() touches: window, speechSynthesis and the utterance
   * constructor.
   */
  function stubSilentEngine() {
    const g = globalThis as unknown as Record<string, unknown>;
    const savedWindow = g.window;
    const savedSynth = g.speechSynthesis;
    const savedUtterance = g.SpeechSynthesisUtterance;
    const spoken: Array<Record<string, unknown>> = [];
    g.window = globalThis;
    g.speechSynthesis = {
      cancel: () => spoken.splice(0),
      speak: (u: Record<string, unknown>) => spoken.push(u)
    };
    g.SpeechSynthesisUtterance = class {
      text: string;
      lang = "";
      voice: unknown = null;
      pitch = 1;
      rate = 1;
      onstart: ((e: Event) => void) | null = null;
      onend: ((e: Event) => void) | null = null;
      onerror: ((e: Event) => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    };
    return {
      spoken,
      restore: () => {
        g.window = savedWindow;
        g.speechSynthesis = savedSynth;
        g.SpeechSynthesisUtterance = savedUtterance;
      }
    };
  }

  it("releases the story when the engine never starts the utterance", () => {
    const { spoken, restore } = stubSilentEngine();
    try {
      vi.useFakeTimers();
      const done: boolean[] = [];
      expect(speak("hello", { playbackRate: 1, onDone: (c) => done.push(c) })).toBe(true);
      expect(spoken).toHaveLength(1);
      vi.advanceTimersByTime(3499);
      expect(done).toEqual([]);
      vi.advanceTimersByTime(1);
      expect(done).toEqual([false]); // onDone(false) resumes the paused clock
    } finally {
      vi.useRealTimers();
      restore();
    }
  });

  it("a started utterance is never released by the watchdog", () => {
    const { spoken, restore } = stubSilentEngine();
    try {
      vi.useFakeTimers();
      const done: boolean[] = [];
      speak("hello", { playbackRate: 1, onDone: (c) => done.push(c) });
      const line = spoken[0] as { onstart: ((e: Event) => void) | null; onend: ((e: Event) => void) | null; onerror: ((e: Event) => void) | null };
      line.onstart?.(new Event("start"));
      vi.advanceTimersByTime(60_000);
      expect(done).toEqual([]); // still speaking — the guard stood down
      line.onend?.(new Event("end"));
      expect(done).toEqual([true]);
      vi.advanceTimersByTime(60_000);
      expect(done).toEqual([true]); // exactly once
    } finally {
      vi.useRealTimers();
      restore();
    }
  });

  it("an engine error also finishes the line exactly once", () => {
    const { spoken, restore } = stubSilentEngine();
    try {
      vi.useFakeTimers();
      const done: boolean[] = [];
      speak("hello", { playbackRate: 1, onDone: (c) => done.push(c) });
      const line = spoken[0] as { onstart: ((e: Event) => void) | null; onend: ((e: Event) => void) | null; onerror: ((e: Event) => void) | null };
      line.onstart?.(new Event("start"));
      line.onerror?.(new Event("error"));
      line.onend?.(new Event("end"));
      expect(done).toEqual([false]);
      vi.advanceTimersByTime(60_000);
      expect(done).toEqual([false]);
    } finally {
      vi.useRealTimers();
      restore();
    }
  });
});

describe("castPlan", () => {
  const installed: NarrationVoice[] = [
    { voiceURI: "v1", name: "David", lang: "en-US" },
    { voiceURI: "v2", name: "Mark", lang: "en-US" },
    { voiceURI: "v3", name: "Zira", lang: "en-US" }
  ];

  it("covers every character and cycles through all installed voices", () => {
    const plan = castPlan(installed);
    expect(Object.keys(plan).sort()).toEqual([...PLATFORMS].sort());
    const assigned = new Set(Object.values(plan));
    expect(assigned).toEqual(new Set(["v1", "v2", "v3"]));
    for (const character of CAST) {
      expect(plan[character.id]).toMatch(/^v[123]$/);
    }
  });

  it("with no installed voices, everything defers to the default", () => {
    const plan = castPlan([]);
    for (const character of CAST) expect(plan[character.id]).toBe(CAST_SETTING.auto);
  });
});

describe("resolveSpeakerVoice (no speech engine in jsdom)", () => {
  const plan = castPlan([
    { voiceURI: "v1", name: "David", lang: "en-US" },
    { voiceURI: "v2", name: "Mark", lang: "en-US" }
  ]);

  it("cast setting follows the plan, but the engine has no voices -> falls back", () => {
    expect(resolveSpeakerVoice("os", {}, plan, null)).toBeNull();
  });

  it("all-cast lines always use the default voice", () => {
    const fallback = { name: "Default" } as SpeechSynthesisVoice;
    expect(resolveSpeakerVoice("all-cast", {}, plan, fallback)).toBe(fallback);
  });

  it("an explicit override resolves through the engine, degrading to fallback", () => {
    // jsdom cannot resolve URIs, so even a direct override lands on fallback.
    expect(resolveSpeakerVoice("os", { os: "v1" }, plan, null)).toBeNull();
  });
});
