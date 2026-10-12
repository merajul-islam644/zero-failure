// Outcome-driven dialogue resolution: watched lines speak the truth the run
// actually recorded. Pure module — same (scenes, messages) in, same scenes
// out — so compilation stays deterministic and every broadcast viewer at the
// same head sees identical subtitles.
//
// Resolution never invents outcomes: with no messages (run=null bring-up) the
// static script text is returned untouched, and a correlation with no
// recorded messages (blocked live step) falls back to the authored fallback.

import { displayName } from "../script/cast";
import type {
  DialogueWatch,
  MessageStatus,
  SceneDefinition,
  StructuredMessage,
  WatchOutcome
} from "./types";

/** Recorded messages always carry a final status; the guard keeps the
 *  resolver honest if a transient status ever reached it. */
function isWatchable(status: MessageStatus): status is Extract<MessageStatus, WatchOutcome> {
  return status === "succeeded" || status === "failed" || status === "timed-out" || status === "not-configured";
}

/** Outcome of a watched chain. With an explicit attempt the outcome is that
 *  attempt's own status (never "recovered"); otherwise the chain's: final
 *  status, upgraded to "recovered" when the first attempt failed and a later
 *  one succeeded. Returns null only for unresolvable statuses, which recorded
 *  runs never produce. */
export function pickWatchOutcome(
  chain: StructuredMessage[],
  attempt?: number
): WatchOutcome | null {
  const watched = attempt !== undefined
    ? chain.find((m) => m.attempt === attempt)
    : chain[chain.length - 1];
  if (!watched || !isWatchable(watched.status)) return null;
  if (attempt !== undefined) return watched.status;
  const first = chain[0];
  const recovered =
    chain.length > 1 && first !== undefined && first.status !== "succeeded" && watched.status === "succeeded";
  if (recovered) return "recovered";
  return watched.status;
}

/** Text of a watched line: the variant the recorded message actually earns,
 *  with real values interpolated. Order: error-code lines (both a CORS block
 *  and a detected missing key are status "failed"), then the status variant,
 *  then the fallback, then the static text. */
export function resolveWatchedText(
  watch: DialogueWatch,
  chain: StructuredMessage[],
  staticText: string
): string {
  if (chain.length === 0) return watch.fallback ?? staticText;
  const watched =
    watch.attempt !== undefined
      ? chain.find((m) => m.attempt === watch.attempt)
      : chain[chain.length - 1];
  if (!watched) return watch.fallback ?? staticText;

  const outcome = pickWatchOutcome(chain, watch.attempt);
  const code = watched.errorDetails?.code;
  const onErrorText = code ? watch.onError?.[code] : undefined;
  const template = onErrorText
    ?? (outcome ? watch.variants[outcome] : undefined)
    ?? watch.fallback
    ?? staticText;
  return interpolate(template, watched, chain);
}

/** Replace {{token}} placeholders with the watched message's real values.
 *  Every token resolves (unknown stays literal "unknown"), so no "{{" ever
 *  survives into a subtitle or the TTS track. */
export function interpolate(
  text: string,
  message: StructuredMessage,
  chain: StructuredMessage[] = [message]
): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, token: string) => readToken(token, message, chain));
}

function readToken(token: string, message: StructuredMessage, chain: StructuredMessage[]): string {
  if (token === "runId") return message.runId;
  if (token === "operation") return message.operation;
  if (token === "platform") return displayName(message.targetPlatform);
  if (token === "status") return message.status;
  if (token === "attempt") return String(message.attempt);
  if (token === "duration") return `${message.durationMs} ms`;
  if (token === "error") return message.errorDetails?.code ?? "no error";
  if (token === "error.message") return message.errorDetails?.message ?? "no error message";
  if (token === "firstError") return chain[0]?.errorDetails?.code ?? "no error";
  if (token === "data" || token.startsWith("data.")) {
    const value = token === "data"
      ? message.data
      : readPath(message.data, token.slice("data.".length));
    return value === undefined || value === null ? "unknown" : String(value);
  }
  return "unknown";
}

function readPath(data: Record<string, unknown> | undefined, path: string): unknown {
  if (!data) return undefined;
  return path.split(".").reduce<unknown>(
    (node, key) => (node !== null && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined),
    data
  );
}

/** Resolve every watched dialogue line against the recorded messages. With
 *  no messages (run=null engine bring-up) scenes pass through untouched, so
 *  the static script text is what budgets and tests have always seen. */
export function resolveScenes(
  scenes: SceneDefinition[],
  messages: StructuredMessage[] | null
): SceneDefinition[] {
  if (!messages) return scenes;

  const chains = new Map<string, StructuredMessage[]>();
  for (const message of messages) {
    const chain = chains.get(message.correlationId);
    if (chain) chain.push(message);
    else chains.set(message.correlationId, [message]);
  }
  for (const chain of chains.values()) chain.sort((a, b) => a.attempt - b.attempt);

  return scenes.map((scene) => {
    let watched = false;
    const beats = scene.beats.map((beat) => {
      if (beat.type !== "dialogue" || !beat.watch) return beat;
      watched = true;
      const text = resolveWatchedText(beat.watch, chains.get(beat.watch.correlationId) ?? [], beat.text);
      return { ...beat, text };
    });
    return watched ? { ...scene, beats } : scene;
  });
}

/** Compact " · key: value" tail for panel detail lines — at most three
 *  entries, so a row never grows past a sentence. */
export function dataReadout(data?: Record<string, unknown>): string {
  if (!data) return "";
  const entries = Object.entries(data)
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${value === undefined || value === null ? "unknown" : String(value)}`);
  return entries.length > 0 ? ` · ${entries.join(" · ")}` : "";
}
