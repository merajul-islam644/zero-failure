// Live connector — deliberately NOT implemented in this iteration. Every
// operation reports not-configured. It exists so the UI can show the honest
// live-integration strip and so mode:'live' results can never silently
// masquerade as simulated ones.

import type {
  ConnectorOperation,
  OperationRequest,
  OperationResponse,
  PlatformConnector,
  PlatformId
} from "../../engine/types";

export interface LiveConnectorOptions {
  platform: PlatformId;
  displayName: string;
  operations: ConnectorOperation[];
  /** Human-readable intended auth method once wired — never a secret. */
  authMethod?: string;
}

export function createLiveConnectorStub(options: LiveConnectorOptions): PlatformConnector {
  return {
    platform: options.platform,
    displayName: options.displayName,
    configStatus: "not-configured",
    simulated: false,
    authMethod: options.authMethod ?? "Hosted OIDC (pending configuration)",
    operations: options.operations,
    execute(_operation: string, _request: OperationRequest): Promise<OperationResponse> {
      return Promise.resolve({
        status: "not-configured",
        durationMs: 0,
        responseSummary: "Live connector not configured",
        errorDetails: {
          code: "CONNECTOR_NOT_CONFIGURED",
          message: "No live SELISE Blocks connector is configured for this platform.",
          retriable: false
        },
        mode: "live",
        simulated: false
      });
    }
  };
}
