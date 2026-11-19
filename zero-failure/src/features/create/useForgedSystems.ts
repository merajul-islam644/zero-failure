// The read side of the forge: the deck any sector can screen. Cache-first,
// so a system paints the instant the page mounts; then the gateway — the
// source of truth — replaces it when it answers, empty answer included:
// the gateway screens each account to its own forges (row-level policy on
// the forged_system collection), so an empty list is a real answer —
// "nothing forged yet" — and adopting it drops a stale cache of other
// accounts' decks. A silent gateway just leaves the cache up. Nothing
// here writes; the create sector owns that.

import { useEffect, useState } from "react";
import { blocksClient } from "../../lib/blocks/client";
import { loadCachedSystems, readForgedSystems, type ForgedSystem } from "./systemsDoc";

export function useForgedSystems(): ForgedSystem[] {
  const [systems, setSystems] = useState<ForgedSystem[]>(loadCachedSystems);
  useEffect(() => {
    let alive = true;
    readForgedSystems(blocksClient)
      .then((remote) => {
        if (alive) setSystems(remote);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return systems;
}

/** The system to screen: the newest forge wins — the seq stamp is the
 *  deck order the create sector already keeps. */
export function latestSystem(systems: ForgedSystem[]): ForgedSystem | null {
  let best: ForgedSystem | null = null;
  for (const system of systems) {
    if (!best || (system.seq ?? 0) > (best.seq ?? 0)) best = system;
  }
  return best;
}
