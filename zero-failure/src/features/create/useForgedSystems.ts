// The read side of the forge: the deck any sector can screen. Cache-first,
// so a system paints the instant the page mounts; then the gateway — the
// source of truth — replaces it when it answers. A silent gateway just
// leaves the cache up. Nothing here writes; the create sector owns that.

import { useEffect, useState } from "react";
import { blocksClient } from "../../lib/blocks/client";
import { loadCachedSystems, readForgedSystems, type ForgedSystem } from "./systemsDoc";

export function useForgedSystems(): ForgedSystem[] {
  const [systems, setSystems] = useState<ForgedSystem[]>(loadCachedSystems);
  useEffect(() => {
    let alive = true;
    readForgedSystems(blocksClient)
      .then((remote) => {
        if (alive && remote.length > 0) setSystems(remote);
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
