// Live connectors — real read-only executions against SELISE Blocks.
//
// Two factories, chosen by platform capability:
// - createLiveConnector: SDK-backed platforms. Mapped operations call the
//   live service under the operation's own timeout; mutating operations are
//   refused before any call exists (LIVE_READ_ONLY) — no runner path can
//   bypass that.
// - createNoLiveApiConnector: platforms with no SDK surface at all. They
//   record not-configured / NO_LIVE_API so dependency blocking and the
//   export guard stay honest (the step genuinely cannot run live).
//
// Every response is measured, mode:"live", simulated:false — the same
// StructuredMessage shape the simulated runner produces, so the timeline,
// dashboard and report render real outcomes unchanged.

import { BlocksApiError, type BlocksClient } from "@seliseblocks/client";
import type {
  ConnectorOperation,
  OperationRequest,
  OperationResponse,
  PlatformConnector,
  PlatformId
} from "../../engine/types";
import { TimeoutError, withTimeout } from "../../live/withTimeout";
import { liveOpEntryFor } from "../../live/op-mapping";

export interface LiveConnectorOptions {
  platform: PlatformId;
  displayName: string;
  operations: ConnectorOperation[];
  /** Injected for tests; production passes the shared blocksClient. */
  client: BlocksClient;
  authMethod?: string;
}

const READ_ONLY_AUTH = "Hosted OIDC session cookie (read-only)";
const NO_LIVE_API_AUTH = "No live API — simulated only";

const timedOutAfter = (timeoutMs: number) => ({
  status: "timed-out" as const,
  responseSummary: `Timed out after ${timeoutMs} ms against the live service`,
  errorDetails: {
    code: "OPERATION_TIMEOUT",
    message: `The live call exceeded the operation's ${timeoutMs} ms timeout.`,
    retriable: true
  }
});

function classifyLiveError(err: unknown, timeoutMs: number): OperationResponse {
  const classifiedFailure = (
    status: OperationResponse["status"],
    code: string,
    summary: string,
    message: string,
    retriable: boolean
  ): OperationResponse => ({
    status,
    durationMs: 0,
    responseSummary: summary,
    errorDetails: { code, message, retriable },
    mode: "live",
    simulated: false
  });

  if (err instanceof TimeoutError) {
    const timeout = timedOutAfter(timeoutMs);
    return { ...timeout, durationMs: 0, mode: "live", simulated: false };
  }
  if (err instanceof BlocksApiError) {
    if (err.status === 401 || err.status === 403) {
      return classifiedFailure(
        "not-configured",
        "LIVE_PERMISSION_DENIED",
        "Not configured — the signed-in account lacks permission for this block",
        "The live service rejected the call as unauthorized for this account.",
        false
      );
    }
    if (err.status === 404) {
      return classifiedFailure(
        "not-configured",
        "LIVE_BLOCK_UNAVAILABLE",
        "Not configured — this block or collection is not available on the tenant",
        "The live service returned 404 for this call.",
        false
      );
    }
    return classifiedFailure(
      "failed",
      "LIVE_API_ERROR",
      `Live API error ${err.status}`,
      err.message || "The live service returned an error response.",
      (err.status >= 500 || err.status === 429)
    );
  }
  return classifiedFailure(
    "failed",
    "LIVE_TRANSPORT_ERROR",
    "Unreachable — network or transport failure",
    err instanceof Error ? err.message : "The live service could not be reached.",
    true
  );
}

/** Measured wall-clock floor: a real call always takes time; rounding must never record zero. */
const elapsedMs = (startedAt: number): number => Math.max(1, Math.round(performance.now() - startedAt));

async function executeLiveOperation(
  options: LiveConnectorOptions,
  operation: string,
  request: OperationRequest
): Promise<OperationResponse> {
  const operationDef = options.operations.find((op) => op.id === operation);
  const timeoutMs = operationDef?.timeoutMs ?? 2000;
  const entry = liveOpEntryFor(options.platform, operation);

  if (!entry) {
    // Unreachable by construction: op-mapping.test.ts proves every operation
    // of every SDK-backed platform is mapped. Kept as an honest guard.
    return {
      status: "failed",
      durationMs: 0,
      responseSummary: "Live mapping missing for this operation",
      errorDetails: {
        code: "LIVE_OP_NOT_MAPPED",
        message: `No live handler is mapped for ${options.platform}:${operation}.`,
        retriable: false
      },
      mode: "live",
      simulated: false
    };
  }

  if (entry === "refused") {
    return {
      status: "failed",
      durationMs: elapsedMs(performance.now()),
      responseSummary: `Refused: ${operation} is a write — live mode is read-only by design`,
      errorDetails: {
        code: "LIVE_READ_ONLY",
        message: `Live mode never mutates tenant data: "${operation}" would create, send or store something real, so it was refused before any call was made.`,
        retriable: false
      },
      mode: "live",
      simulated: false
    };
  }

  const startedAt = performance.now();
  try {
    const outcome = await withTimeout(entry(options.client, request), timeoutMs, operation);
    return {
      status: outcome.status,
      durationMs: elapsedMs(startedAt),
      responseSummary: outcome.responseSummary,
      errorDetails: outcome.errorDetails,
      ...(outcome.data ? { data: outcome.data } : {}),
      mode: "live",
      simulated: false
    };
  } catch (err) {
    const failure = classifyLiveError(err, timeoutMs);
    return { ...failure, durationMs: elapsedMs(startedAt) };
  }
}

export function createLiveConnector(options: LiveConnectorOptions): PlatformConnector {
  return {
    platform: options.platform,
    displayName: options.displayName,
    configStatus: "configured",
    simulated: false,
    authMethod: options.authMethod ?? READ_ONLY_AUTH,
    operations: options.operations,
    execute(operation: string, request: OperationRequest): Promise<OperationResponse> {
      return executeLiveOperation(options, operation, request);
    }
  };
}

export interface NoLiveApiConnectorOptions {
  platform: PlatformId;
  displayName: string;
  operations: ConnectorOperation[];
}

export function createNoLiveApiConnector(options: NoLiveApiConnectorOptions): PlatformConnector {
  return {
    platform: options.platform,
    displayName: options.displayName,
    configStatus: "not-configured",
    simulated: false,
    authMethod: NO_LIVE_API_AUTH,
    operations: options.operations,
    execute(_operation: string, _request: OperationRequest): Promise<OperationResponse> {
      return Promise.resolve({
        status: "not-configured",
        durationMs: 0,
        responseSummary: "No live API — simulated",
        errorDetails: {
          code: "NO_LIVE_API",
          message: `${options.displayName} has no live SELISE Blocks API — this step cannot run live.`,
          retriable: false
        },
        mode: "live",
        simulated: false
      });
    }
  };
}
