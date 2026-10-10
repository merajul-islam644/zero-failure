// Presentation-time budgeting: turns script beats into a laid-out scene of
// exact durations. Pure math, fully unit-tested — the compiler (timeline.ts)
// consumes its output verbatim.
//
// Rules (from the plan):
// - Dialogue: max(2600, words / 3.6 wps * 1000 + 700) ms.
// - Exchange: travel 700 + processing clamp(900..2200) + resolve 600.
// - Processing beat: weight * 1200 ms (default weight 1).
// - Notes (stage directions) hold the caption floor like a short line —
//   they are script content and must be readable on their own.
// - Scene is scaled to its target with a 0.72x readability floor — a scene
//   whose floored total exceeds the target simply runs longer; scene start
//   times accumulate actual totals so the global canvas stays consistent.

import type { Beat } from "./types";

export interface BudgetedItem {
  beat: Beat;
  startMs: number;
  durationMs: number;
}

export interface SceneBudget {
  items: BudgetedItem[];
  totalMs: number;
  /** Total before scaling (sum of raw durations). */
  rawMs: number;
  scale: number;
  compressed: boolean;
}

export const READABILITY_FLOOR = 0.72;
export const MAX_STRETCH = 1.5;

const WORDS_PER_SECOND = 3.6;
const DIALOGUE_TAIL_MS = 700;
const DIALOGUE_MIN_MS = 2600;
const NOTE_MS = 2600;

export const EXCHANGE_TRAVEL_MS = 700;
export const EXCHANGE_RESOLVE_MS = 600;
export const PROCESSING_UNIT_MS = 1200;
export const DEFAULT_PROCESSING_MS = 1400;

/** Clamp for exchange processing windows (presentation only). */
export function clampProcessingMs(ms: number): number {
  return Math.min(2200, Math.max(900, ms));
}

export function dialogueDurationMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(DIALOGUE_MIN_MS, Math.round((words / WORDS_PER_SECOND) * 1000 + DIALOGUE_TAIL_MS));
}

interface Segment {
  index: number;
  rawMs: number;
  /** Exchange/processing segments absorb leftover budget when stretching. */
  flexible: boolean;
}

function rawDuration(beat: Beat): { ms: number; flexible: boolean } {
  switch (beat.type) {
    case "dialogue":
      return { ms: dialogueDurationMs(beat.text), flexible: false };
    case "exchange": {
      // Processing hint unknown at budget time (runner fills it in M3);
      // default window keeps pacing stable.
      const processing = clampProcessingMs(DEFAULT_PROCESSING_MS);
      return {
        ms: EXCHANGE_TRAVEL_MS + processing + EXCHANGE_RESOLVE_MS,
        flexible: true
      };
    }
    case "processing":
      return { ms: PROCESSING_UNIT_MS * (beat.weight ?? 1), flexible: true };
    case "note":
      return { ms: NOTE_MS, flexible: false };
  }
}

export function budgetScene(beats: Beat[], targetMs: number): SceneBudget {
  const segments: Segment[] = beats.map((beat, index) => {
    const { ms, flexible } = rawDuration(beat);
    return { index, rawMs: ms, flexible };
  });

  const rawMs = segments.reduce((sum, s) => sum + s.rawMs, 0);
  const floored = rawMs * READABILITY_FLOOR;
  // Too long even at the floor → run over the target (compressed).
  // Otherwise scale toward the target, bounded for natural pacing.
  const scale =
    floored > targetMs
      ? READABILITY_FLOOR
      : Math.min(MAX_STRETCH, Math.max(READABILITY_FLOOR, targetMs / rawMs));

  // First pass: scaled durations.
  const scaled = segments.map((s) => ({ ...s, ms: Math.round(s.rawMs * scale) }));
  let totalMs = scaled.reduce((sum, s) => sum + s.ms, 0);

  // Leftover target time goes into flexible segments (processing/travel
  // windows breathe instead of leaving blank waits). Floor still applies.
  let leftover = targetMs - totalMs;
  if (leftover > 0) {
    const flex = scaled.filter((s) => s.flexible);
    if (flex.length > 0) {
      const flexRaw = flex.reduce((sum, s) => sum + s.rawMs, 0);
      for (const s of flex) {
        const share = flexRaw === 0 ? 0 : Math.round((s.rawMs / flexRaw) * leftover);
        s.ms += share;
      }
      totalMs += leftover;
      leftover = 0;
    }
  }

  // Lay out contiguously; every beat now holds a positive duration.
  const items: BudgetedItem[] = [];
  let cursor = 0;
  scaled.forEach((s, i) => {
    const beat = beats[i];
    if (!beat) return;
    items.push({ beat, startMs: cursor, durationMs: s.ms });
    cursor += s.ms;
  });

  return { items, totalMs, rawMs, scale, compressed: floored > targetMs };
}
