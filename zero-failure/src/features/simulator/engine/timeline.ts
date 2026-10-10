// Timeline compiler: (scenes, run) -> presentation canvas.
//
// The runner (run/runner.ts, M3) pre-executes the whole scenario and produces
// StructuredMessages + TestResults; this module places them on the 570-second
// canvas. Compilation is pure and deterministic: same inputs -> same timeline,
// which is what makes golden-snapshot tests and exact seeking possible.
//
// When `run` is null (engine bring-up) exchanges fall back to placeholder
// envelopes so the skeleton still plays end to end.

import { budgetScene, clampProcessingMs, type BudgetedItem } from "./budget";
import { buildSceneTable, type SceneWindow } from "./select";
import type {
  Beat,
  CharacterState,
  RunResult,
  SceneDefinition,
  StructuredMessage,
  TimelineEvent
} from "./types";

export interface MessageWindow {
  message: StructuredMessage;
  dispatchMs: number;
  arriveMs: number;
  resolveMs: number;
  travelMs: number;
  processingMs: number;
}

export interface TimelineScene {
  index: number;
  title: string;
  environment: string;
  startMs: number;
  endMs: number;
}

export interface Timeline {
  events: TimelineEvent[];
  messages: StructuredMessage[];
  messageWindows: MessageWindow[];
  sceneTable: SceneWindow[];
  scenes: TimelineScene[];
  totalMs: number;
}

/** Hold after the final scene so the finale state stays on screen. */
export const TIMELINE_TAIL_MS = 1500;

const FLASH_MS = 1600;

/** Omit over a union must distribute — plain Omit collapses to common keys. */
type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : T;
type UnsequencedEvent = DistributiveOmit<TimelineEvent, "seq">;

export function buildTimeline(scenes: SceneDefinition[], run: RunResult | null): Timeline {
  const events: TimelineEvent[] = [];
  const messages: StructuredMessage[] = [];
  const scenesOut: TimelineScene[] = [];
  let seq = 0;
  let cursor = 0;

  const push = (event: UnsequencedEvent) => {
    events.push({ ...event, seq: seq++ } as TimelineEvent);
  };

  const envelopeFor = (
    correlationId: string,
    attempt: number,
    beat: Extract<Beat, { type: "exchange" }>,
    timestamp: number,
    processingMs: number
  ): StructuredMessage => {
    const found = run?.messages.find(
      (m) => m.correlationId === correlationId && m.attempt === attempt
    );
    if (found) return found;
    // Placeholder envelope — replaced by the runner in M3; scene01 has none.
    return {
      runId: run?.runId ?? "pending-run",
      correlationId,
      requestId: `${correlationId}#a${attempt}`,
      sourcePlatform: beat.from,
      targetPlatform: beat.to,
      operation: beat.operation,
      timestamp,
      status: "succeeded",
      durationMs: processingMs,
      requestSummary: beat.requestSummary,
      responseSummary: "OK",
      mode: run?.mode ?? "simulated",
      attempt,
      simulated: true
    };
  };

  const flashState = (status: StructuredMessage["status"]): CharacterState => {
    switch (status) {
      case "succeeded":
        return "success";
      case "failed":
      case "not-configured":
        return "failure";
      case "timed-out":
        return "timeout-retry";
      default:
        return "processing";
    }
  };

  for (const scene of scenes) {
    const budget = budgetScene(scene.beats, scene.targetDurationMs);
    const sceneStart = cursor;
    push({
      kind: "scene-start",
      time: sceneStart,
      sceneIndex: scene.index,
      title: scene.title,
      environment: scene.environment
    });

    budget.items.forEach((item: BudgetedItem, beatIndex: number) => {
      const id = `s${scene.index}b${beatIndex}`;
      const beat = item.beat;

      switch (beat.type) {
        case "dialogue": {
          push({
            kind: "dialogue",
            time: sceneStart + item.startMs,
            id,
            speaker: beat.speaker,
            text: beat.text,
            durationMs: item.durationMs,
            sceneIndex: scene.index
          });
          const t = sceneStart + item.startMs;
          const d = item.durationMs;
          if (beat.speaker === "all-cast") {
            // Collective line: the whole present cast speaks together.
            for (const member of scene.cast) {
              push({
                kind: "character-state",
                time: t,
                id: `${id}-spk-${member}`,
                platform: member,
                state: "speaking",
                durationMs: d
              });
            }
          } else {
            push({
              kind: "character-state",
              time: t,
              id: `${id}-st`,
              platform: beat.speaker,
              state: "speaking",
              durationMs: d
            });
            // Non-speaking cast listens.
            for (const member of scene.cast) {
              if (member !== beat.speaker) {
                push({
                  kind: "character-state",
                  time: t,
                  id: `${id}-ls-${member}`,
                  platform: member,
                  state: "listening",
                  durationMs: d
                });
              }
            }
          }
          break;
        }
        case "exchange": {
          const t0 = sceneStart + item.startMs;
          const travelMs = Math.min(700, item.durationMs);
          const remaining = item.durationMs - travelMs;
          const resolveHold = Math.min(600, remaining);
          const processingMs = Math.max(300, remaining - resolveHold);
          const envelope = envelopeFor(beat.correlationId, beat.attempt ?? 1, beat, t0, processingMs);
          envelope.timestamp = t0;

          push({ kind: "message-dispatch", time: t0, id: `${id}-dispatch`, message: envelope, travelMs });
          push({ kind: "message-arrive", time: t0 + travelMs, id: `${id}-arrive`, messageId: envelope.requestId });
          push({
            kind: "message-resolve",
            time: t0 + travelMs + processingMs,
            id: `${id}-resolve`,
            messageId: envelope.requestId
          });
          messages.push(envelope);

          push({
            kind: "character-state",
            time: t0,
            id: `${id}-src`,
            platform: beat.from,
            state: "listening",
            durationMs: travelMs + processingMs
          });
          push({
            kind: "character-state",
            time: t0,
            id: `${id}-dst`,
            platform: beat.to,
            state: "processing",
            durationMs: travelMs + processingMs
          });
          const flash = flashState(envelope.status);
          push({
            kind: "character-state",
            time: t0 + travelMs + processingMs,
            id: `${id}-flash-dst`,
            platform: beat.to,
            state: flash,
            durationMs: FLASH_MS
          });
          if (beat.outcomeRef && run) {
            const result = run.results.find((r) => r.assertionId === beat.outcomeRef);
            if (result) {
              push({
                kind: "assertion-result",
                time: t0 + travelMs + processingMs,
                id: `${id}-assert`,
                assertionId: beat.outcomeRef
              });
            }
          }
          break;
        }
        case "processing": {
          push({
            kind: "character-state",
            time: sceneStart + item.startMs,
            id: `${id}-proc`,
            platform: beat.platform,
            state: "processing",
            durationMs: item.durationMs
          });
          break;
        }
        case "note": {
          push({ kind: "note", time: sceneStart + item.startMs, id: `${id}-note`, text: beat.text });
          break;
        }
      }
    });

    cursor += budget.totalMs;
    scenesOut.push({
      index: scene.index,
      title: scene.title,
      environment: scene.environment,
      startMs: sceneStart,
      endMs: cursor
    });
    push({ kind: "scene-end", time: cursor, sceneIndex: scene.index });
  }

  // Sorted by time with stable seq tie-break.
  events.sort((a, b) => a.time - b.time || a.seq - b.seq);

  const messageWindows: MessageWindow[] = [];
  for (const event of events) {
    if (event.kind !== "message-dispatch") continue;
    const m = event.message;
    const arrive = events.find(
      (e) => e.kind === "message-arrive" && e.messageId === m.requestId
    );
    const resolve = events.find(
      (e) => e.kind === "message-resolve" && e.messageId === m.requestId
    );
    messageWindows.push({
      message: m,
      dispatchMs: event.time,
      travelMs: event.travelMs,
      arriveMs: arrive?.time ?? event.time + event.travelMs,
      resolveMs: resolve?.time ?? event.time + event.travelMs + clampProcessingMs(m.durationMs),
      processingMs: Math.max(
        0,
        (resolve?.time ?? event.time + event.travelMs) - (arrive?.time ?? event.time)
      )
    });
  }

  return {
    events,
    messages,
    messageWindows,
    sceneTable: buildSceneTable(events),
    scenes: scenesOut,
    totalMs: cursor > 0 ? cursor + TIMELINE_TAIL_MS : 0
  };
}

/** Scene window by 1-based scene index from the compiled timeline. */
export function sceneWindow(timeline: Timeline, sceneIndex: number): TimelineScene | null {
  return timeline.scenes.find((s) => s.index === sceneIndex) ?? null;
}
