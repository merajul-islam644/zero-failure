// Story strip: one equal 1-inch part block per voice, tinted in the body's
// own hue. Per-frame subscriber (designated); click seeks (through the
// injected actions, so it reaches the shared head), and the part under the
// head lights up and fills with its own run line. Hovering a part floats
// the command pill
// above it — play / copy / delete / more, the node-editor pattern.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ChevronsLeft,
  ChevronsRight,
  Copy,
  EllipsisVertical,
  Lock,
  LockOpen,
  Pencil,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  Volume2,
  VolumeX
} from "lucide-react";
import { usePlayer, usePlaybackTime } from "../../state/PlayerContext";
import { formatTime } from "../../engine/format";
import type { BroadcastActions } from "../../live/broadcast/useBroadcastActions";
import type { Timeline, TimelineScene } from "../../engine/timeline";

export function TimelineStrip({
  timeline,
  actions,
  onCopyPart,
  onDeletePart,
  canDeletePart,
  onReorderPart,
  onPlayPart,
  soloKey,
  onEditPart,
  mutedKeys,
  onToggleMutePart,
  lockedKeys,
  onToggleLockPart,
  onResetOrder
}: {
  timeline: Timeline;
  actions: BroadcastActions;
  /** Copy this part — the sequencer upstream decides where the duplicate
   *  lands. Absent, the pill's copy stays disabled. */
  onCopyPart?: (scene: TimelineScene) => void;
  /** Delete this part — the sequencer upstream deletes copies only. */
  onDeletePart?: (scene: TimelineScene) => void;
  /** Whether the pill's trash may fire for this part — false (or absent)
   *  leaves the trash disabled, so an original can never be deleted. */
  canDeletePart?: (scene: TimelineScene) => boolean;
  /** Drag arranging: the strip previews the new arrangement live while the
   *  pointer moves; the drop commits exactly what the strip shows. */
  onReorderPart?: (nextOrder: string[]) => void;
  /** Play ONLY this part — its words, its bubble, then the show holds. */
  onPlayPart?: (scene: TimelineScene) => void;
  /** The part key of the solo run, when one is live — the pill's own
   *  button turns into its pause/resume while its part is that run. */
  soloKey?: string | null;
  /** The ⋮ menu's commands — absent, an item sits disabled. */
  /** Open the part's body console — the presentation's Edit speech. */
  onEditPart?: (scene: TimelineScene) => void;
  /** Part keys holding their peace; the menu flips them. */
  mutedKeys?: string[];
  onToggleMutePart?: (scene: TimelineScene) => void;
  /** Part keys refusing a drag; the menu flips them. */
  lockedKeys?: string[];
  onToggleLockPart?: (scene: TimelineScene) => void;
  /** Reset the arrangement: originals to natural order, copies trailing. */
  onResetOrder?: () => void;
}) {
  const t = usePlaybackTime();
  const { playing } = usePlayer();
  const stripRef = useRef<HTMLDivElement | null>(null);

  // The pill floats above the hovered part. It anchors to the strip itself —
  // never the scroll-clipped track — and hides on a short delay so the
  // pointer can travel the gap onto it.
  const [pill, setPill] = useState<{ scene: TimelineScene; x: number; y: number; w: number } | null>(null);
  // The ⋮ menu stands under the pill — or above it, or shifted sideways:
  // the layout pass below measures the real menu and moves it so it never
  // leaves the screen. While it stands, the pill never auto-hides — the
  // user may park the pointer anywhere and read; an outside click puts
  // the pair away, Escape closes just the menu.
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const pillRef = useRef<HTMLDivElement | null>(null);
  const hideRef = useRef<number | null>(null);
  const cancelHide = () => {
    if (hideRef.current !== null) {
      window.clearTimeout(hideRef.current);
      hideRef.current = null;
    }
  };
  const scheduleHide = () => {
    if (menu) return; // the menu holds the pill up
    cancelHide();
    hideRef.current = window.setTimeout(() => setPill(null), 140);
  };
  useEffect(() => cancelHide, []);
  const openMenu = () => {
    cancelHide();
    if (!pill) return;
    // the first guess: below the pill, centered — the measured pass flips
    // or shifts it the moment it lands
    const host = stripRef.current?.getBoundingClientRect();
    const x = host ? Math.min(Math.max(pill.x - 85, 8), Math.max(8, host.width - 178)) : pill.x - 85;
    setMenu({ x, y: pill.y + 8 });
  };
  // A proper tooltip never leaves the screen: once mounted, the menu is
  // measured and moved as a whole — below the pill when the viewport has
  // the room, above it when not, and sideways so every option stays
  // inside the window.
  useLayoutEffect(() => {
    if (!menu) return;
    const menuEl = menuRef.current;
    const pillEl = pillRef.current;
    const stripEl = stripRef.current;
    if (!menuEl || !pillEl || !stripEl) return;
    const m = menuEl.getBoundingClientRect();
    const p = pillEl.getBoundingClientRect();
    const margin = 8;
    let left = p.left + p.width / 2 - m.width / 2;
    left = Math.min(Math.max(left, margin), Math.max(margin, window.innerWidth - m.width - margin));
    let top = p.bottom + 6;
    if (top + m.height > window.innerHeight - margin) {
      const above = p.top - 6 - m.height;
      top = above >= margin ? above : Math.max(margin, window.innerHeight - m.height - margin);
    }
    const strip = stripEl.getBoundingClientRect();
    const x = Math.round(left - strip.left);
    const y = Math.round(top - strip.top);
    if (Math.abs(x - menu.x) < 1 && Math.abs(y - menu.y) < 1) return;
    setMenu({ x, y });
  }, [menu]);
  useEffect(() => {
    if (!menu) return;
    const onDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setMenu(null);
      setPill(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Capture on document: the menu is the innermost layer, so its Escape
      // must land before the drawer's bubble-phase handler — without the
      // capture + stop, a sheet behind the strip would close instead of
      // (or in addition to) the menu standing in it.
      event.stopPropagation();
      setMenu(null);
    };
    window.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [menu]);

  const showPill = (scene: TimelineScene, el: HTMLElement) => {
    cancelHide();
    setMenu(null); // another part took the pill — the old menu goes with it
    const rect = el.getBoundingClientRect();
    const host = stripRef.current?.getBoundingClientRect();
    if (!host) return;
    setPill({
      scene,
      // clamp keeps the pill inside the strip on the edge-most parts; the
      // pill never gets wider than its own part (w below)
      x: Math.min(Math.max(rect.left + rect.width / 2 - host.left, 50), host.width - 50),
      y: rect.top - host.top - 6,
      w: rect.width
    });
  };

  // Any scroll or resize un-anchors the pill from its part — hide it rather
  // than let it drift off its body.
  useEffect(() => {
    if (!pill) return;
    const onHide = () => setPill(null);
    window.addEventListener("scroll", onHide, true);
    window.addEventListener("resize", onHide);
    return () => {
      window.removeEventListener("scroll", onHide, true);
      window.removeEventListener("resize", onHide);
    };
  }, [pill]);

  const playPart = (scene: TimelineScene) => {
    // a solo play — just this part, then nothing — when the host knows how
    if (onPlayPart) {
      onPlayPart(scene);
    } else {
      actions.seek(scene.startMs + 1);
      if (!playing) actions.togglePlay();
    }
    setPill(null);
    setMenu(null);
  };

  // Drag arranging: a live sortable driven by pointer events — no HTML5
  // drag machine, so a drop can never leave the browser's drag state stuck
  // (the old "drags once, then never again" trap). Press a part, move past
  // a few pixels, and the row previews the arrangement live; release
  // commits it. The glide is FLIP: capture each block's rect before a
  // preview swap, then play the delta so the reorder reads as motion.
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<string[] | null>(null);
  const blockRefs = useRef(new Map<string, HTMLElement>());
  const rectsRef = useRef(new Map<string, DOMRect>());
  const partKeyOf = (scene: TimelineScene) => scene.partKey ?? String(scene.index);
  // the drag reads refs only, so it may cross any render boundary without
  // a stale closure
  const previewRef = useRef<string[] | null>(null);
  const dragRef = useRef<string | null>(null);
  const pressRef = useRef<{ key: string; x: number; y: number } | null>(null);
  const clickGuardRef = useRef(false);
  const reorderRef = useRef(onReorderPart);
  const sceneKeysRef = useRef<string[]>([]);
  useEffect(() => {
    reorderRef.current = onReorderPart;
    sceneKeysRef.current = timeline.scenes.map(partKeyOf);
  });
  const setArrangement = (next: string[] | null) => {
    previewRef.current = next;
    setPreview(next);
  };
  useLayoutEffect(() => {
    if (!dragKey || !preview) return;
    for (const [key, el] of blockRefs.current) {
      const prev = rectsRef.current.get(key);
      if (!prev) continue;
      const dx = prev.left - el.getBoundingClientRect().left;
      if (Math.abs(dx) < 1) continue;
      el.style.transition = "none";
      el.style.transform = `translateX(${dx}px)`;
      requestAnimationFrame(() => {
        el.style.transition = "transform 180ms ease";
        el.style.transform = "";
      });
    }
  }, [preview, dragKey]);
  const arrangeAt = (clientX: number) => {
    const current = previewRef.current;
    const key = dragRef.current;
    if (!current || !key) return;
    const others = current.filter((part) => part !== key);
    let at = others.length;
    for (let i = 0; i < others.length; i++) {
      const el = blockRefs.current.get(others[i]!);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (clientX < rect.left + rect.width / 2) {
        at = i;
        break;
      }
    }
    const next = [...others.slice(0, at), key, ...others.slice(at)];
    if (next.join("\u0000") === current.join("\u0000")) return;
    rectsRef.current.clear();
    for (const [part, el] of blockRefs.current) {
      rectsRef.current.set(part, el.getBoundingClientRect());
    }
    setArrangement(next);
  };
  // pointer handlers, mounted once: a press becomes a drag past a small
  // threshold, every move re-arranges, and the release commits exactly
  // what the strip was showing
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const press = pressRef.current;
      if (press && !dragRef.current) {
        if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < 5) return;
        dragRef.current = press.key;
        setPill(null);
        setDragKey(press.key);
        setArrangement(sceneKeysRef.current);
      }
      if (dragRef.current) arrangeAt(event.clientX);
    };
    const onUp = () => {
      const key = dragRef.current;
      pressRef.current = null;
      if (!key) return;
      dragRef.current = null;
      // glide into the committed arrangement: capture the rects, let the
      // parent reorder, and the FLIP effect plays the delta
      rectsRef.current.clear();
      for (const [part, el] of blockRefs.current) {
        rectsRef.current.set(part, el.getBoundingClientRect());
      }
      const arrangedNow = previewRef.current;
      if (arrangedNow && reorderRef.current) reorderRef.current(arrangedNow);
      clickGuardRef.current = true;
      // The drop's trailing click (same target) consumes the guard above.
      // A release off the track sends no click at all, so disarm on the
      // next task — input events dispatch before timers — or the guard
      // would eat the user's next real seek.
      window.setTimeout(() => {
        clickGuardRef.current = false;
      }, 0);
      setDragKey(null);
      setArrangement(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // arrangeAt reads refs alone — safe across renders
  }, []);

  // the parts as arranged right now (drag preview wins), plus each part's
  // copy badge and the one whose window holds the head — the part that is
  // speaking at this very moment, with how far through it the head is
  const byKey = new Map(timeline.scenes.map((scene) => [partKeyOf(scene), scene]));
  const arranged = preview
    ? preview.map((key) => byKey.get(key)).filter((scene): scene is TimelineScene => Boolean(scene))
    : timeline.scenes;
  const activeScene = arranged.find((scene) => t >= scene.startMs && t < scene.endMs) ?? null;
  const isActive = (scene: TimelineScene) =>
    activeScene !== null && partKeyOf(activeScene) === partKeyOf(scene);
  const activeProgress =
    activeScene && activeScene.endMs > activeScene.startMs
      ? Math.min(1, Math.max(0, (t - activeScene.startMs) / (activeScene.endMs - activeScene.startMs)))
      : 0;
  const totals = new Map<string, number>();
  for (const scene of arranged) {
    totals.set(scene.environment, (totals.get(scene.environment) ?? 0) + 1);
  }
  const nth = new Map<string, number>();
  const badges = new Map<string, string>();
  for (const scene of arranged) {
    const at = (nth.get(scene.environment) ?? 0) + 1;
    nth.set(scene.environment, at);
    badges.set(partKeyOf(scene), `${at}/${totals.get(scene.environment) ?? 1}`);
  }
  // the ⋮ menu's edge jumps: one click sends a part to either end of the
  // row — the same commit a drop would make, minus the drag
  const moveToEdge = (scene: TimelineScene, edge: "start" | "end") => {
    if (!onReorderPart) return;
    const key = partKeyOf(scene);
    const others = arranged.filter((entry) => partKeyOf(entry) !== key).map(partKeyOf);
    onReorderPart(edge === "start" ? [key, ...others] : [...others, key]);
    setMenu(null);
    setPill(null);
  };

  return (
    <div ref={stripRef} className="sim-strip" role="group" aria-label="Story timeline">
      <div className="sim-strip-track">
        {arranged.map((scene, orderNo) => (
          <button
            key={partKeyOf(scene)}
            ref={(el) => {
              const key = partKeyOf(scene);
              if (el) blockRefs.current.set(key, el);
              else blockRefs.current.delete(key);
            }}
            type="button"
            className="sim-strip-block"
            data-tinted={scene.hue ? "" : undefined}
            data-active={isActive(scene) ? "" : undefined}
            style={scene.hue ? ({ "--scene-hue": scene.hue } as React.CSSProperties) : undefined}
            onPointerDown={(event) => {
              if (event.pointerType !== "mouse" || event.button !== 0) return;
              if (!onReorderPart || !scene.partKey) return;
              // a locked part refuses the grab — no press, no drag
              if (lockedKeys?.includes(scene.partKey)) return;
              pressRef.current = { key: scene.partKey, x: event.clientX, y: event.clientY };
            }}
            data-dragging={dragKey === scene.partKey ? "" : undefined}
            data-muted={mutedKeys?.includes(scene.partKey ?? "") ? "" : undefined}
            data-locked={lockedKeys?.includes(scene.partKey ?? "") ? "" : undefined}
            onClick={() => {
              if (clickGuardRef.current) {
                clickGuardRef.current = false; // a drag just ended here — not a seek
                return;
              }
              actions.seek(scene.startMs + 1);
            }}
            onMouseEnter={(event) => {
              if (dragKey) return;
              showPill(scene, event.currentTarget);
            }}
            onMouseLeave={scheduleHide}
            onFocus={(event) => showPill(scene, event.currentTarget)}
            onBlur={scheduleHide}
            title={`${orderNo + 1}. ${scene.title} (${formatTime(scene.startMs)})${
              mutedKeys?.includes(scene.partKey ?? "") ? " — muted" : ""
            }${lockedKeys?.includes(scene.partKey ?? "") ? " — locked" : ""}`}
            aria-label={`Scene ${orderNo + 1}: ${scene.title}`}
          >
            {/* the mark + name on top, the part's live place in the show
                small underneath — it renumbers as a drag rearranges */}
            <span className="sim-strip-main">
              {scene.icon ? (
                <span className="sim-strip-glyph" aria-hidden>
                  {scene.icon}
                </span>
              ) : null}
              <span className="sim-strip-name">{scene.title}</span>
            </span>
            <span className="sim-strip-no">scene no - {orderNo + 1}</span>
            <span className="sim-strip-copy">{badges.get(partKeyOf(scene))}</span>
            {/* the run line: the playing part carries its own progress —
                visible on a full playthrough and a solo run alike */}
            {isActive(scene) && (
              <span
                className="sim-strip-run"
                style={{ width: `${Math.round(activeProgress * 100)}%` }}
                aria-hidden
              />
            )}
          </button>
        ))}
      </div>
      {pill && (
        <div
          ref={pillRef}
          className="sim-part-pill"
          role="toolbar"
          aria-label={`${pill.scene.title} actions`}
          style={{ left: pill.x, top: pill.y, width: pill.w }}
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
          onFocusCapture={cancelHide}
        >
          {/* the part's own play/pause: while this pill's part is the solo
              run, the same button pauses and resumes it — the pill stays
              open so the button is right under the pointer */}
          <SoloButton
            scene={pill.scene}
            solo={pill.scene.partKey !== undefined && pill.scene.partKey === soloKey}
            playing={playing}
            onToggle={() => actions.togglePlay()}
            onPlay={() => playPart(pill.scene)}
          />
          <button
            type="button"
            title={onCopyPart ? "Copy this part" : "Copy"}
            aria-label={`Copy ${pill.scene.title}`}
            disabled={!onCopyPart}
            onClick={() => {
              if (!onCopyPart) return;
              onCopyPart(pill.scene);
              setPill(null);
            }}
          >
            <Copy size={12} strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            title={
              canDeletePart?.(pill.scene)
                ? "Delete this copy"
                : "Original part — only copies can be deleted"
            }
            aria-label={`Delete ${pill.scene.title}`}
            disabled={!onDeletePart || !canDeletePart?.(pill.scene)}
            onClick={() => {
              if (!onDeletePart) return;
              onDeletePart(pill.scene);
              setPill(null);
            }}
          >
            <Trash2 size={12} strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            title="More"
            aria-label={`More on ${pill.scene.title}`}
            aria-expanded={menu ? true : undefined}
            onClick={() => (menu ? setMenu(null) : openMenu())}
          >
            <EllipsisVertical size={12} strokeWidth={2} aria-hidden />
          </button>
        </div>
      )}
      {pill && menu && (
        <div
          ref={menuRef}
          className="sim-part-menu"
          role="menu"
          aria-label={`${pill.scene.title} more actions`}
          style={{ left: menu.x, top: menu.y }}
        >
          <button
            type="button"
            role="menuitem"
            title="Open this body's narration console"
            disabled={!onEditPart || pill.scene.seat === undefined}
            onClick={() => {
              if (!onEditPart || pill.scene.seat === undefined) return;
              onEditPart(pill.scene);
              setMenu(null);
              setPill(null);
            }}
          >
            <Pencil size={12} strokeWidth={2} aria-hidden />
            Edit speech
          </button>
          <button
            type="button"
            role="menuitem"
            title={
              mutedKeys?.includes(pill.scene.partKey ?? "")
                ? "Let this part speak again"
                : "Keep the part on the strip, but silent"
            }
            disabled={!onToggleMutePart || pill.scene.partKey === undefined}
            onClick={() => {
              onToggleMutePart?.(pill.scene);
              setMenu(null);
              setPill(null);
            }}
          >
            {mutedKeys?.includes(pill.scene.partKey ?? "") ? (
              <Volume2 size={12} strokeWidth={2} aria-hidden />
            ) : (
              <VolumeX size={12} strokeWidth={2} aria-hidden />
            )}
            {mutedKeys?.includes(pill.scene.partKey ?? "") ? "Unmute this part" : "Mute this part"}
          </button>
          <button
            type="button"
            role="menuitem"
            title="Send this part to the front of the row"
            disabled={!onReorderPart}
            onClick={() => moveToEdge(pill.scene, "start")}
          >
            <ChevronsLeft size={12} strokeWidth={2} aria-hidden />
            Move to start
          </button>
          <button
            type="button"
            role="menuitem"
            title="Send this part to the end of the row"
            disabled={!onReorderPart}
            onClick={() => moveToEdge(pill.scene, "end")}
          >
            <ChevronsRight size={12} strokeWidth={2} aria-hidden />
            Move to end
          </button>
          <button
            type="button"
            role="menuitem"
            title="Duplicate this part — one copy at a time"
            disabled={!onCopyPart}
            onClick={() => {
              if (!onCopyPart) return;
              onCopyPart(pill.scene);
              setMenu(null);
              setPill(null);
            }}
          >
            <Copy size={12} strokeWidth={2} aria-hidden />
            Duplicate part
          </button>
          <button
            type="button"
            role="menuitem"
            title={
              lockedKeys?.includes(pill.scene.partKey ?? "")
                ? "Let this part be dragged again"
                : "Lock the part so a stray grab cannot drag it"
            }
            disabled={!onToggleLockPart || pill.scene.partKey === undefined}
            onClick={() => {
              onToggleLockPart?.(pill.scene);
              setMenu(null);
              setPill(null);
            }}
          >
            {lockedKeys?.includes(pill.scene.partKey ?? "") ? (
              <LockOpen size={12} strokeWidth={2} aria-hidden />
            ) : (
              <Lock size={12} strokeWidth={2} aria-hidden />
            )}
            {lockedKeys?.includes(pill.scene.partKey ?? "") ? "Unlock part" : "Lock part"}
          </button>
          <button
            type="button"
            role="menuitem"
            title="Originals back to their natural order — copies kept, trailing"
            disabled={!onResetOrder}
            onClick={() => {
              onResetOrder?.();
              setMenu(null);
              setPill(null);
            }}
          >
            <RotateCcw size={12} strokeWidth={2} aria-hidden />
            Reset arrangement
          </button>
        </div>
      )}
    </div>
  );
}

/** The pill's first button: ▶ starts a part's own run; while that run is
 *  live it reads ⏸ (pause) and, once paused, ▶ again (resume) — one
 *  button, the whole play/pause cycle of a single part. */
function SoloButton({
  scene,
  solo,
  playing,
  onToggle,
  onPlay
}: {
  scene: TimelineScene;
  solo: boolean;
  playing: boolean;
  onToggle: () => void;
  onPlay: () => void;
}) {
  const running = solo && playing;
  const label = running ? `Pause ${scene.title}` : solo ? `Resume ${scene.title}` : `Play ${scene.title}`;
  return (
    <button
      type="button"
      title={running ? "Pause this part" : solo ? "Resume this part" : "Play this part"}
      aria-label={label}
      onClick={solo ? onToggle : onPlay}
    >
      {running ? <Pause size={12} strokeWidth={2} aria-hidden /> : <Play size={12} strokeWidth={2} aria-hidden />}
    </button>
  );
}
