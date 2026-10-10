// Connector registry: what each platform can do, in both modes.
// Simulated mode: all 10 providers active (the script needs every platform
// reporting). Live mode: all 10 honest stubs — Not Configured until real
// SDK connectors land.

import { CAST_BY_ID } from "../script/cast";
import type { ConnectorOperation, PlatformConnector, PlatformId } from "../engine/types";
import { createSimulatedConnector } from "./simulated/simulated-connector";
import { createLiveConnectorStub } from "./live/live-connector";

const op = (
  id: string,
  summary: string,
  timeoutMs = 2000,
  maxRetries = 2,
  backoffMs = 750
): ConnectorOperation => ({ id, summary, timeoutMs, retryPolicy: { maxRetries, backoffMs } });

const OPERATIONS: Record<PlatformId, ConnectorOperation[]> = {
  os: [op("manage-test-run", "Create and close the test run")],
  iam: [
    op("authenticate-identity", "Validate the test identity"),
    op("authorize-operation", "Check an operation against the access policy"),
    op("authorize-deployment-identity", "Authorize a least-privilege deployment identity")
  ],
  "data-gateway": [
    op("query-project-record", "Fetch permitted fields of the test project record"),
    op("create-test-record", "Create a uniquely identified test record"),
    op("read-test-record", "Read a record back for persistence verification"),
    op("load-translation-resources", "Load configured language resources"),
    op("isolated-timeout-probe", "Isolated probe used by failure scenarios", 800, 1, 500),
    op("store-evidence-metadata", "Store evidence metadata rows")
  ],
  logic: [op("coordinate-step", "Execute one orchestrated workflow step")],
  release: [
    op("get-deployment-config", "Fetch the validated deployment configuration"),
    op("start-deployment-job", "Start the test-environment deployment job", 3000),
    op("run-readiness-check", "Run the application readiness check"),
    op("observe-deployment-events", "Subscribe to deployment events")
  ],
  monitor: [op("check-correlation", "Match an event against the test-run correlation")],
  utilities: [
    op("verify-idempotency-support", "Check idempotency-key support"),
    op("send-test-notification", "Send the test notification to the designated recipient")
  ],
  localization: [op("check-missing-key", "Verify missing-key detection behavior")],
  storage: [op("register-evidence-metadata", "Register expected evidence metadata")]
  ,
  "ai-agent": [op("classify-cause", "Classify failure evidence, or leave cause undetermined")]
};

export type ConnectorRegistry = Record<PlatformId, PlatformConnector>;

export function simulatedRegistry(): ConnectorRegistry {
  return Object.fromEntries(
    (Object.keys(OPERATIONS) as PlatformId[]).map((platform) => [
      platform,
      createSimulatedConnector({
        platform,
        displayName: CAST_BY_ID[platform].name,
        operations: OPERATIONS[platform]
      })
    ])
  ) as ConnectorRegistry;
}

export function liveStubRegistry(): ConnectorRegistry {
  return Object.fromEntries(
    (Object.keys(OPERATIONS) as PlatformId[]).map((platform) => [
      platform,
      createLiveConnectorStub({
        platform,
        displayName: CAST_BY_ID[platform].name,
        operations: OPERATIONS[platform]
      })
    ])
  ) as ConnectorRegistry;
}

export function registryFor(mode: "simulated" | "live"): ConnectorRegistry {
  return mode === "simulated" ? simulatedRegistry() : liveStubRegistry();
}
