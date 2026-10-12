// Scene 6 — Monitor Investigates a Failure (Monitor + Release + AI Agent,
// 04:50–05:50). Dialogue verbatim. Default storyline: the readiness check
// fails on attempt 1 and recovers on attempt 2 of the same correlation —
// both attempts stay visible (recovered-after-retry → warning, never passed).

import type { SceneDefinition } from "../../engine/types";

export const scene06: SceneDefinition = {
  index: 6,
  title: "Monitor Investigates a Failure",
  environment: "Observability Lab",
  cast: ["monitor", "release", "ai-agent", "os"],
  targetDurationMs: 60000,
  beats: [
    {
      type: "dialogue",
      speaker: "monitor",
      text: "The application readiness check has returned an unsuccessful result in our simulated failure scenario. I’m checking the available logs, health signals and request traces."
    },
    { type: "exchange", from: "monitor", to: "release", operation: "run-readiness-check", correlationId: "s6-readiness", attempt: 1, requestSummary: "Run the application readiness check", outcomeRef: "s6-readiness-first" },
    { type: "note", text: "A simulated failure appears on the readiness check." },
    { type: "processing", platform: "monitor", weight: 2, label: "Opening logs, health signals and request traces" },
    {
      type: "dialogue",
      speaker: "release",
      text: "The deployment job itself completed successfully. Could the application still be failing after deployment?"
    },
    {
      type: "dialogue",
      speaker: "monitor",
      text: "Yes. A completed deployment and a healthy application are different conditions. I’ll correlate the failure with the deployment timestamp and the test-run ID.",
      watch: {
        correlationId: "s6-readiness",
        attempt: 1,
        variants: {
          failed: "The first readiness attempt failed ({{error}}) — I’ll correlate it with the deployment timestamp and the test-run ID.",
          "timed-out": "The first readiness attempt timed out after {{duration}} ({{error}}) — I’ll correlate the trace with the test-run ID.",
          succeeded: "The first readiness attempt actually passed in {{duration}} — there is no failure to correlate in this run."
        },
        fallback: "The readiness chain never ran — its prerequisite is not configured, so there is no attempt to correlate yet."
      }
    },
    { type: "processing", platform: "monitor", label: "Correlating failure with deployment timestamp and RUN-001" },
    {
      type: "dialogue",
      speaker: "ai-agent",
      text: "What evidence do we have so far? Let’s avoid guessing the root cause."
    },
    {
      type: "dialogue",
      speaker: "monitor",
      text: "The current evidence shows an unsuccessful health check. The available logs do not yet prove why it happened."
    },
    {
      type: "dialogue",
      speaker: "ai-agent",
      text: "Then I’ll classify the cause as undetermined, preserve the relevant evidence and suggest the next diagnostic checks. I won’t claim that a particular service caused the failure without supporting evidence."
    },
    { type: "processing", platform: "ai-agent", label: "Classifying cause as undetermined; preserving evidence" },
    {
      type: "dialogue",
      speaker: "release",
      text: "I can rerun the readiness check after the configured recovery interval. I won’t redeploy automatically unless the workflow explicitly permits it."
    },
    { type: "exchange", from: "monitor", to: "release", operation: "run-readiness-check", correlationId: "s6-readiness", attempt: 2, requestSummary: "Rerun the readiness check after the recovery interval", outcomeRef: "s6-readiness-retry" },
    {
      type: "dialogue",
      speaker: "monitor",
      text: "The second readiness check has now returned a successful result in this simulation. I’ll preserve both attempts so the first failure is not erased.",
      watch: {
        correlationId: "s6-readiness",
        variants: {
          recovered: "The retry came back healthy in {{duration}} — attempt 1 failed ({{firstError}}), attempt {{attempt}} succeeded. I keep both so the first failure is not erased.",
          succeeded: "The readiness check passed on the first attempt in {{duration}} — there was no failure to recover from in this run.",
          failed: "The retry did not recover — the readiness check still reports {{error}}. Both attempts stay in the trace."
        },
        fallback: "The readiness check never ran — its prerequisite is not configured live, so neither failure nor recovery applies here."
      }
    },
    { type: "note", text: "A retry succeeds while the original failure remains in the timeline." },
    {
      type: "dialogue",
      speaker: "os",
      text: "That’s the correct approach. Recovery is useful, but a recovered test must still report that an initial failure occurred."
    },
    {
      type: "dialogue",
      speaker: "ai-agent",
      text: "I’ll mark the readiness check as recovered after retry, retain the first failure as a warning, and include both results in the final report.",
      watch: {
        correlationId: "s6-readiness",
        variants: {
          recovered: "Marked recovered after retry — attempt 1 failed ({{firstError}}), attempt {{attempt}} succeeded; the warning stays in the report.",
          succeeded: "No recovery to mark — the check passed first try, so the report records a clean pass, not a warning."
        },
        fallback: "The readiness check never ran, so the report marks it not tested rather than recovered."
      }
    }
  ],
  checkpoints: [
    { id: "CP-6-1", text: "Health-check failure detected.", sceneIndex: 6 },
    { id: "CP-6-2", text: "Evidence correlated with the test run.", sceneIndex: 6 },
    { id: "CP-6-3", text: "Root cause not invented.", sceneIndex: 6 },
    { id: "CP-6-4", text: "Retry count and recovery recorded.", sceneIndex: 6 },
    { id: "CP-6-5", text: "Initial failure preserved.", sceneIndex: 6 }
  ]
};
