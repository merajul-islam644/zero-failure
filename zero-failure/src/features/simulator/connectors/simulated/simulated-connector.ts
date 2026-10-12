// Simulated connector: promise-shaped but sync-resolving, so the live
// connector can later drop in without touching the runner. Outcomes come
// from (1) scenario injections matched first, then (2) deterministic
// per-operation success responses seeded by requestId.

import { rngFor } from "../rng";
import type {
  ConnectorOperation,
  OperationRequest,
  OperationResponse,
  PlatformConnector,
  PlatformId,
  ScenarioDefinition
} from "../../engine/types";

export interface SimulatedConnectorOptions {
  platform: PlatformId;
  displayName: string;
  operations: ConnectorOperation[];
  /** All 10 simulated providers report "configured" honestly as simulated. */
  authMethod?: string;
}

/**
 * Injection lookup: first matching injection wins (scenarios list most
 * specific first). Matches on correlationId + platform + operation + attempt,
 * each field optional meaning "any".
 */
export function matchInjection(
  scenario: ScenarioDefinition,
  platform: PlatformId,
  operation: string,
  attempt: number,
  correlationId?: string
): ScenarioDefinition["injections"][number] | null {
  for (const injection of scenario.injections) {
    const { platform: p, operation: op, attempt: a, correlationId: c } = injection.match;
    if (p !== undefined && p !== platform) continue;
    if (op !== undefined && op !== operation) continue;
    if (a !== undefined && a !== attempt) continue;
    if (c !== undefined && c !== correlationId) continue;
    return injection;
  }
  return null;
}

export function createSimulatedConnector(options: SimulatedConnectorOptions): PlatformConnector {
  const getOperation = (operation: string): ConnectorOperation | undefined =>
    options.operations.find((op) => op.id === operation);

  return {
    platform: options.platform,
    displayName: options.displayName,
    configStatus: "configured",
    simulated: true,
    authMethod: options.authMethod ?? "Simulated service account (no real credentials)",
    operations: options.operations,
    execute(operation: string, request: OperationRequest): Promise<OperationResponse> {
      const op = getOperation(operation);
      const rng = rngFor(`${request.requestId}:${operation}`);
      return Promise.resolve({
        status: "succeeded",
        durationMs: op ? Math.round(300 + rng() * Math.min(1700, op.timeoutMs - 400)) : 900,
        responseSummary: defaultResponseSummary(operation, request),
        data: simulatedDataFor(operation, request.requestId),
        mode: "simulated",
        simulated: true
      });
    }
  };
}

/**
 * Deterministic response values the dialogue and panels may quote, seeded on
 * a FRESH rng stream (":data" suffix) so the duration stream above — and with
 * it every golden outcome — stays byte-identical. These are simulated values
 * in a mode the UI labels simulated everywhere; live mode records real ones.
 */
export function simulatedDataFor(operation: string, requestId: string): Record<string, unknown> | undefined {
  const rng = rngFor(`${requestId}:${operation}:data`);
  const int = (min: number, span: number) => min + Math.floor(rng() * span);
  const hex4 = () => Math.floor(rng() * 0xffff).toString(16).padStart(4, "0");

  switch (operation) {
    case "authenticate-identity":
      return { user: "test-identity", roles: 2 };
    case "authorize-operation":
      return { roles: 2 };
    case "authorize-deployment-identity":
      return { roles: int(3, 6) };
    case "query-project-record":
      return {
        schemas: int(3, 10),
        environmentMatch: true,
        detail: "the returned project matches the expected test environment"
      };
    case "create-test-record":
      return { recordId: `REC-${hex4()}` };
    case "read-test-record":
      return { fieldsMatch: true, fields: int(6, 9) };
    case "load-translation-resources":
      return { languages: 2, keys: int(180, 140), detail: "English and Bengali resources loaded" };
    case "check-missing-key":
      return { key: "simulator.probe.key-that-must-not-exist", keyPresent: false };
    case "isolated-timeout-probe":
      return { schemas: 1, latency: int(300, 480) };
    case "store-evidence-metadata":
      return { rows: 3 };
    case "register-evidence-metadata":
      return { artifacts: 1 };
    case "get-deployment-config": {
      const v = int(1, 8);
      return { version: `cfg-1.${v}.${v}`, valid: true };
    }
    case "start-deployment-job":
      return { jobId: `JOB-${hex4()}` };
    case "run-readiness-check":
      return { healthy: true };
    case "observe-deployment-events":
      return { events: int(12, 28) };
    case "verify-idempotency-support":
      return { supported: true };
    case "send-test-notification":
      return { queued: true, recipient: "test-recipient@blocks.test" };
    default:
      return undefined;
  }
}

/** Human-readable, script-aligned response summaries per known operation. */
export function defaultResponseSummary(operation: string, request: OperationRequest): string {
  switch (operation) {
    case "authenticate-identity":
      return "Test identity authenticated via configured mechanism";
    case "authorize-operation":
      return request.operation === "authorize-operation"
        ? "Permission confirmed by configured access policy"
        : "Authorization resolved";
    case "authorize-deployment-identity":
      return "Least-privilege deployment identity authorized";
    case "query-project-record":
      return "Record returned with permitted fields; environment matches expected test environment";
    case "create-test-record":
      return "Test record created with unique identifier";
    case "read-test-record":
      return "Stored fields match submitted values";
    case "load-translation-resources":
      return "English and Bengali resources loaded";
    case "check-missing-key":
      return "Deliberately missing key detected and reported";
    case "store-evidence-metadata":
      return `Evidence metadata stored for ${request.runId}`;
    case "register-evidence-metadata":
      return "Evidence metadata registered for expected artifact";
    case "get-deployment-config":
      return "Deployment configuration validated for test environment";
    case "start-deployment-job":
      return "Deployment job completed in test environment";
    case "run-readiness-check":
      return "Application readiness verified";
    case "observe-deployment-events":
      return "Deployment events and health signals captured";
    case "verify-idempotency-support":
      return "Idempotency key supported for side-effect operations";
    case "send-test-notification":
      return "Accepted by notification provider (queued; delivery confirmation not available)";
    case "isolated-timeout-probe":
      return "Isolated connector responded within the timeout";
    default:
      return "Operation completed";
  }
}
