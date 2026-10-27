// The access console's IAM wire: every read and the one write the
// registry allows — listing operatives, reading one operative's
// clearance, the assignable-role and permission catalogs, and the
// access grant that replaces an operative's roles and permissions in
// one transmission. IAM answers in loose Records, so wire shapes stay
// `unknown` until a normalize blesses them — a stranger field must
// degrade to a default, never break the console. The client is
// injected so tests (and node) never construct the real browser
// client.

import type { BlocksClient } from "@seliseblocks/client";

/** One operative as the console sees them: identity, the clearance
 *  chips (role slugs, permission references), the live flag, the
 *  registry's own activation flag, and the two timestamps the
 *  dossier's invited-operatives window reads (invite moment, last
 *  time through the door). */
export interface AccUser {
  itemId: string;
  email: string;
  firstName: string;
  lastName: string;
  active: boolean;
  verified: boolean;
  lastLoggedInTime: string;
  createdDate: string;
  roles: string[];
  permissions: string[];
}

export interface AccUserPage {
  users: AccUser[];
  totalCount: number;
  pageSize: number;
}

export interface AccRole {
  itemId: string;
  name: string;
  slug: string;
}

export interface AccPermission {
  itemId: string;
  name: string;
  resource: string;
  roles: string[];
  /** what enforces the grant — the gateway, the SPA gate, or masking */
  kind: "endpoint" | "frontend" | "data" | "";
  builtIn: boolean;
}

/** One role definition as the registry sees it: the display name, the
 *  slug every grant keys off, what it's for, and how many permissions
 *  ride in it. */
export interface AccRoleDef {
  itemId: string;
  name: string;
  slug: string;
  description: string;
  permissionCount: number;
  canCreateOwn: boolean;
  isArchived: boolean;
}

export interface AccRolePage {
  roles: AccRoleDef[];
  totalCount: number;
  pageSize: number;
}

/** What staging would change, per kind, both directions — the review
 *  strip reads straight off this. */
export interface AccessDelta {
  addedRoles: string[];
  removedRoles: string[];
  addedPermissions: string[];
  removedPermissions: string[];
}

export interface AccessListQuery {
  pageNo: number;
  pageSize: number;
  search?: string;
}

/** A loose IAM answer, readable only when it rode back as an object. */
function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Strings only, trimmed, empties dropped, first-seen order kept —
 *  the clearance chips' one honest shape whatever the wire said. */
export function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (trimmed) seen.add(trimmed);
  }
  return [...seen];
}

/** The clearance lists ride differently per endpoint — the file read
 *  hands a flat string array, the registry hands an object keyed by
 *  organization (`{ default: ["clouduser"] }`). Every array the value
 *  carries reads as one deduped list; anything else reads as none. */
function readAccessList(value: unknown): string[] {
  if (Array.isArray(value)) return normalizeStringArray(value);
  const rec = asRecord(value);
  if (!rec) return [];
  const merged: unknown[] = [];
  for (const key of Object.keys(rec)) {
    const entry = rec[key];
    if (Array.isArray(entry)) merged.push(...entry);
  }
  return normalizeStringArray(merged);
}

export function normalizeUser(raw: unknown): AccUser {
  const rec = asRecord(raw);
  return {
    itemId: rec ? asString(rec.itemId) : "",
    email: rec ? asString(rec.email) : "",
    firstName: rec ? asString(rec.firstName) : "",
    lastName: rec ? asString(rec.lastName) : "",
    active: rec?.active === true,
    verified: rec?.isVerified === true,
    lastLoggedInTime: rec ? asString(rec.lastLoggedInTime) : "",
    createdDate: rec ? asString(rec.createdDate) : "",
    roles: readAccessList(rec?.roles),
    permissions: readAccessList(rec?.permissions),
  };
}

/** The dossier's own display rule, for any AccUser: the given name,
 *  else the signal address, else the record id. */
export function accUserDisplayName(user: AccUser): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name || user.email || user.itemId;
}

/** The operative's door status, read straight off the registry's own
 *  flags: an activation mail still unanswered (`isVerified` false)
 *  reads as pending, then the account's live flag splits active from
 *  held. Nothing here guesses — a password-created account is
 *  whatever the server says it is. */
export function accUserStatus(user: AccUser): "pending" | "active" | "held" {
  if (!user.verified) return "pending";
  return user.active ? "active" : "held";
}

/** Newest invite first — the invited-operatives window's one
 *  ordering. A row whose created date is absent or unreadable sinks
 *  below every dated one and keeps its wire order among its kin. */
export function byInviteRecency(a: AccUser, b: AccUser): number {
  const left = Date.parse(a.createdDate);
  const right = Date.parse(b.createdDate);
  if (Number.isNaN(left) && Number.isNaN(right)) return 0;
  if (Number.isNaN(left)) return 1;
  if (Number.isNaN(right)) return -1;
  return right - left;
}

export function normalizeUserPage(
  raw: { data?: unknown; totalCount?: unknown },
  fallbackPageSize: number
): AccUserPage {
  const users = Array.isArray(raw.data) ? raw.data.map(normalizeUser) : [];
  return {
    users,
    totalCount: typeof raw.totalCount === "number" ? raw.totalCount : users.length,
    pageSize: fallbackPageSize,
  };
}

export function normalizeRole(raw: unknown): AccRole {
  const rec = asRecord(raw);
  const itemId = rec ? asString(rec.itemId) : "";
  const slug = rec ? asString(rec.slug) : "";
  const name = rec ? asString(rec.name) || slug || itemId : "";
  return { itemId, name, slug };
}

/** The wire's raw type enum (1/2/3) read as what enforces the grant —
 *  anything else reads as unset. */
function permissionKind(value: unknown): AccPermission["kind"] {
  if (value === 1) return "endpoint";
  if (value === 2) return "frontend";
  if (value === 3) return "data";
  return "";
}

export function normalizePermission(raw: unknown): AccPermission {
  const rec = asRecord(raw);
  const itemId = rec ? asString(rec.itemId) : "";
  const resource = rec ? asString(rec.resource) : "";
  return {
    itemId,
    name: (rec ? asString(rec.name) : "") || resource || itemId,
    resource,
    roles: normalizeStringArray(rec?.roles),
    kind: permissionKind(rec?.type),
    builtIn: rec?.isBuiltIn === true,
  };
}

export function normalizeRoleDef(raw: unknown): AccRoleDef {
  const rec = asRecord(raw);
  const itemId = rec ? asString(rec.itemId) : "";
  const slug = rec ? asString(rec.slug) : "";
  return {
    itemId,
    name: rec ? asString(rec.name) || slug || itemId : "",
    slug,
    description: rec ? asString(rec.description) : "",
    permissionCount: rec && typeof rec.count === "number" ? rec.count : 0,
    canCreateOwn: rec?.canCreateOwn === true,
    isArchived: rec?.isArchived === true,
  };
}

export function normalizeRolePage(
  raw: { data?: unknown; totalCount?: unknown },
  fallbackPageSize: number
): AccRolePage {
  const roles = Array.isArray(raw.data) ? raw.data.map(normalizeRoleDef) : [];
  return {
    roles,
    totalCount: typeof raw.totalCount === "number" ? raw.totalCount : roles.length,
    pageSize: fallbackPageSize,
  };
}

/** Every form the wire might have used to record one permission on a
 *  user's file — the catalog id, the display name, or the resolved
 *  resource string (`blocks-iam::iam::users`). Checks and unchecks
 *  match on all of them, so a grant the file already carries never
 *  reads as absent and a staged replace can't silently drop it. The
 *  forms dedupe, since the display name often falls back to the id. */
export function permissionForms(perm: AccPermission): string[] {
  return normalizeStringArray([perm.itemId, perm.name, perm.resource]);
}

/** The form one tick stages onto the file: the resolved resource
 *  string — the very form the platform's own console transmits
 *  (`permissions: selected.map(p => p.resource)`). The gateway stores
 *  a user grant verbatim, so an id-staged tick would read back as a
 *  raw GUID chip on every authorization list; the resource string
 *  reads back as itself. Name is the fallback for the rare row the
 *  catalog answers without a resource, and the id is the last resort
 *  only — the wire's reference unit, never the intended form. */
export function permissionRef(perm: AccPermission): string {
  return perm.resource || perm.name || perm.itemId || "";
}

/** `roles.assignable()` rides no fixed envelope — a bare array, a
 *  `{ data }` page, an `{ items }` bundle, or the real one the
 *  endpoint answers with: `{ hierarchy: [...], standalone: [...] }`,
 *  the roles this operator may hand out split by kind. All of them
 *  read as one list, deduped by slug (hierarchy wins first place);
 *  anything else reads as none. */
export function normalizeAssignableRoles(raw: unknown): AccRole[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) list = raw;
  else {
    const rec = asRecord(raw);
    if (rec && Array.isArray(rec.data)) list = rec.data;
    else if (rec && Array.isArray(rec.items)) list = rec.items;
    else if (rec && (Array.isArray(rec.hierarchy) || Array.isArray(rec.standalone))) {
      list = [
        ...(Array.isArray(rec.hierarchy) ? rec.hierarchy : []),
        ...(Array.isArray(rec.standalone) ? rec.standalone : []),
      ];
    }
  }
  const seen = new Set<string>();
  return list
    .map(normalizeRole)
    .filter((role) => {
      if (role.slug && seen.has(role.slug)) return false;
      if (role.slug) seen.add(role.slug);
      return true;
    });
}

/** Both directions, per kind, sorted for a stable review strip — a
 *  no-op stage returns four empty arrays and the transmit stays shut.
 *  Both sides dedupe: a duplicated entry in any set must not read as
 *  two staged changes. */
export function computeAccessDelta(
  currentRoles: string[],
  currentPermissions: string[],
  desiredRoles: string[],
  desiredPermissions: string[]
): AccessDelta {
  const diff = (current: string[], desired: string[]) => {
    const now = new Set(current);
    const next = new Set(desired);
    const pick = (list: string[], other: Set<string>) => {
      const seen = new Set<string>();
      return list
        .filter((entry) => {
          if (other.has(entry) || seen.has(entry)) return false;
          seen.add(entry);
          return true;
        })
        .sort((a, b) => a.localeCompare(b));
    };
    return { added: pick(desired, now), removed: pick(current, next) };
  };
  const roles = diff(currentRoles, desiredRoles);
  const permissions = diff(currentPermissions, desiredPermissions);
  return {
    addedRoles: roles.added,
    removedRoles: roles.removed,
    addedPermissions: permissions.added,
    removedPermissions: permissions.removed,
  };
}

/** The IAM list endpoints' one body shape — POST-reads carrying a
 *  zero-based `page`, a `pageSize`, and every term under `filter`
 *  (whose `search` is non-nullable server-side and must always ride,
 *  blank meaning "no filter"). The SDK's pageNo/pageNumber spellings
 *  are ignored by the wire: a request carrying them reads as page
 *  one at twenty rows, unfiltered — the very bug that made every
 *  catalog page render the same rows. */
function iamListBody(
  pageNo: number,
  pageSize: number,
  filter: Record<string, unknown>
): Record<string, unknown> {
  return {
    filter,
    // the UI counts pages from one; the wire counts from zero
    page: Math.max(0, pageNo - 1),
    pageSize,
  };
}

/** One page of the registry — a POST-read, not a GET; a refusal
 *  (403 and kin) rejects and the console's empty state tells it.
 *  The users filter has no generic sweep — an address-shaped term
  * sweeps the email column, anything else the name column. */
export async function fetchUsers(client: BlocksClient, query: AccessListQuery): Promise<AccUserPage> {
  const term = query.search?.trim() ?? "";
  const response = await client.iam.users.list(
    iamListBody(
      query.pageNo,
      query.pageSize,
      term.includes("@") ? { email: term } : term ? { name: term } : {}
    )
  );
  return normalizeUserPage(
    { data: response.data, totalCount: response.totalCount },
    query.pageSize
  );
}

/** One operative, fresh — the editor always stages from this read,
 *  never from a possibly-stale list row. */
export async function fetchUser(client: BlocksClient, userId: string): Promise<AccUser> {
  const response = await client.iam.users.get(userId);
  const rec = asRecord(response);
  return normalizeUser(rec && "data" in rec ? rec.data : response);
}

/** The duplicate-address check an invite form runs while its operator
 *  types — true means the address is free for a new operative. */
export async function fetchEmailAvailable(client: BlocksClient, email: string): Promise<boolean> {
  const response = await client.iam.users.emailAvailable({ email });
  const rec = asRecord(response);
  return rec?.isAvailable === true;
}

/** The roles this console's operator may hand out — the grant
 *  picker's only source, never the full role catalog. */
export async function fetchAssignableRoles(client: BlocksClient): Promise<AccRole[]> {
  return normalizeAssignableRoles(await client.iam.roles.assignable());
}

/** One page of the role registry — the definitions themselves, not
 *  the assignable subset the grant picker reads. */
export async function fetchRoles(client: BlocksClient, query: AccessListQuery): Promise<AccRolePage> {
  const response = await client.iam.roles.list(
    iamListBody(query.pageNo, query.pageSize, { search: query.search?.trim() ?? "" })
  );
  return normalizeRolePage(
    { data: response.data, totalCount: response.totalCount },
    query.pageSize
  );
}

/** Every permission one role holds, paged through in a bounded loop —
 *  the checkmark column's source of truth. The catalog's own pages
 *  can't fill this role: a search or a later page hides held grants. */
export async function fetchRolePermissions(
  client: BlocksClient,
  slug: string
): Promise<AccPermission[]> {
  const pageSize = 200;
  const held: AccPermission[] = [];
  const seen = new Set<string>();
  for (let pageNo = 1; pageNo <= 5; pageNo++) {
    const response = await client.iam.permissions.list({
      ...iamListBody(pageNo, pageSize, { search: "", isBuiltIn: "" }),
      roles: [slug],
    });
    const data = Array.isArray(response.data) ? response.data.map(normalizePermission) : [];
    for (const perm of data) {
      const key = perm.itemId || perm.resource || perm.name;
      if (seen.has(key)) continue;
      seen.add(key);
      held.push(perm);
    }
    const totalCount = typeof response.totalCount === "number" ? response.totalCount : held.length;
    // stop when the count says the set is whole, or the wire returned
    // an empty page — the cap bounds a lying count either way
    if (data.length === 0 || held.length >= totalCount) break;
  }
  return held;
}

export async function fetchPermissions(
  client: BlocksClient,
  query: AccessListQuery
): Promise<{ permissions: AccPermission[]; totalCount: number }> {
  const response = await client.iam.permissions.list(
    iamListBody(query.pageNo, query.pageSize, {
      search: query.search?.trim() ?? "",
      isBuiltIn: "",
    })
  );
  const data = Array.isArray(response.data) ? response.data.map(normalizePermission) : [];
  return {
    permissions: data,
    totalCount: typeof response.totalCount === "number" ? response.totalCount : data.length,
  };
}

/** The console's one write: grant or change an operative's clearance.
 *  The gateway replaces any list it receives and keeps any list it
 *  doesn't, so both complete desired sets always ride — and they ride
 *  as copies, so later staging can't bend an in-flight request. */
export async function updateUserAccess(
  client: BlocksClient,
  request: { userId: string; roles: string[]; permissions: string[] }
): Promise<void> {
  await client.iam.users.updateAccess({
    userId: request.userId,
    roles: [...request.roles],
    permissions: [...request.permissions],
  });
}

/** The one write the plain transmission can't say: strip an operative
 *  to an empty role list, an empty permission list, or both. The
 *  gateway's access write keeps a list that arrives empty — a member
 *  never rides with nothing — so "remove the last grant" has no
 *  single-call form. The platform's own escape hatch is a revoke and
 *  an immediate re-grant: the revoke lifts the membership (roles,
 *  permissions, all of it), the re-grant restores exactly what the
 *  operator kept, and an empty side starts empty on the way back in.
 *  Both legs ride silent (notifyUser false) — the operative's mail
 *  should not announce a rewrite that nets to what they already had.
 *  The gateway refuses revoking one's own access, so on the operator's
 *  own file this transmission is refused before anything lands. */
export async function clearUserAccessOverrides(
  client: BlocksClient,
  request: { userId: string; roles: string[]; permissions: string[] }
): Promise<void> {
  // The revoke lifts everything, so record what's on file first — if the
  // re-grant leg fails, this snapshot is what best-effort restoration puts
  // back, instead of leaving the operative stripped while the console
  // shows an error.
  const onFile = await fetchUser(client, request.userId).catch(() => null);
  await client.iam.users.revokeAccess({
    userId: request.userId,
    notifyUser: false,
  });
  try {
    await client.iam.users.updateAccess({
      userId: request.userId,
      roles: [...request.roles],
      permissions: [...request.permissions],
      notifyUser: false,
    });
  } catch (err) {
    if (onFile) {
      // Best effort only, and silent: the original failure is the one the
      // operator must see, and a failed restore must not mask it.
      await client.iam.users
        .updateAccess({
          userId: request.userId,
          roles: [...onFile.roles],
          permissions: [...onFile.permissions],
          notifyUser: false,
        })
        .catch(() => undefined);
    }
    throw err;
  }
}

/** Define a new role — the name is the only required field; the slug
 *  rides only when the operator typed one, else the gateway derives
 *  it. Omitted optionals are absent from the body, not empty strings. */
export async function createRole(
  client: BlocksClient,
  request: { name: string; slug?: string; description?: string }
): Promise<void> {
  await client.iam.roles.create({
    name: request.name,
    ...(request.slug ? { slug: request.slug } : {}),
    ...(request.description ? { description: request.description } : {}),
  });
}

/** Invite an operative: provision the account under one address. An
 *  omitted password is the invitation itself — the platform mails an
 *  activation link and the operative sets their own — so absent
 *  optionals stay absent from the body, never empty strings. Roles
 *  ride as slugs, as a copy. */
export async function createUser(
  client: BlocksClient,
  request: { email: string; firstName?: string; lastName?: string; password?: string; roles?: string[] }
): Promise<void> {
  await client.iam.users.create({
    email: request.email,
    ...(request.firstName ? { firstName: request.firstName } : {}),
    ...(request.lastName ? { lastName: request.lastName } : {}),
    ...(request.password ? { password: request.password } : {}),
    ...(request.roles && request.roles.length ? { roles: [...request.roles] } : {}),
  });
}

/** Attach/detach permissions on one role — a delta, not a replace:
 *  the adds and the removals ride the one transmission as permission
 *  ids, and both ride as copies, so later staging can't bend an
 *  in-flight request. The role keys off its slug. */
export async function assignRolePermissions(
  client: BlocksClient,
  request: { slug: string; addPermissions: string[]; removePermissions: string[] }
): Promise<void> {
  await client.iam.roles.assignPermissions({
    slug: request.slug,
    addPermissions: [...request.addPermissions],
    removePermissions: [...request.removePermissions],
  });
}
