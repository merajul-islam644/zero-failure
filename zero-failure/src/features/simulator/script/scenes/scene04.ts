// Scene 4 — Logic Orchestrates the Entire Workflow
// (Logic + All Platform Connectors, 02:55–03:55). Dialogue verbatim.

import type { SceneDefinition } from "../../engine/types";

export const scene04: SceneDefinition = {
  index: 4,
  title: "Logic Orchestrates the Entire Workflow",
  environment: "Workflow Control Room",
  cast: ["logic", "release", "storage", "utilities", "ai-agent", "monitor", "os"],
  targetDurationMs: 60000,
  beats: [
    {
      type: "dialogue",
      speaker: "logic",
      text: "We now have a verified identity and a valid test project. I’ll coordinate the remaining tasks in dependency order."
    },
    {
      type: "dialogue",
      speaker: "release",
      text: "I need a valid deployment configuration before starting the deployment check."
    },
    { type: "exchange", from: "logic", to: "release", operation: "get-deployment-config", correlationId: "s4-deploy-config", requestSummary: "Fetch the validated deployment configuration" },
    {
      type: "dialogue",
      speaker: "logic",
      text: "I’ll request the required configuration through the approved integration. I’ll proceed only when the response passes validation."
    },
    {
      type: "dialogue",
      speaker: "storage",
      text: "I’m ready to receive test evidence, but I need the run identifier and the expected evidence metadata."
    },
    { type: "exchange", from: "logic", to: "storage", operation: "register-evidence-metadata", correlationId: "s4-evidence-meta", requestSummary: "Provide run identifier and expected evidence metadata" },
    {
      type: "dialogue",
      speaker: "logic",
      text: "I’ll provide the run identifier and pass the required metadata through the configured connector."
    },
    {
      type: "dialogue",
      speaker: "utilities",
      text: "I’ll wait for a verified test event before sending the notification. I don’t want to send duplicate alerts when a workflow retries."
    },
    { type: "exchange", from: "logic", to: "utilities", operation: "verify-idempotency-support", correlationId: "s4-idempotency", requestSummary: "Check idempotency-key support for notification operations" },
    {
      type: "dialogue",
      speaker: "logic",
      text: "That’s important. I’ll track each operation’s state and use an idempotency key where the integration supports it."
    },
    {
      type: "dialogue",
      speaker: "ai-agent",
      text: "What happens if the deployment fails? Will the entire workflow stop?"
    },
    {
      type: "dialogue",
      speaker: "logic",
      text: "Not every failure requires a complete stop. A missing prerequisite must block dependent tasks. An independent diagnostic task may continue if it is safe. The final result will still show the failure."
    },
    {
      type: "dialogue",
      speaker: "monitor",
      text: "And a retry must not hide the original error."
    },
    {
      type: "dialogue",
      speaker: "logic",
      text: "Correct. We’ll preserve the original failure, the retry attempt and the final outcome."
    },
    { type: "note", text: "The workflow graph expands into dependency branches; completed steps turn green, a blocked step turns amber, and the event log records every transition." },
    {
      type: "dialogue",
      speaker: "os",
      text: "Proceed. Every branch must end in a recorded result, including skipped and blocked tasks."
    }
  ],
  checkpoints: [
    { id: "CP-4-1", text: "Workflow follows dependency order.", sceneIndex: 4 },
    { id: "CP-4-2", text: "Invalid prerequisites block dependent operations.", sceneIndex: 4 },
    { id: "CP-4-3", text: "Retry behavior is bounded.", sceneIndex: 4 },
    { id: "CP-4-4", text: "Duplicate side effects are prevented where supported.", sceneIndex: 4 },
    { id: "CP-4-5", text: "Every step records a final state.", sceneIndex: 4 }
  ]
};
