// Scenario registry: the default storyline (the script as written, including
// its scripted negatives and two failure-recovery chains) plus the 14
// selectable failure/recovery scenarios from the spec. Injections match
// before the deterministic simulated response; first match wins, most
// specific first.

import type { ScenarioDefinition, ScenarioInjection } from "../engine/types";

/**
 * Denials the script itself authors: the restricted-authorization negative
 * test (scene 2) and the deliberately missing translation key (scene 8).
 * These are part of "the script as written", so every scenario that does not
 * explicitly override them keeps them — a scenario never accidentally turns
 * a scripted negative test into a pass.
 */
export const SCRIPTED_NEGATIVES: ScenarioInjection[] = [
  {
    match: { correlationId: "s2-authorize-restricted" },
    outcome: "fail",
    errorCode: "ACCESS_DENIED",
    errorMessage: "Restricted operation denied by the configured access policy (scripted negative test)."
  },
  {
    match: { correlationId: "s8-missing-key" },
    outcome: "fail",
    errorCode: "MISSING_TRANSLATION_KEY",
    errorMessage: "Deliberately missing key detected (scripted negative test)."
  }
];

export const SCENARIO_DEFAULT: ScenarioDefinition = {
  id: "default-storyline",
  title: "Default storyline",
  description:
    "The script as written: every check passes except the two scripted negatives and the two scripted failure-recovery chains — the readiness check (scene 6) fails once then recovers, and the isolated timeout probe (scene 9) times out once then recovers.",
  injections: [
    ...SCRIPTED_NEGATIVES,
    { match: { correlationId: "s6-readiness", attempt: 1 }, outcome: "fail", errorCode: "READINESS_CHECK_FAILED", errorMessage: "Application readiness check returned an unsuccessful result (simulated)." },
    { match: { correlationId: "s9-timeout-probe", attempt: 1 }, outcome: "timeout", errorCode: "OPERATION_TIMEOUT", errorMessage: "Isolated connector delayed beyond the configured timeout (simulated)." },
    { match: { correlationId: "s6-readiness", attempt: 2 }, outcome: "succeed" },
    { match: { correlationId: "s9-timeout-probe", attempt: 2 }, outcome: "succeed" }
  ],
  expectedOutcome:
    "All required assertions pass; recovered chains report warnings with both attempts preserved."
};

export const SCENARIOS: ScenarioDefinition[] = [
  SCENARIO_DEFAULT,
  {
    id: "auth-succeeds",
    title: "1 — Authentication succeeds",
    description: "The happy authentication path: identity and permission checks pass.",
    injections: [...SCRIPTED_NEGATIVES],
    expectedOutcome: "Valid identity accepted and permission check verified; the restricted negative test is still denied by design. Recovery chains are not exercised (warnings)."
  },
  {
    id: "auth-fails",
    title: "2 — Authentication fails",
    description: "The test identity cannot be authenticated.",
    injections: [
      ...SCRIPTED_NEGATIVES,
      { match: { correlationId: "s2-identity-check" }, outcome: "fail", errorCode: "AUTHENTICATION_FAILED", errorMessage: "Test identity failed authentication (simulated)." }
    ],
    expectedOutcome: "Authentication assertion fails; the overall verdict is failed."
  },
  {
    id: "authz-denied",
    title: "3 — Authorization denies a restricted operation",
    description: "Even the permitted-read check is denied by policy.",
    injections: [
      ...SCRIPTED_NEGATIVES,
      { match: { operation: "authorize-operation", attempt: 1 }, outcome: "fail", errorCode: "ACCESS_DENIED", errorMessage: "Operation denied by the configured access policy (simulated)." }
    ],
    expectedOutcome: "Authorization denial recorded; no protected record modified. The permitted-read assertion fails; the negative test still passes as designed."
  },
  {
    id: "data-read-succeeds",
    title: "4 — Data read succeeds",
    description: "The permitted read returns the expected fields.",
    injections: [...SCRIPTED_NEGATIVES],
    expectedOutcome: "Query response validated and correct environment verified; recovery chains not exercised (warnings)."
  },
  {
    id: "data-write-fails",
    title: "5 — Data write fails",
    description: "Creating the uniquely identified test record fails; the read-back cannot verify persistence.",
    injections: [
      ...SCRIPTED_NEGATIVES,
      { match: { correlationId: "s3-create-record" }, outcome: "fail", errorCode: "WRITE_CONFLICT", errorMessage: "Record creation conflict (simulated)." },
      { match: { correlationId: "s3-read-back" }, outcome: "fail", errorCode: "RECORD_NOT_FOUND", errorMessage: "Read-back blocked: the record was never created (simulated)." }
    ],
    expectedOutcome: "The create/read-back assertion fails and the read-back records the blocked state."
  },
  {
    id: "dependency-unavailable",
    title: "6 — Workflow dependency is unavailable",
    description: "The deployment configuration prerequisite fails, so dependent workflow steps are blocked (never silently skipped).",
    injections: [
      ...SCRIPTED_NEGATIVES,
      { match: { correlationId: "s4-deploy-config" }, outcome: "fail", errorCode: "DEPENDENCY_UNAVAILABLE", errorMessage: "Deployment configuration prerequisite unavailable (simulated)." }
    ],
    expectedOutcome: "Dependent steps record not-tested (blocked) states; the overall verdict is incomplete until the prerequisite succeeds."
  },
  {
    id: "deploy-ok-readiness-fails",
    title: "7 — Deployment succeeds but readiness fails",
    description: "The deployment job completes, but the application readiness check fails on every attempt — no recovery.",
    injections: [
      ...SCRIPTED_NEGATIVES,
      { match: { correlationId: "s6-readiness", attempt: 1 }, outcome: "fail", errorCode: "READINESS_CHECK_FAILED", errorMessage: "Application readiness check returned an unsuccessful result (simulated)." },
      { match: { correlationId: "s6-readiness", attempt: 2 }, outcome: "fail", errorCode: "READINESS_CHECK_FAILED", errorMessage: "Readiness still failing after the recovery interval (simulated)." }
    ],
    expectedOutcome: "Deployment job result is captured separately; the readiness assertions fail with both attempts preserved."
  },
  {
    id: "monitor-detects-error",
    title: "8 — Monitoring detects an error",
    description: "The timeout fires and monitoring correlates it with the original request.",
    injections: [
      ...SCRIPTED_NEGATIVES,
      { match: { correlationId: "s9-timeout-probe", attempt: 1 }, outcome: "timeout", errorCode: "OPERATION_TIMEOUT", errorMessage: "Isolated connector delayed beyond the configured timeout (simulated)." },
      { match: { correlationId: "s9-timeout-probe", attempt: 2 }, outcome: "succeed" }
    ],
    expectedOutcome: "Timeout event visible in monitoring data with a matching correlation ID; recovery reported as a warning."
  },
  {
    id: "upload-ok-retrieval-fails",
    title: "9 — Upload succeeds but retrieval fails",
    description: "The evidence artifact uploads, but the metadata/retrieval chain cannot be verified.",
    injections: [
      ...SCRIPTED_NEGATIVES,
      { match: { correlationId: "s7-evidence-metadata" }, outcome: "fail", errorCode: "EVIDENCE_METADATA_WRITE_FAILED", errorMessage: "Evidence metadata write failed after artifact upload (simulated)." }
    ],
    expectedOutcome: "Upload result captured; retrieval verification cannot complete and reports the failure honestly."
  },
  {
    id: "notification-rejected",
    title: "10 — Notification request is rejected",
    description: "The provider rejects the test notification.",
    injections: [
      ...SCRIPTED_NEGATIVES,
      { match: { correlationId: "s7-notification" }, outcome: "fail", errorCode: "NOTIFICATION_REJECTED", errorMessage: "Notification provider rejected the request (simulated)." }
    ],
    expectedOutcome: "Rejection recorded with the provider error; acceptance-vs-delivery caveat noted."
  },
  {
    id: "translation-missing",
    title: "11 — A translation key is missing",
    description: "Language resources fail to load; the missing-key negative test still detects correctly.",
    injections: [
      ...SCRIPTED_NEGATIVES,
      { match: { correlationId: "s8-load-resources" }, outcome: "fail", errorCode: "RESOURCE_LOAD_FAILED", errorMessage: "Configured language resources could not be loaded (simulated)." }
    ],
    expectedOutcome: "Resource-load assertion fails; missing-key detection remains a positive detection."
  },
  {
    id: "timeout-recovers",
    title: "12 — Request times out and recovers after retry",
    description: "The scripted timeout probe: attempt 1 times out, the configured retry succeeds.",
    injections: [
      ...SCRIPTED_NEGATIVES,
      { match: { correlationId: "s9-timeout-probe", attempt: 1 }, outcome: "timeout", errorCode: "OPERATION_TIMEOUT", errorMessage: "Isolated connector delayed beyond the configured timeout (simulated)." },
      { match: { correlationId: "s9-timeout-probe", attempt: 2 }, outcome: "succeed" }
    ],
    expectedOutcome: "Timeout handled within the configured limit; retry succeeds; both attempts retained (warning)."
  },
  {
    id: "idempotency-repeat",
    title: "13 — Repeated request tests idempotency",
    description: "Side-effect operations carry an idempotency key; duplicates are suppressed where supported.",
    injections: [
      ...SCRIPTED_NEGATIVES,
      { match: { correlationId: "s9-timeout-probe", attempt: 1 }, outcome: "timeout", errorCode: "OPERATION_TIMEOUT", errorMessage: "Isolated connector delayed beyond the configured timeout (simulated)." },
      { match: { correlationId: "s9-timeout-probe", attempt: 2 }, outcome: "succeed" }
    ],
    expectedOutcome: "Duplicate side effects prevented where supported; the retry chain reuses the correlation's idempotency key."
  },
  {
    id: "not-configured",
    title: "14 — Integration is not configured",
    description: "Every connector reports Not Configured — the honest state of the live mode today.",
    injections: [{ match: {}, outcome: "not-configured" }],
    expectedOutcome: "Nothing is marked as passed; overall verdict is not-configured-only."
  }
];

export function scenarioById(id: string): ScenarioDefinition {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIO_DEFAULT;
}
