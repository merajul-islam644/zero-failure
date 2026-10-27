// One forged body's console — the simulator's planet menu modal,
// walking the forged tree the very same way. A click on a world (or the
// star itself) opens the body's own menu levels: the menus authored
// under it (an app base's apps carry menus, a menu base's menu carries
// its sub-menus straight away) as a grid of the same mini-planet design
// (same .sim-menu-node-body/halo/glyph classes, same --node-hue rule).
// Branches descend like fresh dialogs: clicking a mini re-presents the
// panel as THAT menu's own console — the header swaps to the menu's
// logo on a mini-planet disc, the grid shows its sub-menus, and the
// open animation replays (the panel is keyed by the walked path).
// Every level carries its own repository console — a level holds a
// folder only once its parent does, and a leaf (nothing nested beneath)
// lays a loose-files picker beside the folder. A parent's connected
// folder opens itself as a chooser: the levels beneath pick their own
// folder or files from inside it, no second trip to the laptop's file
// manager. A breadcrumb trail walks
// you back up. Escape, the ✕ or the backdrop close it; focus lands on
// the panel so keyboard users start inside. The header's play runs
// THIS app's own playwright suite — the dev server's run desk carries
// the repo's own harness from its home on this machine (the panel asks
// for that home once, then remembers) and the panel shows the verdict.

import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowLeft,
  FilePlus2,
  Folder,
  FolderGit2,
  FolderOpen,
  Link2Off,
  Play,
  Trash2,
  X,
} from "lucide-react";
import type { BodyLogo } from "../create/iconCatalog";
import type { ForgedNode } from "../create/systemsDoc";
import { ForgeBody, ForgeStar, SkyDefs, useReducedMotion } from "../create/SystemSky";
import { FilesSummaryCard, RepoSummaryCard } from "../simulator/components/RepoSummaryCards";
import {
  repoKey,
  type FilesSummary,
  type FolderListing,
  type RepoSummary,
} from "../simulator/script/repoScan";

/** One play press, as the console's panel shows it. */
export interface LevelRun {
  pathKey: string;
  label: string;
  status: "running" | "done" | "error";
  /** When the play press went out — the panel ticks the seconds by it. */
  startedAt?: number;
  durationMs?: number;
  stats?: RunStats;
  tests?: RunTests[];
  logs?: RunLog[];
  /** The live frame the desk's reporter last narrated — which file,
   *  which line, which block, which step is on stage this second. */
  now?: RunNow;
  error?: string;
  /** The folder the harness actually ran from — the repo root the desk
   *  climbed to, which may sit above the folder the browser knew. */
  ranFrom?: string;
}

export interface RunStats {
  passed: number;
  failed: number;
  skipped: number;
}

export interface RunTests {
  title: string;
  ok: boolean;
  status?: string;
  message?: string;
}

/** One streamed line of the harness's own chatter — what file, what
 *  block, what verdict as it happens; the stderr stream dresses red. */
export interface RunLog {
  text: string;
  stream?: "err";
}

/** One live frame from the desk's own reporter — which file, which
 *  line, which block, which step the harness is touching this
 *  second; it lights the panel's "now" banner while the run grinds. */
export interface RunNow {
  phase: string;
  project?: string;
  file?: string;
  line?: number;
  block?: string;
  title?: string;
  step?: string;
  error?: string;
  ok?: boolean;
  status?: string;
  total?: number;
  durationMs?: number;
}

/** The console's subject. A planet carries its `body` — the baker id,
 *  numeric hue and logo its ForgeBody paints with; the sun carries
 *  none, and the header paints the real ForgeStar instead. */
export interface ConsoleSubject {
  name: string;
  label?: string;
  body?: { id: string; hue: number; logo: BodyLogo };
}

interface PlaywrightPlanetModalProps {
  subject: ConsoleSubject;
  /** The body's own hue as an "H S% L%" triple — the panel, the discs
   *  and the summary cards all wear it through --node-hue. */
  hue: string;
  /** The body's map key — every level's repoKey hangs off it. */
  bodyKey: string;
  /** The body's forged tree — menus (app base) or sub-menus (menu
   *  base). Empty and the body's own console is the whole panel. */
  tree: ForgedNode[];
  /** The walked trail of labels — [] is the body itself. */
  path: string[];
  /** Every connected folder, keyed by level (repoKey): the console
   *  shows the one belonging to the level on display — the body's at
   *  the body level, the walked menu's own once a branch is open. */
  repos: Partial<Record<string, RepoSummary>>;
  /** Every connected loose-file set, keyed the same way — leaf levels
   *  carry these beside their folder. */
  files: Partial<Record<string, FilesSummary>>;
  /** True while the laptop's folder walk is in flight — the pick button
   *  goes busy so a big repository never looks like a dead click. */
  pending: boolean;
  /** True while the file picker is out. */
  filePending: boolean;
  /** A mini was clicked — walk the open trail down (or fold it back)
   *  to this path; the panel re-presents that level. */
  onPath: (path: string[]) => void;
  /** Open the laptop's folder picker for this level. */
  onConnect: (path: string[]) => void;
  /** Let go of the level's folder — picking another means this first. */
  onDisconnect: (path: string[]) => void;
  /** Open the laptop's file picker for this level (loose files). */
  onConnectFiles: (path: string[]) => void;
  /** Remove the level's loose-file set. */
  onDisconnectFiles: (path: string[]) => void;
  /** The connected folder this level can pick from — the nearest
   *  ancestor's (or its own) live tree. Null and the laptop's own
   *  picker is the only road. */
  browseName?: string | null;
  /** The open chooser for THIS level — the source folder's name, the
   *  trail of folders stepped into beneath it, and the listing read
   *  from the trail's end (null while the browser withholds a restored
   *  grant). Null when the chooser is closed. */
  browse?: { name: string; trail: string[]; listing: FolderListing | null } | null;
  /** True while the chooser's folder is being read. */
  browsePending?: boolean;
  /** Open the chooser — list the source folder's children. */
  onBrowseOpen: (path: string[]) => void;
  /** Step the chooser's trail — into a named folder, or back one; an
   *  empty trail folds the chooser. */
  onBrowseTrail: (path: string[], trail: string[]) => void;
  /** Connect the folder a trail of names reaches, as this level's own. */
  onConnectFromTree: (path: string[], trail: string[]) => void;
  /** Take the loose files of the folder the trail reaches as this
   *  level's file set. */
  onConnectFilesFromTree: (path: string[], trail: string[]) => void;
  /** The play press for this very level, when one is in flight or just
   *  landed — the panel shows its progress and verdict. Null when the
   *  run belongs to another level. */
  run?: LevelRun | null;
  /** May this level's play run? True once any level of the played
   *  subtree carries a connected folder or file set of its own — the
   *  sector's rule: the run belongs to the connected repo. */
  canPlay?: boolean;
  /** True when a play press found no home for this app's repo — the
   *  panel asks for the path once, then runs. */
  runPathAsk?: boolean;
  /** The desk's hunt answers — homes on this machine wearing the repo's
   *  name; more than one, and the panel shows them as buttons. */
  runMatches?: string[] | null;
  /** Where this app's repo lives on this machine — shown beside the
   *  verdict, the run desk's working folder. */
  runRoot?: string | null;
  /** Keep the repo's home path and start the run at once. */
  onRunRoot: (rootPath: string) => void;
  /** Play from this level — the run desk runs this app's own
   *  playwright suite from its home on this machine (a menu's play
   *  aims it at that menu's folder); the panel stays open and shows
   *  the verdict. */
  onPlay: (path: string[]) => void;
  /** Kill the live run — the panel's Stop press while the harness
   *  grinds; closing the pipe is the desk's signal to kill. */
  onStop?: () => void;
  onClose: () => void;
}

export function PlaywrightPlanetModal({
  subject,
  hue,
  bodyKey,
  tree,
  path,
  repos,
  files,
  pending,
  filePending,
  onPath,
  onConnect,
  onDisconnect,
  onConnectFiles,
  onDisconnectFiles,
  browseName = null,
  browse = null,
  browsePending = false,
  onBrowseOpen,
  onBrowseTrail,
  onConnectFromTree,
  onConnectFilesFromTree,
  run = null,
  canPlay = false,
  runPathAsk = false,
  runMatches = null,
  runRoot = null,
  onRunRoot,
  onPlay,
  onStop,
  onClose,
}: PlaywrightPlanetModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  // The header body's own gradient/clip ids, and the moon's respect
  // for the viewer's reduced-motion setting.
  const uid = useId().replace(/:/g, "");
  const reduced = useReducedMotion();

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Document fires before any window-level shortcuts — stop here so
        // closing the console never also fires something beneath it.
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [path, onClose]);

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
  const subjectTitle = subjectNode ? subjectNode.label : subject.name;
  // This level's own play press, when the run belongs to this path —
  // its progress rides the play button, its verdict the panel below.
  const runHere = run;
  // The repo-home prompt's draft — fresh whenever the panel remounts.
  const [draft, setDraft] = useState("");
  // The running run's heartbeat — a second-tick so the panel shows how
  // long the harness has been grinding instead of a frozen promise.
  const [now, setNow] = useState(Date.now());
  const runLive = runHere?.status === "running";
  useEffect(() => {
    if (!runLive) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [runLive]);
  // the streamed log rides its own tail — new lines keep the box
  // pinned to the bottom
  const logRef = useRef<HTMLPreElement | null>(null);
  const logCount = runHere?.logs?.length ?? 0;
  useEffect(() => {
    const box = logRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [logCount]);
  // This level's own folder and loose files — the body's at the body
  // level, the walked menu's once a branch is open.
  const levelKey = repoKey(bodyKey, path);
  const repo = repos[levelKey] ?? null;
  const fileSummary = files[levelKey] ?? null;
  // A leaf level: nothing nested beneath — there the folder console
  // gains a loose-files picker beside it.
  const leaf = level.length === 0;
  // The hierarchy gate: a level holds a folder only once its parent does
  // — the body anchors its menus, a menu anchors its sub-menus. The
  // body level itself is never gated.
  const parentRepo =
    crumbs.length > 0 ? (repos[repoKey(bodyKey, crumbs.slice(0, -1))] ?? null) : null;
  const parentName =
    crumbs.length > 1 ? (crumbNodes[crumbs.length - 2]?.label ?? subject.name) : subject.name;
  const gated = !repo && subjectNode !== null && !parentRepo;

  // A mini's glyph: the shelf icon the forge stamped on the node, or
  // the uploaded image — both inside the sim modal's own glyph box.
  const glyph = (logo: BodyLogo) =>
    logo.kind === "icon" ? (
      <logo.icon size={20} strokeWidth={1.8} />
    ) : (
      <image href={logo.src} x={-10} y={-10} width={20} height={20} preserveAspectRatio="xMidYMid meet" />
    );

  // The folder console — every level's block, leaf or not. The laptop's
  // own picker stays for any folder on the machine; when a parent's
  // folder is connected, the chooser beside it picks from inside that
  // folder instead — the levels of the tree mapping onto the levels of
  // the disk.
  const folderBlock = (
    <>
      {!repo ? (
        browse ? (
          <>
            <h4>
              Inside {browse.name}
              {browse.trail.length > 0 && ` › ${browse.trail.join(" › ")}`}
            </h4>
            <p className="sim-repo-drawer-hint">
              {browsePending
                ? "Reading the folder…"
                : browse.listing
                  ? `Click a folder to step inside — Select connects it to this level${leaf ? ", or take the folder's loose files" : ""}.`
                  : `The browser wants permission to read ${browse.name} again — allow it once and this list works.`}
            </p>
            {!browsePending && browse.listing && (
              <div className="pw-tree-list">
                {browse.listing.dirs.map((dir) => (
                  <div key={dir} className="pw-tree-row">
                    <button
                      type="button"
                      className="pw-tree-enter"
                      disabled={pending}
                      title={`Step inside ${dir}`}
                      onClick={() => onBrowseTrail(path, [...browse.trail, dir])}
                    >
                      <Folder size={14} aria-hidden />
                      <span>{dir}</span>
                    </button>
                    <button
                      type="button"
                      className="pw-tree-pick"
                      disabled={pending}
                      title={`Connect ${dir} — its own walk summarizes it here`}
                      onClick={() => onConnectFromTree(path, [...browse.trail, dir])}
                    >
                      Select
                    </button>
                  </div>
                ))}
                {leaf && browse.listing.files.length > 0 && (
                  <button
                    type="button"
                    className="pw-tree-row"
                    disabled={filePending}
                    title="Take the folder you're inside's own loose files as this level's file set"
                    onClick={() => onConnectFilesFromTree(path, browse.trail)}
                  >
                    <FilePlus2 size={14} aria-hidden />
                    {browse.listing.files.length} loose{" "}
                    {browse.listing.files.length === 1 ? "file" : "files"} — take them
                  </button>
                )}
                {browse.trail.length > 0 && (
                  <button
                    type="button"
                    className="pw-tree-row"
                    disabled={pending}
                    title="Connect the folder you stepped into — its own walk summarizes it here"
                    onClick={() => onConnectFromTree(path, browse.trail)}
                  >
                    <FolderGit2 size={14} aria-hidden />
                    Select this folder
                  </button>
                )}
                {browse.listing.dirs.length === 0 &&
                  !(leaf && browse.listing.files.length > 0) && (
                    <p className="sim-repo-drawer-hint">Nothing readable inside.</p>
                  )}
                <button
                  type="button"
                  className="pw-tree-back"
                  onClick={() => onBrowseTrail(path, browse.trail.slice(0, -1))}
                >
                  <ArrowLeft size={13} aria-hidden />
                  {browse.trail.length > 0 ? "Up one folder" : "Back"}
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <h4>Add repository</h4>
            <p className="sim-repo-drawer-hint">
              {pending
                ? "Reading the folder on this laptop — a big repository takes a few seconds…"
                : gated
                  ? `Connect a folder to ${
                      crumbs.length > 1 ? `the ${parentName} menu` : subject.name
                    } first — a level holds a folder only once its parent does.`
                  : subjectNode
                    ? `Pick a folder for the ${subjectNode.label} menu — from this laptop, or from inside ${browseName ? `the ${browseName} folder` : "its parent's folder"}. Read-only: the walk never leaves this machine.`
                    : "Pick a folder from this laptop — its name, size and languages are summarized below. Read-only: the walk never leaves this machine."}
            </p>
            <button
              type="button"
              className="sim-report-btn"
              disabled={pending || gated}
              onClick={() => onConnect(path)}
            >
              <FolderGit2 size={15} aria-hidden />
              {pending ? "Walking…" : "Pick a folder"}
            </button>
            {!gated && browseName && (
              <button
                type="button"
                className="sim-report-btn pw-tree-open"
                disabled={pending || browsePending}
                onClick={() => onBrowseOpen(path)}
              >
                <FolderOpen size={15} aria-hidden />
                {browsePending ? "Reading…" : `Pick from ${browseName}`}
              </button>
            )}
          </>
        )
      ) : (
        <>
          <h4>Connected</h4>
          <RepoSummaryCard repo={repo} />
          <button
            type="button"
            className="sim-repo-disconnect"
            onClick={() => onDisconnect(path)}
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
            onClick={() => onConnectFiles(path)}
          >
            <FilePlus2 size={15} aria-hidden />
            {filePending ? "Picking…" : "Pick files"}
          </button>
          {!gated && browseName && (
            <button
              type="button"
              className="sim-report-btn pw-tree-open"
              disabled={filePending || browsePending}
              title="Take the connected folder's own loose files as this level's file set"
              onClick={() => onConnectFilesFromTree(path, [])}
            >
              <FolderOpen size={15} aria-hidden />
              Loose files inside {browseName}
            </button>
          )}
        </>
      ) : (
        <>
          <h4>Files</h4>
          <FilesSummaryCard files={fileSummary} />
          <button
            type="button"
            className="sim-repo-disconnect"
            onClick={() => onDisconnectFiles(path)}
          >
            <Trash2 size={14} aria-hidden />
            Remove {fileSummary.count} {fileSummary.count === 1 ? "file" : "files"}
          </button>
        </>
      )}
    </>
  ) : null;

  return (
    <div className="sim-menu-modal pw-planet-modal">
      <button
        type="button"
        className="sim-menu-modal-backdrop"
        aria-label="Close the console"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        key={`${bodyKey}:${path.join(">")}`}
        className="sim-menu-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`${subjectTitle} menu`}
        tabIndex={-1}
        ref={panelRef}
        style={{ "--node-hue": hue } as React.CSSProperties}
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
            /* the real body itself — the sim modal's own header
                treatment: a planet at the r44-disk window, the star at
                the wider one, its photosphere spilling past the frame */
            <svg
              className="sim-menu-modal-planet"
              viewBox={subject.body ? "-58 -58 116 116" : "-92 -92 184 184"}
              aria-hidden
            >
              <SkyDefs uid={uid} />
              {subject.body ? (
                <ForgeBody
                  uid={uid}
                  bodyId={subject.body.id}
                  hue={subject.body.hue}
                  logo={subject.body.logo}
                  bearing={0}
                  scale={1}
                  reduced={reduced}
                />
              ) : (
                <ForgeStar uid={uid} scale={1} />
              )}
            </svg>
          )}
          <div className="sim-menu-modal-title">
            <h3>{subjectTitle}</h3>
            <p>
              {subjectNode
                ? `${subject.name} — sub-menu`
                : tree.length > 0
                  ? `${subject.label ? `${subject.label} · ` : ""}${tree.length} ${tree.length === 1 ? "menu" : "menus"}`
                  : `${subject.label ? `${subject.label} · ` : ""}One folder and one file set of its own`}
            </p>
          </div>
          {/* the level's play action, the sim modal's own seat — and
              this sector's rule: the run belongs to the connected repo.
              One press flattens the level's subtree into real playwright
              tests; the panel shows the verdict when the harness lands. */}
          <button
            type="button"
            className="sim-menu-modal-play"
            disabled={!canPlay || runHere?.status === "running"}
            title={
              !canPlay
                ? "Connect a folder or files somewhere in this subtree first — the run belongs to the connected repo"
                : runHere?.status === "running"
                  ? "The harness is running — it signs in first, so this takes a minute"
                  : undefined
            }
            onClick={() => onPlay(path)}
            aria-label={
              canPlay
                ? runHere?.status === "running"
                  ? `Playwright run in flight for ${subjectTitle}`
                  : `Play ${subjectTitle} — run its playwright walk`
                : `Play ${subjectTitle} — connect a folder or files first`
            }
          >
            <Play size={14} aria-hidden />
            {runHere?.status === "running" ? "Running…" : "Play"}
          </button>
          <button
            type="button"
            className="sim-menu-modal-close"
            onClick={onClose}
            aria-label="Close the console"
          >
            <X size={16} aria-hidden />
          </button>
        </header>

        {crumbs.length > 0 && (
          <nav className="sim-menu-modal-crumbs" aria-label="Menu trail">
            <button type="button" onClick={() => onPath([])}>
              {subject.name}
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
                    aria-label={`${node.label} — opens its console`}
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
          // The walk ended on a level with nothing nested — its
          // repository console below is the body. Only the bare body
          // shows the quiet "no menus" copy.
          !subjectNode && <p className="sim-menu-modal-empty">No menus yet</p>
        )}

        {/* The level's console: the folder walk every level carries —
            and at leaves, where nothing nests, a loose files picker
            beside it. One folder and one file set per level; swapping
            either means dropping it first. */}
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

        {/* the play press — the repo-home prompt when the desk needs it,
            then the verdict: progress while the harness grinds, then one
            row per test with the failures' own words */}
        {runPathAsk && !runHere && (
          <section className="pw-run">
            <header className="pw-run-head">
              <span className="pw-run-tag">
                <Play size={11} aria-hidden />
                Run desk
              </span>
            </header>
            {runMatches && runMatches.length > 0 ? (
              <>
                <p className="pw-run-ask-copy">
                  The desk searched this machine for the repo — these
                  folders wear a playwright config. Which one is home?
                </p>
                <div className="pw-run-choices">
                  {runMatches.map((match) => (
                    <button
                      key={match}
                      type="button"
                      className="pw-run-choice"
                      onClick={() => onRunRoot(match)}
                    >
                      {match}
                    </button>
                  ))}
                </div>
                <p className="pw-run-ask-copy">None of these? Paste the folder&apos;s path.</p>
              </>
            ) : (
              <p className="pw-run-ask-copy">
                Where does this repo live on this machine? The repo&apos;s
                root — or any folder inside it; the desk walks up to the
                config itself. The harness runs this app&apos;s own
                playwright tests — its own .env credentials, its own
                tests. The path stays in this browser.
              </p>
            )}
            <form
              className="pw-run-ask"
              onSubmit={(event) => {
                event.preventDefault();
                onRunRoot(draft);
              }}
            >
              <input
                className="pw-run-input"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="D:\projects\that-app"
                spellCheck={false}
                autoComplete="off"
                aria-label="The repo's home path on this machine"
              />
              <button type="submit" className="sim-report-btn" disabled={!draft.trim()}>
                Save and run
              </button>
            </form>
          </section>
        )}
        {runHere && (
          <section className={`pw-run${runHere.status === "error" ? " is-bad" : ""}`}>
            <header className="pw-run-head">
              <span className="pw-run-tag">
                <Play size={11} aria-hidden />
                Playwright run
              </span>
              <span className="pw-run-side">
                <span className="pw-run-meta">
                  {runHere.status === "running"
                    ? `Running ${runHere.startedAt ? Math.max(1, Math.round((now - runHere.startedAt) / 1000)) : 0}s — this repo's own harness: its web server, its sign-in, then the tests…`
                    : runHere.status === "done"
                      ? [
                          `${runHere.stats?.passed ?? 0} passed`,
                          `${runHere.stats?.failed ?? 0} failed`,
                          `${runHere.stats?.skipped ?? 0} skipped`,
                          runHere.durationMs !== undefined
                            ? `${(runHere.durationMs / 1000).toFixed(1)}s`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : "The run could not finish"}
                </span>
                {runHere.status === "running" && onStop && (
                  <button type="button" className="pw-run-stop" onClick={onStop}>
                    Stop
                  </button>
                )}
              </span>
            </header>
            {(runHere.ranFrom || runRoot) && (
              <p className="pw-run-root">{runHere.ranFrom ?? runRoot}</p>
            )}
            {runHere.error && <p className="pw-run-error">{runHere.error}</p>}
            {runHere.status === "running" && runHere.now && (
              <div className="pw-now">
                <span className="pw-now-kicker">now</span>
                {runHere.now.phase === "begin" ? (
                  <span className="pw-now-block">
                    {runHere.now.total ? `${runHere.now.total} tests aimed` : "harness warming up"}
                  </span>
                ) : (
                  <>
                    <span className="pw-now-file">
                      {runHere.now.file ? runHere.now.file.split(/[\\/]/).pop() : "…"}
                      {runHere.now.line ? `:${runHere.now.line}` : ""}
                    </span>
                    {(runHere.now.project || runHere.now.block || runHere.now.title) && (
                      <span className="pw-now-block">
                        {[runHere.now.project, runHere.now.block, runHere.now.title]
                          .filter(Boolean)
                          .join(" › ")}
                      </span>
                    )}
                    {runHere.now.step && <span className="pw-now-step">{runHere.now.step}</span>}
                    {runHere.now.error && (
                      <span className="pw-now-step is-bad">{runHere.now.error}</span>
                    )}
                  </>
                )}
              </div>
            )}
            {runHere.logs && runHere.logs.length > 0 && (
              <pre className="pw-run-log" ref={logRef} role="log" aria-label="Playwright run output">
                {runHere.logs.map((log, index) => (
                  <span
                    key={index}
                    className={`pw-run-log-line${log.stream === "err" ? " is-err" : ""}`}
                  >
                    {log.text}
                    {"\n"}
                  </span>
                ))}
              </pre>
            )}
            {runHere.tests && runHere.tests.length > 0 && (
              <ul className="pw-run-tests">
                {runHere.tests.map((test, index) => (
                  <li key={`${test.title}:${index}`} className={test.ok ? "is-ok" : "is-bad"}>
                    <span className="pw-run-verdict">
                      {test.ok ? "PASS" : test.status === "skipped" ? "SKIP" : "FAIL"}
                    </span>
                    <div className="pw-run-body">
                      <p className="pw-run-title">{test.title}</p>
                      {test.message && <pre className="pw-run-message">{test.message}</pre>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
