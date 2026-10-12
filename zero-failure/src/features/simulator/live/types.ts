// Live-capability types: what each simulator platform can really do against
// a SELISE Blocks tenant, and what a read-only probe last observed. The
// engine's ExecutionMode says which registry runs; these types describe what
// "live" honestly means per platform.

/** The five read-only probes the live layer polls — one per SDK-backed platform. */
export type ProbeKey =
  | "iam-me"
  | "data-schemas"
  | "localization-languages"
  | "storage-objects"
  | "notifier-inbox";

export type LiveCapability =
  | { kind: "sdk-read"; probe: ProbeKey }
  /** SDK surface exists but is send-only (mail) — nothing safe to probe or run. */
  | { kind: "send-only" }
  /** No SELISE Blocks API backs this platform (os, logic, release, …) — simulated only. */
  | { kind: "no-live-api" };

export type LiveProbeState =
  | {
      status: "configured";
      detail: string;
      /** Structured count behind the detail (schemas, languages, objects, inbox) — the activity differ compares these, never the prose. */
      count?: number;
      latencyMs: number;
      checkedAt: number;
    }
  | { status: "not-configured"; reason: string; checkedAt: number }
  | { status: "unreachable"; reason: string; checkedAt: number }
  | { status: "unknown" };
