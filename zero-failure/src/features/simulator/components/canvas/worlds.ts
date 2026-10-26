// Deterministic world traits for the platform planets, hashed from the
// body's id: whether a small moon circles it, and how fast its cloud deck
// shuttles. The terrain itself bakes in planetTexture.ts; the settlements'
// lights place here. Every viewer sees the same worlds.

export interface WorldSpec {
  /** A small moon rides its squashed rail around the world. */
  moon: boolean;
  /** One-way cloud-deck drift duration (s). */
  cloudDur: number;
}

export interface LightSpec {
  x: number;
  y: number;
  r: number;
}

/** The sun's HSL hue trio — the literal solar amber the OS body tints
 *  every surface with (shared via --node-hue). */
export const SUN_HUE = "25 100% 55%";

/** Tiny seeded PRNG — same discipline as GalaxyLayer's field. */
function seeded(id: string): () => number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  return () => {
    h = (Math.imul(h, 1103515245) + 12345) | 0;
    return ((h >>> 16) & 1023) / 1023;
  };
}

export function worldFor(id: string): WorldSpec {
  const rnd = seeded(id);
  return {
    moon: Math.floor(rnd() * 4) === 0,
    cloudDur: 42 + rnd() * 26
  };
}

/** The settlements: two warm clusters on the night hemisphere (+x local —
 *  the shade overlay's frame, where +x points away from the sun), a bright
 *  core each with outskirt dots around it. They ride the shade's rotation,
 *  so they always glow on the dark side as the orbit carries the world. */
export function lightsFor(id: string): LightSpec[] {
  const rnd = seeded(`${id}·night`);
  const lights: LightSpec[] = [];
  for (let c = 0; c < 2; c++) {
    const cx = 15 + rnd() * 16;
    const cy = rnd() * 36 - 18;
    lights.push({ x: cx, y: cy, r: 1.3 });
    for (let i = 0; i < 3; i++) {
      lights.push({ x: cx + rnd() * 12 - 6, y: cy + rnd() * 14 - 7, r: 0.7 + rnd() * 0.5 });
    }
  }
  return lights;
}
