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
        mode: "simulated",
        simulated: true
      });
    }
  };
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
