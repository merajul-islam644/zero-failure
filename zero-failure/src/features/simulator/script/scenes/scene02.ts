// Scene 2 — Security Before Communication (IAM + OS + Data Gateway, 00:55–01:55).
// Dialogue verbatim from the approved script.

import type { SceneDefinition } from "../../engine/types";

export const scene02: SceneDefinition = {
  index: 2,
  title: "Security Before Communication",
  environment: "Secure Access Gate",
  cast: ["os", "iam", "data-gateway", "ai-agent"],
  targetDurationMs: 60000,
  beats: [
    {
      type: "dialogue",
      speaker: "os",
      text: "IAM, before anyone accesses project data, verify the test identity and its permissions."
    },
    { type: "exchange", from: "os", to: "iam", operation: "authenticate-identity", correlationId: "s2-identity-check", requestSummary: "Validate the test identity and list its granted permissions" },
    {
      type: "dialogue",
      speaker: "iam",
      text: "Understood. I’ll validate the configured authentication mechanism, confirm the identity, and check whether the requested operation is authorized."
    },
    {
      type: "dialogue",
      speaker: "data-gateway",
      text: "I have a request waiting. I need to retrieve a test project record, but I won’t treat the request as authorized just because it came from another platform."
    },
    { type: "exchange", from: "data-gateway", to: "iam", operation: "authorize-operation", correlationId: "s2-authorize-read", requestSummary: "Check permission for reading the test project record" },
    {
      type: "dialogue",
      speaker: "iam",
      text: "Correct. Authentication answers who the caller is. Authorization answers what the caller is allowed to do. Those are separate checks."
    },
    {
      type: "dialogue",
      speaker: "ai-agent",
      text: "Let’s test both a valid request and an unauthorized request. The valid request should succeed. The unauthorized request should be denied without exposing protected information."
    },
    {
      type: "dialogue",
      speaker: "iam",
      text: "The valid test identity has passed authentication, and the requested permission is confirmed by the configured access policy.",
      watch: {
        correlationId: "s2-identity-check",
        variants: {
          succeeded: "The live session is confirmed — signed in as {{data.user}} — and the requested permission is confirmed by the tenant's access policy.",
          failed: "The identity check failed ({{error}}) — I cannot claim the test identity passed. Authentication must hold before anything else runs.",
          "not-configured": "The identity check came back not-configured ({{error}}) — I cannot confirm the test identity against the tenant."
        },
        fallback: "The identity check recorded no result — authentication stays unverified in this run."
      }
    },
    {
      type: "dialogue",
      speaker: "data-gateway",
      text: "Authorization confirmed. I can now process the permitted request.",
      watch: {
        correlationId: "s2-authorize-read",
        variants: {
          succeeded: "Live policy confirms {{data.roles}} role(s) — the permitted request may proceed.",
          failed: "The live authorization check failed ({{error}}) — this request does not proceed.",
          "not-configured": "Authorization is not verifiable live ({{error}}) — I treat this request as unpermitted."
        }
      }
    },
    {
      type: "dialogue",
      speaker: "ai-agent",
      text: "Now run the negative test. Request a restricted operation using an identity without the necessary permission."
    },
    { type: "exchange", from: "data-gateway", to: "iam", operation: "authorize-operation", correlationId: "s2-authorize-restricted", requestSummary: "Request a restricted operation with an under-privileged identity", outcomeRef: "s2-negative" },
    { type: "note", text: "A green token travels from IAM to the permitted request; a second request turns red and stops at the access gate." },
    {
      type: "dialogue",
      speaker: "data-gateway",
      text: "The restricted request was denied. No protected record was modified.",
      watch: {
        correlationId: "s2-authorize-restricted",
        variants: {
          failed: "The restricted request was denied ({{error}}). No protected record was touched.",
          succeeded: "The restricted request was not denied — that is a real access-policy finding, not a pass."
        },
        fallback: "The restricted check recorded no result — there is no denial to confirm in this run."
      }
    },
    {
      type: "dialogue",
      speaker: "os",
      text: "Good. We have tested both access and denial. Remember, a secure system must reject unauthorized requests as reliably as it accepts authorized ones."
    }
  ],
  checkpoints: [
    { id: "CP-2-1", text: "Valid identity accepted.", sceneIndex: 2 },
    { id: "CP-2-2", text: "Permission check verified.", sceneIndex: 2 },
    { id: "CP-2-3", text: "Unauthorized request rejected.", sceneIndex: 2 },
    { id: "CP-2-4", text: "No unintended data modification.", sceneIndex: 2 },
    { id: "CP-2-5", text: "Tokens and secrets never displayed in the animation.", sceneIndex: 2 }
  ]
};
