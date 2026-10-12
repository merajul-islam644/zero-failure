// Read-only live probes: one cheap GET per SDK-backed platform, classified
// honestly. A probe never mutates anything; "configured" here means "the
// signed-in account reached this block right now", nothing stronger — a 200
// from the notifier inbox proves reachability, not send configuration.
// Probes take the client as a parameter so tests can inject a fake.

import { BlocksApiError, type BlocksClient } from "@seliseblocks/client";
import type { LiveProbeState, ProbeKey } from "./types";
import { TimeoutError, withTimeout } from "./withTimeout";

const PROBE_TIMEOUT_MS = 8000;

export function classifyProbeError(err: unknown): { kind: "not-configured" | "unreachable"; reason: string } {
  if (err instanceof TimeoutError) {
    return { kind: "unreachable", reason: err.message };
  }
  if (err instanceof BlocksApiError) {
    if (err.status === 401 || err.status === 403) {
      return { kind: "not-configured", reason: "Signed-in account lacks permission for this block" };
    }
    if (err.status === 404) {
      return { kind: "not-configured", reason: "Block or collection not available on this tenant" };
    }
    return { kind: "unreachable", reason: `Blocks API error ${err.status}` };
  }
  return { kind: "unreachable", reason: "Network or transport failure" };
}

async function probe(
  client: BlocksClient,
  key: ProbeKey,
  run: (client: BlocksClient) => Promise<{ detail: string; count?: number }>
): Promise<LiveProbeState> {
  const startedAt = performance.now();
  try {
    const { detail, count } = await withTimeout(run(client), PROBE_TIMEOUT_MS, `probe ${key}`);
    return {
      status: "configured",
      detail,
      ...(count === undefined ? {} : { count }),
      latencyMs: Math.round(performance.now() - startedAt),
      checkedAt: Date.now()
    };
  } catch (err) {
    const { kind, reason } = classifyProbeError(err);
    return kind === "not-configured"
      ? { status: "not-configured", reason, checkedAt: Date.now() }
      : { status: "unreachable", reason, checkedAt: Date.now() };
  }
}

export const PROBES: Record<ProbeKey, (client: BlocksClient) => Promise<LiveProbeState>> = {
  "iam-me": (client) =>
    probe(client, "iam-me", async (c) => {
      const me = await c.iam.me();
      const name = [me.firstName, me.lastName].filter(Boolean).join(" ").trim();
      // No count: identity is not a tenant metric the activity differ tracks.
      return { detail: `Session confirmed for ${name || me.email || "the signed-in user"}` };
    }),
  "data-schemas": (client) =>
    probe(client, "data-schemas", async (c) => {
      const schemas = await c.data.schemas.list({ pageNo: 1, pageSize: 1 });
      const count = schemas.data?.totalCount ?? schemas.data?.items?.length ?? 0;
      return { detail: `${count} data schema${count === 1 ? "" : "s"} visible`, count };
    }),
  "localization-languages": (client) =>
    probe(client, "localization-languages", async (c) => {
      const languages = await c.localization.languages();
      const count = languages.length;
      return { detail: `${count} language${count === 1 ? "" : "s"} configured`, count };
    }),
  "storage-objects": (client) =>
    probe(client, "storage-objects", async (c) => {
      const objects = await c.data.objects.list({ limit: 1 });
      const count = objects.totalChildCount;
      return { detail: `${count} storage object${count === 1 ? "" : "s"} at root`, count };
    }),
  "notifier-inbox": (client) =>
    probe(client, "notifier-inbox", async (c) => {
      const inbox = await c.notifier.getNotifications({ page: 1, pageSize: 1 });
      const count = inbox.totalNotificationsCount;
      return { detail: `${count} notification${count === 1 ? "" : "s"} in inbox`, count };
    })
};

export type ProbeResults = Record<ProbeKey, LiveProbeState>;

/** Run every probe in parallel; probes catch their own errors, so this never rejects. */
export async function runAllProbes(client: BlocksClient): Promise<ProbeResults> {
  const keys = Object.keys(PROBES) as ProbeKey[];
  const states = await Promise.all(keys.map((key) => PROBES[key](client)));
  return Object.fromEntries(keys.map((key, i) => [key, states[i]])) as ProbeResults;
}
