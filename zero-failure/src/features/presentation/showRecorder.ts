// One show lap, painted and recorded: a hidden 1600×900 canvas redraws
// the sky the live deck draws — the sim's own rings and Kepler periods,
// the forged cast at its real seats, the breathing star — while
// MediaRecorder turns those frames into a WebM the browser downloads.
// The speaking level's words ride the video as a caption bubble over
// its body: no browser recorder can capture the speech voices, so the
// captions carry the narration. The soundtrack, when the show has one,
// is mixed in best-effort — a link the network won't share (no CORS)
// records as silence, never as a failure.

import { ORBIT_CENTER, ORBIT_RINGS, ringPoint } from "../simulator/components/canvas/orbits";
import { orbitAngle, orbitSlots } from "../create/liveSky";
import { planetHues } from "../create/SystemSky";
import type { ForgedSystem } from "../create/systemsDoc";
import { speechSpeaker } from "./speech";

/** Can this browser record a canvas at all? */
export const canRecordShow: boolean =
  typeof MediaRecorder !== "undefined" &&
  typeof HTMLCanvasElement !== "undefined" &&
  typeof HTMLCanvasElement.prototype.captureStream === "function";

/** The stage the video paints — the deck's own design frame. */
const W = 1600;
const H = 900;

export interface ShowRecordingHandle {
  /** Stop early and throw the frames away. */
  cancel(): void;
}

export interface ShowRecordingOptions {
  /** One full lap — the outermost ring's period. */
  showMs: number;
  musicSrc?: string;
  musicVolume: number;
  onProgress: (fraction: number) => void;
  /** The lap finished — the WebM is ready to save. */
  onSaved: (blob: Blob) => void;
  /** Recording broke mid-lap (recorder error, empty capture). */
  onFailed?: () => void;
}

/** Record one full lap of the system's show. Returns null when the
 *  browser cannot record; otherwise a handle that can cancel it. */
export function startShowRecording(
  system: ForgedSystem,
  opts: ShowRecordingOptions,
): ShowRecordingHandle | null {
  if (!canRecordShow) return null;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // The cast: an app base's first app holds the center (the star wears
  // its name), every other planet rides its real seat on the real rings.
  const hues = planetHues(system.planets.length, system.sun);
  const appCenter =
    system.base === "app" && system.planets.length > 0 ? system.planets[0] : undefined;
  const centerName = appCenter ? appCenter.name : system.sun;
  const slots = orbitSlots(appCenter ? system.planets.length - 1 : system.planets.length);
  const bodies = system.planets
    .map((planet, index) => ({ planet, index }))
    .filter(({ index }) => !(appCenter && index === 0))
    .map(({ planet, index }) => {
      const slot = slots[appCenter ? index - 1 : index]!;
      return {
        index,
        name: planet.name,
        label: planet.label ?? "",
        hue: hues[index] ?? 200,
        slot,
        ring: ORBIT_RINGS[slot.ringIndex]!,
      };
    });

  // --- the deep sky, painted once, worn every frame ---------------------
  const sky = document.createElement("canvas");
  sky.width = W;
  sky.height = H;
  const sctx = sky.getContext("2d");
  if (!sctx) return null;
  sctx.fillStyle = "hsl(222 34% 4%)";
  sctx.fillRect(0, 0, W, H);
  const nebula = sctx.createRadialGradient(
    ORBIT_CENTER.x, ORBIT_CENTER.y, 40, ORBIT_CENTER.x, ORBIT_CENTER.y, 620,
  );
  nebula.addColorStop(0, "hsla(199, 95%, 58%, 0.1)");
  nebula.addColorStop(1, "hsla(199, 95%, 58%, 0)");
  sctx.fillStyle = nebula;
  sctx.fillRect(0, 0, W, H);
  // stars: seeded, so every recording wears the same sky
  let seed = 20260417;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let i = 0; i < 260; i += 1) {
    const r = rand() * 1.3 + 0.3;
    sctx.globalAlpha = rand() * 0.55 + 0.15;
    sctx.fillStyle = rand() > 0.85 ? "hsl(199 80% 75%)" : "hsl(210 30% 92%)";
    sctx.beginPath();
    sctx.arc(rand() * W, rand() * H, r, 0, Math.PI * 2);
    sctx.fill();
  }
  sctx.globalAlpha = 1;

  // --- the seat a speaker's bubble hangs over ---------------------------
  const seatOf = (index: number, t: number): { x: number; y: number } | null => {
    if (index === -1) return { ...ORBIT_CENTER };
    const body = bodies.find((entry) => entry.index === index);
    if (!body) return null;
    return ringPoint(body.slot.ringIndex, orbitAngle(body.slot, body.ring.periodMs, t));
  };

  // --- per-frame paint ---------------------------------------------------
  const drawFrame = (t: number) => {
    ctx.drawImage(sky, 0, 0);
    // the four rings, dash for dash with the live deck's
    ctx.strokeStyle = "hsla(199, 95%, 58%, 0.16)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 10]);
    for (const ring of ORBIT_RINGS) {
      ctx.beginPath();
      ctx.ellipse(ORBIT_CENTER.x, ORBIT_CENTER.y, ring.rx, ring.ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // the star: a breathing fire
    const breathe = 1 + Math.sin(t / 900) * 0.05;
    const glow = ctx.createRadialGradient(
      ORBIT_CENTER.x, ORBIT_CENTER.y, 8, ORBIT_CENTER.x, ORBIT_CENTER.y, 120 * breathe,
    );
    glow.addColorStop(0, "hsla(38, 100%, 68%, 0.95)");
    glow.addColorStop(0.25, "hsla(28, 95%, 55%, 0.55)");
    glow.addColorStop(1, "hsla(28, 95%, 50%, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(ORBIT_CENTER.x, ORBIT_CENTER.y, 120 * breathe, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "hsl(40 100% 62%)";
    ctx.beginPath();
    ctx.arc(ORBIT_CENTER.x, ORBIT_CENTER.y, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.textAlign = "center";
    ctx.fillStyle = "hsl(200 25% 82%)";
    ctx.font = '600 15px "Share Tech Mono", ui-monospace, monospace';
    ctx.fillText(centerName.toUpperCase(), ORBIT_CENTER.x, ORBIT_CENTER.y + 78);
    // the worlds, at their real seats
    for (const body of bodies) {
      const point = ringPoint(body.slot.ringIndex, orbitAngle(body.slot, body.ring.periodMs, t));
      ctx.shadowColor = `hsl(${body.hue} 58% 60%)`;
      ctx.shadowBlur = 18;
      ctx.fillStyle = `hsl(${body.hue} 58% 60%)`;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "hsla(210, 40%, 95%, 0.5)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "hsl(200 25% 82%)";
      ctx.font = '600 13px "Share Tech Mono", ui-monospace, monospace';
      ctx.fillText(body.name.toUpperCase(), point.x, point.y + 38);
      if (body.label) {
        ctx.fillStyle = "hsla(200, 20%, 70%, 0.75)";
        ctx.font = '11px "Share Tech Mono", ui-monospace, monospace';
        ctx.fillText(body.label, point.x, point.y + 54);
      }
    }
    // the speaking level's words — the video's narration
    const speaker = speechSpeaker(system, t);
    if (speaker) {
      const seat = seatOf(speaker.index, t);
      if (seat) {
        const hue =
          speaker.index === -1 || (appCenter && speaker.index === 0) ? 38 : hues[speaker.index] ?? 200;
        drawBubble(ctx, seat, speaker.name, speaker.text, hue);
      }
    }
  };

  // --- the bubble: name, words, the level's own hue ----------------------
  const drawBubble = (
    ctx: CanvasRenderingContext2D,
    seat: { x: number; y: number },
    name: string,
    text: string,
    hue: number,
  ) => {
    const padX = 18;
    const padY = 13;
    const lineH = 24;
    const nameH = 26;
    const maxTextW = 520;
    ctx.font = "500 16px system-ui, sans-serif";
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const next = line.length === 0 ? word : `${line} ${word}`;
      if (ctx.measureText(next).width > maxTextW && line.length > 0) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line.length > 0) lines.push(line);
    ctx.font = '600 13px "Share Tech Mono", ui-monospace, monospace';
    const nameW = ctx.measureText(name.toUpperCase()).width;
    let textW = 0;
    ctx.font = "500 16px system-ui, sans-serif";
    for (const entry of lines) textW = Math.max(textW, ctx.measureText(entry).width);
    const w = Math.max(nameW, textW) + padX * 2;
    const h = nameH + lines.length * lineH + padY * 2;
    let x = Math.min(Math.max(seat.x - w / 2, 12), W - w - 12);
    let y = seat.y - 78 - h;
    if (y < 12) y = seat.y + 56;
    x = Math.round(x);
    y = Math.round(y);
    // panel — a rounded rectangle drawn by hand, the one canvas call
    // older browsers never shipped
    ctx.fillStyle = "rgba(4, 10, 20, 0.92)";
    ctx.strokeStyle = `hsla(${hue}, 58%, 60%, 0.85)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 10, y);
    ctx.arcTo(x + w, y, x + w, y + h, 10);
    ctx.arcTo(x + w, y + h, x, y + h, 10);
    ctx.arcTo(x, y + h, x, y, 10);
    ctx.arcTo(x, y, x + w, y, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // the pointer toward the seat
    const tipX = Math.min(Math.max(seat.x, x + 18), x + w - 18);
    ctx.fillStyle = "rgba(4, 10, 20, 0.92)";
    ctx.beginPath();
    if (y > seat.y) {
      ctx.moveTo(tipX - 9, y);
      ctx.lineTo(tipX, y - 10);
      ctx.lineTo(tipX + 9, y);
    } else {
      ctx.moveTo(tipX - 9, y + h);
      ctx.lineTo(tipX, y + h + 10);
      ctx.lineTo(tipX + 9, y + h);
    }
    ctx.closePath();
    ctx.fill();
    // name, then the words
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = `hsl(${hue} 80% 70%)`;
    ctx.font = '600 13px "Share Tech Mono", ui-monospace, monospace';
    ctx.fillText(name.toUpperCase(), x + padX, y + padY);
    ctx.fillStyle = "hsl(206 30% 92%)";
    ctx.font = "500 16px system-ui, sans-serif";
    lines.forEach((entry, i) => {
      ctx.fillText(entry, x + padX, y + padY + nameH + i * lineH);
    });
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
  };

  // --- the recorder -------------------------------------------------------
  const mime =
    ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((candidate) =>
      MediaRecorder.isTypeSupported(candidate),
    ) ?? "";
  const stream = canvas.captureStream(30);
  const chunks: Blob[] = [];
  let cancelled = false;
  let finished = false;
  let raf = 0;
  let audioCtx: AudioContext | null = null;
  let musicEl: HTMLAudioElement | null = null;

  const cleanup = () => {
    cancelAnimationFrame(raf);
    if (musicEl) {
      musicEl.pause();
      musicEl.src = "";
      musicEl = null;
    }
    if (audioCtx) {
      void audioCtx.close().catch(() => undefined);
      audioCtx = null;
    }
    stream.getTracks().forEach((track) => track.stop());
  };

  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(
      stream,
      mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000 } : { videoBitsPerSecond: 8_000_000 },
    );
  } catch {
    cleanup();
    return null;
  }
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  recorder.onstop = () => {
    cleanup();
    if (cancelled) return;
    const blob = new Blob(chunks, { type: mime || "video/webm" });
    if (blob.size === 0) {
      opts.onFailed?.();
      return;
    }
    opts.onSaved(blob);
  };
  recorder.onerror = () => {
    cancelled = true;
    finished = true;
    cleanup();
    opts.onFailed?.();
  };

  // The lap: frames paint from the moment recording begins, progress
  // rides the same clock, and the last frame lands at one full lap.
  const start = { at: 0 };
  const frame = () => {
    const t = performance.now() - start.at;
    const clamped = Math.min(t, opts.showMs);
    drawFrame(clamped);
    opts.onProgress(clamped / opts.showMs);
    if (clamped >= opts.showMs) {
      finished = true;
      try {
        if (recorder.state !== "inactive") recorder.stop();
      } catch {
        opts.onFailed?.();
      }
      return;
    }
    raf = requestAnimationFrame(frame);
  };

  // The soundtrack rides an AudioContext into the recording — hooked
  // before the recorder starts, video-only when the link won't share.
  const hookMusic = async () => {
    if (!opts.musicSrc) return;
    try {
      const el = new Audio(opts.musicSrc);
      if (/^https?:/i.test(opts.musicSrc)) el.crossOrigin = "anonymous";
      el.loop = true;
      el.volume = Math.min(1, Math.max(0, opts.musicVolume));
      const ctxA = new AudioContext();
      await ctxA.resume().catch(() => undefined);
      const dest = ctxA.createMediaStreamDestination();
      ctxA.createMediaElementSource(el).connect(dest);
      await el.play().catch(() => undefined);
      const track = dest.stream.getAudioTracks()[0];
      if (track) stream.addTrack(track);
      audioCtx = ctxA;
      musicEl = el;
    } catch {
      // video-only — the caption bubbles carry the show regardless
    }
  };

  const begin = () => {
    if (cancelled) return;
    start.at = performance.now();
    recorder.start(1000);
    raf = requestAnimationFrame(frame);
  };

  void hookMusic().then(begin, begin);

  return {
    cancel() {
      if (cancelled) return;
      cancelled = true;
      if (!finished) {
        finished = true;
        try {
          if (recorder.state !== "inactive") recorder.stop();
        } catch {
          cleanup();
        }
      } else {
        cleanup();
      }
    },
  };
}
