// The picked trees outlive their page: a folder connected through the
// File System Access API keeps its directory handle in IndexedDB — the
// one store a refresh cannot take — so the levels beneath keep picking
// from inside it after the tab comes back. A restored handle answers
// "prompt" until the viewer grants it again; the first click that needs
// the tree asks once, and a denial just leaves the laptop's own picker
// as the road. The webkitdirectory fallback keeps no handle (the
// browser hands none out), so those trees ride the session alone —
// their summaries still persist beside every other connection.

export interface StoredTree {
  name: string;
  dir: FileSystemDirectoryHandle;
}

const DB_NAME = "zf-playwright-trees";
const STORE = "trees";

/** The tree store, opened quietly — a blocked or absent IndexedDB
 *  resolves null and every caller carries on without persistence. */
function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) {
          request.result.createObjectStore(STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Every stored tree, keyed by the level key its summary hangs off —
 *  an empty record when the store is empty, blocked or unreadable. */
export async function loadTrees(): Promise<Record<string, StoredTree>> {
  const db = await openDb();
  if (!db) return {};
  return new Promise((resolve) => {
    try {
      const store = db.transaction(STORE, "readonly").objectStore(STORE);
      const keysRequest = store.getAllKeys();
      const valuesRequest = store.getAll();
      keysRequest.onsuccess = () => {
        valuesRequest.onsuccess = () => {
          const trees: Record<string, StoredTree> = {};
          keysRequest.result.forEach((key, index) => {
            const value = valuesRequest.result[index] as StoredTree | undefined;
            if (typeof key === "string" && value?.dir) trees[key] = value;
          });
          db.close();
          resolve(trees);
        };
      };
      keysRequest.onerror = () => {
        db.close();
        resolve({});
      };
    } catch {
      db.close();
      resolve({});
    }
  });
}

/** One tree written into the store — a failed write leaves the session's
 *  live tree untouched, the next connect overwrites it anyway. */
export async function saveTree(key: string, tree: StoredTree): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(tree, key);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
  db.close();
}

/** One tree dropped — the level's folder was disconnected or replaced. */
export async function removeTree(key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const request = db.transaction(STORE, "readwrite").objectStore(STORE).delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
  db.close();
}

/** Every tree at or beneath a level — the same subtree rule the
 *  connection maps follow, so a disconnected branch keeps no handles
 *  (or restored grants) dangling in the store. */
export async function removeTreesUnder(key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const store = db.transaction(STORE, "readwrite").objectStore(STORE);
      const keysRequest = store.getAllKeys();
      keysRequest.onsuccess = () => {
        for (const candidate of keysRequest.result) {
          if (typeof candidate !== "string") continue;
          if (candidate === key || candidate.startsWith(`${key}:`) || candidate.startsWith(`${key}>`)) {
            store.delete(candidate);
          }
        }
        resolve();
      };
      keysRequest.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
  db.close();
}

/** May this folder be read right now? A handle picked this session is
 *  always granted; a restored one asks the browser's one permission
 *  question — which needs the click it is being asked from, and a
 *  refusal simply reads as false. */
export async function treeReadable(folder: { dir?: FileSystemDirectoryHandle }): Promise<boolean> {
  const dir = folder.dir as
    | (FileSystemDirectoryHandle & {
        queryPermission?: (descriptor: { mode: "read" }) => Promise<PermissionState>;
        requestPermission?: (descriptor: { mode: "read" }) => Promise<PermissionState>;
      })
    | undefined;
  if (!dir) return true; // the fallback's file list needs no grant
  try {
    if (dir.queryPermission && (await dir.queryPermission({ mode: "read" })) === "granted") {
      return true;
    }
    if (!dir.requestPermission) return false;
    return (await dir.requestPermission({ mode: "read" })) === "granted";
  } catch {
    return false;
  }
}
