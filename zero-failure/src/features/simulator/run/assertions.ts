// The 49 script checkpoints as explicit, evaluable assertions. Every row in
// the dashboard traces back to a checkpoint id (CP-<scene>-<n>); nothing is
// "green" because the animation looked smooth.

import type {
  AssertionStatus,
  ExecutionMode,
  PlatformId,
  StructuredMessage
} from "../engine/types";

export type MessageExpectation =
  /** Final attempt of the correlation must succeed; a recovered chain warns. */
  | "succeeded"
  /** Negative test: denial/failure is the passing outcome. */
  | "failed-by-design"
  /** First attempt of the chain must record the failure/timeout. */
  | "first-attempt-failure"
  /** Chain must show failure -> success across attempts (recovered = warning). */
  | "recovered-after-retry";

export type ProcessRuleId =
  | "run-initialized"
  | "connectors-identified"
  | "correlation-created"
  | "initial-not-tested"
  | "no-unintended-writes"
  | "no-secrets-displayed"
  | "env-match"
  | "durations-captured"
  | "test-data-isolated"
  | "dependency-order"
  | "dependents-blocked"
  | "retry-bounded"
  | "idempotency-keys"
  | "every-step-final"
  | "target-is-test-env"
  | "separate-checks"
  | "no-production-deploy"
  | "correlation-with-run"
  | "cause-undetermined"
  | "first-failure-preserved"
  | "checksum-compared"
  | "metadata-has-run-id"
  | "config-paths-respected"
  | "summary-matches-evidence"
  | "agent-not-privileged"
  | "results-collected"
  | "warnings-retained"
  | "not-configured-excluded"
  | "verdict-from-assertions"
  | "export-available";

export interface AssertionDefinition {
  id: string;
  platform: PlatformId;
  checkpointId: string;
  title: string;
  expected: string;
  severity: "required" | "advisory";
  sceneIndex: number;
  rule:
    | { kind: "message"; expectation: MessageExpectation; correlationId?: string; operation?: string }
    | { kind: "process"; process: ProcessRuleId };
}

export interface EvalContext {
  messages: StructuredMessage[];
  scenarioId: string;
  mode: ExecutionMode;
}

export interface AssertionOutcome {
  status: AssertionStatus;
  actual: string;
  correlationId?: string;
  attempts: StructuredMessage[];
}

export const ASSERTIONS: AssertionDefinition[] = [
  // Scene 1
  { id: "A-1-1", platform: "os", checkpointId: "CP-1-1", title: "Test run initialized", expected: "RUN-001 initialized before any exchange", severity: "required", sceneIndex: 1, rule: { kind: "process", process: "run-initialized" } },
  { id: "A-1-2", platform: "os", checkpointId: "CP-1-2", title: "All configured platform connectors identified", expected: "Ten platforms registered; live strip shows Not Configured", severity: "required", sceneIndex: 1, rule: { kind: "process", process: "connectors-identified" } },
  { id: "A-1-3", platform: "logic", checkpointId: "CP-1-3", title: "Correlation ID created", expected: "Every exchange carries a correlationId", severity: "required", sceneIndex: 1, rule: { kind: "process", process: "correlation-created" } },
  { id: "A-1-4", platform: "monitor", checkpointId: "CP-1-4", title: "Initial status: NOT TESTED", expected: "Rows show not-tested until their assertion-result fires", severity: "required", sceneIndex: 1, rule: { kind: "process", process: "initial-not-tested" } },
  // Scene 2
  { id: "A-2-1", platform: "iam", checkpointId: "CP-2-1", title: "Valid identity accepted", expected: "authenticate-identity succeeds", severity: "required", sceneIndex: 2, rule: { kind: "message", expectation: "succeeded", correlationId: "s2-identity-check" } },
  { id: "A-2-2", platform: "iam", checkpointId: "CP-2-2", title: "Permission check verified", expected: "authorize-operation (permitted read) succeeds", severity: "required", sceneIndex: 2, rule: { kind: "message", expectation: "succeeded", correlationId: "s2-authorize-read" } },
  { id: "A-2-3", platform: "iam", checkpointId: "CP-2-3", title: "Unauthorized request rejected", expected: "Restricted operation is denied", severity: "required", sceneIndex: 2, rule: { kind: "message", expectation: "failed-by-design", correlationId: "s2-authorize-restricted" } },
  { id: "A-2-4", platform: "data-gateway", checkpointId: "CP-2-4", title: "No unintended data modification", expected: "No write operation executes in scene 2", severity: "required", sceneIndex: 2, rule: { kind: "process", process: "no-unintended-writes" } },
  { id: "A-2-5", platform: "iam", checkpointId: "CP-2-5", title: "Tokens and secrets never displayed", expected: "No credential material in any summary", severity: "required", sceneIndex: 2, rule: { kind: "process", process: "no-secrets-displayed" } },
  // Scene 3
  { id: "A-3-1", platform: "data-gateway", checkpointId: "CP-3-1", title: "Query response validated", expected: "query-project-record succeeds", severity: "required", sceneIndex: 3, rule: { kind: "message", expectation: "succeeded", correlationId: "s3-query-record" } },
  { id: "A-3-2", platform: "data-gateway", checkpointId: "CP-3-2", title: "Correct environment verified", expected: "Response states environment matches the expected test environment", severity: "required", sceneIndex: 3, rule: { kind: "process", process: "env-match" } },
  { id: "A-3-3", platform: "logic", checkpointId: "CP-3-3", title: "Create/read-back assertion passed", expected: "Both create and read-back succeed", severity: "required", sceneIndex: 3, rule: { kind: "message", expectation: "succeeded", correlationId: "s3-read-back" } },
  { id: "A-3-4", platform: "monitor", checkpointId: "CP-3-4", title: "Response duration recorded", expected: "Narrative durations captured on data messages", severity: "required", sceneIndex: 3, rule: { kind: "process", process: "durations-captured" } },
  { id: "A-3-5", platform: "data-gateway", checkpointId: "CP-3-5", title: "Test data isolated from production records", expected: "Only test-environment records touched", severity: "required", sceneIndex: 3, rule: { kind: "process", process: "test-data-isolated" } },
  // Scene 4
  { id: "A-4-1", platform: "logic", checkpointId: "CP-4-1", title: "Workflow follows dependency order", expected: "Steps execute in authored dependency order", severity: "required", sceneIndex: 4, rule: { kind: "process", process: "dependency-order" } },
  { id: "A-4-2", platform: "logic", checkpointId: "CP-4-2", title: "Invalid prerequisites block dependent operations", expected: "Dependents of a failed prerequisite report blocked, not failed", severity: "required", sceneIndex: 4, rule: { kind: "process", process: "dependents-blocked" } },
  { id: "A-4-3", platform: "logic", checkpointId: "CP-4-3", title: "Retry behavior is bounded", expected: "Attempts never exceed the operation retry policy", severity: "required", sceneIndex: 4, rule: { kind: "process", process: "retry-bounded" } },
  { id: "A-4-4", platform: "utilities", checkpointId: "CP-4-4", title: "Duplicate side effects prevented where supported", expected: "Side-effect operations carry an idempotency key", severity: "required", sceneIndex: 4, rule: { kind: "process", process: "idempotency-keys" } },
  { id: "A-4-5", platform: "logic", checkpointId: "CP-4-5", title: "Every step records a final state", expected: "Each exchange resolves to a terminal status", severity: "required", sceneIndex: 4, rule: { kind: "process", process: "every-step-final" } },
  // Scene 5
  { id: "A-5-1", platform: "release", checkpointId: "CP-5-1", title: "Correct target environment", expected: "Deployment targets the designated test environment", severity: "required", sceneIndex: 5, rule: { kind: "process", process: "target-is-test-env" } },
  { id: "A-5-2", platform: "iam", checkpointId: "CP-5-2", title: "Deployment permissions validated", expected: "authorize-deployment-identity succeeds", severity: "required", sceneIndex: 5, rule: { kind: "message", expectation: "succeeded", correlationId: "s5-deploy-authz" } },
  { id: "A-5-3", platform: "release", checkpointId: "CP-5-3", title: "Actual release-job result captured", expected: "start-deployment-job returns a real (simulated) result", severity: "required", sceneIndex: 5, rule: { kind: "message", expectation: "succeeded", correlationId: "s5-deploy-job" } },
  { id: "A-5-4", platform: "release", checkpointId: "CP-5-4", title: "Build success and readiness checked separately", expected: "Deployment job and readiness are distinct correlations", severity: "required", sceneIndex: 5, rule: { kind: "process", process: "separate-checks" } },
  { id: "A-5-5", platform: "release", checkpointId: "CP-5-5", title: "No unintended production deployment", expected: "No operation targets production", severity: "required", sceneIndex: 5, rule: { kind: "process", process: "no-production-deploy" } },
  // Scene 6
  { id: "A-6-1", platform: "monitor", checkpointId: "CP-6-1", title: "Health-check failure detected", expected: "First readiness attempt records the failure", severity: "required", sceneIndex: 6, rule: { kind: "message", expectation: "first-attempt-failure", correlationId: "s6-readiness" } },
  { id: "A-6-2", platform: "monitor", checkpointId: "CP-6-2", title: "Evidence correlated with the test run", expected: "Failure evidence carries RUN-001 correlation", severity: "required", sceneIndex: 6, rule: { kind: "process", process: "correlation-with-run" } },
  { id: "A-6-3", platform: "ai-agent", checkpointId: "CP-6-3", title: "Root cause not invented", expected: "Cause classified as undetermined without supporting evidence", severity: "required", sceneIndex: 6, rule: { kind: "process", process: "cause-undetermined" } },
  { id: "A-6-4", platform: "release", checkpointId: "CP-6-4", title: "Retry count and recovery recorded", expected: "Chain shows failure then success with both attempts", severity: "required", sceneIndex: 6, rule: { kind: "message", expectation: "recovered-after-retry", correlationId: "s6-readiness" } },
  { id: "A-6-5", platform: "monitor", checkpointId: "CP-6-5", title: "Initial failure preserved", expected: "First failed attempt remains in the report", severity: "required", sceneIndex: 6, rule: { kind: "process", process: "first-failure-preserved" } },
  // Scene 7
  { id: "A-7-1", platform: "storage", checkpointId: "CP-7-1", title: "Upload and retrieval verified", expected: "Evidence chain completes successfully", severity: "required", sceneIndex: 7, rule: { kind: "message", expectation: "succeeded", correlationId: "s7-evidence-metadata" } },
  { id: "A-7-2", platform: "storage", checkpointId: "CP-7-2", title: "File content or checksum compared", expected: "Artifact compared, not just referenced", severity: "required", sceneIndex: 7, rule: { kind: "process", process: "checksum-compared" } },
  { id: "A-7-3", platform: "data-gateway", checkpointId: "CP-7-3", title: "Evidence metadata associated with the test run", expected: "Metadata carries RUN-001", severity: "required", sceneIndex: 7, rule: { kind: "process", process: "metadata-has-run-id" } },
  { id: "A-7-4", platform: "utilities", checkpointId: "CP-7-4", title: "Notification sent only to the configured recipient", expected: "send-test-notification succeeds for the test recipient", severity: "required", sceneIndex: 7, rule: { kind: "message", expectation: "succeeded", correlationId: "s7-notification" } },
  { id: "A-7-5", platform: "utilities", checkpointId: "CP-7-5", title: "API acceptance distinguished from confirmed delivery", expected: "Only provider-supported confirmation is reported", severity: "advisory", sceneIndex: 7, rule: { kind: "message", expectation: "succeeded", correlationId: "s7-notification" } },
  // Scene 8
  { id: "A-8-1", platform: "localization", checkpointId: "CP-8-1", title: "Required translation keys loaded", expected: "load-translation-resources succeeds", severity: "required", sceneIndex: 8, rule: { kind: "message", expectation: "succeeded", correlationId: "s8-load-resources" } },
  { id: "A-8-2", platform: "localization", checkpointId: "CP-8-2", title: "Missing-key behavior validated", expected: "Deliberately missing key is detected (denial is the pass)", severity: "required", sceneIndex: 8, rule: { kind: "message", expectation: "failed-by-design", correlationId: "s8-missing-key" } },
  { id: "A-8-3", platform: "data-gateway", checkpointId: "CP-8-3", title: "Platform-specific configuration paths respected", expected: "No assumption of a shared config store", severity: "required", sceneIndex: 8, rule: { kind: "process", process: "config-paths-respected" } },
  { id: "A-8-4", platform: "ai-agent", checkpointId: "CP-8-4", title: "AI summary matches actual evidence", expected: "Summary counts equal collected results", severity: "required", sceneIndex: 8, rule: { kind: "process", process: "summary-matches-evidence" } },
  { id: "A-8-5", platform: "ai-agent", checkpointId: "CP-8-5", title: "No unauthorized actions performed by the agent", expected: "Agent only analyzes and recommends", severity: "required", sceneIndex: 8, rule: { kind: "process", process: "agent-not-privileged" } },
  // Scene 9
  { id: "A-9-1", platform: "logic", checkpointId: "CP-9-1", title: "Timeout handled within the configured limit", expected: "First probe attempt records timed-out at the configured timeout", severity: "required", sceneIndex: 9, rule: { kind: "message", expectation: "first-attempt-failure", correlationId: "s9-timeout-probe" } },
  { id: "A-9-2", platform: "logic", checkpointId: "CP-9-2", title: "Retry policy respected", expected: "Retry follows the configured policy and succeeds", severity: "required", sceneIndex: 9, rule: { kind: "message", expectation: "recovered-after-retry", correlationId: "s9-timeout-probe" } },
  { id: "A-9-3", platform: "monitor", checkpointId: "CP-9-3", title: "Failure and recovery both recorded", expected: "Both attempts retained in the trace", severity: "required", sceneIndex: 9, rule: { kind: "message", expectation: "recovered-after-retry", correlationId: "s9-timeout-probe" } },
  { id: "A-9-4", platform: "ai-agent", checkpointId: "CP-9-4", title: "Duplicate side effects checked", expected: "Retry reuses the correlation's idempotency key", severity: "required", sceneIndex: 9, rule: { kind: "process", process: "idempotency-keys" } },
  { id: "A-9-5", platform: "logic", checkpointId: "CP-9-5", title: "Test isolation verified", expected: "Failure injection confined to the isolated connector", severity: "required", sceneIndex: 9, rule: { kind: "process", process: "test-data-isolated" } },
  // Scene 10
  { id: "A-10-1", platform: "os", checkpointId: "CP-10-1", title: "Final results collected from all configured connectors", expected: "Every platform contributed at least one result or caveat", severity: "required", sceneIndex: 10, rule: { kind: "process", process: "results-collected" } },
  { id: "A-10-2", platform: "monitor", checkpointId: "CP-10-2", title: "Failures and warnings retained", expected: "No failure or warning is dropped from the report", severity: "required", sceneIndex: 10, rule: { kind: "process", process: "warnings-retained" } },
  { id: "A-10-3", platform: "os", checkpointId: "CP-10-3", title: "Unconfigured services not marked as passed", expected: "not-configured never maps to passed", severity: "required", sceneIndex: 10, rule: { kind: "process", process: "not-configured-excluded" } },
  { id: "A-10-4", platform: "ai-agent", checkpointId: "CP-10-4", title: "Overall status calculated from explicit test assertions", expected: "Verdict derived only from assertion outcomes", severity: "required", sceneIndex: 10, rule: { kind: "process", process: "verdict-from-assertions" } },
  { id: "A-10-5", platform: "storage", checkpointId: "CP-10-5", title: "Final report exported with evidence and execution history", expected: "Report is exportable with message history", severity: "required", sceneIndex: 10, rule: { kind: "process", process: "export-available" } }
];

export function assertionById(id: string): AssertionDefinition | undefined {
  return ASSERTIONS.find((a) => a.id === id);
}
