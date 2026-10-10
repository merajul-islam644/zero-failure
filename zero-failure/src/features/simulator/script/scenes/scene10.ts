// Scene 10 — The Final Verdict (All Characters, 08:35–09:30). Dialogue
// verbatim; the collective line uses the all-cast speaker.

import type { SceneDefinition } from "../../engine/types";
import { PLATFORMS } from "../cast";

export const scene10: SceneDefinition = {
  index: 10,
  title: "The Final Verdict",
  environment: "Central Command Room",
  cast: [...PLATFORMS],
  targetDurationMs: 55000,
  beats: [
    {
      type: "dialogue",
      speaker: "os",
      text: "Team, the execution sequence is complete. Each platform, report its actual test outcome."
    },
    {
      type: "dialogue",
      speaker: "iam",
      text: "Authentication and authorization checks are complete. I’ll report the results of both permitted and denied requests."
    },
    {
      type: "dialogue",
      speaker: "data-gateway",
      text: "The data assertions will show which reads, writes and persistence checks passed."
    },
    {
      type: "dialogue",
      speaker: "logic",
      text: "I’ll report the workflow steps, dependency failures, retries and final execution states."
    },
    {
      type: "dialogue",
      speaker: "release",
      text: "I’ll report the actual deployment-job result separately from application readiness."
    },
    {
      type: "dialogue",
      speaker: "monitor",
      text: "I’ll provide the available health signals, correlated errors and recovery evidence."
    },
    {
      type: "dialogue",
      speaker: "storage",
      text: "I’ll report whether the test artifacts were uploaded and retrieved successfully."
    },
    {
      type: "dialogue",
      speaker: "utilities",
      text: "I’ll report the notification operation and any delivery confirmation actually available."
    },
    {
      type: "dialogue",
      speaker: "localization",
      text: "I’ll report the translation-resource checks and missing-key results."
    },
    {
      type: "dialogue",
      speaker: "ai-agent",
      text: "I’ve consolidated the available evidence. I found one simulated timeout that recovered after retry. I’ll also list any unconfigured integration or missing evidence that prevents a conclusive result."
    },
    {
      type: "dialogue",
      speaker: "os",
      text: "Then our final verdict must be based on the assertions, not on how smoothly the animation played."
    },
    { type: "note", text: "All character panels converge into one dashboard: green passed, red failed, amber warning or recovered failure, grey not tested." },
    { type: "dialogue", speaker: "all-cast", text: "Operation Zero Failure — Verification complete!" },
    {
      type: "dialogue",
      speaker: "os",
      text: "Remember: our goal is not to pretend that nothing ever fails. Our goal is to detect failures, communicate them correctly, recover safely and provide reliable evidence."
    }
  ],
  checkpoints: [
    { id: "CP-10-1", text: "Final results collected from all configured connectors.", sceneIndex: 10 },
    { id: "CP-10-2", text: "Failures and warnings retained.", sceneIndex: 10 },
    { id: "CP-10-3", text: "Unconfigured services not marked as passed.", sceneIndex: 10 },
    { id: "CP-10-4", text: "Overall status calculated from explicit test assertions.", sceneIndex: 10 },
    { id: "CP-10-5", text: "Final report exported with evidence and execution history.", sceneIndex: 10 }
  ]
};
