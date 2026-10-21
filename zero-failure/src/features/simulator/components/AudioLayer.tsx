// Audio layer: narration and sfx default ON (transport speaker button or
// the Config panel toggles turn them off). Subscribes to the event index
// (discrete, not per-frame): every event between the previous and current
// index fires its sound; seeks stay silent.
//
// Narration runs as audiobook mode: when a dialogue line starts, the story
// pauses until the line has been spoken in full, then resumes — at the
// line's window tail, so the next voice follows a natural breath rather
// than a silent replay of the subtitle window the head never lived through.
// Chasing the subtitle window instead forces mid-word cancellations (the
// engines speak slower than the script pace) — waiting for the voice keeps
// every line complete and perfectly matched to the subtitle on screen.

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Timeline } from "../engine/timeline";
import type { SpeakerId } from "../engine/types";
import { orbitSkyTime, useEventIndex, usePlayer } from "../state/PlayerContext";
import { useSettings } from "../state/SettingsContext";
import { SfxController, speak, stopSpeech } from "../state/audio";
import { castPlan, pitchForPlatform, rateForPlatform, resolveSpeakerVoice, resolveVoice, useVoices } from "../state/voices";

/** Head movement beyond what the rate allows (plus slack) means the user seeked. */
const SEEK_HEAD_TOLERANCE_MS = 1200;
/** Absolute cap on crossed events per step — a fast seek crosses hundreds. */
const SEEK_EVENT_CAP = 40;
/**
 * The quiet beat after a finished voice: the story resumes at the spoken
 * line's window tail — the pause every dialogue already budgets
 * (budgetScene's 700 ms dialogue tail) — instead of replaying the whole
 * subtitle window from its start. The head parks at the line's beginning
 * while the voice runs (the clock is frozen), so a plain resume would make
 * the audience wait the entire window out again in silence before the next
 * voice — the "one person finished, the next spoke much later" gap.
 */
const NARRATION_BREATH_MS = 700;

export function AudioLayer({
  timeline,
  onNarrationPause,
  onNarrationResume
}: {
  timeline: Timeline;
  /** Published when narration pauses the story (audiobook mode) — broadcast rooms share the rhythm. */
  onNarrationPause?: () => void;
  /** Published when a finished line resumes the story. */
  onNarrationResume?: () => void;
}) {
  const { clock, playing } = usePlayer();
  const { narration, sfx, voice, castVoices } = useSettings();
  const index = useEventIndex(timeline.events);
  const prevIndexRef = useRef(index);
  const sfxRef = useRef<SfxController | null>(null);
  const lastRunRef = useRef<{ head: number; at: number }>({
    head: clock.time,
    at: performance.now()
  });
  // Audiobook flow bookkeeping: the next !playing run is our own narration
  // pause, and (while set) a paused story waits for speech to finish. The
  // window end of the line now speaking — the resume point's anchor.
  const selfPauseRef = useRef(false);
  const pendingResumeRef = useRef(false);
  const spokenWindowEndRef = useRef(0);
  // Keep the publish callbacks current for onDone, which speech fires later.
  const narrationCallbacksRef = useRef({ onNarrationPause, onNarrationResume });
  narrationCallbacksRef.current = { onNarrationPause, onNarrationResume };

  // Resolve the saved voiceURI against installed voices; null = engine default.
  const narrationVoice = useMemo(() => resolveVoice(voice), [voice]);
  const installed = useVoices();
  const plan = useMemo(() => castPlan(installed), [installed]);

  // requestId -> final status, so resolves can blip fail vs success.
  const statusByRequest = useMemo(() => {
    const map = new Map<string, string>();
    for (const message of timeline.messages) map.set(message.requestId, message.status);
    return map;
  }, [timeline]);

  // Rejoin the story to the sky: resume where the drift already stands,
  // never past the spoken line's window tail (the next line must not be
  // jumped over). When the voice ran long, the sky is parked at the tail
  // and the story resumes exactly there; when it was short, the story
  // resumes wherever the sky got to. Either way — no snap.
  const resumeAtLineTail = useCallback(() => {
    const tail = spokenWindowEndRef.current - NARRATION_BREATH_MS;
    const resumeAt = Math.min(orbitSkyTime(clock), tail);
    if (resumeAt > clock.time) clock.seek(resumeAt);
  }, [clock]);

  // Narration entry: character voice/pitch/speed; while the story plays,
  // pause it for the duration and resume when the utterance completes — at
  // the line's window tail, not its start (see NARRATION_BREATH_MS).
  const speakDialogue = useCallback(
    (text: string, speaker: SpeakerId, windowEndMs: number) => {
      spokenWindowEndRef.current = windowEndMs;
      const spoke = speak(text, {
        playbackRate: clock.playbackRate,
        voice: resolveSpeakerVoice(speaker, castVoices, plan, narrationVoice),
        pitch: pitchForPlatform(speaker),
        rate: rateForPlatform(speaker),
        onDone: () => {
          if (pendingResumeRef.current) {
            pendingResumeRef.current = false;
            resumeAtLineTail();
            clock.play();
            narrationCallbacksRef.current.onNarrationResume?.();
          }
        }
      });
      if (spoke && playing) {
        selfPauseRef.current = true;
        pendingResumeRef.current = true;
        // Park the sky at the line's tail: while the voice runs, the drift
        // carries it this far and no further — the story's exact resume
        // point, so the planets never have to snap back on resume.
        clock.pausedDriftTargetMs = windowEndMs - NARRATION_BREATH_MS;
        clock.pause();
        narrationCallbacksRef.current.onNarrationPause?.();
      }
    },
    [clock, castVoices, plan, narrationVoice, playing, resumeAtLineTail]
  );

  useEffect(() => {
    const now = performance.now();
    const prev = lastRunRef.current;
    lastRunRef.current = { head: clock.time, at: now };

    const crossed = timeline.events.slice(prevIndexRef.current + 1, index + 1);
    prevIndexRef.current = index;

    const expectedMs = Math.max(0, (now - prev.at) * clock.playbackRate);
    const movedMs = Math.abs(clock.time - prev.head);
    const seeked =
      movedMs > expectedMs + SEEK_HEAD_TOLERANCE_MS || crossed.length > SEEK_EVENT_CAP;
    if (seeked) {
      // A stale line must not play over the new position; its onDone resumes
      // the story from wherever the head landed.
      stopSpeech();
      return;
    }

    if (!playing) {
      if (selfPauseRef.current) {
        selfPauseRef.current = false; // our narration pause — speech continues
      } else {
        pendingResumeRef.current = false; // user pause — no auto-resume
        stopSpeech();
      }
      return;
    }

    if (crossed.length === 0) return;

    if (sfx) {
      const controller = sfxRef.current ?? new SfxController();
      if (controller.ensure()) {
        sfxRef.current = controller;
        for (const event of crossed) {
          if (event.kind === "message-dispatch") controller.blip("dispatch");
          else if (event.kind === "message-resolve") {
            const status = statusByRequest.get(event.messageId);
            controller.blip(status === "failed" || status === "timed-out" || status === "not-configured" ? "fail" : "resolve");
          }
        }
      }
    }

    if (narration) {
      const dialogue = [...crossed].reverse().find((e) => e.kind === "dialogue");
      if (dialogue && dialogue.kind === "dialogue") {
        speakDialogue(dialogue.text, dialogue.speaker, dialogue.time + dialogue.durationMs);
      }
    }
  }, [index, playing, narration, sfx, clock, timeline.events, statusByRequest, narrationVoice, castVoices, plan, speakDialogue]);

  // Sync on resume/toggle: the subtitle already shows the line under the
  // head when the user presses Play or enables narration mid-line.
  const syncRefs = useRef({ playing, narration });
  useEffect(() => {
    const resumed = playing && !syncRefs.current.playing;
    const justEnabled = narration && !syncRefs.current.narration && playing;
    syncRefs.current = { playing, narration };
    if (!resumed && !justEnabled) return;

    // Pressing Play during a narration pause means "skip the rest" — drop
    // the line and let the story run, from the line's tail like any resume.
    if (pendingResumeRef.current) {
      pendingResumeRef.current = false;
      stopSpeech();
      resumeAtLineTail();
      return;
    }

    const event = timeline.events[index];
    if (!event || event.kind !== "dialogue" || !narration) return;
    speakDialogue(event.text, event.speaker, event.time + event.durationMs);
  }, [playing, narration, index, clock, timeline.events, speakDialogue, resumeAtLineTail]);

  // Stop speech whenever narration turns off or the layer unmounts; if the
  // story was waiting on a line, let it continue from the sky's position
  // (and publish — followers are paused on the room doc until this resume
  // lands).
  useEffect(() => {
    if (!narration) {
      stopSpeech();
      if (pendingResumeRef.current) {
        pendingResumeRef.current = false;
        resumeAtLineTail();
        clock.play();
        narrationCallbacksRef.current.onNarrationResume?.();
      }
    }
    return () => stopSpeech();
  }, [narration, clock, resumeAtLineTail]);

  useEffect(() => {
    return () => {
      sfxRef.current?.dispose();
      sfxRef.current = null;
    };
  }, []);

  return null;
}
