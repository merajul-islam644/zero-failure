// Narration voices: enumerate the browser's speechSynthesis voices, sort
// them for the picker, and give each of the ten characters a distinct pitch
// so a single chosen voice still reads like a cast. Everything here is pure
// except the enumeration hook, and all of it degrades to a no-op when the
// browser has no speech engine (headless, jsdom, screen-reader-only setups).

import { useEffect, useState } from "react";
import type { PlatformId, SpeakerId } from "../engine/types";

export interface NarrationVoice {
  voiceURI: string;
  name: string;
  lang: string;
}

/**
 * Per-character pitch (speechSynthesis allows 0–2). Distinct, deterministic,
 * and grouped roughly by role so back-and-forth dialogue is audible as a
 * change of speaker, not a monotone relay.
 */
const CAST_PITCH: Record<PlatformId, number> = {
  os: 0.95, // command center lead — level
  iam: 1.0, // gatekeeper — neutral
  "data-gateway": 0.9, // pipeline — lower
  logic: 1.05, // workflow brain — slight lift
  release: 1.1, // deployment energy — brighter
  monitor: 0.85, // watchtower — deepest
  "ai-agent": 1.15, // assistant — highest
  utilities: 0.92, // notifications — low-mid
  localization: 1.08, // language desk — bright
  storage: 0.88 // archive — low
};

export function pitchForPlatform(platform: SpeakerId): number {
  if (platform === "all-cast") return 1; // chorus lines — no single voice to tint
  return CAST_PITCH[platform] ?? 1;
}

/** English voices first (default narration language), then alphabetical. */
export function sortVoices(voices: NarrationVoice[]): NarrationVoice[] {
  return [...voices].sort((a, b) => {
    const aEn = a.lang.toLowerCase().startsWith("en") ? 0 : 1;
    const bEn = b.lang.toLowerCase().startsWith("en") ? 0 : 1;
    if (aEn !== bEn) return aEn - bEn;
    if (a.lang !== b.lang) return a.lang.localeCompare(b.lang);
    return a.name.localeCompare(b.name);
  });
}

function speechSynthesis(): SpeechSynthesis | null {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
    return window.speechSynthesis;
  } catch {
    return null;
  }
}

/** Snapshot of the installed voices, sorted for the picker. */
export function listNarrationVoices(): NarrationVoice[] {
  const synth = speechSynthesis();
  if (!synth) return [];
  try {
    return sortVoices(
      synth.getVoices().map((v) => ({ voiceURI: v.voiceURI, name: v.name, lang: v.lang }))
    );
  } catch {
    return [];
  }
}

/** Subscribe to voice-list changes (Chrome loads voices asynchronously). */
export function subscribeToVoices(onChange: () => void): () => void {
  const synth = speechSynthesis();
  if (!synth) return () => undefined;
  synth.addEventListener("voiceschanged", onChange);
  onChange(); // Firefox/Edge populate synchronously; Chrome may already be ready.
  return () => synth.removeEventListener("voiceschanged", onChange);
}

/** Reactive voice list for the picker; re-renders when the engine finishes loading. */
export function useVoices(): NarrationVoice[] {
  const [voices, setVoices] = useState<NarrationVoice[]>(listNarrationVoices);
  useEffect(() => subscribeToVoices(() => setVoices(listNarrationVoices())), []);
  return voices;
}

/** Resolve a saved voiceURI ("auto" = null) against the installed voices. */
export function resolveVoice(voiceURI: string): SpeechSynthesisVoice | null {
  if (voiceURI === "auto") return null;
  const synth = speechSynthesis();
  if (!synth) return null;
  try {
    return synth.getVoices().find((v) => v.voiceURI === voiceURI) ?? null;
  } catch {
    return null;
  }
}
