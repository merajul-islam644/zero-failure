// Shared types for the Operation Zero Failure simulator.
// Everything downstream (clock, compiler, canvas, dashboard, report)
// compiles against this file — change names here first, nowhere else.

// ---- Platforms and characters ----

export type PlatformId =
  | "os"
  | "iam"
  | "data-gateway"
  | "logic"
  | "release"
  | "monitor"
  | "utilities"
  | "localization"
  | "storage"
  | "ai-agent";

export type SpeakerId = PlatformId | "all-cast";

export type CharacterState =
  | "idle"
  | "speaking"
  | "listening"
  | "processing"
  | "success"
  | "failure"
  | "timeout-retry";

// ---- Structured message envelope (section 5 of the spec) ----

export type ExecutionMode = "simulated" | "live";

export type MessageStatus =
  | "in-flight"
  | "processing"
  | "succeeded"
  | "failed"
  | "timed-out"
  | "not-configured";

export interface ErrorDetails {
  code: string;
  message: string;
  retriable: boolean;
}

export interface StructuredMessage {
  runId: string;
  /** Groups an operation across retries. */
  correlationId: string;
  /** Unique per attempt. */
  requestId: string;
  sourcePlatform: PlatformId;
  targetPlatform: PlatformId;
  operation: string;
  /** Presentation time (ms) of the dispatch on the timeline. */
  timestamp: number;
  status: MessageStatus;
  /** Narrative operation duration — what the report shows, not the timeline position. */
  durationMs: number;
  requestSummary: string;
  responseSummary?: string;
  errorDetails?: ErrorDetails;
  mode: ExecutionMode;
  /** 1-based; > 1 implies a retry of correlationId. */
  attempt: number;
  idempotencyKey?: string;
  simulated: boolean;
  /** Real values recorded with the response; quoted by dialogue and panels. */
  data?: Record<string, unknown>;
}

// ---- Timeline events ----

export type TimelineEvent =
  | {
      kind: "scene-start";
      time: number;
      seq: number;
      sceneIndex: number;
      title: string;
      environment: string;
    }
  | { kind: "scene-end"; time: number; seq: number; sceneIndex: number }
  | {
      kind: "dialogue";
      time: number;
      seq: number;
      id: string;
      speaker: SpeakerId;
      text: string;
      durationMs: number;
      sceneIndex: number;
    }
  | {
      kind: "character-state";
      time: number;
      seq: number;
      id: string;
      platform: PlatformId;
      state: CharacterState;
      durationMs: number;
    }
  | {
      kind: "message-dispatch";
      time: number;
      seq: number;
      id: string;
      message: StructuredMessage;
      travelMs: number;
    }
  | {
      kind: "message-arrive";
      time: number;
      seq: number;
      id: string;
      messageId: string;
    }
  | {
      kind: "message-resolve";
      time: number;
      seq: number;
      id: string;
      messageId: string;
    }
  | {
      kind: "assertion-result";
      time: number;
      seq: number;
      id: string;
      assertionId: string;
    }
  | { kind: "note"; time: number; seq: number; id: string; text: string };

// ---- Test layer ----

export type AssertionStatus =
  | "passed"
  | "failed"
  | "warning"
  | "not-tested"
  | "not-configured";

/** From the script's "Testing checkpoints" lists — the traceability anchor. */
export interface Checkpoint {
  id: string;
  text: string;
  sceneIndex: number;
}

export interface AssertionDefinition {
  id: string;
  platform: PlatformId;
  checkpointId: string;
  title: string;
  expected: string;
  severity: "required" | "advisory";
  sceneIndex: number;
}

export interface AttemptRecord {
  attempt: number;
  status: MessageStatus;
  durationMs: number;
  errorDetails?: ErrorDetails;
}

export interface TestResult {
  assertionId: string;
  runId: string;
  /** Message-kind asserts an exchange chain; process-kind asserts a structural property. */
  kind: "message" | "process";
  status: AssertionStatus;
  mode: ExecutionMode;
  expected: string;
  actual: string;
  /** Evidence link into the message history. */
  correlationId?: string;
  attempts: AttemptRecord[];
  durationMs?: number;
}

// ---- Connectors ----

export interface ConnectorOperation {
  id: string;
  summary: string;
  timeoutMs: number;
  retryPolicy: { maxRetries: number; backoffMs: number };
}

export interface OperationRequest {
  runId: string;
  correlationId: string;
  requestId: string;
  operation: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface OperationResponse {
  status: "succeeded" | "failed" | "timed-out" | "not-configured";
  durationMs: number;
  responseSummary: string;
  errorDetails?: ErrorDetails;
  mode: ExecutionMode;
  simulated: boolean;
  /** Real values the dialogue and panels may quote (counts, ids, names).
   *  Dropped when an injected failure overrides the response. */
  data?: Record<string, unknown>;
}

export interface PlatformConnector {
  platform: PlatformId;
  displayName: string;
  /** Live-mode truth; simulated providers report "configured" + simulated. */
  configStatus: "configured" | "not-configured";
  simulated: boolean;
  /** Human-readable description — never a secret. */
  authMethod: string;
  operations: ConnectorOperation[];
  execute(operation: string, request: OperationRequest): Promise<OperationResponse>;
}

// ---- Scenarios ----

export interface ScenarioInjection {
  match: { platform?: PlatformId; operation?: string; attempt?: number; correlationId?: string };
  outcome: "succeed" | "fail" | "timeout" | "not-configured" | "delay";
  errorCode?: string;
  errorMessage?: string;
  delayMs?: number;
}

export interface ScenarioDefinition {
  id: string;
  title: string;
  description: string;
  injections: ScenarioInjection[];
  /** Shown in the UI; asserted in tests. */
  expectedOutcome: string;
}

// ---- Report ----

export type OverallStatus =
  | "passed"
  | "passed-with-warnings"
  | "failed"
  | "incomplete"
  | "not-configured-only";

export interface RunReport {
  reportVersion: 1;
  runId: string;
  mode: ExecutionMode;
  scenarioId: string;
  startedAt: string;
  completedAt: string;
  /** 570000 in the default simulated presentation. */
  presentationDurationMs: number;
  /** null in simulation; real wall clock in live mode. */
  executionDurationMs: number | null;
  disclaimer: string;
  counts: Record<AssertionStatus, number>;
  overall: { status: OverallStatus; rationale: string[] };
  results: TestResult[];
  messages: StructuredMessage[];
}

// ---- Scenes and beats (script data) ----

/** What a dialogue line may say about a watched exchange, keyed by the
 *  outcome the run actually recorded. "recovered" = the first attempt did
 *  not succeed and a later attempt did. */
export type WatchOutcome =
  | "succeeded"
  | "failed"
  | "timed-out"
  | "not-configured"
  | "recovered";

/** Attaches an outcome-narrating dialogue line to an exchange's real result.
 *  The compiler picks the variant the recorded message actually earns, so the
 *  same line tells the truth in every mode and scenario. Authoring rule: the
 *  watched exchange beat must precede the line that watches it. */
export interface DialogueWatch {
  correlationId: string;
  /** Specific attempt to watch; omitted = the final attempt of the chain. */
  attempt?: number;
  variants: Partial<Record<WatchOutcome, string>>;
  /** Error-code-keyed lines, checked before status variants — e.g.
   *  LIVE_TRANSPORT_ERROR vs MISSING_KEY_DETECTED are both status "failed". */
  onError?: Partial<Record<string, string>>;
  /** Used when the correlation has no messages (blocked live step). */
  fallback?: string;
}

export type Beat =
  | { type: "dialogue"; speaker: SpeakerId; text: string; watch?: DialogueWatch }
  | {
      type: "exchange";
      from: PlatformId;
      to: PlatformId;
      operation: string;
      correlationId: string;
      requestSummary: string;
      /** Assertion this exchange resolves; ties it to the test layer. */
      outcomeRef?: string;
      /** Which attempt of the correlation this beat shows (default 1). */
      attempt?: number;
    }
  | { type: "processing"; platform: PlatformId; weight?: number; label: string }
  | { type: "note"; text: string };

export interface SceneDefinition {
  index: number; // 1-based
  title: string;
  environment: string;
  cast: PlatformId[];
  targetDurationMs: number;
  beats: Beat[];
  checkpoints: Checkpoint[];
}

export interface CharacterDef {
  id: PlatformId;
  name: string;
  role: string;
  personality: string;
  /** Tailwind-compatible HSL triple, e.g. "215 90% 60%". */
  hue: string;
  glyph: string;
}

// ---- Derived playback state (pure fold output) ----

export interface ActiveDialogue {
  id: string;
  speaker: SpeakerId;
  text: string;
  startMs: number;
  durationMs: number;
}

export interface SceneInfo {
  index: number;
  title: string;
  environment: string;
  startMs: number;
}

export interface DerivedState {
  time: number;
  eventIndex: number;
  scene: SceneInfo | null;
  dialogue: ActiveDialogue | null;
  note: string | null;
  states: Record<PlatformId, CharacterState>;
}

// ---- Run ----

export interface RunResult {
  runId: string;
  mode: ExecutionMode;
  scenarioId: string;
  messages: StructuredMessage[];
  results: TestResult[];
  /** Real wall clock spent executing in live mode; null in simulation. */
  executionDurationMs: number | null;
}
