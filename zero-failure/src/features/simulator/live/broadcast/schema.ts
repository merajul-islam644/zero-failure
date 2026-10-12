// Broadcast document: the shared playback head every signed-in viewer
// converges on, stored as a single Data Gateway document (last-writer-wins).
// It stores presentation facts only — who moved the head, where it stands —
// never tokens or credentials; `updatedBy` is a display name.

/** Data Gateway collection holding the single broadcast document. */
export const BROADCAST_COLLECTION = "broadcast_state";

/** The one document in the collection — one room, one head. */
export const BROADCAST_DOC_ID = "main";

/** Playback rates the TransportBar offers; the head projection assumes one of these. */
export const BROADCAST_RATES = [0.5, 1, 2, 4, 8, 16];

export interface BroadcastState {
  /**
   * When this state was authored (writer's wall clock, ms epoch) — the
   * projection origin. On the wire it travels as a string (see parse).
   */
  epochMs: number;
  /** The head position at epochMs, in timeline ms. */
  headMs: number;
  playing: boolean;
  rate: number;
  /** Which scenario the head indexes into; slaves switch to match. */
  scenarioId: string;
  mode: "simulated" | "live";
  /** Authoring timestamp, kept distinct from epochMs for diagnostics. String on the wire. */
  updatedAt: number;
  /** Display name of the last writer — no tokens, no emails. */
  updatedBy: string;
  /** Writer count; every write bumps it so readers can order states. */
  rev: number;
}

/**
 * Validate an untrusted document (another viewer's write, another schema
 * version) into a BroadcastState, or null when it is not one. Narrow on
 * purpose: headMs must be a non-negative finite number, rate a positive
 * finite number — a garbage field must disable sync, not corrupt the clock.
 *
 * epochMs/updatedAt may arrive as numeric strings: the gateway's numeric
 * write path is 32-bit, so ms epochs (~1.7e12) are stored as strings.
 */
export function parseBroadcastState(raw: unknown): BroadcastState | null {
  if (typeof raw !== "object" || raw === null) return null;
  const doc = raw as Record<string, unknown>;
  const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
  // A ms epoch wearing the string the gateway stores it in, or a plain number.
  const asMs = (v: unknown): number | null => {
    if (isFiniteNumber(v)) return v;
    if (typeof v === "string" && v.length > 0) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
    return null;
  };
  const epochMs = asMs(doc.epochMs);
  const updatedAt = asMs(doc.updatedAt);
  if (epochMs === null || !isFiniteNumber(doc.headMs) || doc.headMs < 0) return null;
  if (!isFiniteNumber(doc.rate) || doc.rate <= 0) return null;
  if (typeof doc.playing !== "boolean") return null;
  if (typeof doc.scenarioId !== "string" || doc.scenarioId.length === 0) return null;
  if (doc.mode !== "simulated" && doc.mode !== "live") return null;
  if (updatedAt === null || !isFiniteNumber(doc.rev) || doc.rev < 0) return null;
  return {
    epochMs,
    headMs: doc.headMs,
    playing: doc.playing,
    rate: doc.rate,
    scenarioId: doc.scenarioId,
    mode: doc.mode,
    updatedAt,
    updatedBy: typeof doc.updatedBy === "string" ? doc.updatedBy : "unknown",
    rev: doc.rev
  };
}
