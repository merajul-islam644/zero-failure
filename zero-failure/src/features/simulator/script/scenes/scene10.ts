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
      text: "Authentication and authorization checks are complete. I’ll report the results of both permitted and denied requests.",
      watch: {
        correlationId: "s2-identity-check",
        variants: {
          succeeded: "Authentication and authorization are complete — the live session is {{data.user}}. Permitted and denied results both hold.",
          failed: "The identity chain failed ({{error}}) — I’ll report authentication as unverified rather than passed.",
          "not-configured": "The identity check is not configured ({{error}}) — authentication goes in the report as untested."
        }
      }
    },
    {
      type: "dialogue",
      speaker: "data-gateway",
      text: "The data assertions will show which reads, writes and persistence checks passed.",
      watch: {
        correlationId: "s3-read-back",
        variants: {
          succeeded: "The assertions held — the record round-tripped with {{data.fields}} field(s) matching.",
          failed: "The persistence assertion does not hold ({{error}}) — the report will say so, not gloss over it."
        },
        onError: {
          LIVE_READ_ONLY: "Live refused the write ({{error}}) — nothing was created; the persistence claim stays unproven."
        }
      }
    },
    {
      type: "dialogue",
      speaker: "logic",
      text: "I’ll report the workflow steps, dependency failures, retries and final execution states.",
      watch: {
        correlationId: "s4-deploy-config",
        variants: {
          succeeded: "The workflow ran in order — the configuration gate passed ({{data.version}}), every state recorded.",
          failed: "The configuration gate failed ({{error}}) — dependent steps blocked, and the report says so.",
          "not-configured": "The configuration gate is not configured live ({{error}}) — I blocked its dependents instead of faking them."
        }
      }
    },
    {
      type: "dialogue",
      speaker: "release",
      text: "I’ll report the actual deployment-job result separately from application readiness.",
      watch: {
        correlationId: "s6-readiness",
        variants: {
          recovered: "Deployment and readiness stay separate — readiness recovered after attempt 1 failed ({{firstError}}).",
          succeeded: "The deployment report stays honest — readiness passed clean, no recovery to claim.",
          failed: "Readiness is still failing ({{error}}) — the report separates that from the job result."
        },
        fallback: "Neither the job nor readiness ran — the prerequisite failed, so both go down as blocked."
      }
    },
    {
      type: "dialogue",
      speaker: "monitor",
      text: "I’ll provide the available health signals, correlated errors and recovery evidence.",
      watch: {
        correlationId: "s9-timeout-probe",
        variants: {
          recovered: "Health signals show the timeout and its recovery — correlated errors and both attempts preserved.",
          succeeded: "The probes never timed out — health signals show two clean attempts, no recovery evidence.",
          failed: "The probe is still failing ({{error}}) — the correlated error and both attempts are preserved."
        }
      }
    },
    {
      type: "dialogue",
      speaker: "storage",
      text: "I’ll report whether the test artifacts were uploaded and retrieved successfully.",
      watch: {
        correlationId: "s7-evidence-metadata",
        variants: {
          succeeded: "The artifact uploaded and its metadata stored ({{data.rows}} row(s)) — retrieval verified.",
          failed: "The evidence write did not hold ({{error}}) — the report marks the artifact unverified."
        }
      }
    },
    {
      type: "dialogue",
      speaker: "utilities",
      text: "I’ll report the notification operation and any delivery confirmation actually available.",
      watch: {
        correlationId: "s7-notification",
        variants: {
          succeeded: "The notification was accepted and queued — I report acceptance, not confirmed delivery.",
          failed: "No notification was sent ({{error}}) — there is no delivery confirmation to report."
        }
      }
    },
    {
      type: "dialogue",
      speaker: "localization",
      text: "I’ll report the translation-resource checks and missing-key results.",
      watch: {
        correlationId: "s8-missing-key",
        variants: {
          failed: "The missing-key check detected the gap ({{error}}) — the report lists it as designed.",
          succeeded: "The probe key was present — detection did not trigger; the report flags that finding."
        },
        onError: {
          LIVE_TRANSPORT_ERROR: "Localization stayed unreachable ({{error}}) — no key results exist to report."
        }
      }
    },
    {
      type: "dialogue",
      speaker: "ai-agent",
      text: "I’ve consolidated the available evidence. I found one simulated timeout that recovered after retry. I’ll also list any unconfigured integration or missing evidence that prevents a conclusive result.",
      watch: {
        correlationId: "s9-timeout-probe",
        variants: {
          recovered: "Evidence consolidated: one real timeout recovered after retry — attempt 1 failed ({{firstError}}), attempt {{attempt}} succeeded.",
          succeeded: "Evidence consolidated: the probe never timed out — both attempts succeeded. There is no recovered failure to list.",
          failed: "Evidence consolidated: the probe ended in {{error}} with no recovery — the report lists it unresolved."
        }
      }
    },
    {
      type: "dialogue",
      speaker: "os",
      text: "Then our final verdict must be based on the assertions, not on how smoothly the animation played."
    },
    { type: "note", text: "All character panels converge into one dashboard: green passed, red failed, amber warning or recovered failure, grey not tested." },
    { type: "dialogue", speaker: "all-cast", text: "Mission Deck — Verification complete!" },
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
