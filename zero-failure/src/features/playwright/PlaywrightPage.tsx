// The playwright sector: the mission's forged systems wait here as
// cards — the deck stays dark until a card is clicked. Then the cards
// step aside entirely: the page becomes that system's live solar
// system with a back arrow in the topbar for the road home. In the
// live deck every body is a button — the sun and the worlds alike:
// clicking one opens the simulator's own planet menu modal, walking
// the body's forged tree (an app base's app → menu → sub-menu chain,
// a menu base's menu → sub-menus) with a repository console at every
// level — one folder per level, and loose files at the leaves, the
// connections kept in the browser's own cache so a refresh brings
// every folder and file set back. The suite's own runs and reports
// land here later.
// Nothing forged yet? The panel waits, reserved.

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Theater } from "lucide-react";
import { userScopedKey } from "../../shared/storage/userScope";
import { ForgedOrbitDeck } from "../create/ForgedOrbitDeck";
import { SystemShelf } from "../create/SystemShelf";
import type { ForgedNode, ForgedPlanet, ForgedSystem } from "../create/systemsDoc";
import { forgedTree, sunTree } from "../create/systemsDoc";
import { forgedBodyId, planetHues } from "../create/SystemSky";
import { useForgedSystems } from "../create/useForgedSystems";
import { DashboardRails } from "../dashboard/DashboardRails";
import { SUN_HUE } from "../simulator/components/canvas/PlanetMenuLayer";
import {
  directFilesSummary,
  listFolder,
  pickFiles,
  pickRepoTree,
  repoKey,
  subFolder,
  summarizeFolder,
  type FilesSummary,
  type FolderListing,
  type RepoSummary,
  type TreeFolder,
} from "../simulator/script/repoScan";
import { loadTrees, removeTree, removeTreesUnder, saveTree, treeReadable } from "./folderTrees";
import {
  PlaywrightPlanetModal,
  type ConsoleSubject,
  type LevelRun,
  type RunNow,
  type RunStats,
  type RunTests,
} from "./PlaywrightPlanetModal";

/** One open console: the body it belongs to, the map key its levels
 *  hang off, the "H S% L%" triple its panel wears, and the walked
 *  trail — [] is the body itself. */
interface OpenConsole {
  key: string;
  subject: ConsoleSubject;
  hue: string;
  /** The forged tree the console walks — the body's own menus, or the
   *  ring's menus under the menu base's sun. */
  tree: ForgedNode[];
  path: string[];
}

export function PlaywrightPage() {
  const systems = useForgedSystems();
  // The page is one thing at a time: the card shelf, or — once a card
  // is clicked — that system's live deck alone.
  const [selected, setSelected] = useState<ForgedSystem | null>(null);
  // The body console open over the live deck, when one is.
  const [consoleOpen, setConsoleOpen] = useState<OpenConsole | null>(null);

  // Connected repositories and loose-file sets, keyed per level —
  // repoKey hangs them off the body's key: the body's own at the body
  // level ("sun" / "sun:planet"), "sun:planet:menu>submenu" below it.
  // The browser's own cache keeps the summaries — a refresh reattaches
  // every folder and file set exactly as the walk left them (the
  // console shows the walk's summary, so the summary IS the
  // connection; the trees themselves stay on the laptop, untouched
  // and unread).
  const [repos, setRepos] = useState<Partial<Record<string, RepoSummary>>>(() => loadMap(REPOS_KEY));
  const [files, setFiles] = useState<Partial<Record<string, FilesSummary>>>(() => loadMap(FILES_KEY));
  // every connect, disconnect and re-pick mirrors into the cache at once
  useEffect(() => saveMap(REPOS_KEY, repos), [repos]);
  useEffect(() => saveMap(FILES_KEY, files), [files]);
  // The picked trees — the live folders beneath which the levels pick.
  // Where the browser gave a directory handle it lands in IndexedDB, so
  // a refresh restores the tree the moment its summary is back (the
  // first click that needs it asks the browser's one permission
  // question); the fallback's file lists ride the session alone.
  const [trees, setTrees] = useState<Partial<Record<string, TreeFolder>>>({});
  const reposRef = useRef(repos);
  reposRef.current = repos;
  useEffect(() => {
    let gone = false;
    void loadTrees().then((stored) => {
      if (gone) return;
      setTrees((prev) => {
        const next = { ...prev };
        for (const [key, tree] of Object.entries(stored)) {
          // only a key whose summary survived the refresh reattaches
          if (!next[key] && reposRef.current[key]) {
            next[key] = { name: tree.name, dir: tree.dir };
          }
        }
        return next;
      });
    });
    return () => {
      gone = true;
    };
  }, []);
  // The in-console chooser: the level listing one connected folder's
  // children — and, beneath that, any folder stepped into on the trail.
  // listing null = the browser withheld a restored grant.
  const [browse, setBrowse] = useState<{
    path: string[];
    trail: string[];
    name: string;
    listing: FolderListing | null;
  } | null>(null);
  const [browsePending, setBrowsePending] = useState(false);
  // Busy flags — a big repository's walk must never look like a dead click.
  const [connecting, setConnecting] = useState(false);
  const [pickingFiles, setPickingFiles] = useState(false);
  // The play press in flight or just landed — one run at a time, keyed
  // to the level it was pressed from; the console's panel shows its
  // progress and verdict.
  const [run, setRun] = useState<LevelRun | null>(null);
  const runningRef = useRef(false);
  // The live run's abort handle — the Stop press kills the harness by
  // closing its pipe; the desk does the actual killing.
  const runAbort = useRef<AbortController | null>(null);
  // Where each app's repo lives on this machine — the run desk runs the
  // repo's own playwright suite from there, with the repo's own config
  // and .env credentials. Kept per body key in the browser's cache
  // beside the connection maps; the path never leaves this browser.
  const [runPaths, setRunPaths] = useState<Partial<Record<string, string>>>(() =>
    loadMap(RUNPATHS_KEY),
  );
  useEffect(() => saveMap(RUNPATHS_KEY, runPaths), [runPaths]);
  // The repo-home prompt, when a play press found no home for its app's
  // repo — the desk hunts the machine first, and only a hunt with no
  // answer (or many) lands the human here.
  const [runPathAsk, setRunPathAsk] = useState<string | null>(null);
  // The hunt's answers when several homes wear the repo's name — the
  // panel shows them as buttons; one click keeps and runs.
  const [runMatches, setRunMatches] = useState<string[] | null>(null);

  // A folder's tree rides its connection: the handle lands in IndexedDB
  // where the browser gave one, a session-only file list where it
  // didn't — and a replacement clears the store's stale entry.
  const keepTree = (key: string, folder: TreeFolder) => {
    setTrees((prev) => ({ ...prev, [key]: folder }));
    if (folder.dir) void saveTree(key, { name: folder.name, dir: folder.dir });
    else void removeTree(key);
  };

  const connectRepo = async (key: string) => {
    setConnecting(true);
    try {
      const picked = await pickRepoTree();
      if (!picked) return; // picker closed without a choice — nothing changes
      setRepos((prev) => ({ ...prev, [key]: picked.summary }));
      keepTree(key, picked.folder);
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
  // The nearest connected folder above a level — the chooser's source:
  // the level's own folder when it has one (its files, its children),
  // else the parent's, then each ancestor up to the body itself.
  const nearestTree = (bodyKey: string, crumbs: string[]): TreeFolder | null => {
    for (let depth = crumbs.length; depth >= 0; depth -= 1) {
      const tree = trees[repoKey(bodyKey, crumbs.slice(0, depth))];
      if (tree) return tree;
    }
    return null;
  };
  // Open the chooser: ask the browser's one permission question for a
  // restored tree, then read the source folder's children. A refusal
  // leaves the listing empty — the chooser says so, the laptop's own
  // picker stays available.
  const openBrowse = async (bodyKey: string, crumbs: string[]) => {
    const source = nearestTree(bodyKey, crumbs);
    if (!source) return;
    setBrowsePending(true);
    setBrowse({ path: crumbs, trail: [], name: source.name, listing: null });
    try {
      if (!(await treeReadable(source))) return;
      const listing = await listFolder(source);
      setBrowse({ path: crumbs, trail: [], name: source.name, listing });
    } finally {
      setBrowsePending(false);
    }
  };
  // A step on the chooser's trail — into a named folder, or back one
  // (an empty trail folds the chooser). The walk reads only; the
  // connect stays the Select button's own decision.
  const setBrowseTrail = async (bodyKey: string, crumbs: string[], trail: string[]) => {
    const source = nearestTree(bodyKey, crumbs);
    if (!source) return;
    if (trail.length === 0) {
      setBrowse(null);
      return;
    }
    setBrowsePending(true);
    try {
      if (!(await treeReadable(source))) return;
      const folder = await walkTrail(source, trail);
      if (!folder) return;
      const listing = await listFolder(folder);
      setBrowse({ path: crumbs, trail, name: source.name, listing });
    } finally {
      setBrowsePending(false);
    }
  };
  // A level picks its folder from inside the source's walk — the folder
  // a trail of names reaches is walked for its own summary, its tree
  // kept for the levels beneath it.
  const connectFromTree = async (bodyKey: string, crumbs: string[], trail: string[]) => {
    const key = repoKey(bodyKey, crumbs);
    const source = nearestTree(bodyKey, crumbs);
    if (!source || repos[key] || trail.length === 0) return; // one folder per level; swapping means dropping first
    setConnecting(true);
    try {
      const folder = await walkTrail(source, trail);
      if (!folder) return;
      const summary = await summarizeFolder(folder);
      setRepos((prev) => ({ ...prev, [key]: summary }));
      // the folder's chain of names from the repo root rides along —
      // the run desk aims the app's own harness at exactly this code
      keepTree(key, { ...folder, rel: [...(source.rel ?? []), ...trail] });
      setBrowse(null);
    } finally {
      setConnecting(false);
    }
  };
  // A level takes the loose files of the folder the trail reaches as
  // its file set.
  const connectFilesFromTree = async (bodyKey: string, crumbs: string[], trail: string[]) => {
    const key = repoKey(bodyKey, crumbs);
    const source = nearestTree(bodyKey, crumbs);
    if (!source || files[key]) return;
    setPickingFiles(true);
    try {
      const folder = trail.length > 0 ? await walkTrail(source, trail) : source;
      if (!folder) return;
      const summary = await directFilesSummary(folder);
      if (!summary) return;
      setFiles((prev) => ({ ...prev, [key]: summary }));
      setBrowse(null);
    } finally {
      setPickingFiles(false);
    }
  };
  // A level's folder anchors the levels beneath it — letting go
  // detaches the whole subtree from every map (menus under a body,
  // sub-menus under a menu), the cache and the stored trees following.
  // A stale entry can never surface: a lookup happens only at a level
  // the open tree actually walks.
  const disconnectRepo = (key: string) => {
    setRepos((prev) => dropSubtree(prev, key));
    setFiles((prev) => dropSubtree(prev, key));
    setTrees((prev) => dropSubtree(prev, key));
    void removeTreesUnder(key);
  };
  const disconnectFiles = (key: string) => {
    setFiles((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // A world clicked in the live deck: its console opens wearing the
  // body's own hue — the same even-walk palette the sky painted it
  // with — carrying the body's own paint for the header portrait, and
  // walking its forged tree from the root.
  const openPlanet = (planet: ForgedPlanet, index: number) => {
    if (!selected) return;
    const hues = planetHues(selected.planets.length, selected.sun);
    setConsoleOpen({
      key: `${selected.sun}:${planet.name}`,
      subject: {
        name: planet.name,
        label: planet.label,
        body: {
          id: forgedBodyId(selected.sun, planet.name),
          hue: hues[index]!,
          logo: planet.logo,
        },
      },
      hue: `${hues[index]} 58% 60%`,
      tree: forgedTree(planet),
      path: [],
    });
  };
  // The star clicked: on an app base it IS the center app — its console
  // walks the first app's own menus like any planet's, in literal solar
  // amber (the simulator's SUN_HUE, the way its menu modal paints the
  // sun). On a menu base the sun is the app itself — the ring's planets
  // are its menus, so its console walks them the very same way. No body
  // either way: the header paints ForgeStar.
  const openSun = () => {
    if (!selected) return;
    setConsoleOpen({
      key: selected.sun,
      subject: {
        name: selected.base === "app" ? selected.planets[0]?.name ?? selected.sun : selected.sun,
        label: selected.base === "app" ? "App base" : "Menu base",
      },
      hue: SUN_HUE,
      tree: sunTree(selected),
      path: [],
    });
  };

  // A mini in the console — menu or sub-menu: the panel walks to that
  // level (its own presentation, its own repository console).
  const changeConsolePath = (path: string[]) => {
    setConsoleOpen((open) => (open ? { ...open, path } : open));
  };

  // Play from a console level — the sector's own rule: the run belongs
  // to the connected repo. The dev server's run desk runs THAT repo's
  // own playwright suite from its home on this machine — its own
  // config, its own .env credentials, its own tests. The app's play
  // runs the whole suite; a menu's play aims the harness at its
  // connected folder's chain of code.
  const runLevel = async (open: OpenConsole, rootPathOverride?: string) => {
    const system = selected;
    if (!system || runningRef.current) return;
    const rootPath = rootPathOverride ?? runPaths[open.key];
    if (!rootPath) {
      void resolveRunRoot(open);
      return;
    }
    const folder = open.path.length > 0 ? nearestTree(open.key, open.path) : null;
    const rel = open.path.length > 0 ? (folder?.rel ?? []) : [];
    const pathKey = open.path.join(">");
    const label =
      [system.sun, ...open.path, open.subject.name]
        .join(" ")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "run";
    const pending: LevelRun = { pathKey, label, status: "running", startedAt: Date.now() };
    runningRef.current = true;
    setRun(pending);
    const controller = new AbortController();
    runAbort.current = controller;
    try {
      const response = await fetch("/api/playwright-run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label, rootPath, rel }),
        signal: controller.signal,
      });
      const body = response.body;
      if (!body) throw new Error("the desk sent no stream");
      // the run streams ndjson: the harness's own lines live, the
      // verdict as the last line — each log lands in the panel as it
      // happens, the verdict settles the run
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let landed: LevelRun | null = null;
      const pushLog = (text: string, stream?: "err") => {
        setRun((prev) =>
          prev && prev.status === "running"
            ? { ...prev, logs: [...(prev.logs ?? []).slice(-299), { text, stream }] }
            : prev,
        );
      };
      let logsSeen = false;
      const absorbLine = (line: string) => {
        let event: unknown;
        try {
          event = JSON.parse(line);
        } catch {
          return;
        }
        if (!event || typeof event !== "object") return;
        const ev = event as {
          type?: string;
          stream?: string;
          text?: string;
          ranFrom?: string;
          aim?: string;
          now?: unknown;
          payload?: {
            ok?: boolean;
            ranFrom?: string;
            durationMs?: number;
            stats?: RunStats;
            tests?: RunTests[];
            error?: string;
          };
        };
        if (ev.type === "log" && typeof ev.text === "string") {
          logsSeen = true;
          pushLog(ev.text, ev.stream === "err" ? ("err" as const) : undefined);
          return;
        }
        // a live frame — which file, which line, which block, which
        // step is on stage this second; it lights the banner, not the
        // log box
        if (ev.type === "now" && ev.now && typeof ev.now === "object") {
          const now = ev.now as RunNow;
          setRun((prev) => (prev && prev.status === "running" ? { ...prev, now } : prev));
          return;
        }
        if (ev.type === "start") {
          if (typeof ev.ranFrom === "string") {
            const ranFrom = ev.ranFrom;
            setRun((prev) => (prev ? { ...prev, ranFrom } : prev));
          }
          pushLog(
            `run desk → ${
              typeof ev.aim === "string" && ev.aim ? ev.aim : "the whole suite"
            } — harness starting from ${typeof ev.ranFrom === "string" ? ev.ranFrom : "…"}`,
          );
          return;
        }
        if (ev.type === "ping") {
          // the harness's quiet phase — a web server booting, a sign-in
          // grinding — gets its own line once, so the box never reads dead
          if (!logsSeen) {
            logsSeen = true;
            pushLog(
              "…no line from the harness yet — its quiet phase (web server boot, sign-in) is still grinding…",
            );
          }
          return;
        }
        // a bare payload (old-shape body) and a wrapped one land alike
        const payload = (ev.type === "done" && ev.payload ? ev.payload : ev) as {
          ok?: unknown;
          ranFrom?: string;
          durationMs?: number;
          stats?: RunStats;
          tests?: RunTests[];
          error?: string;
        };
        if (typeof payload.ok === "boolean") {
          landed = {
            ...pending,
            status: payload.ok ? "done" : "error",
            ranFrom: payload.ranFrom,
            durationMs: payload.durationMs,
            stats: payload.stats,
            tests: payload.tests,
            error: payload.error,
          };
        }
      };
      const absorb = (piece: string) => {
        buffer += piece;
        let idx = buffer.indexOf("\n");
        while (idx >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (line) absorbLine(line);
          idx = buffer.indexOf("\n");
        }
      };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        absorb(decoder.decode(value, { stream: true }));
      }
      absorb(decoder.decode());
      if (buffer.trim()) absorbLine(buffer.trim());
      setRun(
        landed ?? {
          ...pending,
          status: "error",
          error: "The run desk closed its pipe with no verdict.",
        },
      );
    } catch (caught) {
      setRun({
        ...pending,
        status: "error",
        error:
          caught instanceof DOMException && caught.name === "AbortError"
            ? "Stopped — the harness was killed before it could finish."
            : "The run desk answered nothing — this page must be the dev server's own to run the harness.",
      });
    } finally {
      runningRef.current = false;
      runAbort.current = null;
    }
  };

  // The Stop press: close the run's pipe — the desk kills the harness
  // the moment its pipe dies.
  const stopRun = () => {
    runAbort.current?.abort();
  };

  // No home on file: the desk hunts this machine for the repo by the
  // root folder's own name — the name rode the connect, so nobody types
  // a path the desk can find itself. One answer: kept and run at once,
  // nothing asked. Several: the panel shows them as buttons. None (or a
  // deaf desk): the panel falls back to asking for the path.
  const resolveRunRoot = async (open: OpenConsole) => {
    const rootName = nearestTree(open.key, [])?.name ?? "";
    setRunMatches(null);
    try {
      const response = await fetch("/api/playwright-run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ find: { rootName } }),
      });
      const data = (await response.json()) as { ok: boolean; matches?: string[] };
      if (data.ok && data.matches) {
        const [hit] = data.matches;
        if (data.matches.length === 1 && hit) {
          setRunPaths((prev) => ({ ...prev, [open.key]: hit }));
          void runLevel(open, hit);
          return;
        }
        if (data.matches.length > 1) {
          setRunMatches(data.matches);
          return;
        }
      }
    } catch {
      // the desk is deaf — the panel asks the human instead
    }
    setRunPathAsk(open.path.join(">"));
  };

  // The repo-home prompt's save: keep the path, then run at once.
  const saveRunRoot = (value: string) => {
    if (!consoleOpen) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    setRunPaths((prev) => ({ ...prev, [consoleOpen.key]: trimmed }));
    setRunPathAsk(null);
    setRunMatches(null);
    void runLevel(consoleOpen, trimmed);
  };

  // The open console's chooser source and state: the nearest connected
  // folder above the walked level, and the listing only when the chooser
  // was opened for this very level.
  const consoleSource = consoleOpen ? nearestTree(consoleOpen.key, consoleOpen.path) : null;
  const consoleBrowse =
    browse && consoleOpen && browse.path.join(">") === consoleOpen.path.join(">")
      ? { name: browse.name, trail: browse.trail, listing: browse.listing }
      : null;
  // The open console's run and gate: the verdict only shows on the very
  // level it was pressed from, and the play button lights once any
  // level of the played subtree carries cargo of its own.
  const consoleRun = run && consoleOpen && run.pathKey === consoleOpen.path.join(">") ? run : null;
  const consoleCanPlay = consoleOpen
    ? subtreeHasCargoIn(repos, files, consoleOpen.key, consoleOpen.path, consoleOpen.tree)
    : false;

  return (
    <div className="dash-space dash-scan-off">
      <DashboardRails active="playwright">
        <div className="dash-topbar">
          <div className="dash-topbar-side">
            {selected && (
              <button
                type="button"
                className="dash-back"
                aria-label="Back to the systems"
                title="Back to the systems"
                onClick={() => {
                  setSelected(null);
                  setConsoleOpen(null);
                  setBrowse(null);
                }}
              >
                <ArrowLeft size={15} aria-hidden />
              </button>
            )}
            <span className="dash-topbar-tag">
              <i className="dash-live-dot" aria-hidden />
              OPS // PLAYWRIGHT
            </span>
          </div>
        </div>
        {selected ? (
          <ForgedOrbitDeck
            system={selected}
            skyHint="Click the sun or any planet — connect each level's folder from the laptop, or from inside its parent's folder"
            onPlanetClick={openPlanet}
            onSunClick={openSun}
          />
        ) : systems.length > 0 ? (
          <SystemShelf systems={systems} onOpen={(system) => setSelected(system)} />
        ) : (
          <section className="dash-soon">
            <span className="dash-soon-glyph" aria-hidden>
              <Theater size={26} strokeWidth={1.6} />
            </span>
            <p className="dash-kicker">Sector reserved</p>
            <h2>Playwright</h2>
            <p>
              The e2e suite&apos;s deck — specs, runs and their reports will
              land here, straight from the harness.
            </p>
          </section>
        )}
      </DashboardRails>
      {/* The clicked body's console — the simulator's own planet menu
          walk over the forged menus and sub-menus, a repository console
          at every level, dressed in the deck pages' dialog. */}
      {selected && consoleOpen && (
        <PlaywrightPlanetModal
          subject={consoleOpen.subject}
          hue={consoleOpen.hue}
          bodyKey={consoleOpen.key}
          tree={consoleOpen.tree}
          path={consoleOpen.path}
          repos={repos}
          files={files}
          pending={connecting}
          filePending={pickingFiles}
          onPath={changeConsolePath}
          onConnect={(path) => connectRepo(repoKey(consoleOpen.key, path))}
          onDisconnect={(path) => disconnectRepo(repoKey(consoleOpen.key, path))}
          onConnectFiles={(path) => connectFiles(repoKey(consoleOpen.key, path))}
          onDisconnectFiles={(path) => disconnectFiles(repoKey(consoleOpen.key, path))}
          browseName={consoleSource?.name ?? null}
          browse={consoleBrowse}
          browsePending={browsePending}
          onBrowseOpen={(browsePath) => void openBrowse(consoleOpen.key, browsePath)}
          onBrowseTrail={(browsePath, trail) => void setBrowseTrail(consoleOpen.key, browsePath, trail)}
          onConnectFromTree={(browsePath, trail) =>
            void connectFromTree(consoleOpen.key, browsePath, trail)
          }
          onConnectFilesFromTree={(browsePath, trail) =>
            void connectFilesFromTree(consoleOpen.key, browsePath, trail)
          }
          onPlay={() => void runLevel(consoleOpen)}
          run={consoleRun}
          canPlay={consoleCanPlay}
          onStop={stopRun}
          runPathAsk={runPathAsk === consoleOpen.path.join(">")}
          runMatches={runMatches}
          runRoot={runPaths[consoleOpen.key] ?? null}
          onRunRoot={saveRunRoot}
          onClose={() => {
            setConsoleOpen(null);
            setBrowse(null);
            setRunPathAsk(null);
            setRunMatches(null);
          }}
        />
      )}
    </div>
  );
}

/** The folder a trail of names reaches beneath a source — folding
 *  subFolder link by link; null when any link is unreadable. */
async function walkTrail(source: TreeFolder, trail: string[]): Promise<TreeFolder | null> {
  let current = source;
  for (const name of trail) {
    const next = await subFolder(current, name);
    if (!next) return null;
    current = next;
  }
  return current;
}

/** The map minus a level's entry and everything beneath it — "sun:App"
 *  also drops "sun:App:Payments" and "sun:App:Payments>Cards";
 *  "sun:App:Payments" drops only its own sub-menus. The colon and
 *  chevron suffixes keep near-miss keys ("sun:App:Payments2") safe. */
function dropSubtree<T>(map: Partial<Record<string, T>>, key: string): Partial<Record<string, T>> {
  const next: Partial<Record<string, T>> = {};
  for (const [k, v] of Object.entries(map)) {
    if (k === key || k.startsWith(`${key}:`) || k.startsWith(`${key}>`)) continue;
    if (v) next[k] = v;
  }
  return next;
}

/** Any cargo in the played subtree — the gate the play button lights
 *  by. The body's own folder counts, then every menu and sub-menu
 *  beneath the walked trail. */
function subtreeHasCargoIn(
  repos: Partial<Record<string, unknown>>,
  files: Partial<Record<string, unknown>>,
  bodyKey: string,
  crumbs: string[],
  tree: ForgedNode[],
): boolean {
  const has = (key: string) => Boolean(repos[key] || files[key]);
  const walk = (nodes: ForgedNode[], path: string[]): boolean =>
    nodes.some(
      (node) =>
        has(repoKey(bodyKey, [...path, node.label])) || walk(node.children ?? [], [...path, node.label]),
    );
  return has(repoKey(bodyKey, crumbs)) || walk(tree, crumbs);
}

/** localStorage keys for the sector's connection maps — the walk's
 *  summaries survive a refresh; each drawer is namespaced by the
 *  signed-in account (userScopedKey), so another login sees its own. */
const REPOS_KEY = "zf-playwright-repos";
const FILES_KEY = "zf-playwright-files";
const RUNPATHS_KEY = "zf-playwright-runpaths";

/** A connection map read back from the cache — an empty map when the
 *  cache is empty, blocked or holding junk, never a thrown refresh. */
function loadMap<T>(key: string): Partial<Record<string, T>> {
  try {
    const raw = window.localStorage.getItem(userScopedKey(key));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Partial<Record<string, T>>) : {};
  } catch {
    return {};
  }
}

/** The map mirrored into the cache — a full or blocked store keeps the
 *  session's own state as-is and stays silent. */
function saveMap<T>(key: string, map: Partial<Record<string, T>>): void {
  try {
    window.localStorage.setItem(userScopedKey(key), JSON.stringify(map));
  } catch {
    // the session's maps are already live — the cache can wait
  }
}
