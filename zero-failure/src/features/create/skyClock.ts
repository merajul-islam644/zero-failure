// One sky clock per page. Every live solar system mounted on a page —
// the presentation deck or the create sector's cards — sweeps on the
// same requestAnimationFrame loop: orbits stay in phase across
// components and the loop runs only while at least one live sky exists.
// Reduced motion never joins the loop, pinning that sky at its designed
// base layout (t = 0), exactly as the canvas does.

import { useEffect, useState } from "react";

type SkyListener = (t: number) => void;

const listeners = new Set<SkyListener>();
let raf = 0;
let start = 0;

function tick(now: number) {
  raf = window.requestAnimationFrame(tick);
  const t = now - start;
  for (const listener of listeners) listener(t);
}

/** Sky time: elapsed ms since the first live sky joined the loop. */
export function useSkyClock(reduced: boolean): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const listener: SkyListener = (now) => setT(now);
    listeners.add(listener);
    if (listeners.size === 1) {
      start = performance.now();
      raf = window.requestAnimationFrame(tick);
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) window.cancelAnimationFrame(raf);
    };
  }, [reduced]);
  return t;
}
