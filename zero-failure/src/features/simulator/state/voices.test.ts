// Narration-voice helpers: cast pitch table, picker sorting, and the
// no-speech-engine guards (jsdom has no speechSynthesis — exactly the
// degradation path real headless/embedded contexts hit).

import { describe, expect, it } from "vitest";
import { PLATFORMS } from "../script/cast";
import { speak, stopSpeech } from "./audio";
import { listNarrationVoices, pitchForPlatform, resolveVoice, sortVoices, type NarrationVoice } from "./voices";

describe("pitchForPlatform", () => {
  it("gives every character a distinct pitch in the utterance-safe range", () => {
    const pitches = PLATFORMS.map((platform) => pitchForPlatform(platform));
    expect(new Set(pitches).size).toBe(PLATFORMS.length); // all distinct — a cast, not a choir
    for (const pitch of pitches) {
      expect(pitch).toBeGreaterThanOrEqual(0);
      expect(pitch).toBeLessThanOrEqual(2);
    }
  });

  it("is deterministic, defaults unknown platforms to neutral, and keeps chorus lines neutral", () => {
    expect(pitchForPlatform("monitor")).toBe(pitchForPlatform("monitor"));
    expect(pitchForPlatform("all-cast")).toBe(1);
    expect(pitchForPlatform("nobody" as never)).toBe(1);
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
