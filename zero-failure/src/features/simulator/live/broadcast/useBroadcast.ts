// Broadcast sync hook — the slave side of shared viewing. While the viewer
// has Broadcast on and the tenant is ready, the shared doc is polled every
// 4s (and on window focus) and reconciled into the local clock; local
// transport actions publish through useBroadcastActions. One hook instance
// per page (it owns the slave effect); consumers receive the api object.
//
// Rev discipline keeps the loop closed: applying or publishing a rev marks
// it seen, and any doc at or below that rev is ignored — so this viewer's
// own echo and stale polls never re-trigger commands.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../../app/providers/AuthProvider";
import { blocksClient } from "../../../../lib/blocks/client";
import { usePlayer } from "../../state/PlayerContext";
import { useRun } from "../../run/RunContext";
import { useSettings } from "../../state/SettingsContext";
import { useCurrentUser, userDisplayName } from "../../../profile/useCurrentUser";
import { reconcile, buildBroadcastWrite } from "./broadcast-clock";
import { BROADCAST_DOC_ID, type BroadcastState } from "./schema";
import { classifyProbeError } from "../probes";
import {
  checkBroadcastReadiness,
  readBroadcastDoc,
  writeBroadcastDoc,
  type BroadcastReadiness
} from "./broadcast-doc";

const POLL_INTERVAL_MS = 4_000;
/** Local transport publishes coalesce to at most one write per window. */
const PUBLISH_THROTTLE_MS = 1_000;

/** What a transport action can override; the rest comes from the live clock. */
export interface BroadcastPublishAction {
  headMs?: number;
  playing?: boolean;
  rate?: number;
  scenarioId?: string;
  mode?: "simulated" | "live";
  /** Publish even inside the throttle window (discrete buttons use this). */
  force?: boolean;
}

export interface BroadcastApi {
  /** The persisted user toggle — sync only ever runs when this is on. */
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  readiness: BroadcastReadiness | null;
  /** Latest doc from the room (parsed), or null. */
  broadcast: BroadcastState | null;
  /** The signed-in viewer's display name — what this tab publishes as. */
  displayName: string;
  /** Last write failure, surfaced honestly in the control. */
  writeError: string | null;
  publish: (action: BroadcastPublishAction) => void;
}

export function useBroadcast(): BroadcastApi {
  const { status } = useAuth();
  const { clock } = usePlayer();
  const { scenarioId, mode, selectScenario } = useRun();
  const { broadcast: enabled, setBroadcast, setExecutionMode } = useSettings();
  const me = useCurrentUser();
  const displayName = useMemo(
    () => userDisplayName(me.data?.data) || "a viewer",
    [me.data?.data]
  );

  const [writeError, setWriteError] = useState<string | null>(null);

  // Is sync even possible here? One cheap schema lookup, re-checked rarely.
  const readinessQuery = useQuery<BroadcastReadiness>({
    enabled: enabled && status === "authenticated",
    queryFn: () => checkBroadcastReadiness(blocksClient),
    queryKey: ["live", "broadcast", "readiness"],
    retry: false,
    staleTime: 60_000
  });
  // A failed check is an answer, not a pending one — a 403 must show its
  // reason immediately, not spin "Checking the tenant…" forever.
  const readiness = enabled
    ? (readinessQuery.data ??
      (readinessQuery.isError
        ? { ready: false as const, reason: classifyProbeError(readinessQuery.error).reason }
        : null))
    : null;
  const ready = readiness?.ready === true;

  // The room itself: 4s poll, fresh on focus — the one query allowed to
  // refetch on focus, so a backgrounded tab catches up the moment the
  // viewer returns.
  const docQuery = useQuery({
    enabled: enabled && ready && status === "authenticated",
    queryFn: () => readBroadcastDoc(blocksClient),
    queryKey: ["live", "broadcast", "state", BROADCAST_DOC_ID],
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
    staleTime: 0
  });

  // Latest known room doc + item id (updates need the gateway's item id).
  const docRef = useRef<{ doc: BroadcastState | null; itemId: string | null }>({
    doc: null,
    itemId: null
  });
  // Revs this tab has already applied (from the room) or published (its own
  // echo) — anything at or below is ignored by the slave effect.
  const appliedRevRef = useRef(0);
  const publishedRevRef = useRef(0);
  // Revs live and die with one row: if the room's row is replaced (cleanup
  // deleted it, a tab re-created it) the new row's rev starts over, and a
  // tab still holding the old row's high revs would ignore the new doc
  // forever. A new ItemId resets that memory.
  const roomIdRef = useRef<string | null>(null);

  const docData = docQuery.data;
  useEffect(() => {
    if (!docData) return;
    docRef.current = docData;
    if (docData.itemId !== roomIdRef.current) {
      roomIdRef.current = docData.itemId;
      appliedRevRef.current = 0;
      publishedRevRef.current = 0;
    }
    const doc = docData.doc;
    if (!doc || doc.rev <= Math.max(appliedRevRef.current, publishedRevRef.current)) return;

    // Remote director changes first: scenario and mode recompile the
    // timeline (clock.setDuration absorbs the span), then the head follows.
    if (doc.scenarioId !== scenarioId) selectScenario(doc.scenarioId);
    if (doc.mode !== mode) setExecutionMode(doc.mode);

    const command = reconcile({
      localHeadMs: clock.time,
      localPlaying: clock.isPlaying,
      localRate: clock.playbackRate,
      broadcast: doc,
      nowMs: Date.now(),
      durationMs: clock.duration
    });
    if (command.type !== "noop") {
      if (command.type === "play") {
        clock.seek(command.headMs);
        clock.play();
      } else if (command.type === "seek") {
        clock.seek(command.headMs);
      } else if (command.type === "pause") {
        clock.pause();
      } else {
        clock.seek(command.headMs);
        clock.setRate(command.rate);
      }
    }
    appliedRevRef.current = doc.rev;
    // scenarioId/mode are read only to decide director changes, not to
    // re-run this effect — the next poll covers any lag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docData, clock]);

  const itemIdRef = useRef<string | null>(null);
  useEffect(() => {
    itemIdRef.current = docData?.itemId ?? itemIdRef.current;
  }, [docData]);

  const publishThrottleRef = useRef<{ lastAt: number; timer: number | null }>({
    lastAt: 0,
    timer: null
  });

  // A trailing throttle write must not fire after the page (or the deck that
  // owns this hook) is gone — cancel it, or it publishes for an unmounted
  // viewer and races the next mount's item id.
  useEffect(() => {
    return () => {
      if (publishThrottleRef.current.timer !== null) {
        clearTimeout(publishThrottleRef.current.timer);
        publishThrottleRef.current.timer = null;
      }
    };
  }, []);

  const publish = useCallback(
    (action: BroadcastPublishAction) => {
      if (!enabled || !ready || status !== "authenticated") return;
      const writeNow = () => {
        const doc = buildBroadcastWrite({
          current: docRef.current.doc,
          headMs: action.headMs ?? clock.time,
          playing: action.playing ?? clock.isPlaying,
          rate: action.rate ?? clock.playbackRate,
          scenarioId: action.scenarioId ?? scenarioId,
          mode: action.mode ?? mode,
          nowMs: Date.now(),
          displayName
        });
        publishedRevRef.current = doc.rev;
        publishThrottleRef.current.lastAt = Date.now();
        void writeBroadcastDoc(blocksClient, itemIdRef.current, doc)
          .then((id) => {
            if (id) itemIdRef.current = id;
            setWriteError(null);
          })
          .catch((err: unknown) => {
            setWriteError(err instanceof Error ? err.message : "Broadcast write failed");
          });
      };

      const sinceLast = Date.now() - publishThrottleRef.current.lastAt;
      if (action.force || sinceLast >= PUBLISH_THROTTLE_MS) {
        if (publishThrottleRef.current.timer !== null) {
          clearTimeout(publishThrottleRef.current.timer);
          publishThrottleRef.current.timer = null;
        }
        writeNow();
        return;
      }
      // Inside the window: schedule one trailing write at the window's end,
      // so a drag ends with the final position on the record.
      if (publishThrottleRef.current.timer !== null) return;
      publishThrottleRef.current.timer = window.setTimeout(() => {
        publishThrottleRef.current.timer = null;
        writeNow();
      }, PUBLISH_THROTTLE_MS - sinceLast);
    },
    [enabled, ready, status, clock, scenarioId, mode, displayName]
  );

  return {
    enabled,
    setEnabled: setBroadcast,
    readiness,
    broadcast: docData?.doc ?? null,
    displayName,
    writeError,
    publish
  };
}
