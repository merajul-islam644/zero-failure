// Scene 1 — The Mission Briefing. Dialogue transcribed verbatim from the
// approved script (OS, 00:00–00:55). Notes are the script's animation actions;
// checkpoints become assertion anchors in the test layer.

import type { SceneDefinition } from "../../engine/types";

export const scene01: SceneDefinition = {
  index: 1,
  title: "The Mission Briefing",
  environment: "Central Command Room",
  cast: ["os", "monitor", "ai-agent", "logic"],
  targetDurationMs: 55000,
  beats: [
    { type: "note", text: "Command center lights up; ten characters appear." },
    {
      type: "dialogue",
      speaker: "os",
      text: "Good morning, everyone. Today is not an ordinary system check. We are going to verify whether our platforms can communicate correctly, exchange information safely, recover from errors, and complete a full end-to-end workflow."
    },
    {
      type: "dialogue",
      speaker: "monitor",
      text: "Are we checking whether every service is online, or are we checking whether the services can actually perform their jobs?"
    },
    {
      type: "dialogue",
      speaker: "os",
      text: "Both. A service can respond to a health check and still fail its main function. We need to test availability, authentication, data operations, workflow execution, deployment, monitoring, storage, notifications and localization."
    },
    {
      type: "dialogue",
      speaker: "ai-agent",
      text: "I suggest we assign a unique test-run ID, record every request and response, and correlate all events. That will help us trace a failure across multiple platforms."
    },
    { type: "note", text: "A central test-run ID is generated: RUN-001." },
    {
      type: "dialogue",
      speaker: "os",
      text: "Agreed. Our test run is RUN-001. Every message must have a traceable result. No one may declare success without evidence."
    },
    {
      type: "dialogue",
      speaker: "logic",
      text: "I’ll organize the execution sequence. Each step will wait for its required dependency, capture the result, and decide whether the next step can continue."
    },
    { type: "note", text: "The command constellation forms — OS at the center, platforms settling into orbit." },
    {
      type: "dialogue",
      speaker: "os",
      text: "Excellent. Team, initialize the test environment. Operation Zero Failure begins now."
    }
  ],
  checkpoints: [
    { id: "CP-1-1", text: "Test run initialized.", sceneIndex: 1 },
    { id: "CP-1-2", text: "All configured platform connectors identified.", sceneIndex: 1 },
    { id: "CP-1-3", text: "Correlation ID created.", sceneIndex: 1 },
    { id: "CP-1-4", text: "Initial status: NOT TESTED.", sceneIndex: 1 }
  ]
};
