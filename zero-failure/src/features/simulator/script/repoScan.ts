// Connecting a local repository to a planet: the browser's folder picker —
// the File System Access API where it exists, a webkitdirectory input
// fallback elsewhere — is opened by the laptop's own file manager, and the
// chosen tree is walked for a summary: name, file and folder counts, total
// size and a language breakdown by bytes. Known noise (node_modules, build
// output, dot-directories, lockfiles' dependencies) is skipped so a real
// repository summarizes in a blink. Read-only: nothing is written.

export interface RepoLanguage {
  name: string;
  bytes: number;
}

export interface RepoSummary {
  /** The picked folder's own name. */
  name: string;
  files: number;
  dirs: number;
  bytes: number;
  /** Distinct known languages, largest first. */
  languages: RepoLanguage[];
}

/** Directories that are regenerated or third-party — never interesting in
 *  a repository's shape. */
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "out",
  "vendor",
  "target",
  "venv",
  ".venv",
  "__pycache__",
  ".next",
  ".nuxt",
  ".cache",
  ".gradle",
  ".idea",
  "bin",
  "obj",
  "Pods",
  "DerivedData",
  "coverage",
]);

const MAX_FILES = 20000;
const MAX_DEPTH = 8;

/** File extension → language display name. Extensions that carry no
 *  signal (assets, docs config) are simply not counted. */
const EXT_LANGUAGES: Record<string, string> = {
  ts: "TypeScript",
  tsx: "TypeScript",
  mts: "TypeScript",
  cts: "TypeScript",
  js: "JavaScript",
  jsx: "JavaScript",
  mjs: "JavaScript",
  cjs: "JavaScript",
  py: "Python",
  java: "Java",
  kt: "Kotlin",
  kts: "Kotlin",
  swift: "Swift",
  cs: "C#",
  c: "C",
  h: "C",
  cpp: "C++",
  cc: "C++",
  cxx: "C++",
  hpp: "C++",
  go: "Go",
  rs: "Rust",
  rb: "Ruby",
  php: "PHP",
  dart: "Dart",
  scala: "Scala",
  sh: "Shell",
  bash: "Shell",
  zsh: "Shell",
  ps1: "PowerShell",
  sql: "SQL",
  graphql: "GraphQL",
  html: "HTML",
  htm: "HTML",
  css: "CSS",
  scss: "SCSS",
  sass: "Sass",
  less: "Less",
  vue: "Vue",
  svelte: "Svelte",
  json: "JSON",
  yml: "YAML",
  yaml: "YAML",
  xml: "XML",
  toml: "TOML",
  md: "Markdown",
  mdx: "MDX",
};

interface WalkStats {
  files: number;
  dirs: number;
  bytes: number;
  byLanguage: Map<string, number>;
}

/** A directory handle with the async iteration the DOM lib still doesn't
 *  declare — exported so a picked tree stays reachable for browsing. */
export type DirHandle = FileSystemDirectoryHandle & {
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
};

/** A fallback pick's file — the path it rode in with stays on it. */
export type TreeFile = File & { webkitRelativePath?: string };

/** One live folder inside a connected tree — what a menu connects to
 *  when it picks from inside its parent's folder. File System Access
 *  browsers carry the directory handle itself; the webkitdirectory
 *  fallback carries the pick's whole file list and this folder's path
 *  inside it (root segment included). */
export interface TreeFolder {
  /** The folder's own name. */
  name: string;
  dir?: DirHandle;
  files?: TreeFile[];
  /** The folder's path inside the fallback pick, root segment included. */
  path?: string;
  /** Chain of folder names from the connected repo's root to this
   *  folder — [] for the root itself. The playwright sector's run desk
   *  aims the repo's own harness at exactly this chain of code. */
  rel?: string[];
}

/** A folder's direct children — the list a level's chooser offers. */
export interface FolderListing {
  /** Direct sub-folders, alphabetical, noise skipped. */
  dirs: string[];
  /** Direct loose files, largest first. */
  files: FileEntry[];
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

function isSkippedDir(name: string): boolean {
  return name.startsWith(".") || SKIP_DIRS.has(name);
}

function noteFile(stats: WalkStats, name: string, size: number): void {
  stats.files += 1;
  stats.bytes += size;
  const language = EXT_LANGUAGES[extensionOf(name)];
  if (language)
    stats.byLanguage.set(
      language,
      (stats.byLanguage.get(language) ?? 0) + size,
    );
}

async function walk(
  dir: DirHandle,
  depth: number,
  stats: WalkStats,
): Promise<void> {
  if (depth > MAX_DEPTH || stats.files >= MAX_FILES) return;
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === "directory") {
      if (isSkippedDir(name)) continue;
      stats.dirs += 1;
      await walk(handle as DirHandle, depth + 1, stats);
    } else {
      if (stats.files >= MAX_FILES) return;
      const file = await (handle as FileSystemFileHandle).getFile();
      noteFile(stats, name, file.size);
    }
  }
}

function freshStats(): WalkStats {
  return { files: 0, dirs: 0, bytes: 0, byLanguage: new Map() };
}

function summarize(name: string, stats: WalkStats): RepoSummary {
  return {
    name,
    files: stats.files,
    dirs: stats.dirs,
    bytes: stats.bytes,
    languages: [...stats.byLanguage.entries()]
      .map(([language, bytes]) => ({ name: language, bytes }))
      .sort((a, b) => b.bytes - a.bytes),
  };
}

/** A picked repository and its live tree: the summary the console shows
 *  plus the folder itself, kept reachable so the levels beneath can pick
 *  from inside it instead of the laptop's file manager again. */
export interface PickedRepo {
  summary: RepoSummary;
  folder: TreeFolder;
}

/** Opens the laptop's file manager and reads the chosen folder — the
 *  same summary the walk always made, plus the live folder (a directory
 *  handle where the File System Access API ran, the pick's own file
 *  list in the webkitdirectory fallback) so the tree beneath stays
 *  browsable. Null when the viewer cancels or the browser can't offer a
 *  picker. */
export async function pickRepoTree(): Promise<PickedRepo | null> {
  const picker = (
    window as Window & {
      showDirectoryPicker?: (options?: {
        mode?: "read" | "readwrite";
      }) => Promise<DirHandle>;
    }
  ).showDirectoryPicker;
  if (picker) {
    let dir: DirHandle | null = null;
    try {
      dir = await picker({ mode: "read" });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        // The viewer closed the picker without choosing.
        return null;
      }
      // Any other refusal — lost user gesture, permission policy, an
      // embedded browser that has the API but no real picker — falls
      // through to the input fallback below instead of dying silently.
    }
    if (dir) {
      const stats = freshStats();
      try {
        await walk(dir, 0, stats);
      } catch {
        // A protected subtree (Windows system folders throw on entries())
        // or a revoked grant mid-walk: keep whatever was counted so far.
      }
      return { summary: summarize(dir.name, stats), folder: { name: dir.name, dir, rel: [] } };
    }
  }

  // Fallback (Firefox/Safari): a webkitdirectory input opens the same OS
  // picker; every File then carries its path below the chosen root — the
  // whole list stays collected so the levels beneath can pick from
  // inside it, the path deciding who lives where.
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    (
      input as HTMLInputElement & { webkitdirectory?: boolean }
    ).webkitdirectory = true;
    input.multiple = true;
    const collected: TreeFile[] = [];
    input.onchange = () => {
      for (const file of Array.from(input.files ?? [])) {
        collected.push(file as TreeFile);
      }
      if (collected.length === 0) {
        resolve(null);
        return;
      }
      const root = collected[0]!.webkitRelativePath?.split("/")[0] ?? "repository";
      const folder: TreeFolder = { name: root, files: collected, path: root, rel: [] };
      summarizeFolder(folder).then((summary) => resolve({ summary, folder }));
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

/** Opens the laptop's file manager and summarizes the chosen folder. Null
 *  when the viewer cancels the picker or the browser can't offer one. */
export async function pickRepo(): Promise<RepoSummary | null> {
  const picked = await pickRepoTree();
  return picked?.summary ?? null;
}

/** The same walk the picker ran, over whatever backend the folder came
 *  through — the shared counts a connected level's card shows. The
 *  fallback re-applies the noise rules beneath this folder's own path,
 *  exactly as the root walk once did. */
export async function summarizeFolder(folder: TreeFolder): Promise<RepoSummary> {
  if (folder.dir) {
    const stats = freshStats();
    try {
      await walk(folder.dir, 0, stats);
    } catch {
      // a protected subtree or a revoked grant: keep what was counted
    }
    return summarize(folder.dir.name, stats);
  }
  const stats = freshStats();
  const dirs = new Set<string>();
  const rootDepth = folder.path ? folder.path.split("/").length : 0;
  for (const file of folder.files ?? []) {
    const segments = (file.webkitRelativePath ?? file.name).split("/");
    const inner = segments.slice(rootDepth, -1);
    if (inner.some(isSkippedDir) || inner.length > MAX_DEPTH) continue;
    inner.forEach((_segment, index) => {
      dirs.add(segments.slice(rootDepth, rootDepth + index + 1).join("/"));
    });
    noteFile(stats, segments[segments.length - 1]!, file.size);
  }
  stats.dirs = dirs.size;
  return summarize(folder.name, stats);
}

/** The direct children of a connected folder — its sub-folders by name
 *  and its own loose files — the list a level's chooser shows when it
 *  picks from inside the parent's folder instead of the laptop again. */
export async function listFolder(folder: TreeFolder): Promise<FolderListing> {
  if (folder.dir) {
    const dirs: string[] = [];
    const files: FileEntry[] = [];
    try {
      for await (const [name, handle] of folder.dir.entries()) {
        if (handle.kind === "directory") {
          if (!isSkippedDir(name)) dirs.push(name);
        } else {
          const file = await (handle as FileSystemFileHandle).getFile();
          files.push({ name, size: file.size });
        }
      }
    } catch {
      // a revoked grant mid-read: hand back whatever was read
    }
    return {
      dirs: dirs.sort((a, b) => a.localeCompare(b)),
      files: files.sort((a, b) => b.size - a.size),
    };
  }
  const dirs = new Set<string>();
  const files: FileEntry[] = [];
  const base = folder.path ? `${folder.path}/` : "";
  for (const file of folder.files ?? []) {
    const relative = file.webkitRelativePath ?? file.name;
    if (!relative.startsWith(base)) continue;
    const rest = relative.slice(base.length);
    const slash = rest.indexOf("/");
    if (slash < 0) files.push({ name: rest, size: file.size });
    else if (!isSkippedDir(rest.slice(0, slash))) dirs.add(rest.slice(0, slash));
  }
  return {
    dirs: [...dirs].sort((a, b) => a.localeCompare(b)),
    files: files.sort((a, b) => b.size - a.size),
  };
}

/** Step into a named sub-folder — the folder a level connects when it
 *  picks from inside the parent's. Null when the folder is gone. */
export async function subFolder(
  folder: TreeFolder,
  name: string,
): Promise<TreeFolder | null> {
  if (folder.dir) {
    try {
      const dir = await folder.dir.getDirectoryHandle(name);
      return { name, dir: dir as DirHandle };
    } catch {
      return null;
    }
  }
  return { name, files: folder.files, path: `${folder.path}/${name}` };
}

/** A connected folder's own loose files as a file set — the leaf level's
 *  "add files" taken from inside the parent's folder. Null when the
 *  folder holds no direct files at all. */
export async function directFilesSummary(folder: TreeFolder): Promise<FilesSummary | null> {
  const listing = await listFolder(folder);
  if (listing.files.length === 0) return null;
  const byType = new Map<string, number>();
  const picked: FilesSummary = { count: listing.files.length, bytes: 0, files: listing.files, types: [] };
  for (const entry of listing.files) {
    picked.bytes += entry.size;
    const language = EXT_LANGUAGES[extensionOf(entry.name)];
    if (language) byType.set(language, (byType.get(language) ?? 0) + entry.size);
  }
  picked.types = [...byType.entries()]
    .map(([name, bytes]) => ({ name, bytes }))
    .sort((a, b) => b.bytes - a.bytes);
  return picked;
}

/** Human size for the summary rows: bytes → KB/MB with one decimal. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The repository map's key for a level: the planet's own id at the body
 *  level, `"planet:menu>submenu"` once the walk descends — every planet
 *  and every menu keeps exactly one folder of its own. */
export function repoKey(planet: string, path: string[]): string {
  return path.length > 0 ? `${planet}:${path.join(">")}` : planet;
}

/** One picked loose file, as the leaf consoles remember it. */
export interface FileEntry {
  name: string;
  size: number;
}

/** A loose-file set's summary — what the file picker handed over, sized
 *  and typed. Leaf menus and sub-menus (nothing nested beneath) carry
 *  these beside their folder. */
export interface FilesSummary {
  count: number;
  bytes: number;
  /** Picked files, largest first. */
  files: FileEntry[];
  /** Known types by bytes, largest first. */
  types: RepoLanguage[];
}

/** Opens the laptop's file picker (multiple allowed) and summarizes the
 *  picked loose files: count, total bytes, a type breakdown, the files
 *  themselves by size. Read-only — nothing leaves the machine. Null when
 *  the viewer cancels or picks nothing. */
export function pickFiles(): Promise<FilesSummary | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    let settled = false;
    const finish = (summary: FilesSummary | null) => {
      if (!settled) {
        settled = true;
        resolve(summary);
      }
    };
    input.onchange = () => {
      const picked: FilesSummary = { count: 0, bytes: 0, files: [], types: [] };
      const byType = new Map<string, number>();
      for (const file of Array.from(input.files ?? [])) {
        picked.count += 1;
        picked.bytes += file.size;
        picked.files.push({ name: file.name, size: file.size });
        const language = EXT_LANGUAGES[extensionOf(file.name)];
        if (language) byType.set(language, (byType.get(language) ?? 0) + file.size);
      }
      picked.files.sort((a, b) => b.size - a.size);
      picked.types = [...byType.entries()]
        .map(([name, bytes]) => ({ name, bytes }))
        .sort((a, b) => b.bytes - a.bytes);
      finish(picked.count > 0 ? picked : null);
    };
    input.oncancel = () => finish(null);
    input.click();
  });
}
