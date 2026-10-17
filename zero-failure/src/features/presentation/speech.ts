// The show's voice track: who speaks when. Every level speaks in its
// own right — on a menu base the sun (the system identity) first, then
// each planet, then its menus and sub-menus depth-first — and the
// turnstile paces each turn by the words it holds. Pure functions over
// the system, no React: the live show rides them per frame, and the
// video recorder paints the very same turns as caption bubbles.

import { CAST } from "../simulator/script/cast";
import type { ForgedMenu, ForgedLeaf, ForgedSystem } from "../create/systemsDoc";

/** The breath between two voices — a beat of quiet sky before the next
 *  world picks up its own words. */
export const BREATH_MS = 700;

/** One turn on the stage: the speaker's ring seat, its words, the name
 *  and cartoon face the bubble wears, and the voice the browser speaks
 *  it with — all of it the level's own, straight off its console. */
export interface VoiceEntry {
  index: number;
  name: string;
  text: string;
  avatar?: string;
  voice?: string;
  pitch?: number;
  /** The bubble window the turn holds (ms) — narration fits inside it. */
  dur?: number;
}

/** The cast faces a level's bubble may wear — ids the wire carries are
 *  guarded here, so a stranger record's junk id never reaches the painter. */
const AVATAR_IDS = new Set<string>(CAST.map((character) => character.id));

/** Every voice the show hears: on a menu base the sun — the system
 *  identity itself — speaks first (index -1, the center seat), then
 *  each planet's own words, then its menus and sub-menus depth-first —
 *  every level speaks in its own right, all riding its seat in the sky.
 *  A muted level, or one left empty, never speaks. */
export function speechVoices(system: ForgedSystem): VoiceEntry[] {
  const voices: VoiceEntry[] = [];
  const hear = (
    level: { name: string; speech?: string; muted?: boolean; avatar?: string; voice?: string; pitch?: number },
    index: number,
  ) => {
    const words = (level.speech ?? "").trim();
    if (words.length === 0 || level.muted === true) return;
    voices.push({
      index,
      name: level.name,
      text: words,
      avatar: level.avatar && AVATAR_IDS.has(level.avatar) ? level.avatar : undefined,
      voice: level.voice,
      pitch: level.pitch,
    });
  };
  const walk = (levels: (ForgedMenu | ForgedLeaf)[] | undefined, index: number) => {
    for (const level of levels ?? []) {
      hear(level, index);
      walk((level as ForgedMenu).submenu, index);
    }
  };
  if (system.base === "menu") {
    hear(
      {
        name: system.sun,
        speech: system.speech,
        muted: system.muted,
        avatar: system.avatar,
        voice: system.voice,
        pitch: system.pitch,
      },
      -1,
    );
  }
  system.planets.forEach((planet, index) => {
    hear(planet, index);
    walk(planet.menus, index);
    walk(planet.submenu, index);
  });
  return voices;
}

/** Who speaks at the head's current moment: each narration holds the
 *  stage for as long as its words need — paced by word count, clipped
 *  to a bubble's worth — and the voices cycle from the playback head
 *  itself, so pause freezes a voice mid-sentence, speed scales it and
 *  scrubbing recasts it. One lone voice simply never stops. */
export function speechSpeaker(system: ForgedSystem, t: number): VoiceEntry | null {
  const voices = speechVoices(system).map((voice) => ({
    ...voice,
    dur: Math.min(14000, Math.max(3200, voice.text.split(/\s+/).length * 430)),
  }));
  if (voices.length === 0) return null;
  if (voices.length === 1) return voices[0]!;
  const cycle = voices.reduce((sum, voice) => sum + voice.dur + BREATH_MS, 0);
  let local = t % cycle;
  for (const voice of voices) {
    if (local < voice.dur) return voice;
    local -= voice.dur + BREATH_MS;
  }
  return null; // inside the final breath
}
