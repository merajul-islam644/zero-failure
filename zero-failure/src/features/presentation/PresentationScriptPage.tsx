// The show's script, on its own page — and every scene a full console.
// The strip's ⋮ menu "Edit speech" turns the screen into a group chat:
// every part of the arranged play order is a message bubble wearing its
// speaker's cartoon face and hue, stamped with the moment it takes the
// stage. One scene stands open at a time — the one the menu asked for
// opens with the page, opening another folds the last away — and the
// open scene carries the whole narration console: its words, mute,
// remove and save, its cartoon face, its browser voice and pitch. The
// rows reorder by dragging anywhere on them, the way the strip's parts
// do, and the show's soundtrack — one loop for the whole show — edits
// from the page's foot. A click on a world in the sky keeps its own
// per-body walk; this page is the show read as one conversation, each
// scene editable in place.

import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, Ban, ChevronDown, FolderOpen, Save, Trash2, Volume2, VolumeX } from "lucide-react";
import type { TimelineScene } from "../simulator/engine/timeline";
import type { ForgedSystem, MusicPatch, VoicePatch } from "../create/systemsDoc";
import { CAST } from "../simulator/script/cast";
import { CartoonAvatar } from "../simulator/components/canvas/CartoonAvatar";
import { useVoices } from "../simulator/state/voices";
import { DashboardRails } from "../dashboard/DashboardRails";

/** One row of the thread: the part's strip scene plus everything its
 *  level owns — the words, the mute, the cartoon face, the browser
 *  voice and pitch — and whether the part is a duplicate riding its
 *  source's voice. */
export interface ScriptPart {
  scene: TimelineScene;
  text: string;
  muted: boolean;
  avatar?: string;
  voice?: string | null;
  pitch?: number | null;
  copy: boolean;
}

/** A part's window opens at this head moment — the thread stamps each
 *  bubble with it, the way a chat marks every message. */
const stampTime = (ms: number) => {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

interface PresentationScriptPageProps {
  system: ForgedSystem;
  /** The show's parts in play order — the thread lists them as they run. */
  parts: ScriptPart[];
  /** The part key the page opened for — the scene that starts open. */
  focusKey: string;
  /** Save the open scene's words — its seat's own speech. */
  onSave: (scene: TimelineScene, text: string) => void;
  /** Take the open scene's words back — the part leaves the thread. */
  onRemove: (scene: TimelineScene) => void;
  /** A voice touch — mute, face, browser voice, pitch — landing at
   *  once, the scene staying open for the next one. */
  onPatch: (scene: TimelineScene, patch: VoicePatch) => void;
  /** The show's soundtrack as the page sees it: the saved link, the
   *  session file's name, and the loudness 0..1. */
  music: { url?: string; fileName?: string; volume: number };
  /** A soundtrack touch — a link (null clears it), a picked session
   *  file (null drops it), a loudness. */
  onMusic: (patch: MusicPatch & { file?: { url: string; name: string } | null }) => void;
  /** A drag's release: the thread's part keys in their new play
   *  order — the strip's arrangement follows. */
  onReorder: (nextOrder: string[]) => void;
  /** Back to the show. */
  onBack: () => void;
}

/** The cast faces a bubble may wear — ids the wire carries are guarded
 *  here, so a stranger record's junk avatar id never reaches the painter. */
const AVATAR_IDS = new Set<string>(CAST.map((character) => character.id));

/** The open scene's console: the very fields the per-body modal carries —
 *  words, mute, remove, save, face, voice, pitch — landed right inside
 *  the bubble. Every touch lands at once; the console stays open. */
function SceneConsole({
  part,
  draft,
  canSave,
  inputRef,
  onDraft,
  onSave,
  onRemove,
  onPatch,
  uid,
}: {
  part: ScriptPart;
  draft: string;
  canSave: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  onDraft: (text: string) => void;
  onSave: () => void;
  onRemove: () => void;
  onPatch: (patch: VoicePatch) => void;
  uid: string;
}) {
  const voices = useVoices();
  const face =
    part.avatar && AVATAR_IDS.has(part.avatar)
      ? CAST.find((character) => character.id === part.avatar)
      : undefined;
  return (
    <div className="dash-scene-console">
      <textarea
        ref={inputRef}
        className="dash-speech-input dash-chat-input"
        value={draft}
        rows={3}
        placeholder={`${part.scene.title} introduces itself…`}
        onChange={(event) => onDraft(event.target.value)}
      />
      <footer className="dash-chat-actions">
        <button
          type="button"
          className="sim-repo-disconnect"
          onClick={() => onPatch({ muted: !part.muted })}
          aria-label={part.muted ? `Unmute ${part.scene.title}` : `Mute ${part.scene.title}`}
        >
          {part.muted ? <Volume2 size={14} aria-hidden /> : <VolumeX size={14} aria-hidden />}
          {part.muted ? "Unmute" : "Mute"}
        </button>
        <button type="button" className="sim-repo-disconnect" onClick={onRemove}>
          <Trash2 size={14} aria-hidden />
          Remove narration
        </button>
        <button type="button" className="sim-report-btn" disabled={!canSave} onClick={onSave}>
          <Save size={15} aria-hidden />
          Save narration
        </button>
      </footer>
      <h4>Its face and voice</h4>
      <div className="sim-avatar-strip" role="group" aria-label={`${part.scene.title}'s cartoon face`}>
        <button
          type="button"
          className={`sim-avatar-chip sim-avatar-none${face ? "" : " is-picked"}`}
          aria-pressed={!face}
          aria-label="No cartoon — a plain text bubble"
          title="No cartoon — a plain text bubble"
          onClick={() => onPatch({ avatar: null })}
        >
          <Ban size={15} aria-hidden />
        </button>
        {CAST.map((character) => (
          <button
            key={character.id}
            type="button"
            className={`sim-avatar-chip${face?.id === character.id ? " is-picked" : ""}`}
            aria-pressed={face?.id === character.id}
            aria-label={`${character.name} face`}
            title={`${character.name} — ${character.role}`}
            onClick={() => onPatch({ avatar: character.id })}
          >
            <svg viewBox="0 0 64 64" aria-hidden>
              <CartoonAvatar character={character} mood="talk" />
            </svg>
          </button>
        ))}
      </div>
      <div className="sim-voice-row">
        <label className="sim-voice-label" htmlFor={`${uid}-voice`}>
          Voice
        </label>
        <select
          id={`${uid}-voice`}
          className="sim-voice-select"
          value={part.voice ?? "auto"}
          onChange={(event) =>
            onPatch({ voice: event.target.value === "auto" ? null : event.target.value })
          }
        >
          <option value="auto">Auto — browser default</option>
          {voices.map((entry) => (
            <option key={entry.voiceURI} value={entry.voiceURI}>
              {entry.name} ({entry.lang})
            </option>
          ))}
        </select>
      </div>
      <div className="sim-voice-row">
        <label className="sim-voice-label" htmlFor={`${uid}-pitch`}>
          Pitch
        </label>
        <input
          id={`${uid}-pitch`}
          className="sim-voice-pitch"
          type="range"
          min={0.5}
          max={1.7}
          step={0.05}
          value={part.pitch ?? 1}
          onChange={(event) => {
            const value = Number(event.target.value);
            onPatch({ pitch: value === 1 ? null : value });
          }}
        />
        <span className="sim-voice-value">{(part.pitch ?? 1).toFixed(2)}</span>
      </div>
    </div>
  );
}

/** The show's soundtrack — one loop under the whole show, edited from
 *  the page's foot: a saved link, a session file, a loudness. */
function SoundtrackCard({
  music,
  onMusic,
}: {
  music: { url?: string; fileName?: string; volume: number };
  onMusic: (patch: MusicPatch & { file?: { url: string; name: string } | null }) => void;
}) {
  const uid = useId().replace(/:/g, "");
  const [linkDraft, setLinkDraft] = useState(music.url ?? "");
  const applyLink = () => {
    const next = linkDraft.trim();
    if (next === (music.url ?? "")) return;
    onMusic({ url: next.length > 0 ? next : null });
  };
  const fileRef = useRef<HTMLInputElement | null>(null);
  return (
    <section className="dash-script-music">
      <h4>Show soundtrack</h4>
      <p className="sim-repo-drawer-hint">
        One loop of background music under the whole show — the voices speak over it. A link
        saves with the system; a file from this computer plays until the tab closes.
      </p>
      <div className="sim-voice-row">
        <label className="sim-voice-label" htmlFor={`${uid}-music-link`}>
          Link
        </label>
        <input
          id={`${uid}-music-link`}
          className="sim-music-link"
          type="url"
          value={linkDraft}
          placeholder="https://…/theme.mp3"
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => setLinkDraft(event.target.value)}
          onBlur={applyLink}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              applyLink();
            }
          }}
        />
      </div>
      <div className="sim-voice-row">
        <span className="sim-voice-label" id={`${uid}-music-file-label`}>
          File
        </span>
        <button
          type="button"
          className="sim-music-file-btn"
          aria-labelledby={`${uid}-music-file-label`}
          title="Pick an audio file from this computer"
          onClick={() => fileRef.current?.click()}
        >
          <FolderOpen size={14} aria-hidden />
          {music.fileName ? "Replace file" : "Pick a file"}
        </button>
        {music.fileName && <span className="sim-music-file-name">{music.fileName}</span>}
        <input
          ref={fileRef}
          className="sim-music-file-input"
          type="file"
          accept="audio/*"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onMusic({ file: { url: URL.createObjectURL(file), name: file.name } });
            event.target.value = "";
          }}
        />
      </div>
      <div className="sim-voice-row">
        <label className="sim-voice-label" htmlFor={`${uid}-music-volume`}>
          Volume
        </label>
        <input
          id={`${uid}-music-volume`}
          className="sim-voice-pitch"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={music.volume}
          onChange={(event) => onMusic({ volume: Number(event.target.value) })}
        />
        <span className="sim-voice-value">{Math.round(music.volume * 100)}%</span>
      </div>
      <p className="sim-repo-drawer-hint">
        {music.fileName
          ? `This session plays “${music.fileName}”.`
          : music.url
            ? "The show plays the saved link."
            : "Nothing plays yet — paste a link or pick a file."}
      </p>
    </section>
  );
}

export function PresentationScriptPage({
  system,
  parts,
  focusKey,
  onSave,
  onRemove,
  onPatch,
  music,
  onMusic,
  onReorder,
  onBack,
}: PresentationScriptPageProps) {
  // One scene stands open — the one the menu asked for opens with the
  // page; opening another folds the last away, accordion-fashion, and
  // clicking the open scene's row folds it too.
  const [openKey, setOpenKey] = useState<string | null>(focusKey);
  const toggleScene = (key: string) => setOpenKey((prev) => (prev === key ? null : key));
  // Drafts live per scene and survive a fold: come back to a scene and
  // the words you were typing are still in the box.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const openScene = parts.find((part) => part.scene.partKey === openKey) ?? null;
  const openText = openScene?.text ?? "";
  const draft = openScene ? (drafts[openScene.scene.partKey!] ?? openText) : "";
  const trimmed = draft.trim();
  const canSave = trimmed.length > 0 && trimmed !== openText.trim();
  const setDraft = (text: string) => {
    if (!openScene) return;
    const key = openScene.scene.partKey!;
    setDrafts((prev) => ({ ...prev, [key]: text }));
  };
  const saveOpen = () => {
    if (!openScene || !canSave) return;
    const key = openScene.scene.partKey!;
    onSave(openScene.scene, trimmed);
    setDrafts((prev) => ({ ...prev, [key]: trimmed }));
  };
  const removeOpen = () => {
    if (!openScene) return;
    onRemove(openScene.scene);
  };
  const patchOpen = (patch: VoicePatch) => {
    if (!openScene) return;
    onPatch(openScene.scene, patch);
  };

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const uid = useId().replace(/:/g, "");
  // The back handler rides a ref: the show behind this page re-renders
  // per frame while it plays, so a fresh onBack identity would re-run
  // the blocks below — and re-steal focus — sixty times a second.
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  // Focus lands once per open scene — the console is ready for typing —
  // and never drags the scroll along.
  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, [openKey]);
  // Escape walks back to the show, from one document listener installed
  // once per mount — stopped at the document so no window-level shortcut
  // underneath fires with it.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onBackRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  // Removing a part's last words takes the part off the thread entirely —
  // and when the thread runs empty there is nothing left to edit here:
  // walk back to the show.
  const partsCount = parts.length;
  useEffect(() => {
    if (partsCount === 0) onBackRef.current();
  }, [partsCount]);

  // The drag: rows reorder anywhere on them, the simulator strip's own
  // way — a press becomes a drag past a small threshold, every move
  // re-arranges the thread live, and the release commits exactly what
  // the page is showing. A press that landed on a real control inside
  // (the composer's textarea, its buttons, the fold chevron) belongs to
  // that control, never the drag.
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<string[] | null>(null);
  const pressRef = useRef<{ key: string; x: number; y: number } | null>(null);
  const dragRef = useRef<string | null>(null);
  const previewRef = useRef<string[] | null>(null);
  previewRef.current = preview;
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const keysNowRef = useRef<string[]>([]);
  keysNowRef.current = parts.map((part) => part.scene.partKey!);
  const reorderRef = useRef(onReorder);
  reorderRef.current = onReorder;
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const press = pressRef.current;
      if (press && !dragRef.current) {
        if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < 5) return;
        dragRef.current = press.key;
        setDragKey(press.key);
        setPreview(keysNowRef.current);
      }
      const key = dragRef.current;
      const current = previewRef.current;
      if (!key || !current) return;
      const others = current.filter((entry) => entry !== key);
      let at = others.length;
      for (let i = 0; i < others.length; i++) {
        const el = rowRefs.current.get(others[i]!);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (event.clientY < rect.top + rect.height / 2) {
          at = i;
          break;
        }
      }
      const next = [...others.slice(0, at), key, ...others.slice(at)];
      if (next.join("\u0000") === current.join("\u0000")) return;
      setPreview(next);
    };
    const onUp = () => {
      pressRef.current = null;
      const key = dragRef.current;
      if (!key) return;
      dragRef.current = null;
      const arranged = previewRef.current;
      if (arranged) reorderRef.current(arranged);
      setDragKey(null);
      setPreview(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  if (parts.length === 0) return null;
  // The rows as arranged right now — the drag preview wins over the
  // committed order while a row flies.
  const keyRank = new Map(
    (preview ?? parts.map((part) => part.scene.partKey!)).map((key, index) => [key, index]),
  );
  const shown = [...parts].sort(
    (a, b) => (keyRank.get(a.scene.partKey!) ?? 0) - (keyRank.get(b.scene.partKey!) ?? 0),
  );

  return (
    <div className="dash-space">
      <DashboardRails active="presentation">
        <div className="dash-topbar">
          <div className="dash-topbar-side">
            <button
              type="button"
              className="dash-back"
              aria-label="Back to the show"
              title="Back to the show"
              onClick={onBack}
            >
              <ArrowLeft size={15} aria-hidden />
            </button>
            <span className="dash-topbar-tag">
              <i className="dash-live-dot" aria-hidden />
              OPS // PRESENTATION
            </span>
          </div>
        </div>
        <section className="dash-script-page">
          <header className="dash-script-head">
            {/* the chat header's own face — the show's identity, named by
                its first letter the way a chat names a conversation */}
            <svg className="dash-chat-title-avatar" viewBox="-40 -40 80 80" aria-hidden>
              <circle className="sim-menu-node-halo" r={36} />
              <circle className="sim-menu-node-body" r={30} />
              <text className="dash-chat-title-initial" y={7} textAnchor="middle">
                {(system.sun[0] ?? "?").toUpperCase()}
              </text>
            </svg>
            <div>
              <h2>{system.sun}</h2>
              <p>
                {parts.length} {parts.length === 1 ? "message" : "messages"} in play order —{" "}
                {openScene
                  ? `${openScene.scene.title} is open for editing`
                  : "open a scene to edit it"}
                .
              </p>
            </div>
          </header>
          <ol
            className="dash-chat-thread"
            data-dragging={dragKey ? "" : undefined}
          >
            {shown.map((part, position) => {
              const expanded = part.scene.partKey !== null && part.scene.partKey === openKey;
              const face =
                part.avatar && AVATAR_IDS.has(part.avatar)
                  ? CAST.find((character) => character.id === part.avatar)
                  : undefined;
              return (
                <li
                  key={part.scene.partKey}
                  ref={(el) => {
                    const key = part.scene.partKey;
                    if (el && key) rowRefs.current.set(key, el);
                    else if (key) rowRefs.current.delete(key);
                  }}
                  className={`dash-chat-msg${expanded ? " is-focus" : ""}${
                    dragKey === part.scene.partKey ? " is-dragging" : ""
                  }`}
                  onPointerDown={(event) => {
                    if (event.pointerType !== "mouse" || event.button !== 0) return;
                    // a press on a real control inside — the composer's
                    // textarea, its buttons, the fold chevron — belongs
                    // to that control, never the drag
                    if (
                      event.target instanceof Element &&
                      event.target.closest("button, textarea, input, select, a")
                    ) {
                      return;
                    }
                    pressRef.current = {
                      key: part.scene.partKey!,
                      x: event.clientX,
                      y: event.clientY,
                    };
                    // the drag must not drag-select the words beneath it
                    event.preventDefault();
                  }}
                  style={{ "--node-hue": part.scene.hue ?? "232 89% 62%" } as React.CSSProperties}
                >
                  <span className="dash-chat-avatar" aria-hidden>
                    {face ? (
                      <svg viewBox="0 0 64 64">
                        <CartoonAvatar character={face} mood="talk" />
                      </svg>
                    ) : (
                      part.scene.icon ?? (
                        <span className="dash-chat-avatar-fallback">{position + 1}</span>
                      )
                    )}
                  </span>
                  <div className="dash-chat-bubble">
                    <header className="dash-chat-msg-head">
                      <span className="dash-chat-msg-name">{part.scene.title}</span>
                      {part.copy && <span className="dash-script-tag">copy</span>}
                      {expanded && <span className="dash-script-tag is-live">editing</span>}
                      <span className="dash-chat-msg-time">{stampTime(part.scene.startMs)}</span>
                      <button
                        type="button"
                        className={`dash-chat-chevron${expanded ? " is-open" : ""}`}
                        aria-expanded={expanded}
                        aria-label={
                          expanded
                            ? `Minimize ${part.scene.title}'s words`
                            : `Expand ${part.scene.title}'s words`
                        }
                        title={expanded ? "Minimize" : "Expand"}
                        onClick={() => toggleScene(part.scene.partKey!)}
                      >
                        <ChevronDown size={13} aria-hidden />
                      </button>
                    </header>
                    <div className={`dash-chat-fold${expanded ? " is-open" : ""}`}>
                      <div className="dash-chat-fold-clip">
                        {expanded ? (
                          <SceneConsole
                            part={part}
                            draft={draft}
                            canSave={canSave}
                            inputRef={inputRef}
                            onDraft={setDraft}
                            onSave={saveOpen}
                            onRemove={removeOpen}
                            onPatch={patchOpen}
                            uid={uid}
                          />
                        ) : (
                          <p className="dash-chat-text">{part.text}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          <SoundtrackCard music={music} onMusic={onMusic} />
        </section>
      </DashboardRails>
    </div>
  );
}
