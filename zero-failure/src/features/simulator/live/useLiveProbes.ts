// React Query wrapper: poll the read-only probes while signed in. 60s
// refresh — connector status changes rarely; the inspector's Refresh button
// invalidates this key for immediate re-probing.

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../app/providers/AuthProvider";
import { blocksClient } from "../../../lib/blocks/client";
import { runAllProbes, type ProbeResults } from "./probes";

export const LIVE_PROBES_KEY = ["live", "probes"] as const;

export function useLiveProbes(enabled = true) {
  const { status } = useAuth();
  return useQuery<ProbeResults>({
    enabled: enabled && status === "authenticated",
    queryFn: () => runAllProbes(blocksClient),
    queryKey: LIVE_PROBES_KEY,
    refetchInterval: 60_000,
    staleTime: 30_000
  });
}
