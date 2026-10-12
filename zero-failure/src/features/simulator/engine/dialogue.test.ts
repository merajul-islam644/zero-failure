// Watched-dialogue resolution: the variant a line speaks must be the outcome
// the run actually recorded, interpolation must carry real values, and
// resolution must stay pure (same inputs, same scenes out).

import { describe, expect, it } from "vitest";
import { executeScenario } from "../run/runner";
import { SCENARIO_DEFAULT } from "../scenarios/registry";
import { SCENES } from "../script/scenes";
import { budgetScene } from "./budget";
import {
  interpolate,
  pickWatchOutcome,
  resolveScenes,
  resolveWatchedText
} from "./dialogue";
import type { DialogueWatch, StructuredMessage } from "./types";

let fixtureSeq = 0;
function msg(overrides: Partial<StructuredMessage> = {}): StructuredMessage {
  fixtureSeq += 1;
  return {
    runId: "RUN-TEST",
    correlationId: "c",
    requestId: "c#a1",
    sourcePlatform: "os",
    targetPlatform: "iam",
    operation: "authenticate-identity",
    timestamp: 0,
    status: "succeeded",
    durationMs: 900,
    requestSummary: "req",
    responseSummary: "res",
    mode: "simulated",
    attempt: 1,
    simulated: true,
    ...overrides
  };
}

const STATIC = "The static script line.";

describe("pickWatchOutcome", () => {
  it("reports a single attempt's own status", () => {
    expect(pickWatchOutcome([msg({ status: "succeeded" })])).toBe("succeeded");
    expect(pickWatchOutcome([msg({ status: "failed" })])).toBe("failed");
    expect(pickWatchOutcome([msg({ status: "timed-out" })])).toBe("timed-out");
    expect(pickWatchOutcome([msg({ status: "not-configured" })])).toBe("not-configured");
  });

  it("upgrades a fail-then-succeed chain to recovered", () => {
    const chain = [msg({ status: "failed", attempt: 1 }), msg({ status: "succeeded", attempt: 2 })];
    expect(pickWatchOutcome(chain)).toBe("recovered");
  });

  it("never calls an all-clean chain recovered", () => {
    const chain = [msg({ status: "succeeded", attempt: 1 }), msg({ status: "succeeded", attempt: 2 })];
    expect(pickWatchOutcome(chain)).toBe("succeeded");
  });

  it("with an explicit attempt, reports that attempt's own status", () => {
    const chain = [msg({ status: "failed", attempt: 1 }), msg({ status: "succeeded", attempt: 2 })];
    expect(pickWatchOutcome(chain, 1)).toBe("failed");
    expect(pickWatchOutcome(chain, 2)).toBe("succeeded");
  });
});

describe("resolveWatchedText", () => {
  const watch = (overrides: Partial<DialogueWatch> = {}): DialogueWatch => ({
    correlationId: "c",
    variants: { succeeded: "SUCCEEDED VARIANT." },
    ...overrides
  });

  it("falls back when the chain is empty (blocked step)", () => {
    const w = watch({ fallback: "BLOCKED ADMISSION." });
    expect(resolveWatchedText(w, [], STATIC)).toBe("BLOCKED ADMISSION.");
    expect(resolveWatchedText(watch(), [], STATIC)).toBe(STATIC);
  });

  it("falls back when the explicit attempt is missing", () => {
    const w = watch({ attempt: 3, fallback: "NO SUCH ATTEMPT." });
    expect(resolveWatchedText(w, [msg()], STATIC)).toBe("NO SUCH ATTEMPT.");
  });

  it("speaks the variant the final status earns", () => {
    const w = watch({
      variants: { succeeded: "CLEAN.", failed: "DIRTY.", "timed-out": "SLOW.", "not-configured": "ABSENT." }
    });
    expect(resolveWatchedText(w, [msg({ status: "succeeded" })], STATIC)).toBe("CLEAN.");
    expect(resolveWatchedText(w, [msg({ status: "failed" })], STATIC)).toBe("DIRTY.");
    expect(resolveWatchedText(w, [msg({ status: "timed-out" })], STATIC)).toBe("SLOW.");
    expect(resolveWatchedText(w, [msg({ status: "not-configured" })], STATIC)).toBe("ABSENT.");
  });

  it("prefers recovered over plain succeeded on a retry chain", () => {
    const w = watch({ variants: { recovered: "RECOVERED.", succeeded: "CLEAN." } });
    const chain = [msg({ status: "failed", attempt: 1 }), msg({ status: "succeeded", attempt: 2 })];
    expect(resolveWatchedText(w, chain, STATIC)).toBe("RECOVERED.");
  });

  it("error-code lines win over status variants", () => {
    const w = watch({
      variants: { failed: "GENERIC FAILED." },
      onError: { LIVE_TRANSPORT_ERROR: "UNREACHABLE HONESTY." }
    });
    const chain = [msg({ status: "failed", errorDetails: { code: "LIVE_TRANSPORT_ERROR", message: "blocked", retriable: true } })];
    expect(resolveWatchedText(w, chain, STATIC)).toBe("UNREACHABLE HONESTY.");
  });

  it("falls back when no variant matches the outcome", () => {
    const w = watch({ fallback: "DEFAULT ADMISSION." });
    expect(resolveWatchedText(w, [msg({ status: "timed-out" })], STATIC)).toBe("DEFAULT ADMISSION.");
  });

  it("is deterministic", () => {
    const w = watch({ variants: { succeeded: "SUCCEEDED VARIANT. {{data.roles}}" } });
    const chain = [msg({ data: { roles: 3 } })];
    expect(resolveWatchedText(w, chain, STATIC)).toBe(resolveWatchedText(w, chain, STATIC));
  });
});

describe("interpolate", () => {
  const base: Partial<StructuredMessage> = {
    runId: "RUN-X",
    operation: "verify-idempotency-support",
    targetPlatform: "utilities",
    status: "succeeded",
    attempt: 2,
    durationMs: 1234,
    data: { user: "demo@slsblx.com", roles: 3, nested: { deep: 7 } }
  };

  it("resolves every documented token", () => {
    const m = msg(base);
    expect(interpolate("{{runId}}", m)).toBe("RUN-X");
    expect(interpolate("{{operation}}", m)).toBe("verify-idempotency-support");
    expect(interpolate("{{platform}}", m)).toBe("Utilities");
    expect(interpolate("{{status}}", m)).toBe("succeeded");
    expect(interpolate("{{attempt}}", m)).toBe("2");
    expect(interpolate("{{duration}}", m)).toBe("1234 ms");
    expect(interpolate("{{data.user}}", m)).toBe("demo@slsblx.com");
    expect(interpolate("{{data.roles}}", m)).toBe("3");
    expect(interpolate("{{data.nested.deep}}", m)).toBe("7");
  });

  it("reports errors from the watched message and the chain's first attempt", () => {
    const m = msg({
      ...base,
      status: "succeeded",
      errorDetails: undefined,
      attempt: 2
    });
    const chain = [
      msg({ ...base, status: "timed-out", attempt: 1, errorDetails: { code: "OPERATION_TIMEOUT", message: "too slow", retriable: true } }),
      m
    ];
    expect(interpolate("{{error}}", chain[1]!, chain)).toBe("no error");
    expect(interpolate("{{firstError}}", chain[1]!, chain)).toBe("OPERATION_TIMEOUT");
    expect(interpolate("{{error.message}}", chain[0]!, chain)).toBe("too slow");
  });

  it("resolves missing data and unknown tokens to unknown — no braces survive", () => {
    const out = interpolate("{{data.missing}} {{noSuchToken}} {{data}}", msg({ ...base, data: undefined }));
    expect(out).toBe("unknown unknown unknown");
    expect(out).not.toContain("{{");
    expect(interpolate("{{data.missing}}", msg(base))).toBe("unknown");
  });

  it("never mutates its inputs", () => {
    const m = msg(base);
    const frozen = JSON.parse(JSON.stringify(m)) as StructuredMessage;
    interpolate("{{data.user}} {{error}}", m);
    expect(m).toEqual(frozen);
  });
});

describe("resolveScenes", () => {
  it("passes scenes through untouched when there is no run", () => {
    expect(resolveScenes(SCENES, null)).toBe(SCENES);
  });

  it("replaces only watched lines; static lines and unwatched scenes keep their identity", () => {
    const sceneA = {
      index: 1,
      title: "A",
      environment: "env",
      cast: ["iam" as const],
      targetDurationMs: 20000,
      beats: [
        { type: "dialogue" as const, speaker: "iam" as const, text: STATIC },
        {
          type: "dialogue" as const,
          speaker: "iam" as const,
          text: STATIC,
          watch: {
            correlationId: "c",
            variants: { succeeded: "WATCHED {{data.roles}}." }
          }
        }
      ],
      checkpoints: []
    };
    const sceneB = { ...sceneA, index: 2, beats: [{ type: "dialogue" as const, speaker: "iam" as const, text: "B." }] };
    const messages = [msg({ correlationId: "c", data: { roles: 4 } })];

    const [resolvedA, resolvedB] = resolveScenes([sceneA, sceneB], messages);
    expect(resolvedB).toBe(sceneB);
    expect(resolvedA).not.toBe(sceneA);
    const first = resolvedA!.beats[0];
    const second = resolvedA!.beats[1];
    expect(first).toBe(sceneA.beats[0]);
    expect(second).not.toBe(sceneA.beats[1]);
    if (second?.type === "dialogue") expect(second.text).toBe("WATCHED 4.");

    expect(resolveScenes([sceneA], messages)).toEqual(resolveScenes([sceneA], messages));
  });

  it("keeps scene budgets within the script drift bound against the real simulated run", async () => {
    const run = await executeScenario(SCENARIO_DEFAULT, "simulated");
    const resolved = resolveScenes(SCENES, run.messages);
    for (let i = 0; i < SCENES.length; i++) {
      const scene = resolved[i]!;
      const budget = budgetScene(scene.beats, scene.targetDurationMs);
      const drift = Math.abs(budget.totalMs - scene.targetDurationMs) / scene.targetDurationMs;
      expect(drift).toBeLessThanOrEqual(0.1);
    }
  });

  it("resolves the real script deterministically against a real simulated run", async () => {
    const run = await executeScenario(SCENARIO_DEFAULT, "simulated");
    expect(resolveScenes(SCENES, run.messages)).toEqual(resolveScenes(SCENES, run.messages));
  });
});
