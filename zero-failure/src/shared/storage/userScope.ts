// Per-account storage. Every drawer of app data — connected repos,
// run paths, forged systems, the menu showcase, settings — used to
// ride one browser-wide localStorage key, so any account signing in
// on this browser saw the last account's data. A key that goes
// through userScopedKey carries the signed-in account's id, so each
// account reads and writes its own drawer; sign back in and the old
// drawer is right where it was. The first account in after this
// change inherits the old shared drawer and the shared key comes
// down — later accounts start with their own.

let currentUserId: string | undefined;
let currentIdentities: readonly string[] = [];
const migrated = new Set<string>();

/** Identity claim fields the platform might stamp as a record's
 *  creator — read broadly, matched exactly, in preference order. */
const IDENTITY_FIELDS = ["sub", "userId", "uid", "id", "email", "userName", "preferred_username"];

/** AuthProvider calls this when the session's claims arrive — or
 *  leave. The identity sits in whichever claim IAM chose (sub,
 *  userId, uid, id, email as the last resort); nothing recognizable
 *  keeps the browser-wide keys, the old behavior. */
export function setCurrentUserScope(claims?: Record<string, unknown>): void {
  const identities = identitiesFrom(claims);
  currentUserId = identities[0];
  currentIdentities = identities;
}

function identitiesFrom(claims?: Record<string, unknown>): string[] {
  const found: string[] = [];
  for (const field of IDENTITY_FIELDS) {
    const value = claims?.[field];
    if (typeof value === "string" && value.trim()) found.push(value.trim());
  }
  return found;
}

/** Every identity string of the signed-in account — anything a
 *  record's CreatedBy stamp might carry for this viewer. Empty when
 *  nobody is signed in. */
export function currentUserIds(): readonly string[] {
  return currentIdentities;
}

/** The storage key for `base`, namespaced by the signed-in account —
 *  the bare key when nobody is signed in. The first call per scoped
 *  key also runs the one-time migration: an account finding an empty
 *  drawer and a full shared one inherits the shared data, so the
 *  upgrade never eats anyone's setup. */
export function userScopedKey(base: string): string {
  const id = currentUserId;
  if (!id) return base;
  const scoped = `${base}:${id}`;
  migrateLegacy(base, scoped);
  return scoped;
}

// One attempt per scoped key per tab. An account whose drawer
// already exists found its own data — the shared era is over either
// way, so the shared key comes down. An account finding an empty
// drawer and a full shared one is the first in since the split: it
// inherits the shared data, and only then does the shared key come
// down, so the next account starts with its own empty drawer. A
// failure dies quietly; the page renders on its defaults either way.
function migrateLegacy(base: string, scoped: string): void {
  if (migrated.has(scoped)) return;
  migrated.add(scoped);
  try {
    if (window.localStorage.getItem(scoped) !== null) {
      window.localStorage.removeItem(base);
      return;
    }
    const legacy = window.localStorage.getItem(base);
    if (legacy === null) return;
    window.localStorage.setItem(scoped, legacy);
    window.localStorage.removeItem(base);
  } catch {
    // storage unavailable (private mode etc.) — defaults are fine
  }
}
