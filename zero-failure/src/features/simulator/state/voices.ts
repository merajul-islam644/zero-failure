// Narration voices: enumerate the browser's speechSynthesis voices, sort
// them for the picker, and give each of the ten characters a distinct pitch
// so a single chosen voice still reads like a cast. Everything here is pure
// except the enumeration hook, and all of it degrades to a no-op when the
// browser has no speech engine (headless, jsdom, screen-reader-only setups).

import { useEffect, useState } from "react";
import { CAST } from "../script/cast";
import type { PlatformId, SpeakerId } from "../engine/types";

export interface NarrationVoice {
  voiceURI: string;
  name: string;
  lang: string;
}

/**
 * Per-character sound profile (speechSynthesis ranges 0–2 each). The engine
 * voices available to browsers are few — Windows typically ships three — so
 * identity comes from voice × pitch × speed together. The auto-cast plan
 * cycles installed voices across the roster in CAST order, so characters
 * sharing an engine voice land 3 slots apart; the pitch table below is
 * tuned to that cycle: each engine-voice group spans the full 0.5–1.7
 * range, making even shared voices read as different people.
 */
const CAST_PITCH: Record<PlatformId, number> = {
  os: 1.0, // group A (engine voice 1) — level anchor
  iam: 0.8, // group B — firm, low
  "data-gateway": 0.7, // group C — low
  logic: 1.35, // group A — lifted
  release: 1.45, // group B — bright
  monitor: 0.5, // group C — deepest of the cast
  "ai-agent": 1.7, // group A — highest, chirpy
  utilities: 1.15, // group B — mid-high
  localization: 1.3, // group C — bright
  storage: 0.55 // group A — very deep
};

const CAST_RATE: Record<PlatformId, number> = {
  os: 1.0, // measured
  iam: 0.95, // deliberate
  "data-gateway": 0.9, // heavy
  logic: 1.15, // brisk
  release: 1.25, // quick, eager
  monitor: 0.8, // slow, deliberate watch
  "ai-agent": 1.35, // fast assistant
  utilities: 1.0, // even
  localization: 1.15, // lively
  storage: 0.8 // slow
};

export function pitchForPlatform(platform: SpeakerId): number {
  if (platform === "all-cast") return 1; // chorus lines — no single voice to tint
  return CAST_PITCH[platform] ?? 1;
}

/** Per-character speed multiplier layered on the playback rate. */
export function rateForPlatform(platform: SpeakerId): number {
  if (platform === "all-cast") return 1;
  return CAST_RATE[platform] ?? 1;
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

/**
 * Auto-cast: cycle the installed voices across the ten characters so the
 * cast draws from every engine voice available (each with its own pitch on
 * top). With one installed voice this degenerates to pitch-only casting;
 * with more, neighbouring characters tend to sound different.
 */
export function castPlan(installed: NarrationVoice[]): Record<PlatformId, string> {
  const plan = {} as Record<PlatformId, string>;
  if (installed.length === 0) {
    for (const character of CAST) plan[character.id] = "auto";
    return plan;
  }
  CAST.forEach((character, i) => {
    const voice = installed[i % installed.length];
    plan[character.id] = voice ? voice.voiceURI : CAST_SETTING.auto;
  });
  return plan;
}

export const CAST_SETTING = { cast: "cast", auto: "auto" } as const;

/**
 * Voice for one dialogue line: the character's override, the auto-cast
 * plan, or the global default ("auto"/all-cast lines). Falls back to the
 * default voice whenever a saved URI no longer resolves.
 */
export function resolveSpeakerVoice(
  speaker: SpeakerId,
  overrides: Record<string, string>,
  plan: Record<string, string>,
  fallback: SpeechSynthesisVoice | null
): SpeechSynthesisVoice | null {
  if (speaker === "all-cast") return fallback;
  const setting = overrides[speaker] ?? CAST_SETTING.cast;
  const uri =
    setting === CAST_SETTING.cast
      ? (plan[speaker] ?? CAST_SETTING.auto)
      : setting;
  if (uri === CAST_SETTING.auto) return fallback;
  return resolveVoice(uri) ?? fallback;
}
