// Procedural planet surfaces, baked once per world into offscreen canvases
// and served to the SVG layer as images. Value-noise fBm shapes terrain —
// deep lowlands through bright highlands in the world's own hue — with a
// noise-jittered polar cap and, on gas-giant worlds, latitude banding. A
// second pass bakes a horizontally-streaked cloud deck. Deterministic from
// the body's id: every viewer sees the same world.

const TEX = 192; // baked pixels; the disk displays at 88 design px
const CACHE = new Map<string, { surface: string; clouds: string }>();
const SUN_CACHE = new Map<string, string>();

/** Lattice value noise with smooth interpolation — cheap and seamless
 *  enough at these scales. */
function valueNoise(seed: number): (x: number, y: number) => number {
  const lattice = (ix: number, iy: number) => {
    let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x, y) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const a = lattice(ix, iy);
    const b = lattice(ix + 1, iy);
    const c = lattice(ix, iy + 1);
    const d = lattice(ix + 1, iy + 1);
    const ux = smooth(fx);
    const uy = smooth(fy);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };
}

function fbm(
  noise: (x: number, y: number) => number,
  x: number,
  y: number,
  octaves: number
): number {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(x * freq, y * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] =
    hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  const m = l - c / 2;
  return [Math.round((r1 + m) * 255), Math.round((g1 + m) * 255), Math.round((b1 + m) * 255)];
}

function seedOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  return h >>> 0;
}

function makeSurface(id: string, hue: number): string {
  const seed = seedOf(id);
  const noise = valueNoise(seed);
  const gasGiant = seed % 3 === 0;
  const bandFreq = 2 + (seed % 3);
  const bandPhase = (seed % 628) / 100;
  const canvas = document.createElement("canvas");
  canvas.width = TEX;
  canvas.height = TEX;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(TEX, TEX);
  const data = img.data;

  // two ramps, not one: oceans sink through their own depths and land
  // climbs through its own relief, meeting at a coastline — the crisp
  // continent/ocean split is what makes a disk read as a real world from
  // orbit. The sea tone shifts off the identity hue (direction varies per
  // world, so neighbors never converge); land carries the hue itself.
  const seaShift = seed % 2 === 0 ? -18 : 22;
  const isGas = gasGiant;
  const stops: [number, [number, number, number]][] = [
    [0.0, hslToRgb(hue + seaShift, 0.72, 0.1)],
    [0.34, hslToRgb(hue + seaShift * 0.5, 0.56, 0.19)],
    [0.5, hslToRgb(hue, 0.54, 0.36)],
    [0.66, hslToRgb(hue, 0.5, 0.47)],
    [0.82, hslToRgb(hue, 0.42, 0.6)],
    [1.0, hslToRgb(hue, 0.3, 0.72)]
  ];
  const seaStops: [number, [number, number, number]][] = [
    [0.0, hslToRgb(hue + seaShift, 0.72, 0.06)],
    [0.62, hslToRgb(hue + seaShift * 0.6, 0.6, 0.14)],
    [1.0, hslToRgb(hue + seaShift * 0.3, 0.5, 0.26)]
  ];
  const landStops: [number, [number, number, number]][] = [
    [0.0, hslToRgb(hue, 0.44, 0.3)],
    [0.55, hslToRgb(hue, 0.4, 0.43)],
    [0.8, hslToRgb(hue + 6, 0.32, 0.56)],
    [1.0, hslToRgb(hue + 10, 0.24, 0.68)]
  ];
  // per-world sea level: some worlds drown their continents, others are
  // mostly dry — varied coastlines keep the nine disks from twinning
  const coast = 0.5 + ((seed % 5) - 2) * 0.022;
  const capRgb = hslToRgb(hue, 0.12, 0.88);
  // fine soil grain: micro-contrast that breaks the smooth ramp — without
  // it the surface reads like polished glass instead of dirt and stone
  const grain = valueNoise(seed ^ 0x51f3);

  const ramp = (table: [number, [number, number, number]][], e: number): [number, number, number] => {
    for (let i = 1; i < table.length; i++) {
      const [t1, c1] = table[i]!;
      if (e <= t1) {
        const [t0, c0] = table[i - 1]!;
        const k = (e - t0) / (t1 - t0);
        return [
          Math.round(c0[0] + (c1[0] - c0[0]) * k),
          Math.round(c0[1] + (c1[1] - c0[1]) * k),
          Math.round(c0[2] + (c1[2] - c0[2]) * k)
        ];
      }
    }
    return table[table.length - 1]![1];
  };

  const sample = (e: number): [number, number, number] => {
    if (isGas) return ramp(stops, e);
    if (e < coast) return ramp(seaStops, e / coast);
    return ramp(landStops, (e - coast) / (1 - coast));
  };

  for (let py = 0; py < TEX; py++) {
    // latitude across the disk, 0 at the equator of the texture square
    const lat = (py / TEX) * 2 - 1;
    for (let px = 0; px < TEX; px++) {
      // base scale 2.6: big readable continents, octaves add the coastline
      // roughness on top; stretched hard so oceans and land truly split
      let e = fbm(noise, (px / TEX) * 2.6, (py / TEX) * 2.6, 5);
      e = Math.min(1, Math.max(0, (e - 0.5) * 2.6 + 0.5));
      if (gasGiant) {
        // latitude banding: stretch the terrain into belts and zones
        e = e * 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(lat * Math.PI * bandFreq + bandPhase + e * 2.2));
      }
      let [r, g, b] = sample(Math.min(1, Math.max(0, e)));
      // soil grain, ±8% — matte micro-texture over the smooth ramp
      const gr = 0.92 + fbm(grain, (px / TEX) * 13, (py / TEX) * 13, 2) * 0.16;
      r = Math.min(255, Math.round(r * gr));
      g = Math.min(255, Math.round(g * gr));
      b = Math.min(255, Math.round(b * gr));
      // polar cap: noise-jittered rim so the ice never reads as a stamp
      const capEdge = 0.78 + (fbm(noise, (px / TEX) * 6 + 40, lat * 3, 3) - 0.5) * 0.16;
      if (Math.abs(lat) > capEdge) {
        const k = Math.min(1, (Math.abs(lat) - capEdge) / 0.08);
        r = Math.round(r + (capRgb[0] - r) * k);
        g = Math.round(g + (capRgb[1] - g) * k);
        b = Math.round(b + (capRgb[2] - b) * k);
      }
      const o = (py * TEX + px) * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}

function makeClouds(id: string): string {
  const seed = seedOf(`${id}·clouds`);
  const noise = valueNoise(seed);
  const canvas = document.createElement("canvas");
  canvas.width = TEX;
  canvas.height = TEX;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(TEX, TEX);
  const data = img.data;
  for (let py = 0; py < TEX; py++) {
    for (let px = 0; px < TEX; px++) {
      // stretched vertically: clouds shear into trade-wind streaks. Small
      // scale + hard ramp: crisp scattered fronts, not soft fog banks —
      // a heavy white deck is what made the worlds read as frosted glass.
      const n = fbm(noise, (px / TEX) * 4.5 + 90, (py / TEX) * 9, 3);
      const a = Math.min(1, Math.max(0, (n - 0.6) / 0.16));
      const o = (py * TEX + px) * 4;
      data[o] = 246;
      data[o + 1] = 248;
      data[o + 2] = 251;
      data[o + 3] = Math.round(a * 85);
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}

/** The star's photosphere: granulation cells and burnt lanes at two
 *  noise scales, whiting out toward the disk's center like the core of
 *  a real star seen up close. Baked once — every viewer sees the same
 *  fire. */
function makeSun(): string {
  const SUN_TEX = 256;
  const noise = valueNoise(0x5eed);
  const fine = valueNoise(0x5eed ^ 0x9e37);
  const canvas = document.createElement("canvas");
  canvas.width = SUN_TEX;
  canvas.height = SUN_TEX;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(SUN_TEX, SUN_TEX);
  const data = img.data;

  // burnt lanes up through white-hot cells
  const stops: [number, [number, number, number]][] = [
    [0.0, hslToRgb(14, 0.95, 0.4)],
    [0.3, hslToRgb(26, 1.0, 0.52)],
    [0.55, hslToRgb(38, 1.0, 0.6)],
    [0.78, hslToRgb(50, 1.0, 0.76)],
    [1.0, hslToRgb(56, 1.0, 0.94)]
  ];
  const sample = (e: number): [number, number, number] => {
    for (let i = 1; i < stops.length; i++) {
      const [t1, c1] = stops[i]!;
      if (e <= t1) {
        const [t0, c0] = stops[i - 1]!;
        const k = (e - t0) / (t1 - t0);
        return [
          Math.round(c0[0] + (c1[0] - c0[0]) * k),
          Math.round(c0[1] + (c1[1] - c0[1]) * k),
          Math.round(c0[2] + (c1[2] - c0[2]) * k)
        ];
      }
    }
    return stops[stops.length - 1]![1];
  };

  for (let py = 0; py < SUN_TEX; py++) {
    for (let px = 0; px < SUN_TEX; px++) {
      // big convection cells plus fine grain, high contrast
      let g = fbm(noise, (px / SUN_TEX) * 3.5, (py / SUN_TEX) * 3.5, 5) * 0.72;
      g += fbm(fine, (px / SUN_TEX) * 11, (py / SUN_TEX) * 11, 3) * 0.28;
      g = Math.min(1, Math.max(0, (g - 0.5) * 2.6 + 0.5));
      let [r, gg, b] = sample(g);
      // the white-hot core: blend toward near-white as the disk center
      // approaches — square falloff so the mid-radius mottling survives
      const nx = (px / SUN_TEX) * 2 - 1;
      const ny = (py / SUN_TEX) * 2 - 1;
      const dist = Math.min(1, Math.hypot(nx, ny));
      const core = Math.max(0, 1 - dist / 0.62);
      const k = core * core * 0.85;
      r = Math.round(r + (250 - r) * k);
      gg = Math.round(gg + (246 - gg) * k);
      b = Math.round(b + (225 - b) * k);
      const o = (py * SUN_TEX + px) * 4;
      data[o] = r;
      data[o + 1] = gg;
      data[o + 2] = b;
      data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}

/** The world's two baked layers, cached per body. */
export function planetTextures(id: string, hue: number): { surface: string; clouds: string } {
  const key = `${id}:${hue}`;
  const hit = CACHE.get(key);
  if (hit) return hit;
  const made = { surface: makeSurface(id, hue), clouds: makeClouds(id) };
  CACHE.set(key, made);
  return made;
}

/** The star's baked photosphere, cached. */
export function sunTexture(): string {
  const hit = SUN_CACHE.get("os");
  if (hit) return hit;
  const made = makeSun();
  SUN_CACHE.set("os", made);
  return made;
}
