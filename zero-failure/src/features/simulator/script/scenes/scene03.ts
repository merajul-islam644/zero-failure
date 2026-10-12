// Scene 3 — Data Gateway and Logic Exchange Information
// (Data Gateway + Logic, 01:55–02:55). Dialogue verbatim.

import type { SceneDefinition } from "../../engine/types";

export const scene03: SceneDefinition = {
  index: 3,
  title: "Data Gateway and Logic Exchange Information",
  environment: "Data Exchange Hub",
  cast: ["logic", "data-gateway", "ai-agent", "monitor", "os"],
  targetDurationMs: 60000,
  beats: [
    {
      type: "dialogue",
      speaker: "logic",
      text: "Data Gateway, I need a test project record before I can start the verification workflow. Can you retrieve it using the authorized connection?"
    },
    {
      type: "dialogue",
      speaker: "data-gateway",
      text: "I’ll execute the documented query and return only the fields the caller is allowed to access."
    },
    { type: "exchange", from: "logic", to: "data-gateway", operation: "query-project-record", correlationId: "s3-query-record", requestSummary: "Fetch project, environment and test-configuration fields" },
    {
      type: "dialogue",
      speaker: "logic",
      text: "Please include the project identifier, environment identifier and current test configuration. I need those values to select the correct workflow."
    },
    {
      type: "dialogue",
      speaker: "data-gateway",
      text: "The query completed. The response contains the requested fields, and the returned project matches the expected test environment.",
      watch: {
        correlationId: "s3-query-record",
        variants: {
          succeeded: "The query completed in {{duration}} — the permitted fields came back, {{data.schemas}} schema value(s) in the response.",
          failed: "The live query failed ({{error}}) — no project fields came back, so the workflow's data premise is unverified.",
          "not-configured": "The live query is not available ({{error}}) — I cannot confirm the project record in this run."
        }
      }
    },
    {
      type: "dialogue",
      speaker: "ai-agent",
      text: "Let’s verify the data rather than checking only the HTTP status. A successful request could still return the wrong project or an incomplete response."
    },
    {
      type: "dialogue",
      speaker: "data-gateway",
      text: "Agreed. The assertion should compare the returned identifier against the expected test identifier."
    },
    { type: "processing", platform: "logic", label: "Comparing returned identifier against the expected test identifier" },
    {
      type: "dialogue",
      speaker: "logic",
      text: "The assertion passed. Next, I’ll create a uniquely identified test record and read it back to confirm persistence."
    },
    { type: "exchange", from: "logic", to: "data-gateway", operation: "create-test-record", correlationId: "s3-create-record", requestSummary: "Create a uniquely identified test record" },
    { type: "exchange", from: "logic", to: "data-gateway", operation: "read-test-record", correlationId: "s3-read-back", requestSummary: "Read the record back and compare stored fields" },
    {
      type: "dialogue",
      speaker: "data-gateway",
      text: "The record was created. I’ve retrieved it again, and its stored fields match the submitted values.",
      watch: {
        correlationId: "s3-read-back",
        variants: {
          succeeded: "The record was created and read back — {{data.fields}} field(s) match the submitted values.",
          failed: "The create/read-back check failed ({{error}}) — persistence is not proven in this run.",
          "not-configured": "The persistence check is not configured ({{error}}) — no create/read-back ran."
        },
        onError: {
          LIVE_READ_ONLY: "Nothing was created or read back — live refused the write ({{error}}); the persistence claim does not hold here."
        }
      }
    },
    { type: "note", text: "JSON-style data cards travel between Logic and Data Gateway; a record is created, read back and compared." },
    {
      type: "dialogue",
      speaker: "monitor",
      text: "I’ll capture the request duration and any available error details. If this operation becomes slow or starts failing repeatedly, we’ll need that evidence."
    },
    { type: "processing", platform: "monitor", label: "Recording request durations and error details" },
    {
      type: "dialogue",
      speaker: "os",
      text: "Excellent. We have verified the communication, the response content and the persistence of the data—not merely the existence of an endpoint."
    }
  ],
  checkpoints: [
    { id: "CP-3-1", text: "Query response validated.", sceneIndex: 3 },
    { id: "CP-3-2", text: "Correct environment verified.", sceneIndex: 3 },
    { id: "CP-3-3", text: "Create/read-back assertion passed.", sceneIndex: 3 },
    { id: "CP-3-4", text: "Response duration recorded.", sceneIndex: 3 },
    { id: "CP-3-5", text: "Test data isolated from production records.", sceneIndex: 3 }
  ]
};
