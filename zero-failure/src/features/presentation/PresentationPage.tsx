// The presentation sector: the mission's forged systems wait here as
// cards — the deck stays dark until a card is clicked. Then the cards
// step aside entirely: the page becomes that system's live show, riding
// the simulator's own player clock — planets sweep as the head plays,
// pause freezes the sky, speed scales it, scrub positions it — with the
// simulator's own TransportBar for the controls and the header's zoom
// control (or the transport's) re-homing the deck into a full-display
// overlay. Every world here speaks for itself: the words written for it
// ride the sky as a bubble above the speaker, and the voices take turns
// as the head runs — all of it edited from the transport's ⋮ menu, which
// opens the show's script page. Nothing forged yet? The panel waits,
// reserved.

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Presentation as PresentationIcon, Video } from "lucide-react";
import { blocksClient } from "../../lib/blocks/client";
import { ORBIT_RINGS } from "../simulator/components/canvas/orbits";
import { TransportBar } from "../simulator/components/transport/TransportBar";
import type { Timeline, TimelineScene } from "../simulator/engine/timeline";
import type { BroadcastActions } from "../simulator/live/broadcast/useBroadcastActions";
import { PlayerProvider, usePlayer, usePlaybackTime } from "../simulator/state/PlayerContext";
import { SettingsProvider, useSettings } from "../simulator/state/SettingsContext";
import { speak, stopSpeech } from "../simulator/state/audio";
import { resolveVoice } from "../simulator/state/voices";
import { ForgedOrbitDeck } from "../create/ForgedOrbitDeck";
import { SystemShelf } from "../create/SystemShelf";
import { planetHues, SUN_ACCENT_HUE } from "../create/SystemSky";
import {
  createForgedSystem,
  loadCachedSystems,
  patchPlanetVoice,
  patchSystemMusic,
  patchSystemVoice,
  saveCachedSystems,
  updateForgedSystem,
  type ForgedSystem,
  type MusicPatch,
  type VoicePatch,
} from "../create/systemsDoc";
import { useForgedSystems } from "../create/useForgedSystems";
import { DashboardRails } from "../dashboard/DashboardRails";
import { PresentationScriptPage, type ScriptPart } from "./PresentationScriptPage";
import { BREATH_MS, speechCycleMs, speechSpeaker, speechTurns } from "./speech";
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

/** The strip + speech sequencer: everything the drag order drives — the
 *  transport strip's parts, the voice seats' play order and the show's
 *  stretched span. Built once in the parent so the player's duration
 *  already covers the arranged sequence when the show mounts. */
interface Sequencer {
  timeline: Timeline;
  /** The play order as part keys — "b<i>" originals, "c<id>" copies. */
  ordered: string[];
  /** The voice seats in play order, one entry per part — the speech
   *  engine reads this, repeats and all. */
  sequence: number[];
  showMs: number;
}

/** Arrange the system's voices by the user's drag order: base parts (one
 *  per voice, natural order) with copies layered in, every part windowed
 *  by its own turns in the arranged sequence. Keys the order no longer
 *  knows trail in natural order at the end — new bodies land there, and
 *  removed ones simply drop out. */
function buildSequencer(
  system: ForgedSystem | null,
  order: string[],
  copies: { id: number; source: number }[],
): Sequencer {
  // no show open — an empty track at the natural span keeps the clock sane
  if (!system) {
    return {
      timeline: { ...DECK_TIMELINE, totalMs: SHOW_MS, scenes: [] },
      ordered: [],
      sequence: [],
      showMs: SHOW_MS,
    };
  }
  const bodyHues = planetHues(system.planets.length, system.sun);
  // an app base's center is planets[0] itself — its lead voice (seat -1)
  // and its own planet voice (seat 0) are two speeches of one body
  const seatKey = (seat: number) => (system.base === "app" && seat === -1 ? 0 : seat);
  // hues are degrees; the S/L pair is the deck's own convention
  const seatHue = (seat: number): string =>
    `${seat === -1 || (system.base === "app" && seat === 0) ? SUN_ACCENT_HUE : bodyHues[seat] ?? 215} 58% 60%`;
  // each body's own mark rides before its name on the strip
  const bodyIcon = (seat: number) => {
    const logo = system.planets[seatKey(seat)]?.logo;
    if (!logo) return undefined;
    return logo.kind === "icon" ? (
      <logo.icon size={11} strokeWidth={2} />
    ) : (
      <img src={logo.src} alt="" width={11} height={11} />
    );
  };
  // base parts in natural speech order — one per voice, chunks merged;
  // `seats` keeps each part's raw voice seat for the speech engine
  const base: TimelineScene[] = [];
  const seats: number[] = [];
  for (const turn of speechTurns(system)) {
    if (seats[seats.length - 1] === turn.index) {
      base[base.length - 1]!.endMs = turn.end; // more chunks — stretch it
      continue;
    }
    seats.push(turn.index);
    base.push({
      index: base.length + 1,
      title: turn.name,
      environment: `#${seatKey(turn.index)}`,
      startMs: turn.start,
      endMs: turn.end,
      hue: seatHue(turn.index),
      icon: bodyIcon(turn.index),
      partKey: `b${base.length}`,
      seat: seatKey(turn.index),
    });
  }
  // a part key resolves to the voice seat it speaks — a copy speaks its
  // source's seat
  const voiceOf = (key: string): number | null => {
    if (key.startsWith("b")) {
      const i = Number(key.slice(1));
      return seats[i] !== undefined ? seats[i]! : null;
    }
    const copy = copies.find((entry) => `c${entry.id}` === key);
    return copy && seats[copy.source] !== undefined ? seats[copy.source]! : null;
  };
  const known = new Set(base.map((scene) => scene.partKey!));
  for (const copy of copies) {
    if (seats[copy.source] !== undefined) known.add(`c${copy.id}`);
  }
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const key of [...order, ...base.map((scene) => scene.partKey!)]) {
    if (!known.has(key) || seen.has(key)) continue;
    seen.add(key);
    ordered.push(key);
  }
  const sequence = ordered
    .map(voiceOf)
    .filter((seat): seat is number => seat !== null);
  // one strip part per sequence position, windowed by its own turns
  const scenes: TimelineScene[] = [];
  for (const turn of speechTurns(system, sequence)) {
    const key = ordered[turn.part]!;
    const last = scenes[scenes.length - 1];
    if (last && last.partKey === key) {
      last.endMs = turn.end; // more chunks of this part — stretch it
      continue;
    }
    const i = key.startsWith("b")
      ? Number(key.slice(1))
      : copies.find((entry) => `c${entry.id}` === key)?.source;
    const source = i === undefined ? undefined : base[i];
    if (!source) continue;
    scenes.push({
      index: scenes.length + 1,
      title: source.title,
      environment: source.environment,
      startMs: turn.start,
      endMs: turn.end,
      hue: source.hue,
      icon: source.icon,
      partKey: key,
      seat: source.seat,
    });
  }
  const turns = speechTurns(system, sequence);
  const cycle = turns.length > 0 ? turns[turns.length - 1]!.end + BREATH_MS : 0;
  return {
    timeline: { ...DECK_TIMELINE, totalMs: Math.max(SHOW_MS, cycle), scenes },
    ordered,
    sequence,
    showMs: Math.max(SHOW_MS, cycle),
  };
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
  // The strip's own sequencer: the drag-arranged play order and the copies
  // made from parts. Held here so the player's duration can stretch to the
  // arranged sequence before the show ever mounts.
  const [order, setOrder] = useState<string[]>([]);
  const [copies, setCopies] = useState<{ id: number; source: number }[]>([]);
  const copyIdRef = useRef(0);
  const sequencer = useMemo(
    () => buildSequencer(selected, order, copies),
    [selected, order, copies],
  );
  // Copy a part: the duplicate lands right after the part it came from —
  // copying a copy re-wears the same source, so the chain grows freely.
  const copyPart = (scene: TimelineScene) => {
    const partKey = scene.partKey;
    if (!partKey) return;
    const source = partKey.startsWith("b")
      ? Number(partKey.slice(1))
      : copies.find((copy) => `c${copy.id}` === partKey)?.source;
    if (source === undefined) return;
    const id = ++copyIdRef.current;
    setCopies((prev) => [...prev, { id, source }]);
    const next = [...sequencer.ordered];
    next.splice(next.indexOf(partKey) + 1, 0, `c${id}`);
    setOrder(next);
  };
  // Delete a copy — originals never reach here (the pill's trash is
  // disabled for them).
  const deletePart = (scene: TimelineScene) => {
    if (!scene.partKey?.startsWith("c")) return;
    setCopies((prev) => prev.filter((copy) => `c${copy.id}` !== scene.partKey));
    setOrder((prev) => prev.filter((key) => key !== scene.partKey));
  };
  // Drag arranging: the strip previews the new arrangement live while the
  // pointer moves; the drop commits exactly what the strip is showing.
  const movePart = (nextOrder: string[]) => setOrder(nextOrder);
  // Per-part switches the ⋮ menu flips: muted parts stay on the strip but
  // hold their peace (the window still elapses, voiceless), locked parts
  // refuse a drag so a stray grab cannot rearrange the show.
  const [muted, setMuted] = useState<string[]>([]);
  const [locked, setLocked] = useState<string[]>([]);
  const toggleMutePart = (scene: TimelineScene) => {
    if (!scene.partKey) return;
    setMuted((prev) =>
      prev.includes(scene.partKey!) ? prev.filter((key) => key !== scene.partKey) : [...prev, scene.partKey!],
    );
  };
  const toggleLockPart = (scene: TimelineScene) => {
    if (!scene.partKey) return;
    setLocked((prev) =>
      prev.includes(scene.partKey!) ? prev.filter((key) => key !== scene.partKey) : [...prev, scene.partKey!],
    );
  };
  // The ⋮ menu's reset: originals return to the natural speech order and
  // the copies — kept, never lost by a reset — follow them in their own
  // order at the end.
  const resetArrangement = () => {
    const byNumber = (a: string, b: string) => Number(a.slice(1)) - Number(b.slice(1));
    const bases = sequencer.ordered.filter((key) => key.startsWith("b")).sort(byNumber);
    const copiesInOrder = sequencer.ordered.filter((key) => !key.startsWith("b"));
    setOrder([...bases, ...copiesInOrder]);
  };
  // The arrangement survives a refresh: order and copies ride localStorage
  // under the system's own key, reloaded when its show opens — the mute
  // and lock switches ride the same record.
  const sequenceKey = selected ? selected.itemId ?? selected.sun : null;
  useEffect(() => {
    if (!sequenceKey) return;
    let saved: { order?: unknown; copies?: unknown; muted?: unknown; locked?: unknown } = {};
    try {
      saved = JSON.parse(localStorage.getItem(`chokro.show.sequence.${sequenceKey}`) ?? "{}");
    } catch {
      saved = {}; // junk storage — start clean
    }
    const strList = (value: unknown) => (Array.isArray(value) ? (value as string[]) : []);
    setOrder(strList(saved.order));
    setCopies(Array.isArray(saved.copies) ? (saved.copies as { id: number; source: number }[]) : []);
    setMuted(strList(saved.muted));
    setLocked(strList(saved.locked));
    const savedCopies = Array.isArray(saved.copies) ? (saved.copies as { id: number; source: number }[]) : [];
    copyIdRef.current = savedCopies.reduce((max, copy) => Math.max(max, copy.id), 0) + 1;
  }, [sequenceKey]);
  useEffect(() => {
    if (!sequenceKey) return;
    try {
      localStorage.setItem(
        `chokro.show.sequence.${sequenceKey}`,
        JSON.stringify({ order, copies, muted, locked }),
      );
    } catch {
      // storage blocked or full — the arrangement stays session-only
    }
  }, [sequenceKey, order, copies, muted, locked]);
  if (selected) {
    return (
      <SettingsProvider>
        {/* the show stretches past one outer lap when the voices need
            longer — the speech always ends before the show does */}
        <PlayerProvider duration={sequencer.showMs}>
          <PresentationShow
            system={selected}
            onUpdate={updateSystem}
            onBack={() => setSelected(null)}
            sequencer={sequencer}
            onCopyPart={copyPart}
            onDeletePart={deletePart}
            onReorderPart={movePart}
            muted={muted}
            locked={locked}
            onToggleMute={toggleMutePart}
            onToggleLock={toggleLockPart}
            onResetOrder={resetArrangement}
          />
        </PlayerProvider>
      </SettingsProvider>
    );
  }
  return (
    <div className="dash-space">
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
 *  world's words are edited from the transport's ⋮ menu script page; no
 *  world takes the pointer anymore. */
function PresentationShow({
  system,
  onUpdate,
  onBack,
  sequencer,
  onCopyPart,
  onDeletePart,
  onReorderPart,
  muted,
  locked,
  onToggleMute,
  onToggleLock,
  onResetOrder,
}: {
  system: ForgedSystem;
  onUpdate: (next: ForgedSystem) => void;
  onBack: () => void;
  /** The drag-arranged play order — the strip, the voices and the span
   *  all ride it. */
  sequencer: Sequencer;
  onCopyPart: (scene: TimelineScene) => void;
  onDeletePart: (scene: TimelineScene) => void;
  /** The strip previews the arrangement live; the drop commits the order. */
  onReorderPart: (nextOrder: string[]) => void;
  /** Part keys holding their peace — on the strip, out of the story. */
  muted: string[];
  /** Part keys refusing a drag. */
  locked: string[];
  onToggleMute: (scene: TimelineScene) => void;
  onToggleLock: (scene: TimelineScene) => void;
  /** The ⋮ menu's reset: originals to natural order, copies trailing. */
  onResetOrder: () => void;
}) {
  const { clock, restart, playing } = usePlayer();
  // The transport's own speaker button — narration off means the show
  // stays a silent picture, on means the levels speak aloud.
  const { narration, voice: globalVoice } = useSettings();
  // Everything the arrangement drives: the strip's parts, the voice
  // seats' play order and the show's stretched span.
  const { timeline, sequence, showMs } = sequencer;
  // The transport strip is the sequencer's face: its scenes are the
  // arranged parts, each seeking and speaking in the dragged order.
  // Full-display zoom: the deck re-homes into the overlay, and the page
  // beneath stops rendering its own copy — one sky in the document, one
  // frame loop, the same re-parenting discipline the canvas zoom keeps.
  const [zoomed, setZoomed] = useState(false);
  // The ⋮ menu's Edit speech opens the whole script instead: every part
  // in play order, the part that asked focused, the rest read-only.
  // Null = shut.
  const [sheetKey, setSheetKey] = useState<string | null>(null);
  // The show opens paused — the play/pause button is the user's alone;
  // nothing here starts the clock by itself.
  // The show's per-frame head — the deck's sweep time and the voices'
  // turnstile both.
  const t = usePlaybackTime();
  // The world speaking at this head moment, its own words in hand —
  // riding the drag-arranged order like every voice on the stage. While a
  // solo part runs, no other part may take the stage, bubble or voice.
  const [solo, setSolo] = useState<{ part: number; endMs: number } | null>(null);
  const speaker = useMemo(() => {
    const hit = speechSpeaker(system, t, sequence);
    // a muted part keeps its window but holds its peace — no voice, no
    // bubble; the head simply runs through the silence
    if (hit && muted.includes(sequencer.ordered[hit.part] ?? "")) return null;
    if (solo && hit?.part !== solo.part) return null;
    // a show that was never played wears no bubble — the words ride the
    // head only while the show actually runs
    return playing ? hit : null;
  }, [system, t, sequence, solo, muted, sequencer.ordered, playing]);
  // Solo play: seek to the part, speak it alone, and when the head reaches
  // its end the show stops dead — nothing after it runs.
  const playOnePart = (scene: TimelineScene) => {
    const part = scene.partKey ? sequencer.ordered.indexOf(scene.partKey) : -1;
    if (part < 0) return;
    setSolo({ part, endMs: scene.endMs });
    actions.seek(scene.startMs + 1);
    if (!playing) actions.togglePlay();
  };
  useEffect(() => {
    if (!solo) return;
    return clock.subscribe(() => {
      if (clock.time >= solo.endMs) {
        clock.pause();
        setSolo(null);
      }
    });
  }, [clock, solo]);
  // The solo run's own part key — the strip reads it to turn the pill's
  // play button into that part's pause/resume.
  const soloKey = solo ? sequencer.ordered[solo.part] ?? null : null;
  // The ⋮ menu's Edit speech: the whole show's script opens at this part.
  const editPart = (scene: TimelineScene) => {
    if (!scene.partKey) return;
    setSheetKey(scene.partKey);
  };
  // The script thread's rows: every part in play order carrying
  // everything its level owns — the words (seat -1 is the system
  // identity's own voice), the mute, the cartoon face, the browser
  // voice and pitch — the whole console the page edits in place.
  const scriptParts = useMemo<ScriptPart[]>(
    () =>
      sequencer.timeline.scenes
        .filter((scene) => scene.partKey && scene.seat !== undefined)
        .map((scene) => {
          const level =
            scene.seat === -1 ? system : system.planets[scene.seat!];
          return {
            scene,
            text: level?.speech ?? "",
            muted: level?.muted === true,
            avatar: level?.avatar,
            voice: level?.voice,
            pitch: level?.pitch,
            copy: scene.partKey!.startsWith("c"),
          };
        }),
    [system, sequencer.timeline.scenes],
  );
  // Muted part positions — the recording skips their caption bubbles, the
  // video staying as silent in those windows as the live show is.
  const mutedParts = sequence.filter((_, i) => muted.includes(sequencer.ordered[i] ?? ""));
  // Narration speaks every turn as the head hands it the stage — the
  // level's own voice and pitch, always at natural pace. The chain is
  // voice-driven: when the voice finishes a chunk it pulls the head to
  // the turn's end, so the next chunk loads on the voice's word — the
  // clock's window is only a failsafe for a voice that never speaks.
  // The key is the turn's identity: only a new turn (or a fresh play)
  // starts an utterance. Pause, narration off and unmount stop it at once.
  const turnRef = useRef(speaker);
  turnRef.current = speaker;
  // the done-handler reads these live — a pause landing mid-utterance
  // must not advance the show nor bring the voice back
  const liveRef = useRef({ playing, narration });
  liveRef.current = { playing, narration };
  const sysRef = useRef(system);
  sysRef.current = system;
  // the done-handler re-reads the arrangement live — a drag mid-speech
  // must not pull the head into a turn list that no longer exists
  const seqRef = useRef(sequence);
  seqRef.current = sequence;
  const genRef = useRef(0);
  const turnKey = speaker ? `${speaker.index}:${speaker.part}:${speaker.text}` : "";
  useEffect(() => {
    const current = turnRef.current;
    if (!current || !narration || !playing) return;
    const gen = ++genRef.current;
    const say = (retried: boolean) =>
      speak(current.text, {
        playbackRate: clock.playbackRate,
        voice: resolveVoice(current.voice ?? "") ?? resolveVoice(globalVoice),
        pitch: current.pitch ?? 1,
        onDone: (completed) => {
          // a newer turn taking over voids this voice's vote entirely
          if (genRef.current !== gen) return;
          const live = liveRef.current;
          if (completed) {
            if (!live.playing || !live.narration || turnRef.current !== current) return;
            // find this turn in the show's cycle and jump the head to its
            // end boundary — the breath after it plays out, then the next
            // chunk's window arrives and speaks on its own
            const turns = speechTurns(sysRef.current, seqRef.current);
            if (turns.length === 0) return;
            const cycleLen = turns[turns.length - 1]!.end + BREATH_MS;
            const local = clock.time % cycleLen;
            const now = turns.find((turn) => local < turn.end);
            if (!now || now.index !== current.index || now.text !== current.text) return;
            clock.seek(clock.time - local + now.end);
            return;
          }
          // engines sometimes drop a line outright right after a cancel —
          // one quiet retry while this very turn still owns the stage
          if (!retried && live.playing && live.narration) say(true);
        },
      });
    say(false);
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
      showMs,
      sequence,
      skipParts: mutedParts,
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
  // The ⋮ menu's Edit speech turns the screen into the show's script
  // page — the whole conversation, the part that asked being edited.
  // The show itself rides on underneath, untouched. Save and patches
  // land on the part's seat; the page stays open for the next touch.
  if (sheetKey) {
    return (
      <PresentationScriptPage
        system={system}
        parts={scriptParts}
        focusKey={sheetKey}
        onSave={(scene, text) => {
          if (scene.seat !== undefined) saveVoice(scene.seat, [], { text });
        }}
        onRemove={(scene) => {
          if (scene.seat !== undefined) saveVoice(scene.seat, [], { text: null });
        }}
        onPatch={(scene, patch) => {
          if (scene.seat !== undefined) saveVoice(scene.seat, [], patch);
        }}
        music={{
          url: system.music,
          fileName: musicFile?.name,
          volume: system.musicVolume ?? DEFAULT_MUSIC_VOLUME,
        }}
        onMusic={saveMusic}
        onReorder={onReorderPart}
        onBack={() => setSheetKey(null)}
      />
    );
  }
  return (
    <div className="dash-space">
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
            playing={playing}
            onZoom={() => setZoomed(true)}
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
            playing={playing}
            speaker={speaker}
            onExitZoom={() => setZoomed(false)}
          />
        </div>
      )}
      {/* The simulator's own transport bar — play/pause, steps, scrub,
          speed and the zoom toggle, all riding this show's clock. */}
      <TransportBar
        timeline={timeline}
        actions={actions}
        zoomed={zoomed}
        onToggleZoom={() => setZoomed((z) => !z)}
        onCopyPart={onCopyPart}
        onDeletePart={onDeletePart}
        canDeletePart={(scene) => scene.partKey?.startsWith("c") === true}
        onReorderPart={onReorderPart}
        onPlayPart={playOnePart}
        soloKey={soloKey}
        onEditPart={editPart}
        mutedKeys={muted}
        onToggleMutePart={onToggleMute}
        lockedKeys={locked}
        onToggleLockPart={onToggleLock}
        onResetOrder={onResetOrder}
      />
    </div>
  );
}
