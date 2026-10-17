// The presentation sector: the mission's forged systems wait here as
// cards — the deck stays dark until a card is clicked. Then the cards
// step aside entirely: the page becomes that system's live show, riding
// the simulator's own player clock — planets sweep as the head plays,
// pause freezes the sky, speed scales it, scrub positions it — with the
// simulator's own TransportBar for the controls and the header's zoom
// control (or the transport's) re-homing the deck into a full-display
// overlay. Every world here speaks for itself: a click on a planet
// opens its narration console, the words written there ride the sky as
// a bubble above the speaker, and the voices take turns as the head
// runs. Nothing forged yet? The panel waits, reserved.

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Presentation as PresentationIcon, Video } from "lucide-react";
import { blocksClient } from "../../lib/blocks/client";
import { ORBIT_RINGS } from "../simulator/components/canvas/orbits";
import { TransportBar } from "../simulator/components/transport/TransportBar";
import type { Timeline } from "../simulator/engine/timeline";
import type { BroadcastActions } from "../simulator/live/broadcast/useBroadcastActions";
import { PlayerProvider, usePlayer, usePlaybackTime } from "../simulator/state/PlayerContext";
import { SettingsProvider, useSettings } from "../simulator/state/SettingsContext";
import { speak, stopSpeech } from "../simulator/state/audio";
import { resolveVoice } from "../simulator/state/voices";
import { ForgedOrbitDeck } from "../create/ForgedOrbitDeck";
import { SystemShelf } from "../create/SystemShelf";
import { DEFAULT_FORGE_ICON } from "../create/iconCatalog";
import { forgedBodyId, planetHues, SUN_ACCENT_HUE } from "../create/SystemSky";
import {
  createForgedSystem,
  forgedTree,
  loadCachedSystems,
  patchPlanetVoice,
  patchSystemMusic,
  patchSystemVoice,
  saveCachedSystems,
  sunTree,
  updateForgedSystem,
  type ForgedPlanet,
  type ForgedSystem,
  type MusicPatch,
  type VoicePatch,
} from "../create/systemsDoc";
import { useForgedSystems } from "../create/useForgedSystems";
import { DashboardRails } from "../dashboard/DashboardRails";
import { PresentationSpeechModal } from "./PresentationSpeechModal";
import { speechSpeaker } from "./speech";
import { canRecordShow, startShowRecording, type ShowRecordingHandle } from "./showRecorder";

/** The show's span: one full lap of the outermost ring — Σ reads the
 *  slowest planet's year, and scrubbing sets the sweep anywhere in it. */
const SHOW_MS = ORBIT_RINGS[ORBIT_RINGS.length - 1]!.periodMs;

/** The transport's timeline: the show has no story scenes — an empty
 *  scene table keeps the strip a plain track with a running playhead,
 *  the scrubber and clock do the rest. */
const DECK_TIMELINE: Timeline = {
  events: [],
  messages: [],
  messageWindows: [],
  sceneTable: [],
  scenes: [],
  totalMs: SHOW_MS
};

/** The soundtrack's loudness until the console says otherwise — a
 *  background presence, never a rival to the voices. */
const DEFAULT_MUSIC_VOLUME = 0.5;

/** One system's new words are persisted where every deck reads them:
 *  the gateway record updates when it exists, a fresh one is created
 *  when not, and the cache beneath both follows — the create sector's
 *  own write pattern, borrowed for narration. */
function persistSystem(updated: ForgedSystem, onItemId: (itemId: string) => void): void {
  if (updated.itemId) {
    updateForgedSystem(blocksClient, updated.itemId, updated).catch(() => undefined);
  } else {
    createForgedSystem(blocksClient, updated)
      .then((itemId) => {
        if (itemId) onItemId(itemId);
      })
      .catch(() => undefined);
  }
  // the cache mirrors the change by identity — gateway id when the
  // record has one, base and sun when it doesn't
  const same = (entry: ForgedSystem) =>
    updated.itemId
      ? entry.itemId === updated.itemId
      : !entry.itemId && entry.base === updated.base && entry.sun === updated.sun;
  const cached = loadCachedSystems();
  const merged = cached.some(same) ? cached.map((entry) => (same(entry) ? updated : entry)) : [...cached, updated];
  saveCachedSystems(merged);
}

/** The file name a saved show wears: the system's own name, URL-safe. */
const slug = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "forged-show";

/** Hand the browser a blob as a download — an anchor the document never
 *  keeps, its object URL returned a breath later. */
function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function PresentationPage() {
  const hookSystems = useForgedSystems();
  // The sector's own working copy of the deck list: narration saves
  // land here at once — the shelf and the next entry into a show speak
  // the words just written — while the hook stays read-only, its writes
  // owned by the pages that author.
  const [systems, setSystems] = useState(hookSystems);
  useEffect(() => setSystems(hookSystems), [hookSystems]);
  // The page is one thing at a time: the card shelf, or — once a card
  // is clicked — that system's show on its own player clock.
  const [selected, setSelected] = useState<ForgedSystem | null>(null);
  // A narration save: the shelf's copy and the open show move together.
  const updateSystem = (next: ForgedSystem) => {
    setSystems((prev) => prev.map((entry) => (entry === selected ? next : entry)));
    setSelected(next);
  };
  if (selected) {
    return (
      <SettingsProvider>
        <PlayerProvider duration={SHOW_MS}>
          <PresentationShow system={selected} onUpdate={updateSystem} onBack={() => setSelected(null)} />
        </PlayerProvider>
      </SettingsProvider>
    );
  }
  return (
    <div className="dash-space dash-scan-off">
      <DashboardRails active="presentation">
        <div className="dash-topbar">
          <div className="dash-topbar-side">
            <span className="dash-topbar-tag">
              <i className="dash-live-dot" aria-hidden />
              OPS // PRESENTATION
            </span>
          </div>
        </div>
        {systems.length > 0 ? (
          <SystemShelf systems={systems} onOpen={(system) => setSelected(system)} />
        ) : (
          <section className="dash-soon">
            <span className="dash-soon-glyph" aria-hidden>
              <PresentationIcon size={26} strokeWidth={1.6} />
            </span>
            <p className="dash-kicker">Sector reserved</p>
            <h2>Presentation</h2>
            <p>
              The mission&apos;s slide deck will screen here — the story, run
              outcomes and evidence, one frame at a time.
            </p>
          </section>
        )}
      </DashboardRails>
    </div>
  );
}

/** One system's show: the live deck plus the simulator's transport, both
 *  riding the same clock. The theater starts playing on entry — the sky
 *  sweeps from its base layout the moment the card opens — and every
 *  planet takes the pointer as its narration console. */
function PresentationShow({
  system,
  onUpdate,
  onBack,
}: {
  system: ForgedSystem;
  onUpdate: (next: ForgedSystem) => void;
  onBack: () => void;
}) {
  const { clock, restart, playing } = usePlayer();
  // The transport's own speaker button — narration off means the show
  // stays a silent picture, on means the levels speak aloud.
  const { narration, voice: globalVoice } = useSettings();
  // Full-display zoom: the deck re-homes into the overlay, and the page
  // beneath stops rendering its own copy — one sky in the document, one
  // frame loop, the same re-parenting discipline the canvas zoom keeps.
  const [zoomed, setZoomed] = useState(false);
  // The planet whose narration console is open; null = shut.
  const [editing, setEditing] = useState<number | null>(null);
  // The walked trail inside the open console — [] is the body itself.
  const [path, setPath] = useState<string[]>([]);
  // A world's console opens at its own body — a trail walked in an
  // earlier visit never leaks into the next.
  const openConsole = (index: number) => {
    setEditing(index);
    setPath([]);
  };
  // Each world's own hue — the modal portrait paints with the very
  // palette the sky gave the body.
  const hues = useMemo(() => planetHues(system.planets.length, system.sun), [system]);
  // StrictMode-safe autoplay: the double-mounted effect must not toggle
  // twice — the guard makes the second run a no-op.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    clock.play();
  }, [clock]);
  // The show's per-frame head — the deck's sweep time and the voices'
  // turnstile both.
  const t = usePlaybackTime();
  // The world speaking at this head moment, its own words in hand.
  const speaker = useMemo(() => speechSpeaker(system, t), [system, t]);
  // Narration speaks every turn as the head hands it the stage — the
  // level's own voice and pitch, fitted inside its bubble window. The
  // key is the turn's identity, not the object: the memo re-fires per
  // frame, and only a new turn (or a fresh play) may start an utterance.
  // Pause, narration off and unmount stop the voice at once.
  const turnRef = useRef(speaker);
  turnRef.current = speaker;
  const turnKey = speaker ? `${speaker.index}:${speaker.text}` : "";
  useEffect(() => {
    const current = turnRef.current;
    if (!current || !narration || !playing) return;
    speak(current.text, {
      playbackRate: clock.playbackRate,
      voice: resolveVoice(current.voice ?? "") ?? resolveVoice(globalVoice),
      pitch: current.pitch ?? 1,
      fitMs: current.dur,
    });
  }, [turnKey, narration, playing, clock, globalVoice]);
  useEffect(() => {
    if (!narration || !playing) stopSpeech();
  }, [narration, playing]);
  useEffect(() => () => stopSpeech(), []);
  // The show's soundtrack: the saved link rides the system, a file
  // picked this session outranks it until the tab closes — the file
  // never crosses the wire, the model keeps links alone.
  const [musicFile, setMusicFile] = useState<{ url: string; name: string } | null>(null);
  const musicFileRef = useRef<{ url: string; name: string } | null>(null);
  const musicSrc = musicFile?.url ?? system.music;
  const musicVolume = system.musicVolume ?? DEFAULT_MUSIC_VOLUME;
  // One looping audio rides the show: born and buried with it, playing
  // while the clock plays, silent when it pauses, and following the
  // console's edits — a new source swaps in mid-show, loudness applies
  // live. A browser refusing the autoplay play() stays quiet until the
  // next play press grants it.
  const musicRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const audio = new Audio();
    audio.loop = true;
    musicRef.current = audio;
    return () => {
      musicRef.current = null;
      audio.pause();
      audio.src = "";
    };
  }, []);
  useEffect(() => {
    const audio = musicRef.current;
    if (!audio) return;
    if (!musicSrc) {
      audio.pause();
      audio.removeAttribute("src");
      return;
    }
    if (audio.src !== musicSrc) audio.src = musicSrc;
    audio.volume = musicVolume;
    if (playing) audio.play().catch(() => undefined);
    else audio.pause();
  }, [musicSrc, musicVolume, playing]);
  // the session file's object URL is this show's to return
  useEffect(
    () => () => {
      if (musicFileRef.current) URL.revokeObjectURL(musicFileRef.current.url);
    },
    [],
  );
  // Plain clock calls, no room to publish — the show is this viewer's own.
  const actions = useMemo<BroadcastActions>(
    () => ({
      togglePlay: () => clock.toggle(),
      seek: (headMs) => clock.seek(headMs),
      step: (deltaMs) => clock.step(deltaMs),
      setRate: (rate) => clock.setRate(rate),
      restart,
      playUntil: (fromMs, untilMs) => clock.playUntil(fromMs, untilMs),
      selectScenario: () => {},
      rerun: () => {},
      publishMode: () => {},
      narrationPause: () => {},
      narrationResume: () => {}
    }),
    [clock, restart]
  );
  useEffect(() => {
    if (!zoomed) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setZoomed(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomed]);
  // A level's voice written, taken back, or muted: the trail picks the
  // very level — body, menu or sub-menu — and the show, gateway and
  // cache all move at once. Index -1 is the menu base's sun: an empty
  // trail is the system identity itself (its own slot in the model), a
  // walked one lands on one of the ring's menus — which is a planet.
  const saveVoice = (index: number, trail: string[], patch: VoicePatch) => {
    const menuIndex =
      index === -1 && trail.length > 0
        ? system.planets.findIndex((planet) => planet.name === trail[0])
        : -1;
    const updated =
      index === -1 && trail.length === 0
        ? patchSystemVoice(system, patch)
        : index === -1 && menuIndex === -1
          ? system
          : {
              ...system,
              planets: patchPlanetVoice(
                system.planets,
                index === -1 ? menuIndex : index,
                index === -1 ? trail.slice(1) : trail,
                patch,
              ),
            };
    onUpdate(updated);
    persistSystem(updated, (itemId) => onUpdate({ ...updated, itemId }));
  };
  // The soundtrack console's write: link and loudness land on the
  // system (the ring untouched), the picked file stays session-only
  // state beside them — and a replaced file's object URL is revoked.
  const saveMusic = (patch: MusicPatch & { file?: { url: string; name: string } | null }) => {
    if (patch.file !== undefined) {
      const next = patch.file;
      if (musicFileRef.current && musicFileRef.current.url !== next?.url) {
        URL.revokeObjectURL(musicFileRef.current.url);
      }
      musicFileRef.current = next;
      setMusicFile(next);
    }
    const systemPatch: MusicPatch = {};
    if (patch.url !== undefined) systemPatch.url = patch.url;
    if (patch.volume !== undefined) systemPatch.volume = patch.volume;
    if (Object.keys(systemPatch).length === 0) return;
    const updated = patchSystemMusic(system, systemPatch);
    onUpdate(updated);
    persistSystem(updated, (itemId) => onUpdate({ ...updated, itemId }));
  };
  // The video export: the Download press bakes one full lap of the show
  // — the deck's own sky math, the voices riding as caption bubbles,
  // the soundtrack mixed in best-effort — into a WebM the browser
  // saves. The button wears the recording's face while it runs: a live
  // press with a creeping progress fill and a blinking dot, then a
  // green Saved once the file is in hand. Leaving the show cancels.
  const [recording, setRecording] = useState<{ progress: number; saved: boolean } | null>(null);
  const recordingRef = useRef<ShowRecordingHandle | null>(null);
  useEffect(() => () => recordingRef.current?.cancel(), []);
  const beginRecording = () => {
    if (recordingRef.current) return;
    setRecording({ progress: 0, saved: false });
    const handle = startShowRecording(system, {
      showMs: SHOW_MS,
      musicSrc,
      musicVolume,
      onProgress: (fraction) =>
        setRecording((prev) => (prev && !prev.saved ? { progress: fraction, saved: false } : prev)),
      onSaved: (blob) => {
        recordingRef.current = null;
        downloadBlob(blob, `${slug(system.sun)}-show.webm`);
        setRecording({ progress: 1, saved: true });
        window.setTimeout(() => setRecording((prev) => (prev?.saved ? null : prev)), 2600);
      },
      onFailed: () => {
        recordingRef.current = null;
        setRecording(null);
      },
    });
    if (handle) recordingRef.current = handle;
    else setRecording(null);
  };
  const cancelRecording = () => {
    recordingRef.current?.cancel();
    recordingRef.current = null;
    setRecording(null);
  };
  // The console's subject: a clicked world — or, on a menu base, the
  // sun itself. Index -1 is the sun's seat: the system identity, given
  // its own words in the model, wearing the same five voice fields
  // every planet carries; its tree is the ring's menus.
  const subject: ForgedPlanet | null | undefined =
    editing === null
      ? null
      : editing === -1
        ? {
            name: system.sun,
            label: "Menu base",
            logo: { kind: "icon", icon: DEFAULT_FORGE_ICON.icon },
            speech: system.speech,
            muted: system.muted,
            avatar: system.avatar,
            voice: system.voice,
            pitch: system.pitch,
          }
        : system.planets[editing];
  return (
    <div className="dash-space dash-scan-off">
      <DashboardRails active="presentation">
        <div className="dash-topbar">
          <div className="dash-topbar-side">
            {!zoomed && (
              <button
                type="button"
                className="dash-back"
                aria-label="Back to the systems"
                title="Back to the systems"
                onClick={onBack}
              >
                <ArrowLeft size={15} aria-hidden />
              </button>
            )}
            <span className="dash-topbar-tag">
              <i className="dash-live-dot" aria-hidden />
              OPS // PRESENTATION
            </span>
          </div>
          {/* the show's video export — the topbar's right seat: a Download
              press that bakes the show into a WebM, the press itself then
              wearing the recording's face until the file lands */}
          <div className="dash-topbar-side">
            {recording ? (
              recording.saved ? (
                <span className="dash-download-btn is-saved" aria-live="polite">
                  <Check size={14} aria-hidden />
                  Saved
                </span>
              ) : (
                <button
                  type="button"
                  className="dash-download-btn is-live"
                  title="Stop and throw the recording away"
                  onClick={cancelRecording}
                >
                  <span
                    className="dash-download-fill"
                    style={{ transform: `scaleX(${recording.progress})` }}
                    aria-hidden
                  />
                  <span className="dash-download-dot" aria-hidden />
                  Recording {Math.round(recording.progress * 100)}%
                </button>
              )
            ) : (
              <button
                type="button"
                className="dash-download-btn"
                disabled={!canRecordShow}
                title={
                  canRecordShow
                    ? "Record one full lap of the show as a video"
                    : "This browser cannot record video"
                }
                onClick={beginRecording}
              >
                <Video size={14} aria-hidden />
                Download
              </button>
            )}
          </div>
        </div>
        {!zoomed && (
          <ForgedOrbitDeck
            system={system}
            t={t}
            onZoom={() => setZoomed(true)}
            skyHint="Click the sun or a planet to write what it says about itself"
            planetTitleSuffix="write its own words"
            onPlanetClick={(_, index) => openConsole(index)}
            // App base: the sun IS the center app — its seat opens the
            // center app's narration console (index 0). Menu base: the
            // sun is the system identity, and the identity now carries
            // its own words in the model — its seat opens its console
            // too (index -1).
            onSunClick={() => openConsole(system.base === "app" ? 0 : -1)}
            speaker={speaker}
          />
        )}
      </DashboardRails>
      {/* The full-display overlay: the same show, stretched to the whole
          window — the viewBox grows with the frame, so nothing crops and
          nothing distorts. The header's own seat now carries the exit
          arrow (or Esc puts it back). */}
      {zoomed && (
        <div className="dash-zoom-overlay">
          <ForgedOrbitDeck
            system={system}
            t={t}
            planetTitleSuffix="write its own words"
            onPlanetClick={(_, index) => openConsole(index)}
            onSunClick={() => openConsole(system.base === "app" ? 0 : -1)}
            speaker={speaker}
            onExitZoom={() => setZoomed(false)}
          />
        </div>
      )}
      {/* The clicked world's console — the simulator's own planet menu
          walk over the forged menus and sub-menus, and every level —
          body, menu, sub-menu — carries a narration and a mute of its
          own. Opened from the sun's seat, the console wears the sun
          itself: the fireball portrait and the fire's own accent hue,
          so the modal matches the body that was clicked. On a menu base
          the sun's seat is the system identity (index -1), whose tree
          is the ring of menus. Play hands the stage back — the show
          never stopped. */}
      {editing !== null && subject && (
        <PresentationSpeechModal
          key={`${editing}:${path.join(">")}`}
          planet={subject}
          bodyId={forgedBodyId(system.sun, subject.name)}
          hue={
            editing === -1 || (system.base === "app" && editing === 0)
              ? SUN_ACCENT_HUE
              : hues[editing]!
          }
          isSun={editing === -1 || (system.base === "app" && editing === 0)}
          // the identity's own console is no menu's console — a menu
          // base's sun with zero menus really has none yet
          bodyIsMenu={system.base === "menu" && editing !== -1}
          tree={editing === -1 ? sunTree(system) : forgedTree(subject)}
          path={path}
          onPath={setPath}
          onPlay={() => setEditing(null)}
          onSave={(text) => {
            saveVoice(editing, path, { text });
            setEditing(null);
          }}
          onRemove={() => {
            saveVoice(editing, path, { text: null });
            setEditing(null);
          }}
          onPatch={(patch) => saveVoice(editing, path, patch)}
          music={{
            url: system.music,
            fileName: musicFile?.name,
            volume: system.musicVolume ?? DEFAULT_MUSIC_VOLUME,
          }}
          onMusic={saveMusic}
          onClose={() => setEditing(null)}
        />
      )}
      {/* The simulator's own transport bar — play/pause, steps, scrub,
          speed and the zoom toggle, all riding this show's clock. */}
      <TransportBar
        timeline={DECK_TIMELINE}
        actions={actions}
        zoomed={zoomed}
        onToggleZoom={() => setZoomed((z) => !z)}
      />
    </div>
  );
}
