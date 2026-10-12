// Scene 5 — Release Launches a Deployment (Release + OS + IAM, 03:55–04:50).
// Dialogue verbatim.

import type { SceneDefinition } from "../../engine/types";

export const scene05: SceneDefinition = {
  index: 5,
  title: "Release Launches a Deployment",
  environment: "Deployment Control Room",
  cast: ["release", "os", "iam", "monitor", "ai-agent", "logic"],
  targetDurationMs: 55000,
  beats: [
    {
      type: "dialogue",
      speaker: "release",
      text: "I’ve received the deployment verification request. Before starting, I’ll confirm that the target environment and deployment configuration are valid."
    },
    {
      type: "dialogue",
      speaker: "os",
      text: "The target is our designated test environment. Do not deploy to Production as part of this test."
    },
    {
      type: "dialogue",
      speaker: "iam",
      text: "The deployment operation must use an authorized identity with only the permissions it needs."
    },
    { type: "exchange", from: "release", to: "iam", operation: "authorize-deployment-identity", correlationId: "s5-deploy-authz", requestSummary: "Authorize a least-privilege deployment identity" },
    {
      type: "dialogue",
      speaker: "release",
      text: "Authorization and configuration checks are complete. I’m starting the test deployment through the configured release process.",
      watch: {
        correlationId: "s5-deploy-authz",
        variants: {
          succeeded: "The deployment identity is authorized live — {{data.roles}} role(s) granted. Starting the test deployment.",
          failed: "The deployment identity was not authorized ({{error}}) — I will not start the deployment job."
        },
        fallback: "The authorization step never ran — its prerequisite failed, so the deployment stays blocked rather than half-started."
      }
    },
    { type: "exchange", from: "logic", to: "release", operation: "start-deployment-job", correlationId: "s5-deploy-job", requestSummary: "Start the test-environment deployment job" },
    { type: "processing", platform: "release", weight: 2, label: "Deployment job executing" },
    {
      type: "dialogue",
      speaker: "monitor",
      text: "I’ll observe the available deployment events and health signals. I’ll distinguish between deployment completion and application readiness."
    },
    { type: "exchange", from: "monitor", to: "release", operation: "observe-deployment-events", correlationId: "s5-deploy-events", requestSummary: "Subscribe to deployment events and health signals" },
    {
      type: "dialogue",
      speaker: "release",
      text: "The deployment job has returned a result. I’ll now verify the actual job status and any available deployment metadata.",
      watch: {
        correlationId: "s5-deploy-job",
        variants: {
          succeeded: "The deployment job returned a result in {{duration}} — I’ll verify the actual job status next.",
          failed: "The deployment job came back {{status}} ({{error}}) — I record the actual result, not the intended one."
        },
        fallback: "The deployment job never ran — its prerequisite failed, so there is no job result to report."
      }
    },
    { type: "note", text: "Release starts a deployment job; a progress indicator advances; Monitor receives deployment events; the application readiness check begins." },
    {
      type: "dialogue",
      speaker: "ai-agent",
      text: "A successful build does not automatically prove that the application is usable. We also need to check whether the deployed application can load and perform its required functions."
    },
    {
      type: "dialogue",
      speaker: "release",
      text: "Agreed. I’ll report the deployment result, while the end-to-end test verifies application behavior."
    },
    {
      type: "dialogue",
      speaker: "os",
      text: "Good. Keep build status, deployment status and application health as separate checks."
    }
  ],
  checkpoints: [
    { id: "CP-5-1", text: "Correct target environment.", sceneIndex: 5 },
    { id: "CP-5-2", text: "Deployment permissions validated.", sceneIndex: 5 },
    { id: "CP-5-3", text: "Actual release-job result captured.", sceneIndex: 5 },
    { id: "CP-5-4", text: "Build success and application readiness checked separately.", sceneIndex: 5 },
    { id: "CP-5-5", text: "No unintended production deployment.", sceneIndex: 5 }
  ]
};
