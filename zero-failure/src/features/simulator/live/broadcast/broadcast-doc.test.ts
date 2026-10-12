// Gateway adapter rules: reads must ask for the doc's fields (the SDK's
// default selection is ItemId only) and unwrap the gateway's
// `{ data: { getbroadcast_states: … } }` envelope, writes must send epochs
// as strings (the gateway's numeric write path is 32-bit — a ms epoch
// overflows into a masked execution error), and the item id must come back
// from the wrapped insert payload so upserts update instead of duplicate.

import { describe, expect, it, vi } from "vitest";
import type { BlocksClient } from "@seliseblocks/client";
import { readBroadcastDoc, writeBroadcastDoc } from "./broadcast-doc";
import type { BroadcastState } from "./schema";

const DOC: BroadcastState = {
  epochMs: 1_791_746_497_390,
  headMs: 76_262.5,
  playing: false,
  rate: 1,
  scenarioId: "default-storyline",
  mode: "live",
  updatedAt: 1_791_746_497_390,
  updatedBy: "Demo Explorer",
  rev: 1
};

/** The gateway's real envelope: the HTTP layer returns the body verbatim. */
const listEnvelope = (items: unknown[]) => ({
  data: { getbroadcast_states: { items, totalCount: items.length } }
});

/** A collection() stand-in that records calls and replays canned results. */
function fakeClient(paths: {
  list?: (options: unknown) => unknown;
  create?: (payload: Record<string, unknown>) => unknown;
  update?: (itemId: string, payload: Record<string, unknown>) => unknown;
}): BlocksClient {
  return {
    data: {
      collection: () => ({
        list: vi.fn(paths.list ?? (() => undefined)),
        create: vi.fn(paths.create ?? (() => undefined)),
        update: vi.fn(paths.update ?? (() => undefined))
      })
    }
  } as unknown as BlocksClient;
}

describe("readBroadcastDoc", () => {
  it("asks the gateway for every doc field, not the ItemId-only default", async () => {
    let requested: unknown;
    const client = fakeClient({
      list: (options) => {
        requested = options;
        return listEnvelope([]);
      }
    });
    await readBroadcastDoc(client);
    expect(requested).toEqual({
      fields: [
        "epochMs",
        "headMs",
        "playing",
        "rate",
        "scenarioId",
        "mode",
        "updatedAt",
        "updatedBy",
        "rev"
      ]
    });
  });

  it("unwraps the gateway envelope and keeps the highest-rev doc + ItemId key", async () => {
    const client = fakeClient({
      list: () =>
        listEnvelope([
          { ItemId: "low", ...DOC, rev: 1 },
          { ItemId: "high", ...DOC, rev: 2, epochMs: String(DOC.epochMs) },
          { ItemId: "junk", scenarioId: "not-a-doc" }
        ])
    });
    const read = await readBroadcastDoc(client);
    expect(read.doc?.rev).toBe(2);
    expect(read.doc?.epochMs).toBe(DOC.epochMs);
    expect(read.itemId).toBe("high");
  });

  it("still reads a flat (unwrapped) items array as a defense", async () => {
    const client = fakeClient({
      list: () => ({ data: { items: [{ ItemId: "flat", ...DOC }] } })
    });
    const read = await readBroadcastDoc(client);
    expect(read.doc?.rev).toBe(1);
    expect(read.itemId).toBe("flat");
  });

  it("returns a null doc for an empty room", async () => {
    const read = await readBroadcastDoc(fakeClient({ list: () => listEnvelope([]) }));
    expect(read.doc).toBeNull();
    expect(read.itemId).toBeNull();
  });
});

describe("writeBroadcastDoc", () => {
  it("sends epochs as strings so the 32-bit gateway write path holds", async () => {
    let sent: Record<string, unknown> | undefined;
    const client = fakeClient({
      create: (payload) => {
        sent = payload;
        return { data: { insertbroadcast_state: { acknowledged: true, itemId: "created-1" } } };
      }
    });
    const itemId = await writeBroadcastDoc(client, null, DOC);
    expect(itemId).toBe("created-1");
    expect(sent?.epochMs).toBe("1791746497390");
    expect(sent?.updatedAt).toBe("1791746497390");
    expect(sent?.headMs).toBe(76_262.5);
    expect(sent?.rev).toBe(1);
  });

  it("updates the known item instead of creating a duplicate", async () => {
    let updatedWith: string | undefined;
    const client = fakeClient({
      update: (itemId) => {
        updatedWith = itemId;
        return { data: { updatebroadcast_state: { acknowledged: true, itemId } } };
      }
    });
    const itemId = await writeBroadcastDoc(client, "existing-1", DOC);
    expect(itemId).toBe("existing-1");
    expect(updatedWith).toBe("existing-1");
  });

  it("re-creates when the known item has vanished (0 rows impacted)", async () => {
    const order: string[] = [];
    const client = fakeClient({
      update: () => {
        order.push("update");
        return { data: { updatebroadcast_state: { acknowledged: true, totalImpactedData: 0 } } };
      },
      create: () => {
        order.push("create");
        return { data: { insertbroadcast_state: { acknowledged: true, itemId: "recreated-1" } } };
      }
    });
    const itemId = await writeBroadcastDoc(client, "ghost-1", DOC);
    expect(order).toEqual(["update", "create"]);
    expect(itemId).toBe("recreated-1");
  });

  it("returns null (not a crash) when the create response yields no id", async () => {
    const client = fakeClient({ create: () => ({ data: { insertbroadcast_state: {} } }) });
    const itemId = await writeBroadcastDoc(client, null, DOC);
    expect(itemId).toBeNull();
  });
});
