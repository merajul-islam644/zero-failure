// The planet menu modal: clicking any body on the canvas opens this panel
// instead of fanning rings around it in the sky. It carries the same menu
// tree the fan drew — the platform's menu planets, and one step down, each
// branch's sub-menu planets — as a grid of the same mini-planet design
// (same .sim-menu-node-body/halo/glyph classes, same --node-hue rule).
// Branches descend like fresh dialogs: clicking a menu re-presents the
// panel as THAT menu's own modal — the header swaps to the menu's sigil
// on a mini-planet disc, the grid shows its sub-menus, and the open
// animation replays (the panel is keyed by the walked path) — sub-menus
// included, so every level carries its own repository console. A
// breadcrumb trail walks you back up; the rail showcase mirrors the
// trail as it descends. Escape or the backdrop closes it; focus lands
// on the panel so keyboard users start inside.

import { useEffect, useMemo, useRef } from "react";
import { FilePlus2, FolderGit2, Link2Off, Play, Trash2, X } from "lucide-react";
import { CAST_BY_ID } from "../script/cast";
import { menuLevelWords, type OpenPlanetMenu, type PlatformMenuItem } from "../script/platformMenus";
import { PLATFORM_MENUS } from "../script/platformMenus";
import type { FilesSummary, RepoSummary } from "../script/repoScan";
import { repoKey } from "../script/repoScan";
import { speak, stopSpeech } from "../state/audio";
import { useSettings } from "../state/SettingsContext";
import {
  castPlan,
  pitchForPlatform,
  rateForPlatform,
  resolveSpeakerVoice,
  resolveVoice,
  useVoices,
} from "../state/voices";
import { SUN_HUE } from "./canvas/PlanetMenuLayer";
import { CharacterNode } from "./canvas/CharacterNode";
import { FilesSummaryCard, RepoSummaryCard } from "./RepoSummaryCards";

interface PlanetMenuModalProps {
  menu: OpenPlanetMenu | null;
  /** Every connected folder, keyed by level (repoKey): the modal shows
   *  the one belonging to the level on display — the planet's at the
   *  body level, the walked menu's own once a branch is open. */
  repos: Partial<Record<string, RepoSummary>>;
  /** Every connected loose-file set, keyed the same way — leaf levels
   *  carry these beside their folder. */
  files: Partial<Record<string, FilesSummary>>;
  /** True while the laptop's folder walk is in flight — the pick button
   *  goes busy so a big repository never looks like a dead click. */
  pending?: boolean;
  /** True while the file picker is out. */
  filePending?: boolean;
  /** Open the laptop's folder picker for this planet and menu level. */
  onConnect: (planet: OpenPlanetMenu["planet"], path: string[]) => void;
  /** Let go of the level's folder — picking another means this first. */
  onDisconnect: (planet: OpenPlanetMenu["planet"], path: string[]) => void;
  /** Open the laptop's file picker for this level (loose files). */
  onConnectFiles: (planet: OpenPlanetMenu["planet"], path: string[]) => void;
  /** Remove the level's loose-file set. */
  onDisconnectFiles: (planet: OpenPlanetMenu["planet"], path: string[]) => void;
  /** A mini was clicked — walk the open trail down (or fold it back) to
   *  this path; the panel re-presents that level. */
  onPath: (path: string[]) => void;
  /** Play from this level — the stage hands the trail to the showcase,
   *  closes the panel and starts the show. */
  onPlay: (planet: OpenPlanetMenu["planet"], path: string[]) => void;
  onClose: () => void;
}

export function PlanetMenuModal({
  menu,
  repos,
  files,
  pending = false,
  filePending = false,
  onConnect,
  onDisconnect,
  onConnectFiles,
  onDisconnectFiles,
  onPath,
  onPlay,
  onClose,
}: PlanetMenuModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  // The level's own voice: opening a console speaks its words — the
  // authored line, or the level's label where none was written — in
  // the planet's cast voice, the same voice, pitch and speed the body
  // narrates the story with. The narration switch governs here too:
  // off, the walk stays silent. A new level cancels the last one; a
  // closed modal stops the line mid-word.
  const { narration, voice, castVoices } = useSettings();
  const installed = useVoices();
  const plan = useMemo(() => castPlan(installed), [installed]);
  const narrationVoice = useMemo(() => resolveVoice(voice), [voice]);
  const trailKey = menu ? menu.path.join(">") : "";
  useEffect(() => {
    if (!menu || !narration) return;
    const words = menuLevelWords(menu.planet, menu.path);
    if (!words) return;
    const spoke = speak(words, {
      playbackRate: 1,
      voice: resolveSpeakerVoice(menu.planet, castVoices, plan, narrationVoice),
      pitch: pitchForPlatform(menu.planet),
      rate: rateForPlatform(menu.planet)
    });
    return () => {
      if (spoke) stopSpeech();
    };
    // trailKey stands in for the path array — a re-render with the same
    // trail must never restart the line mid-word.
  }, [menu?.planet, trailKey, narration, castVoices, plan, narrationVoice]);

  useEffect(() => {
    if (!menu) return;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Document fires before the stage's window-level shortcuts — stop
        // here so closing the modal never also un-zooms the display.
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menu, onClose]);

  if (!menu) return null;
  const character = CAST_BY_ID[menu.planet];
  // Same hue rule as the canvas fan and rail showcase: the whole panel
  // wears its planet's color (the sun in literal solar amber).
  const hue = menu.planet === "os" ? SUN_HUE : character.hue;
  const root = PLATFORM_MENUS[menu.planet] ?? [];
  // census: the planet's menu count, printed beside its role
  const menuCount = root.length;

  // Walk the open path down to the level on display — each walked label
  // becomes a breadcrumb chip, and each walked menu item becomes the
  // panel's next subject.
  const crumbs: string[] = [];
  const crumbItems: PlatformMenuItem[] = [];
  let level = root;
  for (const label of menu.path) {
    const item = level.find((entry) => entry.label === label);
    if (!item) break;
    crumbs.push(label);
    crumbItems.push(item);
    // A level without authored children still presents itself — its
    // repository console is the body; the grid just stays empty.
    level = item.children ?? [];
  }

  // The header planet: the real textured body at its canvas proportions —
  // the sun simply gets a wider window (its photosphere overshoots a
  // planet's r44 disk).
  const viewR = menu.planet === "os" ? 92 : 58;
  // Inside the tree the subject flips to the walked menu itself: the
  // header wears its sigil on a mini-planet disc and the grid shows its
  // sub-menus — every level presents like its own modal.
  const subject = crumbItems[crumbItems.length - 1] ?? null;
  const subjectTitle = subject ? subject.label : character.name;
  // This level's own folder: the body's at the planet level, the walked
  // menu's once a branch is open — each level keeps exactly one.
  const repo = repos[repoKey(menu.planet, menu.path)] ?? null;
  // This level's own loose-file set — leaf levels only.
  const fileSummary = files[repoKey(menu.planet, menu.path)] ?? null;
  // A leaf level: a menu or sub-menu with nothing nested beneath it —
  // there the folder console gains a loose-files picker beside it.
  const leaf = subject !== null && level.length === 0;
  // The hierarchy gate: a level holds a folder only once its parent does
  // — the planet anchors its menus, a menu anchors its sub-menus. The
  // planet level itself is never gated.
  const parentRepo =
    crumbs.length > 0 ? (repos[repoKey(menu.planet, crumbs.slice(0, -1))] ?? null) : null;
  const parentName =
    crumbs.length > 1 ? (crumbItems[crumbs.length - 2]?.label ?? character.name) : character.name;
  const gated = !repo && subject !== null && !parentRepo;

  // The folder console — every level's block, leaf or not.
  const folderBlock = (
    <>
      {!repo ? (
        <>
          <h4>Add repository</h4>
          <p className="sim-repo-drawer-hint">
            {pending
              ? "Reading the folder on this laptop — a big repository takes a few seconds…"
              : gated
                ? `Connect a folder to ${
                    crumbs.length > 1 ? `the ${parentName} menu` : character.name
                  } first — a level holds a folder only once its parent does.`
                : subject
                  ? `Pick a folder for the ${subject.label} menu — its name, size and languages are summarized below. Read-only: the walk never leaves this machine.`
                  : "Pick a folder from this laptop — its name, size and languages are summarized below. Read-only: the walk never leaves this machine."}
          </p>
          <button
            type="button"
            className="sim-report-btn"
            disabled={pending || gated}
            onClick={() => onConnect(menu.planet, menu.path)}
          >
            <FolderGit2 size={15} aria-hidden />
            {pending ? "Walking…" : "Pick a folder"}
          </button>
        </>
      ) : (
        <>
          <h4>Connected</h4>
          <RepoSummaryCard repo={repo} />
          <button
            type="button"
            className="sim-repo-disconnect"
            onClick={() => onDisconnect(menu.planet, menu.path)}
          >
            <Link2Off size={14} aria-hidden />
            Disconnect {repo.name}
          </button>
        </>
      )}
    </>
  );

  // The loose-files console — leaf levels lay it beside the folder.
  const filesBlock = leaf ? (
    <>
      {!fileSummary ? (
        <>
          <h4>Add files</h4>
          <p className="sim-repo-drawer-hint">
            {filePending
              ? "Waiting on the laptop's file picker…"
              : gated
                ? "The parent's folder comes first — then this level can carry loose files too."
                : "Pick one or more loose files — count, size and types are summarized here. Read-only: nothing leaves this machine."}
          </p>
          <button
            type="button"
            className="sim-report-btn"
            disabled={filePending || gated}
            onClick={() => onConnectFiles(menu.planet, menu.path)}
          >
            <FilePlus2 size={15} aria-hidden />
            {filePending ? "Picking…" : "Pick files"}
          </button>
        </>
      ) : (
        <>
          <h4>Files</h4>
          <FilesSummaryCard files={fileSummary} />
          <button
            type="button"
            className="sim-repo-disconnect"
            onClick={() => onDisconnectFiles(menu.planet, menu.path)}
          >
            <Trash2 size={14} aria-hidden />
            Remove {fileSummary.count} {fileSummary.count === 1 ? "file" : "files"}
          </button>
        </>
      )}
    </>
  ) : null;

  return (
    <div className="sim-menu-modal">
      <button type="button" className="sim-menu-modal-backdrop" aria-label="Close menu" tabIndex={-1} onClick={onClose} />
      <div
        key={`${menu.planet}:${menu.path.join(">")}`}
        className="sim-menu-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`${subjectTitle} menu`}
        tabIndex={-1}
        ref={panelRef}
        style={{ "--node-hue": hue } as React.CSSProperties}
      >
        <header className="sim-menu-modal-head">
          {subject ? (
            <svg className="sim-menu-modal-planet" viewBox="-40 -40 80 80" aria-hidden>
              <circle className="sim-menu-node-halo" r={36} />
              <circle className="sim-menu-node-body" r={30} />
              <g className="sim-menu-node-glyph" transform="translate(-10 -10)">
                <subject.icon size={20} strokeWidth={1.8} />
              </g>
            </svg>
          ) : (
            <svg
              className="sim-menu-modal-planet"
              viewBox={`${-viewR} ${-viewR} ${viewR * 2} ${viewR * 2}`}
              aria-hidden
            >
              <CharacterNode character={character} state="idle" dimmed={false} />
            </svg>
          )}
          <div className="sim-menu-modal-title">
            <h3>{subjectTitle}</h3>
            <p>
              {subject
                ? `${character.name} — sub-menu`
                : menuCount > 0
                  ? `${character.role} · ${menuCount} ${menuCount === 1 ? "menu" : "menus"}`
                  : character.role}
            </p>
          </div>
          <button
            type="button"
            className="sim-menu-modal-play"
            disabled={!repo && !fileSummary}
            title={
              repo || fileSummary
                ? undefined
                : "Connect a folder or files first — a level plays only with content of its own"
            }
            onClick={() => onPlay(menu.planet, menu.path)}
            aria-label={
              repo || fileSummary
                ? `Play ${subjectTitle}`
                : `Play ${subjectTitle} — connect a folder or files first`
            }
          >
            <Play size={14} aria-hidden />
            Play
          </button>
          <button type="button" className="sim-menu-modal-close" onClick={onClose} aria-label="Close menu">
            <X size={18} aria-hidden />
          </button>
        </header>

        {crumbs.length > 0 && (
          <nav className="sim-menu-modal-crumbs" aria-label="Menu trail">
            <button type="button" onClick={() => onPath([])}>
              {character.name}
            </button>
            {crumbs.map((label, depth) => {
              const last = depth === crumbs.length - 1;
              return (
                <span key={label} className="sim-menu-modal-crumb-step">
                  <span aria-hidden>›</span>
                  {last ? (
                    <span aria-current="location">{label}</span>
                  ) : (
                    <button type="button" onClick={() => onPath(menu.path.slice(0, depth + 1))}>
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
            {level.map((item) => {
              const Icon = item.icon;
              const subs = item.children?.length ?? 0;
              return (
                <li key={item.label}>
                  <button
                    type="button"
                    className="sim-menu-modal-item"
                    onClick={() => onPath([...menu.path.slice(0, crumbs.length), item.label])}
                    aria-label={`${item.label} — opens its console`}
                  >
                    <svg viewBox="-40 -40 80 80" aria-hidden>
                      <circle className="sim-menu-node-halo" r={36} />
                      <circle className="sim-menu-node-body" r={30} />
                      <g className="sim-menu-node-glyph" transform="translate(-10 -10)">
                        <Icon size={20} strokeWidth={1.8} />
                      </g>
                    </svg>
                    <span className="sim-menu-modal-item-name">{item.label}</span>
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
          // The walk ended on a level with no authored children — its
          // repository console below is the body. Only the bare planet
          // shows the quiet "no menus" copy the rail showcase carries.
          !subject && <p className="sim-menu-modal-empty">No menu planets yet</p>
        )}

        {/* The level's console: the folder walk every level carries — and
            at leaf menus and sub-menus, where nothing nests, a loose
            files picker beside it. One folder and one file set per
            level; swapping either means dropping it first. */}
        <section className="sim-menu-modal-repo">
          {leaf ? (
            <div className="sim-menu-modal-repo-cols">
              <div>{folderBlock}</div>
              {/* the fork between the two cargos — decorative */}
              <div className="sim-menu-modal-repo-or" aria-hidden>
                or
              </div>
              <div>{filesBlock}</div>
            </div>
          ) : (
            folderBlock
          )}
        </section>
      </div>
    </div>
  );
}
