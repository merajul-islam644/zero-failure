// The simulator screen — mounted at "/" behind RequireAuth. RunProvider
// pre-executes the
// selected scenario up-front; the timeline compiles from its structured
// messages, so playback is a pure fold over real results. Composes the
// engine: clock via PlayerProvider, canvas, overlay, transport,
// audio (opt-in) and the panel deck.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { userScopedKey } from "../../../shared/storage/userScope";
import type { RefObject } from "react";
import { Minimize2 } from "lucide-react";
import { SCENES } from "../script/scenes";
import { buildTimeline } from "../engine/timeline";
import type { Timeline } from "../engine/timeline";
import type { LiveActivityEvent } from "../live/activity";
import { useLiveActivity } from "../live/useLiveActivity";
import { useBroadcast } from "../live/broadcast/useBroadcast";
import { useBroadcastActions } from "../live/broadcast/useBroadcastActions";
import { PlayerProvider, usePlayer } from "../state/PlayerContext";
import { RunProvider, useRun } from "../run/RunContext";
import { SettingsProvider } from "../state/SettingsContext";
import type { OpenPlanetMenu } from "../script/platformMenus";
import { pickFiles, pickRepo, repoKey, type FilesSummary, type RepoSummary } from "../script/repoScan";
import { CommandCanvas } from "./canvas/CommandCanvas";
import { CommandRail } from "./CommandRail";
import { SceneOverlay } from "./canvas/SceneOverlay";
import { PlanetMenuModal } from "./PlanetMenuModal";
import { SimDrawer } from "./SimDrawer";
import { StatusRail } from "./StatusRail";
import { TransportBar, SPEEDS } from "./transport/TransportBar";
import { AudioLayer } from "./AudioLayer";
import { PanelDeck } from "./panels/PanelDeck";
import "../styles/simulator.css";

const SKIP_MS = 10000;

export function SimulatorPage() {
  return (
    <SettingsProvider>
      <RunProvider>
        <SimulatorScreen />
      </RunProvider>
    </SettingsProvider>
  );
}

function SimulatorScreen() {
  const { run, mode } = useRun();
  // Compiled from the pre-executed run: same envelopes the dashboard and
  // report see. Budgets depend only on the beats, so the span is identical
  // whether run has landed yet or not — the clock never jumps.
  const timeline = useMemo(() => buildTimeline(SCENES, run), [run]);
  // One live-activity instance for the whole page: it owns the 20s tenant
  // poll; the canvas and the Inspector both render from its event list.
  const activity = useLiveActivity(mode === "live");

  return (
    <PlayerProvider duration={timeline.totalMs}>
      <SimulatorStage timeline={timeline} liveEvents={activity.events} />
    </PlayerProvider>
  );
}

function SimulatorStage({ timeline, liveEvents }: { timeline: Timeline; liveEvents: LiveActivityEvent[] }) {
  const { clock, playing } = usePlayer();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef<HTMLDivElement | null>(null);
  // Zoom moves the canvas out of the stage band into a fixed full-display
  // layer. Playback never notices: clock and snapshot live in the providers,
  // and the canvas is a pure subscriber that simply re-parents.
  const [zoomed, setZoomed] = useState(false);
  const box = useMeetBox(zoomed ? zoomRef : stageRef);
  // The zoom overlay's raw size: zoom stretches the sky to the window's
  // whole shape instead of the stage band's 16:9.
  const zoomArea = useAreaSize(zoomed ? zoomRef : null);
  // Broadcast owns the room (poll + publish); actions wraps every transport
  // call so local moves reach the shared head. Off, they are plain clock
  // calls — zero behavior change.
  const broadcast = useBroadcast();
  const actions = useBroadcastActions(broadcast);

  // The planet menu modal. Lives at the stage level — not inside the
  // canvas — so a pick keeps feeding the left-rail showcase exactly as
  // the old sky fan did. Clicking a planet opens it; Escape, the ✕ or
  // the backdrop close it (the modal owns those).
  const [openMenu, setOpenMenu] = useState<OpenPlanetMenu | null>(null);
  // The rail showcase, by contrast, is a sticky mirror of the LAST
  // selection: click-away, Escape and even a full reload leave it standing
  // (localStorage) — only picking another planet or menu planet moves it.
  const [showcase, setShowcase] = useState<OpenPlanetMenu | null>(readShowcase);
  useEffect(() => {
    try {
      if (showcase) localStorage.setItem(userScopedKey(SHOWCASE_KEY), JSON.stringify(showcase));
      else localStorage.removeItem(userScopedKey(SHOWCASE_KEY));
    } catch {
      // storage unavailable (private mode etc.) — the showcase just won't
      // survive reloads; nothing else is affected
    }
  }, [showcase]);

  // Connected repositories, one local folder per level: the planet's own
  // (the menu modal's planet level) and each menu's own (the modal's
  // drill-down levels). Keys come from
  // repoKey — the planet's id, or "planet:menu>submenu" below it.
  // Session-only: a refresh detaches every repo (nothing is persisted,
  // nothing is read beyond the walk).
  const [repos, setRepos] = useState<Partial<Record<string, RepoSummary>>>({});
  // Loose-file sets, keyed the same way — leaf menus and sub-menus
  // carry them beside their folder.
  const [files, setFiles] = useState<Partial<Record<string, FilesSummary>>>({});
  // True while the laptop's folder walk is in flight — the modal's pick
  // button goes busy so a big repository never looks like a dead click.
  const [connecting, setConnecting] = useState(false);
  // Same busy idea for the loose-files picker.
  const [pickingFiles, setPickingFiles] = useState(false);
  const connectRepo = async (key: string) => {
    setConnecting(true);
    try {
      const repo = await pickRepo();
      if (!repo) return; // picker closed without a choice — nothing changes
      setRepos((prev) => ({ ...prev, [key]: repo }));
    } finally {
      setConnecting(false);
    }
  };
  const connectFiles = async (key: string) => {
    setPickingFiles(true);
    try {
      const summary = await pickFiles();
      if (!summary) return;
      setFiles((prev) => ({ ...prev, [key]: summary }));
    } finally {
      setPickingFiles(false);
    }
  };
  // A level's folder anchors the levels beneath it — letting go
  // detaches the whole subtree from both maps (menus under a planet,
  // sub-menus under a menu). Session-only, so nothing survives to
  // dangle: the tree can never hold a child whose parent is gone.
  const disconnectRepo = (key: string) => {
    setRepos((prev) => dropSubtree(prev, key));
    setFiles((prev) => dropSubtree(prev, key));
  };
  const disconnectFiles = (key: string) => {
    setFiles((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // The two flanking panels start folded — the sky owns the stage until the
  // command rail's icons unfold them (orbit = the story rail with the scene
  // heading and menu showcase, gear = the run-panel deck).
  const [railOpen, setRailOpen] = useState(false);
  const [deckOpen, setDeckOpen] = useState(false);

  function togglePlanet(id: OpenPlanetMenu["planet"]) {
    // Same planet folds the modal; a different planet is a new pick — the
    // showcase moves to it either way, and stays there when the modal closes.
    const switching = !(openMenu && openMenu.planet === id);
    setOpenMenu(switching ? { planet: id, path: [] } : null);
    if (switching) setShowcase({ planet: id, path: [] });
  }

  // A mini in the modal — menu or sub-menu: the panel walks to that
  // level (its own presentation, its own repository console) and the
  // rail showcase follows the same trail.
  function changeMenuPath(path: string[]) {
    if (!openMenu) return;
    setOpenMenu({ ...openMenu, path });
    setShowcase({ planet: openMenu.planet, path });
  }

  // Play from any modal level: the trail hands off to the showcase (the
  // rail mirrors it), the panel closes, and the show starts — the
  // transport's own play, so a broadcast room moves together. Already
  // playing? The selection just moves; the clock never double-fires.
  function playMenuLevel(planet: OpenPlanetMenu["planet"], path: string[]) {
    setShowcase({ planet, path });
    setOpenMenu(null);
    if (!playing) actions.togglePlay();
  }

  // Full playback map. Ignored while typing in form fields and never with
  // modifier keys (no hijacking browser shortcuts).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "SELECT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      switch (e.code) {
        case "Space":
          e.preventDefault();
          actions.togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          actions.step(-SKIP_MS);
          break;
        case "ArrowRight":
          e.preventDefault();
          actions.step(SKIP_MS);
          break;
        case "ArrowUp":
        case "ArrowDown": {
          e.preventDefault();
          const current = nearestSpeedIndex(clock.playbackRate);
          const next = e.code === "ArrowUp" ? current + 1 : current - 1;
          const clamped = Math.min(SPEEDS.length - 1, Math.max(0, next));
          const rate = SPEEDS[clamped];
          if (rate !== undefined) actions.setRate(rate);
          break;
        }
        case "PageDown":
        case "PageUp": {
          e.preventDefault();
          const targetMs = sceneJumpMs(timeline, clock.time, e.code === "PageDown");
          actions.seek(targetMs);
          break;
        }
        case "Home":
          e.preventDefault();
          actions.seek(0);
          break;
        case "End":
          e.preventDefault();
          actions.seek(timeline.totalMs);
          break;
        case "KeyR":
          e.preventDefault();
          actions.restart();
          break;
        case "Escape":
          if (zoomed) {
            e.preventDefault();
            setZoomed(false);
          }
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions, clock, timeline, zoomed]);

  return (
    <div className="simulator-root">
      <div className="sim-main">
        <CommandRail
          railOpen={railOpen}
          deckOpen={deckOpen}
          zoomed={zoomed}
          onToggleRail={() => setRailOpen((v) => !v)}
          onToggleDeck={() => setDeckOpen((v) => !v)}
          onToggleZoom={() => setZoomed((z) => !z)}
        />
        <main className="sim-stage">
          {/* Exactly 16:9, centered in the stage band. The scene heading and
              stage note live in the story-rail drawer — never floating over
              the constellation. */}
          <div className="sim-canvas-area" ref={stageRef}>
            {/* One canvas instance, two possible homes: the stage band, or —
                while zoomed — the fixed full-display overlay below. The swap
                is a re-parent, not a duplicate: gradients and ids stay
                unique, and only one subscriber renders per frame. */}
            {!zoomed && (
              <div className="sim-canvas-frame" style={{ width: box.w, height: box.h }}>
                <CommandCanvas
                  timeline={timeline}
                  liveEvents={liveEvents}
                  menu={openMenu}
                  onPlanetToggle={togglePlanet}
                />
              </div>
            )}
          </div>
        </main>
        {/* The story rail — the shared drawer with the scene heading, the
            stage note and the menu showcase as its content. */}
        <SimDrawer
          open={railOpen}
          label="Story rail"
          width="min(22rem, 92vw)"
          onClose={() => setRailOpen(false)}
        >
          <SceneOverlay timeline={timeline} showcase={showcase} />
        </SimDrawer>
        <PanelDeck
          timeline={timeline}
          liveEvents={liveEvents}
          actions={actions}
          open={deckOpen}
          onClose={() => setDeckOpen(false)}
        />
        <StatusRail broadcast={broadcast} onModeChange={actions.publishMode} />
      </div>
      <TransportBar
        timeline={timeline}
        actions={actions}
        zoomed={zoomed}
        onToggleZoom={() => setZoomed((z) => !z)}
      />
      {zoomed && (
        <div className="sim-zoom-overlay" ref={zoomRef}>
          <div className="sim-canvas-frame" style={{ width: zoomArea.w, height: zoomArea.h }}>
            <CommandCanvas
              timeline={timeline}
              liveEvents={liveEvents}
              aspect={zoomArea.h > 0 ? zoomArea.w / zoomArea.h : undefined}
              menu={openMenu}
              onPlanetToggle={togglePlanet}
            />
          </div>
          <button
            type="button"
            className="sim-btn sim-zoom-exit"
            onClick={() => setZoomed(false)}
            aria-label="Exit full-display zoom"
            title="Exit zoom (Esc)"
          >
            <Minimize2 size={18} aria-hidden />
          </button>
        </div>
      )}
      {/* The planet menu modal — a click on any body opens its menu and
          sub-menu planets here instead of fanning rings over the sky; the
          planet and every menu level carry their own add-repository
          section. */}
      <PlanetMenuModal
        menu={openMenu}
        repos={repos}
        files={files}
        pending={connecting}
        filePending={pickingFiles}
        onConnect={(planet, path) => connectRepo(repoKey(planet, path))}
        onDisconnect={(planet, path) => disconnectRepo(repoKey(planet, path))}
        onConnectFiles={(planet, path) => connectFiles(repoKey(planet, path))}
        onDisconnectFiles={(planet, path) => disconnectFiles(repoKey(planet, path))}
        onPath={changeMenuPath}
        onPlay={playMenuLevel}
        onClose={() => setOpenMenu(null)}
      />
      {/* Narration's audiobook pauses/resumes publish too: the presenter's
          speech rhythm is the room's rhythm, and a follower's own narration
          pause is never overridden by a stale "playing" doc mid-line. */}
      <AudioLayer
        timeline={timeline}
        onNarrationPause={actions.narrationPause}
        onNarrationResume={actions.narrationResume}
      />
    </div>
  );
}

/** The map minus a level's entry and everything beneath it — "os" also
 *  drops "os:Payments" and "os:Payments>Cards"; "os:Payments" drops only
 *  its own sub-menus. The colon and chevron suffixes keep near-miss keys
 *  ("os:Payments2") safe. */
function dropSubtree<T>(map: Partial<Record<string, T>>, key: string): Partial<Record<string, T>> {
  const next: Partial<Record<string, T>> = {};
  for (const [k, v] of Object.entries(map)) {
    if (k === key || k.startsWith(`${key}:`) || k.startsWith(`${key}>`)) continue;
    if (v) next[k] = v;
  }
  return next;
}

function nearestSpeedIndex(rate: number): number {  let best = 0;
  let bestDelta = Number.POSITIVE_INFINITY;
  SPEEDS.forEach((speed, i) => {
    const delta = Math.abs(speed - rate);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = i;
    }
  });
  return best;
}

/**
 * The stage's "xMidYMid meet" box: the largest 16:9 rectangle that fits.
 * Pure layout math via ResizeObserver — no container queries, which misresolve
 * against flex columns mid-layout. Measured in a layout effect so the first
 * paint is already correct.
 */
function useMeetBox(ref: RefObject<HTMLElement | null>): { w: number; h: number } {
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const stage = ref.current;
    if (!stage) return;
    const measure = () => {
      const { width, height } = stage.getBoundingClientRect();
      // Floor both: rounding up could exceed the stage by a pixel and spawn
      // scrollbars (margin:auto centering amplifies any excess).
      const w = Math.floor(Math.min(width, (height * 16) / 9));
      const h = Math.floor((w * 9) / 16);
      setBox((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [ref]);
  return box;
}

/** The raw measured size of the ref's element — no 16:9 clamp. Lets the
 *  zoom overlay stretch the canvas across the whole window. Null ref means
 *  "not mounted" (stage mode) and reports 0x0. */
function useAreaSize(ref: RefObject<HTMLElement | null> | null): { w: number; h: number } {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref?.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      const w = Math.floor(width);
      const h = Math.floor(height);
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/** localStorage key for the sticky rail showcase; the shape mirrors
 *  OpenPlanetMenu so MenuShowcase can walk it unchanged. */
const SHOWCASE_KEY = "zero-failure.menu-showcase";

function readShowcase(): OpenPlanetMenu | null {
  try {
    const raw = localStorage.getItem(userScopedKey(SHOWCASE_KEY));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as { planet?: unknown }).planet === "string" &&
      Array.isArray((parsed as { path?: unknown }).path)
    ) {
      const { planet, path } = parsed as { planet: string; path: unknown[] };
      return { planet: planet as OpenPlanetMenu["planet"], path: path.filter((s): s is string => typeof s === "string") };
    }
  } catch {
    // broken JSON or blocked storage — fall through to "no showcase yet"
  }
  return null;
}

/** Next/previous scene start; "previous" returns to this scene's start first. */
function sceneJumpMs(timeline: Timeline, time: number, forward: boolean): number {
  const scenes = timeline.scenes;
  if (scenes.length === 0) return time;
  let index = 0;
  for (let i = 0; i < scenes.length; i += 1) {
    const scene = scenes[i];
    if (scene && scene.startMs <= time) index = i;
    else break;
  }
  if (forward) {
    const next = scenes[index + 1];
    return next ? next.startMs : timeline.totalMs;
  }
  const scene = scenes[index];
  if (scene && time - scene.startMs > 2000) return scene.startMs;
  const previous = scenes[index - 1];
  return previous ? previous.startMs : 0;
}
