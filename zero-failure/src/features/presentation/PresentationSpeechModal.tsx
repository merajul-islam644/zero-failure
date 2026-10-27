// One body's narration console — the simulator's planet menu modal,
// wearing the very same chrome and walking the body's forged tree the
// very same way the other deck pages do. A click on a world (or the
// app base's center sun) opens it at the body: write what this planet
// says about itself, and while the show plays it speaks those words
// above itself, one voice at a time. The menus and sub-menus beneath
// it present as the same mini-planet grid — branches descend like
// fresh dialogs (the panel is keyed by the walked path), a breadcrumb
// trail walks back up, and every level speaks in its own right: the
// narration console — words, save, remove, mute — shows up at the
// body and at every menu and sub-menu walked into. A muted level
// keeps its words written but the show keeps it quiet. Play takes
// the stage back — the console closes and the show rides on. Empty
// means the level keeps quiet. Save closes with the words live;
// remove takes them back.

import { useEffect, useId, useRef, useState } from "react";
import { Ban, FolderOpen, Play, Save, Trash2, Volume2, VolumeX, X } from "lucide-react";
import type { ForgedNode, ForgedPlanet, MusicPatch, VoicePatch } from "../create/systemsDoc";
import { ForgeBody, ForgeStar, SkyDefs, useReducedMotion } from "../create/SystemSky";
import { CAST } from "../simulator/script/cast";
import { CartoonAvatar } from "../simulator/components/canvas/CartoonAvatar";
import { useVoices } from "../simulator/state/voices";

interface PresentationSpeechModalProps {
  planet: ForgedPlanet;
  /** The body's baker id — forgedBodyId(sun, name) — so the header
   *  portrait paints with the very texture the sky baked for it. */
  bodyId: string;
  /** The planet's own numeric hue — the portrait paints with it and
   *  the panel wears it as an "H S% L%" triple through --node-hue. */
  hue: number;
  /** Set when the console opened from the sun's seat (the app base's
   *  center app): the header shows the fireball itself — no sigil, no
   *  planet terrain — so it matches the very body that was clicked. */
  isSun?: boolean;
  /** Set on a menu base, where every ring world IS a menu: sub-menus
   *  are its optional garnish, so a walk that ends at the body itself
   *  is no "no menus yet" state — the console is simply the body's. */
  bodyIsMenu?: boolean;
  /** The body's forged tree — menus (app base) or sub-menus (menu
   *  base) — walked with the same structure the other deck pages use. */
  tree: ForgedNode[];
  /** The walked trail of labels — [] is the body itself. */
  path: string[];
  /** A mini was clicked — walk the open trail down (or fold it back)
   *  to this path; the panel re-presents that level. */
  onPath: (path: string[]) => void;
  /** Play from this level — the console closes and the show rides on
   *  (it never stopped). */
  onPlay: (path: string[]) => void;
  onSave: (text: string) => void;
  onRemove: () => void;
  /** The level's own voice touches — mute, cartoon face, narration
   *  voice, pitch — each lands at once and the console stays open. */
  onPatch: (patch: VoicePatch) => void;
  /** The show's soundtrack as this console sees it: the saved link, the
   *  session file's name (a picked file outranks the link), and the
   *  loudness 0..1. One loop for the whole show, edited from any
   *  level's console. */
  music: { url?: string; fileName?: string; volume: number };
  /** A soundtrack touch — a link (null clears it), a picked session
   *  file (null drops it), a loudness. Each lands at once. */
  onMusic: (patch: MusicPatch & { file?: { url: string; name: string } | null }) => void;
  onClose: () => void;
}

/** The cast faces the picker offers — ids are guarded here too, so a
 *  stranger record's junk avatar id falls back to no face at all. */
const AVATAR_IDS = new Set<string>(CAST.map((character) => character.id));

export function PresentationSpeechModal({
  planet,
  bodyId,
  hue,
  isSun,
  bodyIsMenu,
  tree,
  path,
  onPath,
  onPlay,
  onSave,
  onRemove,
  onPatch,
  music,
  onMusic,
  onClose,
}: PresentationSpeechModalProps) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  // Walk the open path down to the level on display — each walked label
  // becomes a breadcrumb chip, and each walked node becomes the panel's
  // next subject.
  const crumbs: string[] = [];
  const crumbNodes: ForgedNode[] = [];
  let level = tree;
  for (const label of path) {
    const node = level.find((entry) => entry.label === label);
    if (!node) break;
    crumbs.push(label);
    crumbNodes.push(node);
    level = node.children;
  }
  const subjectNode = crumbNodes[crumbNodes.length - 1] ?? null;
  const subjectTitle = subjectNode ? subjectNode.label : planet.name;
  // The level's own voice: the walked node's when one is open, the
  // body's at its own level — words and mute both live on the level.
  const currentSpeech = (subjectNode ? subjectNode.speech : planet.speech) ?? "";
  const muted = (subjectNode ? subjectNode.muted : planet.muted) === true;
  // The level's face and voice: the cartoon that speaks its bubble and
  // the browser voice (and pitch) that reads it aloud.
  const rawAvatar = subjectNode ? subjectNode.avatar : planet.avatar;
  const currentAvatar = rawAvatar && AVATAR_IDS.has(rawAvatar) ? rawAvatar : undefined;
  const currentVoice = subjectNode ? subjectNode.voice : planet.voice;
  const currentPitch = subjectNode ? subjectNode.pitch : planet.pitch;
  // The installed narration voices — English first, then alphabetical.
  const voices = useVoices();
  // The draft starts at what the level already says, so the console is
  // always an edit of the truth — never a blank page over it.
  const [draft, setDraft] = useState(currentSpeech);
  // The header body's own gradient/clip ids, and the moon's respect
  // for the viewer's reduced-motion setting.
  const uid = useId().replace(/:/g, "");
  const reduced = useReducedMotion();

  // The close handler rides a ref: the show re-renders per frame (the
  // sky keeps sweeping behind the console), so a fresh onClose identity
  // would re-run the blocks below — and re-steal focus — sixty times a
  // second, dragging the scrolling panel back to the textarea and out
  // from under the close button's click.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // Focus moves once per walked level — never per frame — and never
  // drags the panel's scroll along: the body level starts typing at
  // once, a walked level starts from the panel, where the keyboard walk
  // begins.
  useEffect(() => {
    if (path.length === 0) inputRef.current?.focus({ preventScroll: true });
    else panelRef.current?.focus({ preventScroll: true });
  }, [path]);
  // Escape closes the console from one document listener, installed
  // once per mount — not once per frame the show renders.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Document fires before any window-level shortcuts — stop here so
        // closing the console never also fires something beneath it.
        event.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // An empty draft has nothing to say and nothing new is no save —
  // removing is its own button.
  const trimmed = draft.trim();
  const canSave = trimmed.length > 0 && trimmed !== currentSpeech.trim();

  // The soundtrack's link field: seeded from the saved link, applied on
  // Enter or on leaving the field — and only when it truly changed, so
  // a per-frame re-render never writes a phantom save.
  const [linkDraft, setLinkDraft] = useState(music.url ?? "");
  const applyLink = () => {
    const next = linkDraft.trim();
    if (next === (music.url ?? "")) return;
    onMusic({ url: next.length > 0 ? next : null });
  };
  // The file picker's hidden input — the visible button clicks it.
  const fileRef = useRef<HTMLInputElement | null>(null);

  // A mini's glyph: the shelf icon the forge stamped on the node, or
  // the uploaded image — both inside the sim modal's own glyph box.
  const glyph = (logo: ForgedNode["logo"]) =>
    logo.kind === "icon" ? (
      <logo.icon size={20} strokeWidth={1.8} />
    ) : (
      <image href={logo.src} x={-10} y={-10} width={20} height={20} preserveAspectRatio="xMidYMid meet" />
    );

  return (
    <div className="sim-menu-modal dash-speech-modal">
      <button
        type="button"
        className="sim-menu-modal-backdrop"
        aria-label="Close the narration console"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        key={`${planet.name}:${path.join(">")}`}
        className="sim-menu-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={subjectNode ? `${subjectTitle} menu` : `${subjectTitle} — narration console`}
        tabIndex={-1}
        ref={panelRef}
        style={{ "--node-hue": `${hue} 58% 60%` } as React.CSSProperties}
      >
        <header className="sim-menu-modal-head">
          {subjectNode ? (
            /* Inside the tree the subject flips to the walked menu: the
                header wears its logo on a mini-planet disc and the grid
                shows its sub-menus — every level presents like its own
                console. */
            <svg className="sim-menu-modal-planet" viewBox="-40 -40 80 80" aria-hidden>
              <circle className="sim-menu-node-halo" r={36} />
              <circle className="sim-menu-node-body" r={30} />
              <g className="sim-menu-node-glyph" transform="translate(-10 -10)">
                {glyph(subjectNode.logo)}
              </g>
            </svg>
          ) : (
            /* the real body itself, as the sky paints it — the fireball
                when the seat is the sun's, a world otherwise */
            <svg className="sim-menu-modal-planet" viewBox="-58 -58 116 116" aria-hidden>
              <SkyDefs uid={uid} />
              {isSun ? (
                /* scaled so the ball and its halo fill the thumb the way
                    a planet does — the glow reaches the frame's edge */
                <ForgeStar uid={uid} scale={0.38} />
              ) : (
                <ForgeBody
                  uid={uid}
                  bodyId={bodyId}
                  hue={hue}
                  logo={planet.logo}
                  bearing={0}
                  scale={1}
                  reduced={reduced}
                />
              )}
            </svg>
          )}
          <div className="sim-menu-modal-title">
            <h3>{subjectTitle}</h3>
            <p>
              {subjectNode
                ? `${planet.name} — sub-menu`
                : tree.length > 0
                  ? `${planet.label ? `${planet.label} · ` : ""}${tree.length} ${tree.length === 1 ? "menu" : "menus"}`
                  : `${planet.label ? `${planet.label} · ` : ""}What it says about itself, in its own voice`}
            </p>
          </div>
          {/* the level's play action, the sim modal's own seat — here the
              show is already running, so play simply hands the stage back */}
          <button
            type="button"
            className="sim-menu-modal-play"
            onClick={() => onPlay(path)}
            aria-label={`Play ${subjectTitle}`}
          >
            <Play size={14} aria-hidden />
            Play
          </button>
          <button type="button" className="sim-menu-modal-close" onClick={onClose} aria-label="Close the narration console">
            <X size={16} aria-hidden />
          </button>
        </header>

        {crumbs.length > 0 && (
          <nav className="sim-menu-modal-crumbs" aria-label="Menu trail">
            <button type="button" onClick={() => onPath([])}>
              {planet.name}
            </button>
            {crumbs.map((label, depth) => {
              const last = depth === crumbs.length - 1;
              return (
                <span key={label} className="sim-menu-modal-crumb-step">
                  <span aria-hidden>›</span>
                  {last ? (
                    <span aria-current="location">{label}</span>
                  ) : (
                    <button type="button" onClick={() => onPath(path.slice(0, depth + 1))}>
                      {label}
                    </button>
                  )}
                </span>
              );
            })}
          </nav>
        )}

        {level.length > 0 ? (
          <ul className="sim-menu-modal-grid">
            {level.map((node, index) => {
              const subs = node.children.length;
              return (
                <li key={`${node.label}:${index}`}>
                  <button
                    type="button"
                    className="sim-menu-modal-item"
                    onClick={() => onPath([...path.slice(0, crumbs.length), node.label])}
                    aria-label={`${node.label} — opens its level`}
                  >
                    <svg viewBox="-40 -40 80 80" aria-hidden>
                      <circle className="sim-menu-node-halo" r={36} />
                      <circle className="sim-menu-node-body" r={30} />
                      <g className="sim-menu-node-glyph" transform="translate(-10 -10)">
                        {glyph(node.logo)}
                      </g>
                    </svg>
                    <span className="sim-menu-modal-item-name">{node.label}</span>
                    {/* the menu's own census — how many sub-menus it holds */}
                    {subs > 0 && (
                      <span className="sim-menu-modal-item-count">
                        {subs} {subs === 1 ? "sub" : "subs"}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          // The walk ended on a level with nothing nested — the console
          // below is the body. The quiet "no menus" copy belongs to the
          // app base's bare world alone: a menu base's body IS a menu,
          // and a menu without sub-menus is simply a menu.
          !subjectNode && !bodyIsMenu && <p className="sim-menu-modal-empty">No menus yet</p>
        )}

        {/* The level's console: every level speaks in its own right —
            the body, each menu, each sub-menu. Words written here
            belong to this very level, and the mute keeps the show from
            speaking them without taking them away. */}
        <section className="sim-menu-modal-repo">
          <h4>Its narration</h4>
          <p className="sim-repo-drawer-hint">
            {subjectNode
              ? `Write ${subjectTitle}'s own words — the show speaks them from ${planet.name}'s seat in the sky.`
              : "Write this world's own words. While the show plays it speaks them above itself, and the voices take turns. Left empty, it keeps quiet."}
          </p>
          {muted && (
            <p className="sim-repo-drawer-hint">
              Its voice is muted — the words stay written, but the show keeps it quiet.
            </p>
          )}
          <textarea
            ref={inputRef}
            className="dash-speech-input"
            value={draft}
            rows={4}
            placeholder={`${subjectTitle} introduces itself…`}
            onChange={(event) => setDraft(event.target.value)}
          />
          <footer className="dash-speech-foot">
            {currentSpeech && (
              <button
                type="button"
                className="sim-repo-disconnect"
                onClick={() => onPatch({ muted: !muted })}
                aria-label={muted ? `Unmute ${subjectTitle}` : `Mute ${subjectTitle}`}
              >
                {muted ? <Volume2 size={14} aria-hidden /> : <VolumeX size={14} aria-hidden />}
                {muted ? "Unmute" : "Mute"}
              </button>
            )}
            {currentSpeech && (
              <button type="button" className="sim-repo-disconnect" onClick={onRemove}>
                <Trash2 size={14} aria-hidden />
                Remove narration
              </button>
            )}
            <button type="button" className="sim-report-btn" disabled={!canSave} onClick={() => onSave(trimmed)}>
              <Save size={15} aria-hidden />
              Save narration
            </button>
          </footer>

          {/* The level's face and voice: which cartoon speaks its bubble
              and with which browser voice — every pick lands at once,
              the console stays open for the next touch. */}
          <h4>Its face and voice</h4>
          <div className="sim-avatar-strip" role="group" aria-label={`${subjectTitle}'s cartoon face`}>
            <button
              type="button"
              className={`sim-avatar-chip sim-avatar-none${currentAvatar ? "" : " is-picked"}`}
              aria-pressed={!currentAvatar}
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
                className={`sim-avatar-chip${currentAvatar === character.id ? " is-picked" : ""}`}
                aria-pressed={currentAvatar === character.id}
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
              value={currentVoice ?? "auto"}
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
              value={currentPitch ?? 1}
              onChange={(event) => {
                const value = Number(event.target.value);
                onPatch({ pitch: value === 1 ? null : value });
              }}
            />
            <span className="sim-voice-value">{(currentPitch ?? 1).toFixed(2)}</span>
          </div>

          {/* The show's soundtrack: one background loop for the whole
              show, edited from any level's console. A link saves with
              the system; a file from this computer plays until the tab
              closes. The levels' voices speak over it. */}
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
      </div>
    </div>
  );
}
