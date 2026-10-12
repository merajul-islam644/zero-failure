// Scene 9 — The Unexpected Communication Failure (All Platforms, 07:35–08:35).
// Dialogue verbatim. Default storyline: attempt 1 times out, attempt 2 of the
// same correlation recovers — the trace keeps both attempts.

import type { SceneDefinition } from "../../engine/types";
import { PLATFORMS } from "../cast";

export const scene09: SceneDefinition = {
  index: 9,
  title: "The Unexpected Communication Failure",
  environment: "Network Diagnostics Center",
  cast: [...PLATFORMS],
  targetDurationMs: 60000,
  beats: [
    {
      type: "dialogue",
      speaker: "os",
      text: "Before we finish, I want one final challenge. We need to know whether the system behaves correctly when one of its dependencies becomes temporarily unavailable."
    },
    {
      type: "dialogue",
      speaker: "logic",
      text: "I’ll use an isolated test connector to simulate a timeout. No production service will be disrupted."
    },
    { type: "note", text: "An isolated network link turns red; a timeout timer starts." },
    { type: "exchange", from: "logic", to: "data-gateway", operation: "isolated-timeout-probe", correlationId: "s9-timeout-probe", attempt: 1, requestSummary: "Probe the isolated connector; response delayed beyond the timeout", outcomeRef: "s9-timeout-attempt" },
    {
      type: "dialogue",
      speaker: "data-gateway",
      text: "My simulated response will be delayed beyond the configured timeout. The test controller should record the timeout rather than wait indefinitely."
    },
    {
      type: "dialogue",
      speaker: "logic",
      text: "The request timed out. I’ve recorded the failed attempt and will follow the configured retry policy.",
      watch: {
        correlationId: "s9-timeout-probe",
        attempt: 1,
        variants: {
          "timed-out": "The probe timed out after {{duration}} ({{error}}). I’ve recorded the failed attempt and will follow the retry policy.",
          succeeded: "The first probe actually came back clean in {{duration}} — there is no timeout to record, so I will not stage one.",
          failed: "The first probe failed outright ({{error}}) — recorded as-is, and the retry policy follows."
        }
      }
    },
    { type: "note", text: "The timeout timer expires; a retry starts." },
    {
      type: "dialogue",
      speaker: "monitor",
      text: "I’ve received the timeout event. I’ll check whether the error is visible in the available monitoring data and whether its correlation ID matches the original request."
    },
    { type: "processing", platform: "monitor", label: "Matching timeout event correlation ID against RUN-001" },
    {
      type: "dialogue",
      speaker: "ai-agent",
      text: "The first request failed, but we must not create duplicate records or notifications when the workflow retries. Does this operation support an idempotency key?"
    },
    {
      type: "dialogue",
      speaker: "logic",
      text: "The test will verify that behavior where the integration supports idempotency. If it doesn’t, we’ll report that limitation instead of assuming duplicates are impossible."
    },
    { type: "exchange", from: "logic", to: "data-gateway", operation: "isolated-timeout-probe", correlationId: "s9-timeout-probe", attempt: 2, requestSummary: "Retry the probe with the same idempotency key", outcomeRef: "s9-recovery-attempt" },
    { type: "note", text: "The link recovers; the trace retains both attempts." },
    {
      type: "dialogue",
      speaker: "data-gateway",
      text: "The dependency is available again. The retry returned a successful response in this simulated scenario.",
      watch: {
        correlationId: "s9-timeout-probe",
        variants: {
          recovered: "The dependency is available again — attempt 1 timed out ({{firstError}}), attempt {{attempt}} returned a real response in {{duration}}.",
          succeeded: "Both probe attempts came back clean — the dependency never went down in this run.",
          failed: "The retry did not recover — the probe still reports {{error}}. Both attempts stay in the trace."
        }
      }
    },
    {
      type: "dialogue",
      speaker: "monitor",
      text: "I can confirm that the test observed the timeout and subsequent recovery. I’ll preserve both attempts in the trace.",
      watch: {
        correlationId: "s9-timeout-probe",
        variants: {
          recovered: "Confirmed: the trace shows the timeout and the recovery — both attempts preserved, {{firstError}} then success.",
          succeeded: "The trace shows no timeout — both attempts succeeded, so there is no recovery to confirm.",
          failed: "Confirmed: the probe is still failing ({{error}}) — the trace preserves both attempts and no recovery."
        }
      }
    },
    {
      type: "dialogue",
      speaker: "os",
      text: "Excellent. A resilient system does not hide errors. It detects them, handles them within defined limits and records what happened."
    }
  ],
  checkpoints: [
    { id: "CP-9-1", text: "Timeout handled within the configured limit.", sceneIndex: 9 },
    { id: "CP-9-2", text: "Retry policy respected.", sceneIndex: 9 },
    { id: "CP-9-3", text: "Failure and recovery both recorded.", sceneIndex: 9 },
    { id: "CP-9-4", text: "Duplicate side effects checked.", sceneIndex: 9 },
    { id: "CP-9-5", text: "Test isolation verified.", sceneIndex: 9 }
  ]
};
