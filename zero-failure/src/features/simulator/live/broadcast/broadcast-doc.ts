// Data Gateway adapter for the broadcast document: readiness, read, upsert.
// All shapes on the wire are `unknown` until parseBroadcastState blesses
// them — another viewer's garbage must disable sync, never corrupt the
// clock. Client is injected so tests (and node) never construct the real
// browser client.

import type { BlocksClient } from "@seliseblocks/client";
import { BROADCAST_COLLECTION, parseBroadcastState, type BroadcastState } from "./schema";

export interface BroadcastReadiness {
  ready: boolean;
  /** Present when not ready — shown verbatim in the control's status line. */
  reason?: string;
}

export interface BroadcastDocRead {
  doc: BroadcastState | null;
  /** The gateway item id backing the doc — needed for updates. */
  itemId: string | null;
}

/** The schema must exist before sync can work — say which gap is hit. */
export async function checkBroadcastReadiness(client: BlocksClient): Promise<BroadcastReadiness> {
  const result = await client.data.schemas.get(BROADCAST_COLLECTION);
  const items = result.data?.items ?? [];
  if (items.length === 0) {
    return {
      ready: false,
      reason: `Collection "${BROADCAST_COLLECTION}" does not exist on this tenant yet — create it to enable synced viewing (see README).`
    };
  }
  return { ready: true };
}

/**
 * The gateway wraps every collection payload as `{ data: { <op><Schema>s: … } }`
 * (e.g. `data.getbroadcast_states.items`) — the HTTP layer returns the body
 * verbatim. Dig that single payload out; fall back to the response itself so
 * flatter shapes (and tests) still work.
 */
function unwrapCollectionPayload(response: unknown): Record<string, unknown> {
  if (typeof response !== "object" || response === null) return {};
  const data = (response as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) return response as Record<string, unknown>;
  const payloads = Object.values(data as Record<string, unknown>).filter(
    (value): value is Record<string, unknown> =>
      typeof value === "object" && value !== null && !Array.isArray(value)
  );
  return payloads.find((payload) => Object.keys(payload).length > 0) ?? {};
}

/** Pull items out of whatever envelope the gateway returned — narrowly. */
function extractItems(response: unknown): Record<string, unknown>[] {
  const candidates = [
    unwrapCollectionPayload(response).items,
    (response as { data?: { items?: unknown } }).data?.items,
    (response as { items?: unknown }).items
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(
        (item): item is Record<string, unknown> => typeof item === "object" && item !== null
      );
    }
  }
  return [];
}

function extractItemId(item: Record<string, unknown>): string | null {
  // "ItemId" is the gateway's own key for it; the rest defend against
  // envelope shapes that normalize the name.
  for (const key of ["ItemId", "id", "Id", "itemId", "_id"]) {
    const value = item[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

/**
 * The collection's fields, listed explicitly — the SDK's default selection
 * is ItemId only, which can never parse into a broadcast doc.
 */
const DOC_FIELDS = [
  "epochMs",
  "headMs",
  "playing",
  "rate",
  "scenarioId",
  "mode",
  "updatedAt",
  "updatedBy",
  "rev"
] as const;

/**
 * The wire form of a doc: epochs become strings because the gateway's
 * numeric write path is 32-bit and a ms epoch (~1.7e12) overflows it into
 * a masked "Unexpected Execution Error".
 */
function toWire(doc: BroadcastState): Record<string, unknown> {
  return {
    ...doc,
    epochMs: String(doc.epochMs),
    updatedAt: String(doc.updatedAt)
  };
}

/** Read every item in the collection and keep the highest-rev broadcast doc. */
export async function readBroadcastDoc(client: BlocksClient): Promise<BroadcastDocRead> {
  const collection = client.data.collection<Record<string, unknown>>(BROADCAST_COLLECTION);
  const response = await collection.list({ fields: [...DOC_FIELDS] });
  let best: BroadcastState | null = null;
  let bestItemId: string | null = null;
  for (const item of extractItems(response)) {
    const doc = parseBroadcastState(item);
    if (!doc) continue;
    if (!best || doc.rev > best.rev) {
      best = doc;
      bestItemId = extractItemId(item);
    }
  }
  return { doc: best, itemId: best ? bestItemId : null };
}

/**
 * Upsert the document: update the known item, or create when the collection
 * is empty (or the item id never surfaced). Returns the item id when the
 * response yields one, else null — the next read re-establishes it.
 */
export async function writeBroadcastDoc(
  client: BlocksClient,
  itemId: string | null,
  doc: BroadcastState
): Promise<string | null> {
  const collection = client.data.collection<Record<string, unknown>>(BROADCAST_COLLECTION);
  const wire = toWire(doc);
  if (itemId) {
    const result = await collection.update(itemId, wire);
    // The row can vanish under the tab (maintenance deleted the room's
    // items) — the update then lands on nothing while the local id keeps
    // pointing at the ghost. Impact 0 means "not there": re-create so the
    // room keeps a real document.
    const impacted = unwrapCollectionPayload(result).totalImpactedData;
    if (impacted !== 0) return itemId;
  }
  const created = await collection.create(wire);
  // The create response carries the id inside the wrapped payload
  // (`data.insertbroadcast_state.itemId`) — extract from there, not the envelope.
  return extractItemId(unwrapCollectionPayload(created));
}
