// Per-platform live capability table. Total over PlatformId on purpose — the
// typechecker rejects a platform without an entry, and probes.test.ts asserts
// the table stays in sync with the cast's PLATFORMS list.

import type { PlatformId } from "../engine/types";
import { PLATFORMS } from "../script/cast";
import type { LiveCapability, ProbeKey } from "./types";

export const CAPABILITIES: Record<PlatformId, LiveCapability> = {
  iam: { kind: "sdk-read", probe: "iam-me" },
  "data-gateway": { kind: "sdk-read", probe: "data-schemas" },
  localization: { kind: "sdk-read", probe: "localization-languages" },
  storage: { kind: "sdk-read", probe: "storage-objects" },
  utilities: { kind: "sdk-read", probe: "notifier-inbox" },
  os: { kind: "no-live-api" },
  logic: { kind: "no-live-api" },
  release: { kind: "no-live-api" },
  monitor: { kind: "no-live-api" },
  "ai-agent": { kind: "no-live-api" }
};

export function capabilityFor(platform: PlatformId): LiveCapability {
  return CAPABILITIES[platform];
}

/** The five platforms a probe can reach, keyed the other way for the activity diff. */
export const PLATFORM_FOR_PROBE: Record<ProbeKey, PlatformId> = {
  "iam-me": "iam",
  "data-schemas": "data-gateway",
  "localization-languages": "localization",
  "storage-objects": "storage",
  "notifier-inbox": "utilities"
};

/** Platforms the SDK simply cannot reach live — always rendered as simulated. */
export function isNoLiveApi(platform: PlatformId): boolean {
  return CAPABILITIES[platform].kind === "no-live-api";
}
