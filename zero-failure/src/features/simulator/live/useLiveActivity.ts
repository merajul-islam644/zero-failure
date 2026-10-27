// Live-activity poller: while live mode is on, re-probes the tenant every 20s
// (through the shared probes query key, so the Inspector's connector table
// stays fresh off the same fetch) and accumulates what changed into a bounded
// event list. The differ itself is pure — see activity.ts. Events feed the
// canvas pulse layer and the Inspector's activity list.

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../app/providers/AuthProvider";
import { blocksClient } from "../../../lib/blocks/client";
import { diffActivity, type LiveActivityEvent } from "./activity";
import { runAllProbes, type ProbeResults } from "./probes";
import { LIVE_PROBES_KEY, useLiveProbes } from "./useLiveProbes";

const ACTIVITY_INTERVAL_MS = 20_000;
const MAX_EVENTS = 20;

export function useLiveActivity(enabled: boolean): { events: LiveActivityEvent[] } {
  const { status } = useAuth();
  // The flag rides through: simulated mode must not probe the live tenant
  // from a page that never looks at it (the inspector opens its own probe
  // query when it mounts).
  const probes = useLiveProbes(enabled);
  const queryClient = useQueryClient();
  const [events, setEvents] = useState<LiveActivityEvent[]>([]);
  // Previous observation for the differ; also which dataUpdatedAt was last
  // seen, so a poll that returns identical data doesn't re-diff.
  const prevRef = useRef<{ results?: ProbeResults; at: number }>({ at: 0 });

  const data = probes.data;
  const dataUpdatedAt = probes.dataUpdatedAt;
  useEffect(() => {
    if (!data) return;
    if (dataUpdatedAt === prevRef.current.at) return;
    const prev = prevRef.current.results;
    prevRef.current = { results: data, at: dataUpdatedAt };
    const fresh = diffActivity(prev, data, Date.now());
    if (fresh.length > 0) {
      // Newest first, bounded — the consumers show the last few.
      setEvents((current) => [...fresh, ...current].slice(0, MAX_EVENTS));
    }
  }, [data, dataUpdatedAt]);

  useEffect(() => {
    if (!enabled || status !== "authenticated") return;
    const tick = () => {
      // Skip hidden tabs — no background polling against the tenant.
      if (document.visibilityState === "hidden") return;
      void queryClient
        .fetchQuery({ queryKey: LIVE_PROBES_KEY, queryFn: () => runAllProbes(blocksClient), staleTime: 0 })
        .catch(() => undefined); // runAllProbes never rejects; belt and braces
    };
    const interval = setInterval(tick, ACTIVITY_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [enabled, status, queryClient]);

  return { events };
}
