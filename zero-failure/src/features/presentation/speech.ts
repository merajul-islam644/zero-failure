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

/** The half-breath between two chunks of the same voice — long enough
 *  to mark the page turn, short enough to stay one speech. */
export const CHUNK_BEAT_MS = 350;

/** The most bubble a single chunk holds — and short enough that no
 *  engine's long-utterance quirks bite; longer speeches simply flow
 *  through more chunks. */
const CHUNK_MAX_CHARS = 180;

/**
 * Split one level's words into bubble-sized chunks: whole sentences are
 * packed up to the budget, and a sentence too long for a whole bubble
 * on its own is split by words. The show speaks a chunk, then the next
 * loads — the speech never floods the sky at once.
 */
export function chunkNarration(text: string, maxChars = CHUNK_MAX_CHARS): string[] {
  const chunks: string[] = [];
  const sentences = text.match(/[^.!?…]+[.!?…]*\s*/g) ?? [text];
  let current = "";
  const flush = () => {
    const trimmed = current.trim();
    if (trimmed) chunks.push(trimmed);
    current = "";
  };
  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      flush();
      const words = sentence.trim().split(/\s+/);
      let piece = "";
      for (const word of words) {
        const candidate = piece ? `${piece} ${word}` : word;
        if (candidate.length > maxChars && piece) {
          chunks.push(piece);
          piece = word;
        } else {
          piece = candidate;
        }
      }
      if (piece.trim()) chunks.push(piece.trim());
      continue;
    }
    const candidate = current ? `${current} ${sentence.trim()}` : sentence.trim();
    if (candidate.length > maxChars && current) {
      flush();
      current = sentence.trim();
    } else {
      current = candidate;
    }
  }
  flush();
  return chunks;
}

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
  /** The window the turn holds (ms) — sized to the words, so the voice
   *  finishes at its natural pace with room to spare. */
  dur?: number;
}

/** The cast faces a level's bubble may wear — ids the wire carries are
 *  guarded here, so a stranger record's junk id never reaches the painter. */
const AVATAR_IDS = new Set<string>(CAST.map((character) => character.id));

/** Every voice the show hears: the center speaks first on either base —
 *  the menu base's sun is the system identity, and an app base's center
 *  app is the team lead addressing the rest — then each planet's own
 *  words, then its menus and sub-menus depth-first — every level speaks
 *  in its own right, all riding its seat in the sky. A muted level, or
 *  one left empty, never speaks. */
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
  hear(
    {
      name: system.base === "menu" ? system.sun : system.planets[0]?.name ?? system.sun,
      speech: system.speech,
      muted: system.muted,
      avatar: system.avatar,
      voice: system.voice,
      pitch: system.pitch,
    },
    -1,
  );
  system.planets.forEach((planet, index) => {
    hear(planet, index);
    walk(planet.menus, index);
    walk(planet.submenu, index);
  });
  return voices;
}

/** One paced turn on the clock: the voice entry plus the window it
 *  holds — `start`..`end` on the show's head, the breath after it — and
 *  `part`, the position in the play order this turn belongs to (a part
 *  is one block on the strip; its chunks share the number). */
export type SpeechTurn = VoiceEntry & { start: number; end: number; part: number };

/** The whole show's turn list against the head: every level's words in
 *  bubble-sized chunks, each with the window it holds. `sequence` is the
 *  drag-arranged play order — the voice seats in the order they speak,
 *  repeats and all; without one, the cast speaks in its natural order.
 *  Pure — the live show, the recorder and the voice-driven advance all
 *  read it. */
export function speechTurns(system: ForgedSystem, sequence?: number[]): SpeechTurn[] {
  const voices = speechVoices(system);
  const bySeat = new Map(voices.map((voice) => [voice.index, voice]));
  const parts = (sequence ?? voices.map((voice) => voice.index)).filter((seat) =>
    bySeat.has(seat),
  );
  const turns: SpeechTurn[] = [];
  let start = 0;
  parts.forEach((seat, part) => {
    const voice = bySeat.get(seat)!;
    const chunks = chunkNarration(voice.text);
    chunks.forEach((text, ci) => {
      const dur = Math.max(3400, text.split(/\s+/).length * 495 + 250);
      turns.push({ ...voice, text, dur, start, end: start + dur, part });
      start += dur + (ci < chunks.length - 1 ? CHUNK_BEAT_MS : BREATH_MS);
    });
  });
  return turns;
}

/** Who speaks at the head's current moment: the turn whose window holds
 *  the head — the cycle rides the playback head itself, so pause freezes
 *  a voice mid-chunk, speed scales it and scrubbing recasts it. */
export function speechSpeaker(
  system: ForgedSystem,
  t: number,
  sequence?: number[],
): SpeechTurn | null {
  const turns = speechTurns(system, sequence);
  if (turns.length === 0) return null;
  const cycle = turns[turns.length - 1]!.end + BREATH_MS;
  const local = t % cycle;
  const hit = turns.find((turn) => local >= turn.start && local < turn.end);
  return hit ?? null; // inside a breath
}

/** The whole voice track's length — every chunk window plus the breath
 *  after the last one. The show stretches to cover this, so the voices
 *  always finish before the show does. */
export function speechCycleMs(system: ForgedSystem, sequence?: number[]): number {
  const turns = speechTurns(system, sequence);
  if (turns.length === 0) return 0;
  return turns[turns.length - 1]!.end + BREATH_MS;
}
