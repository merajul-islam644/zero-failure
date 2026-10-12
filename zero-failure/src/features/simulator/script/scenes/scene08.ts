// Scene 8 — Localization and AI Work Together
// (Localization + AI Agent + Data Gateway, 06:45–07:35). Dialogue verbatim.

import type { SceneDefinition } from "../../engine/types";

export const scene08: SceneDefinition = {
  index: 8,
  title: "Localization and AI Work Together",
  environment: "Global Readiness Lab",
  cast: ["localization", "ai-agent", "data-gateway", "os"],
  targetDurationMs: 50000,
  beats: [
    {
      type: "dialogue",
      speaker: "localization",
      text: "The application supports multiple languages. I’ll verify that the required translation keys exist and that the configured language resources can be loaded."
    },
    { type: "exchange", from: "localization", to: "data-gateway", operation: "load-translation-resources", correlationId: "s8-load-resources", requestSummary: "Load configured language resources (English and Bengali)" },
    {
      type: "dialogue",
      speaker: "ai-agent",
      text: "Please check English and Bengali first. We should also verify that missing translations are detected instead of silently being treated as valid."
    },
    { type: "processing", platform: "localization", label: "Checking required keys in English and Bengali resources" },
    {
      type: "dialogue",
      speaker: "localization",
      text: "The required test keys are available in the simulated successful case. I’ll also run a negative test using a deliberately missing key.",
      watch: {
        correlationId: "s8-load-resources",
        variants: {
          succeeded: "The language resources loaded in {{duration}} — the required keys are available; next, the deliberately missing key.",
          failed: "The resource load failed ({{error}}) — I cannot confirm the required keys are available.",
          "not-configured": "The resource load is not available ({{error}}) — the key check proceeds without a confirmed baseline."
        }
      }
    },
    { type: "exchange", from: "ai-agent", to: "localization", operation: "check-missing-key", correlationId: "s8-missing-key", requestSummary: "Negative test: look up a deliberately missing translation key", outcomeRef: "s8-missing-detected" },
    { type: "note", text: "English and Bengali text bubbles appear; a missing translation turns amber; the AI builds a report from collected results." },
    {
      type: "dialogue",
      speaker: "data-gateway",
      text: "If the translation resources are stored or retrieved through a configured data service, I can verify the permitted data operation. Otherwise, Localization can use its own documented resource mechanism."
    },
    {
      type: "dialogue",
      speaker: "ai-agent",
      text: "Good distinction. We must not assume that every platform stores its configuration in the same database."
    },
    {
      type: "dialogue",
      speaker: "localization",
      text: "The missing-key test was detected correctly. The application can now report the missing resource instead of claiming that every translation is complete.",
      watch: {
        correlationId: "s8-missing-key",
        variants: {
          failed: "The missing key was detected, as designed — the dictionary lookup failed ({{error}}), which is the pass. The app can now report the gap.",
          succeeded: "The probe key was actually present — detection did NOT trigger. That is a real finding against the missing-key claim."
        },
        onError: {
          LIVE_TRANSPORT_ERROR: "I could not reach the localization service from the browser at all ({{error}}) — no dictionary was checked, so no detection happened. I record that honestly."
        }
      }
    },
    {
      type: "dialogue",
      speaker: "ai-agent",
      text: "I’ll combine the localization result with the other test results. I’ll summarize verified facts, highlight failures, and separate recommendations from confirmed causes."
    },
    { type: "processing", platform: "ai-agent", label: "Combining localization results with collected evidence" },
    {
      type: "dialogue",
      speaker: "os",
      text: "Approved. The AI may analyze evidence and recommend actions, but privileged operations must still follow the configured authorization rules."
    }
  ],
  checkpoints: [
    { id: "CP-8-1", text: "Required translation keys loaded.", sceneIndex: 8 },
    { id: "CP-8-2", text: "Missing-key behavior validated.", sceneIndex: 8 },
    { id: "CP-8-3", text: "Platform-specific configuration paths respected.", sceneIndex: 8 },
    { id: "CP-8-4", text: "AI summary matches actual evidence.", sceneIndex: 8 },
    { id: "CP-8-5", text: "No unauthorized actions performed by the agent.", sceneIndex: 8 }
  ]
};
