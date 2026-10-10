// Scene 7 — Storage, Evidence and Notifications
// (Storage + Utilities + Data Gateway, 05:50–06:45). Dialogue verbatim.

import type { SceneDefinition } from "../../engine/types";

export const scene07: SceneDefinition = {
  index: 7,
  title: "Storage, Evidence and Notifications",
  environment: "Evidence and Notification Center",
  cast: ["storage", "data-gateway", "ai-agent", "utilities", "os", "monitor"],
  targetDurationMs: 55000,
  beats: [
    {
      type: "dialogue",
      speaker: "storage",
      text: "I’ve received the evidence request. I’ll validate the file metadata, store the test artifact through the configured storage service, and verify that it can be retrieved."
    },
    { type: "processing", platform: "storage", weight: 2, label: "Validating file metadata and uploading the test artifact" },
    { type: "exchange", from: "storage", to: "data-gateway", operation: "store-evidence-metadata", correlationId: "s7-evidence-metadata", requestSummary: "Store test-run ID, artifact reference and creation time" },
    {
      type: "dialogue",
      speaker: "data-gateway",
      text: "I can store the associated evidence metadata, including the test-run ID, artifact reference and creation time, if the configured schema and permissions allow it."
    },
    {
      type: "dialogue",
      speaker: "storage",
      text: "The upload operation returned a successful result. I’ll now retrieve the artifact and compare it with the expected test file."
    },
    { type: "processing", platform: "storage", label: "Retrieving the artifact and comparing with the expected file" },
    {
      type: "dialogue",
      speaker: "ai-agent",
      text: "We should verify the actual retrieved content or checksum, not just the presence of a file reference."
    },
    {
      type: "dialogue",
      speaker: "storage",
      text: "The comparison passed in this simulation. The evidence reference is ready for the report."
    },
    { type: "note", text: "A test artifact moves into Storage; its metadata appears in Data Gateway; a notification travels to a test inbox." },
    {
      type: "dialogue",
      speaker: "utilities",
      text: "I’ve received a notification request containing the test summary. Before sending it, I’ll validate the recipient configuration and the message payload."
    },
    {
      type: "dialogue",
      speaker: "os",
      text: "Send the notification only to the designated test recipient."
    },
    { type: "exchange", from: "os", to: "utilities", operation: "send-test-notification", correlationId: "s7-notification", requestSummary: "Send the test summary to the designated test recipient" },
    {
      type: "dialogue",
      speaker: "utilities",
      text: "The configured notification operation returned a successful result. I’ll record the provider response and delivery status available to us."
    },
    {
      type: "dialogue",
      speaker: "monitor",
      text: "Remember, a successful API response may mean accepted or queued, not necessarily delivered to the recipient."
    },
    {
      type: "dialogue",
      speaker: "utilities",
      text: "Correct. I’ll report only the delivery confirmation supported by the notification service."
    },
    {
      type: "dialogue",
      speaker: "os",
      text: "Excellent. Evidence must be retrievable, and notifications must have a traceable outcome."
    }
  ],
  checkpoints: [
    { id: "CP-7-1", text: "Upload and retrieval verified.", sceneIndex: 7 },
    { id: "CP-7-2", text: "File content or checksum compared.", sceneIndex: 7 },
    { id: "CP-7-3", text: "Evidence metadata associated with the test run.", sceneIndex: 7 },
    { id: "CP-7-4", text: "Test notification sent only to the configured recipient.", sceneIndex: 7 },
    { id: "CP-7-5", text: "API acceptance distinguished from confirmed delivery.", sceneIndex: 7 }
  ]
};
