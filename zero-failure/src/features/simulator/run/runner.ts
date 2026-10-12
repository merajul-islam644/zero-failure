// Pre-execution runner: executes the WHOLE scenario up-front, producing every
// StructuredMessage and TestResult before a single frame is drawn. Playback
// is then a pure fold — seeking is free, determinism is testable.
//
// Simulation executes synchronously (microtasks only). Live mode later
// records real executions into the same shape, then renders identically.

import { SCENES } from "../script/scenes";
import { registryFor, type ConnectorRegistry } from "../connectors/registry";
import { matchInjection } from "../connectors/simulated/simulated-connector";
import { ASSERTIONS, type AssertionOutcome } from "./assertions";
import { evaluateProcessRule } from "./process-rules";
import { RUN_ID, generateRunId } from "./run-id";
import { SCENARIO_DEFAULT } from "../scenarios/registry";

export { RUN_ID };
import type {
  AttemptRecord,
  ExecutionMode,
  MessageStatus,
  RunResult,
  StructuredMessage,
  TestResult
} from "../engine/types";
import type { BlocksClient } from "@seliseblocks/client";
import type { ScenarioDefinition } from "../engine/types";

/**
 * Exchange beats whose target depends on the named prerequisite. When the
 * prerequisite fails (not merely warns), dependents are NOT executed — they
 * surface as not-tested "blocked" instead of pretending to run.
 */
const DEPENDENCY_BLOCKERS: Record<string, string[]> = {
  "get-deployment-config": ["s5-deploy-authz", "s5-deploy-job", "s5-deploy-events", "s6-readiness"]
};

export async function executeScenario(
  scenario: ScenarioDefinition,
  mode: ExecutionMode = "simulated",
  /** Live mode injects the Blocks client here (tests pass a stand-in). */
  client?: BlocksClient
): Promise<RunResult> {
  const registry = registryFor(mode, client);
  const runId = mode === "simulated" ? RUN_ID : generateRunId();
  const messages: StructuredMessage[] = [];
  const blockedOperations = new Set<string>();
  const startedAt = performance.now();

  // Injections policy: live mode runs the default storyline as-is — its
  // outcomes are what the tenant actually returned. The 14 failure scenarios
  // keep their injections as recorded overrides in both modes (disclosed by
  // the live disclaimer; they exist to exercise the test layer itself).
  const effectiveScenario =
    mode === "live" && scenario.id === SCENARIO_DEFAULT.id ? { ...scenario, injections: [] } : scenario;

  for (const scene of SCENES) {
    for (const beat of scene.beats) {
      if (beat.type !== "exchange") continue;
      if (blockedOperations.has(beat.correlationId)) continue;

      // A failed (or unconfigured) prerequisite blocks its dependents for the
      // rest of the run.
      for (const [prerequisite, dependents] of Object.entries(DEPENDENCY_BLOCKERS)) {
        const prereqFailed = messages.some(
          (m) => m.operation === prerequisite && (m.status === "failed" || m.status === "timed-out" || m.status === "not-configured")
        );
        if (prereqFailed) dependents.forEach((d) => blockedOperations.add(d));
      }

      if (blockedOperations.has(beat.correlationId)) continue;

      const attempt = beat.attempt ?? 1;
      const source = registry[beat.from];
      const target = registry[beat.to];
      const requestId = `${beat.correlationId}#a${attempt}`;

      const message = await executeExchange(effectiveScenario, source, target, {
        correlationId: beat.correlationId,
        requestId,
        operation: beat.operation,
        attempt,
        requestSummary: beat.requestSummary,
        runId
      });
      messages.push(message);
    }
  }

  const results = evaluateAssertions(messages, scenario, mode, runId);
  return {
    runId,
    mode,
    scenarioId: scenario.id,
    messages,
    results,
    // Simulation never fakes a wall clock — only live runs measure execution.
    executionDurationMs: mode === "simulated" ? null : Math.round(performance.now() - startedAt)
  };
}

async function executeExchange(
  scenario: ScenarioDefinition,
  source: ConnectorRegistry[PlatformKey],
  target: ConnectorRegistry[PlatformKey],
  spec: {
    correlationId: string;
    requestId: string;
    operation: string;
    attempt: number;
    requestSummary: string;
    runId: string;
  }
): Promise<StructuredMessage> {
  const idempotencyKey = `${spec.runId}:${spec.correlationId}`;
  const request = {
    runId: spec.runId,
    correlationId: spec.correlationId,
    requestId: spec.requestId,
    operation: spec.operation,
    payload: {},
    idempotencyKey
  };

  // Source-side authorization is part of the story; the target connector
  // produces the response we record.
  void source;
  const response = await target.execute(spec.operation, request);

  // Scenario injection wins over the connector's own answer (failures and
  // delays are injected into isolated test paths only).
  const injection = matchInjection(scenario, target.platform, spec.operation, spec.attempt, spec.correlationId);
  let status: MessageStatus = response.status;
  let durationMs = response.durationMs;
  let responseSummary = response.responseSummary;
  let errorDetails = response.errorDetails;

  if (injection) {
    switch (injection.outcome) {
      case "fail":
        status = "failed";
        errorDetails = {
          code: injection.errorCode ?? "INJECTED_FAILURE",
          message: injection.errorMessage ?? "Injected failure (isolated test path).",
          retriable: true
        };
        responseSummary = "Operation failed (injected scenario outcome)";
        break;
      case "timeout":
        status = "timed-out";
        errorDetails = {
          code: injection.errorCode ?? "OPERATION_TIMEOUT",
          message: injection.errorMessage ?? "Operation exceeded the configured timeout (isolated test path).",
          retriable: true
        };
        responseSummary = "Timed out; recorded rather than waiting indefinitely";
        break;
      case "not-configured":
        status = "not-configured";
        errorDetails = {
          code: injection.errorCode ?? "CONNECTOR_NOT_CONFIGURED",
          message: "Integration not configured for this scenario.",
          retriable: false
        };
        responseSummary = "Not configured";
        break;
      case "delay":
        durationMs += injection.delayMs ?? 1000;
        break;
      case "succeed":
        status = "succeeded";
        errorDetails = undefined;
        break;
    }
  }

  return {
    runId: spec.runId,
    correlationId: spec.correlationId,
    requestId: spec.requestId,
    sourcePlatform: source.platform,
    targetPlatform: target.platform,
    operation: spec.operation,
    // Narrative timestamp is assigned by the compiler at placement time;
    // the runner records execution order via the array index.
    timestamp: 0,
    status,
    durationMs,
    requestSummary: spec.requestSummary,
    responseSummary,
    errorDetails,
    mode: response.mode,
    attempt: spec.attempt,
    idempotencyKey,
    simulated: response.mode === "simulated"
  };
}

type PlatformKey = keyof ReturnType<typeof registryFor>;

export function evaluateAssertions(
  messages: StructuredMessage[],
  scenario: ScenarioDefinition,
  mode: ExecutionMode,
  runId: string = RUN_ID
): TestResult[] {
  return ASSERTIONS.map((assertion) => {
    let outcome: AssertionOutcome;
    if (assertion.rule.kind === "message") {
      outcome = evaluateMessageRule(assertion.rule.correlationId, assertion.rule.expectation, messages);
    } else {
      outcome = evaluateProcessRule(assertion.rule.process, { messages, scenarioId: scenario.id, mode, runId });
    }
    return {
      assertionId: assertion.id,
      runId,
      kind: assertion.rule.kind,
      status: outcome.status,
      mode,
      // No-op in simulation (runId is RUN-001); live runs expect their own id.
      expected: assertion.expected.replaceAll("RUN-001", runId),
      actual: outcome.actual,
      correlationId: outcome.correlationId,
      attempts: outcome.attempts.map(toAttemptRecord),
      durationMs: outcome.attempts.reduce((sum, m) => sum + m.durationMs, 0)
    } satisfies TestResult;
  });
}

function evaluateMessageRule(
  correlationId: string | undefined,
  expectation: string,
  messages: StructuredMessage[]
): AssertionOutcome {
  const chain = messages
    .filter((m) => (correlationId ? m.correlationId === correlationId : true))
    .sort((a, b) => a.attempt - b.attempt);

  if (chain.length === 0) {
    return { status: "not-tested", actual: "No message recorded for this correlation", correlationId, attempts: [] };
  }

  const first = chain[0];
  const final = chain[chain.length - 1];
  if (!first || !final) {
    return { status: "not-tested", actual: "Incomplete retry chain recorded", correlationId, attempts: [] };
  }

  if (final.status === "not-configured") {
    return { status: "not-configured", actual: final.responseSummary ?? "Not configured", correlationId, attempts: chain };
  }

  switch (expectation) {
    case "succeeded": {
      if (final.status === "succeeded") {
        const recovered = chain.length > 1 && first.status !== "succeeded";
        return {
          status: recovered ? "warning" : "passed",
          actual: recovered
            ? `Recovered after retry: attempt 1 ${first.status}, attempt ${final.attempt} succeeded`
            : (final.responseSummary ?? "Succeeded"),
          correlationId,
          attempts: chain
        };
      }
      return {
        status: "failed",
        actual: final.errorDetails ? `${final.errorDetails.code}: ${final.errorDetails.message}` : (final.responseSummary ?? "Failed"),
        correlationId,
        attempts: chain
      };
    }
    case "failed-by-design": {
      if (final.status === "failed" || final.status === "timed-out") {
        return {
          status: "passed",
          actual: `Denied/failed as designed (${final.errorDetails?.code ?? final.status})`,
          correlationId,
          attempts: chain
        };
      }
      return {
        status: "failed",
        actual: `Expected denial but operation ${final.status}`,
        correlationId,
        attempts: chain
      };
    }
    case "first-attempt-failure": {
      if (first.status === "failed" || first.status === "timed-out") {
        return {
          status: "passed",
          actual: `Attempt 1 recorded ${first.status}${first.errorDetails ? ` (${first.errorDetails.code})` : ""}`,
          correlationId,
          attempts: chain
        };
      }
      if (first.status === "succeeded") {
        return { status: "warning", actual: "No failure occurred to detect in this scenario", correlationId, attempts: chain };
      }
      return {
        status: "failed",
        actual: `First attempt did not record the expected failure (${first.status})`,
        correlationId,
        attempts: chain
      };
    }
    case "recovered-after-retry": {
      const recovered = chain.length > 1 && first.status !== "succeeded" && final.status === "succeeded";
      if (final.status === "succeeded") {
        return {
          status: "warning",
          actual: recovered
            ? `Recovered: attempts ${chain.map((m) => `${m.attempt}=${m.status}`).join(", ")} — initial failure preserved`
            : "No retry was needed — every attempt succeeded in this scenario",
          correlationId,
          attempts: chain
        };
      }
      if (final.status === "failed" || final.status === "timed-out") {
        return {
          status: "failed",
          actual: `Retry did not recover: final attempt ${final.status}`,
          correlationId,
          attempts: chain
        };
      }
      return { status: "not-tested", actual: "No completed retry chain recorded", correlationId, attempts: chain };
    }
    default:
      return { status: "not-tested", actual: "Unknown expectation", correlationId, attempts: chain };
  }
}

function toAttemptRecord(message: StructuredMessage): AttemptRecord {
  return {
    attempt: message.attempt,
    status: message.status,
    durationMs: message.durationMs,
    errorDetails: message.errorDetails
  };
}
