// The run desk's browser-side sidecars, read back for the dashboard's
// mission readout: which levels carry a linked repository or a
// loose-file set, and which apps have a repo home on this machine for
// the run desk to launch a suite from. Read-only — the playwright
// sector owns every write; the key constants mirror its REPOS_KEY /
// FILES_KEY / RUNPATHS_KEY, and the per-account scoping comes from the
// same userScopedKey the writer used. A blocked or junky cache just
// reads as empty — the readout degrades, never breaks.

import { userScopedKey } from "../../shared/storage/userScope";

/** One linked repository row for the readout — the level key it hangs
 *  off and the folder summary the console shows. */
export interface DeskRepoRow {
  key: string;
  name: string;
  files: number;
}

export interface DeskSidecar {
  /** Linked repository folders, one row per level. */
  repos: DeskRepoRow[];
  /** Levels carrying a picked loose-file set. */
  fileSets: number;
  /** Apps whose repo home is known on this machine — the run desk's
   *  launch pads. */
  homes: string[];
}

function readMap(key: string): Record<string, unknown> {
  try {
    const raw = window.localStorage.getItem(userScopedKey(key));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function readDeskSidecar(): DeskSidecar {
  const repos: DeskRepoRow[] = [];
  for (const [key, value] of Object.entries(readMap("zf-playwright-repos"))) {
    // the summary shape is the writer's business — only bless what the
    // readout renders, and let everything else ride as "linked"
    const name = value && typeof value === "object" && typeof (value as { name?: unknown }).name === "string"
      ? (value as { name: string }).name
      : key;
    const files = value && typeof value === "object" && typeof (value as { files?: unknown }).files === "number"
      ? (value as { files: number }).files
      : 0;
    repos.push({ key, name, files });
  }
  return {
    repos,
    fileSets: Object.keys(readMap("zf-playwright-files")).length,
    homes: Object.keys(readMap("zf-playwright-runpaths")),
  };
}
