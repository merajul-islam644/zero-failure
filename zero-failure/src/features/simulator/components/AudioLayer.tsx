// Audio layer: silent unless the user enables narration/sfx in settings.
// Subscribes to the event index (discrete, not per-frame): every event
// between the previous and current index fires its sound; a large jump
// (seek) stays silent instead of machine-gunning the whole skip.

import { useEffect, useMemo, useRef } from "react";
import type { Timeline } from "../engine/timeline";
import { useEventIndex, usePlayer } from "../state/PlayerContext";
import { useSettings } from "../state/SettingsContext";
import { SfxController, speak, stopSpeech } from "../state/audio";
import { pitchForPlatform, resolveVoice } from "../state/voices";

/** More than this many events crossed in one tick means the user seeked. */
const SEEK_JUMP_EVENTS = 4;

export function AudioLayer({ timeline }: { timeline: Timeline }) {
  const { clock, playing } = usePlayer();
  const { narration, sfx, voice } = useSettings();
  const index = useEventIndex(timeline.events);
  const prevIndexRef = useRef(index);
  const sfxRef = useRef<SfxController | null>(null);

  // Resolve the saved voiceURI against installed voices; null = engine default.
  const narrationVoice = useMemo(() => resolveVoice(voice), [voice]);

  // requestId -> final status, so resolves can blip fail vs success.
  const statusByRequest = useMemo(() => {
    const map = new Map<string, string>();
    for (const message of timeline.messages) map.set(message.requestId, message.status);
    return map;
  }, [timeline]);

  useEffect(() => {
    const crossed = timeline.events.slice(prevIndexRef.current + 1, index + 1);
    prevIndexRef.current = index;

    if (!playing) {
      stopSpeech();
      return;
    }
    if (crossed.length === 0 || crossed.length > SEEK_JUMP_EVENTS) return; // seek: silence

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
        speak(dialogue.text, {
          playbackRate: clock.playbackRate,
          voice: narrationVoice,
          pitch: pitchForPlatform(dialogue.speaker)
        });
      }
    }
  }, [index, playing, narration, sfx, clock, timeline.events, statusByRequest, narrationVoice]);

  // Stop speech whenever narration turns off or the layer unmounts.
  useEffect(() => {
    if (!narration) stopSpeech();
    return () => stopSpeech();
  }, [narration]);

  useEffect(() => {
    return () => {
      sfxRef.current?.dispose();
      sfxRef.current = null;
    };
  }, []);

  return null;
}
