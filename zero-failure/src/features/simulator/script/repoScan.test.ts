// The repo walk: skipped trees stay out of the summary, languages come
// out bytes-largest-first, a cancelled picker detaches cleanly and sizes
// read like a human wrote it. The File System Access API is stubbed onto
// a bare `window` — the node test env has no DOM of its own.

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  directFilesSummary,
  formatBytes,
  listFolder,
  pickRepo,
  subFolder,
  summarizeFolder,
  type RepoSummary,
  type TreeFolder,
} from "./repoScan";

interface FakeFile {
  kind: "file";
  name: string;
  size: number;
}

interface FakeDir {
  kind: "directory";
  name: string;
  children: FakeEntry[];
}

type FakeEntry = FakeFile | FakeDir;

function makeHandle(entry: FakeDir): FileSystemDirectoryHandle {
  const handle = {
    kind: "directory",
    name: entry.name,
    async *entries() {
      for (const child of entry.children) {
        yield [child.name, child.kind === "directory" ? makeHandle(child) : makeFile(child)] as const;
      }
    },
    getDirectoryHandle(name: string) {
      const child = entry.children.find((candidate) => candidate.name === name && candidate.kind === "directory");
      if (!child) return Promise.reject(new DOMException("not found", "NotFoundError"));
      return Promise.resolve(makeHandle(child as FakeDir));
    }
  };
  return handle as unknown as FileSystemDirectoryHandle;
}

function makeFile(entry: FakeFile): FileSystemFileHandle {
  return {
    kind: "file",
    name: entry.name,
    getFile: async () => ({ size: entry.size }) as File
  } as unknown as FileSystemFileHandle;
}

function withPicker(impl: (options?: { mode?: string }) => Promise<FileSystemDirectoryHandle>) {
  vi.stubGlobal("window", { showDirectoryPicker: impl });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("pickRepo", () => {
  it("summarizes the tree: skips generated trees, ranks languages by bytes", async () => {
    withPicker(() =>
      Promise.resolve(
        makeHandle({
          kind: "directory",
          name: "zero-failure",
          children: [
            {
              kind: "directory",
              name: "src",
              children: [
                { kind: "file", name: "app.tsx", size: 3000 },
                { kind: "file", name: "main.ts", size: 1000 },
                { kind: "file", name: "styles.css", size: 500 }
              ]
            },
            // noise: never counted, however heavy
            {
              kind: "directory",
              name: "node_modules",
              children: [{ kind: "file", name: "huge.js", size: 999999 }]
            },
            { kind: "directory", name: ".git", children: [{ kind: "file", name: "index", size: 4000 }] },
            { kind: "file", name: "README.md", size: 250 }
          ]
        })
      )
    );
    const repo: RepoSummary | null = await pickRepo();
    expect(repo).not.toBeNull();
    expect(repo!.name).toBe("zero-failure");
    expect(repo!.files).toBe(4);
    expect(repo!.dirs).toBe(1); // src — node_modules and .git don't count
    expect(repo!.bytes).toBe(4750);
    expect(repo!.languages.map((l) => l.name)).toEqual(["TypeScript", "CSS", "Markdown"]);
    expect(repo!.languages[0]).toEqual({ name: "TypeScript", bytes: 4000 });
  });

  it("resolves null when the viewer cancels the picker", async () => {
    withPicker(() => Promise.reject(new DOMException("aborted", "AbortError")));
    await expect(pickRepo()).resolves.toBeNull();
  });
});

describe("formatBytes", () => {
  it("reads like a human wrote it", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("tree browsing", () => {
  const fixture = {
    kind: "directory" as const,
    name: "zero-failure",
    children: [
      {
        kind: "directory" as const,
        name: "src",
        children: [
          { kind: "file" as const, name: "app.tsx", size: 3000 },
          { kind: "file" as const, name: "main.ts", size: 1000 },
          { kind: "file" as const, name: "styles.css", size: 500 }
        ]
      },
      // noise: never listed, never counted
      { kind: "directory" as const, name: "node_modules", children: [] },
      { kind: "file" as const, name: "README.md", size: 250 }
    ]
  };

  it("lists a folder's direct children, noise skipped", async () => {
    const listing = await listFolder({ name: "zero-failure", dir: makeHandle(fixture) });
    expect(listing.dirs).toEqual(["src"]);
    expect(listing.files).toEqual([{ name: "README.md", size: 250 }]);
  });

  it("steps into a sub-folder and summarizes it with the same walk", async () => {
    const root: TreeFolder = { name: "zero-failure", dir: makeHandle(fixture) };
    const src = await subFolder(root, "src");
    expect(src).not.toBeNull();
    const summary = await summarizeFolder(src!);
    expect(summary.name).toBe("src");
    expect(summary.files).toBe(3);
    expect(summary.dirs).toBe(0);
    expect(summary.bytes).toBe(4500);
    expect(summary.languages[0]).toEqual({ name: "TypeScript", bytes: 4000 });
  });

  it("summarizes a missing sub-folder as null, never a throw", async () => {
    const root: TreeFolder = { name: "zero-failure", dir: makeHandle(fixture) };
    await expect(subFolder(root, "nope")).resolves.toBeNull();
  });

  it("gathers a folder's own loose files into a file set", async () => {
    const picked = await directFilesSummary({ name: "zero-failure", dir: makeHandle(fixture) });
    expect(picked).not.toBeNull();
    expect(picked!.count).toBe(1);
    expect(picked!.bytes).toBe(250);
    expect(picked!.files).toEqual([{ name: "README.md", size: 250 }]);
    expect(picked!.types).toEqual([{ name: "Markdown", bytes: 250 }]);
  });

  it("returns null when a folder holds no direct files", async () => {
    // a folder whose children are only folders — no loose file of its own
    const wrapper = await subFolder(
      {
        name: "zero-failure",
        dir: makeHandle({
          kind: "directory",
          name: "zero-failure",
          children: [
            { kind: "directory", name: "wrapper", children: [fixture] }
          ]
        })
      },
      "wrapper"
    );
    expect(wrapper).not.toBeNull();
    await expect(directFilesSummary(wrapper!)).resolves.toBeNull();
  });
});
