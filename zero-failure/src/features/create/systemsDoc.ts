// The forged deck's persistence: a Data Gateway collection is the source
// of truth, localStorage is the per-browser cache beneath it. Wire shapes
// stay `unknown` until parse blesses them — a stranger record (or a
// schema not yet pushed to this tenant) must degrade to the cache, never
// break the deck. Modeled on the simulator's broadcast-doc adapter, which
// paved this exact road; the client is injected so tests (and node) never
// construct the real browser client.

import type { BlocksClient } from "@seliseblocks/client";
import { DEFAULT_FORGE_ICON, FORGE_ICONS, type BodyLogo } from "./iconCatalog";
import { userScopedKey } from "../../shared/storage/userScope";

export type ForgeBase = "app" | "menu";

/** The deepest row: a name, a logo — a sub-menu leaf. On the
 *  presentation show it may also carry its own words and a mute. */
export interface ForgedLeaf {
  name: string;
  logo: BodyLogo;
  speech?: string;
  /** True and the level keeps quiet even with words written. */
  muted?: boolean;
  /** The cartoon face speaking these words in the bubble — a cast id;
   *  absent, the bubble stays text-only. */
  avatar?: string;
  /** The level's own narration voice (voiceURI) and pitch — absent, the
   *  show falls back to its global narration voice. */
  voice?: string;
  pitch?: number;
}

/** One app's own menu: a name, a logo, and the sub-menus beneath it —
 *  the app base's chain runs app → menu → sub-menu. The presentation
 *  show lets menus speak their own words too, mute included. */
export interface ForgedMenu {
  name: string;
  logo: BodyLogo;
  submenu?: ForgedLeaf[];
  speech?: string;
  muted?: boolean;
  /** See ForgedLeaf — menus carry the very same face and voice. */
  avatar?: string;
  voice?: string;
  pitch?: number;
}

/** One first-ring body: its name, the label that sits under it (app
 *  base), its logo — a shelf glyph or an uploaded image —, the words it
 *  says about itself while the presentation show plays, and its tree:
 *  a menu base's menus carry sub-menus, an app base's apps carry
 *  menus that carry sub-menus. */
export interface ForgedPlanet {
  name: string;
  label?: string;
  logo: BodyLogo;
  speech?: string;
  /** True and the body keeps quiet even with words written. */
  muted?: boolean;
  /** The cartoon face speaking these words in the bubble and the level's
   *  own narration voice — the body's seat of the same system its menus
   *  and sub-menus carry. */
  avatar?: string;
  voice?: string;
  pitch?: number;
  /** Menu base: the sub-menus under this menu — leaves, one level
   *  deep, the simulator's own hierarchy. */
  submenu?: ForgedLeaf[];
  /** App base: the menus under this app — each carrying its own
   *  sub-menus, so the chain runs app → menu → sub-menu. */
  menus?: ForgedMenu[];
}

/** One walkable node of a body's tree — a menu (with its own
 *  sub-menus) or a sub-menu leaf. The deck pages' consoles walk this
 *  shape. */
export interface ForgedNode {
  label: string;
  logo: BodyLogo;
  children: ForgedNode[];
  /** The level's own words and mute — carried so the presentation
   *  console edits (and the show hears) every level's voice. */
  speech?: string;
  muted?: boolean;
  /** The level's cartoon face, voice and pitch — same system as the
   *  planet itself, at every walked level. */
  avatar?: string;
  voice?: string;
  pitch?: number;
}

/** A body's tree in the walkable shape: an app base's app contributes
 *  its menus (each carrying its sub-menus), a menu base's menu its
 *  sub-menus straight away. A body with neither walks nowhere — its
 *  own console is the whole show. */
export function forgedTree(planet: ForgedPlanet): ForgedNode[] {
  if (planet.menus && planet.menus.length > 0) {
    return planet.menus.map((menu) => ({
      label: menu.name,
      logo: menu.logo,
      speech: menu.speech,
      muted: menu.muted,
      avatar: menu.avatar,
      voice: menu.voice,
      pitch: menu.pitch,
      children: (menu.submenu ?? []).map((leaf) => ({
        label: leaf.name,
        logo: leaf.logo,
        speech: leaf.speech,
        muted: leaf.muted,
        avatar: leaf.avatar,
        voice: leaf.voice,
        pitch: leaf.pitch,
        children: [],
      })),
    }));
  }
  if (planet.submenu && planet.submenu.length > 0) {
    return planet.submenu.map((leaf) => ({
      label: leaf.name,
      logo: leaf.logo,
      speech: leaf.speech,
      muted: leaf.muted,
      avatar: leaf.avatar,
      voice: leaf.voice,
      pitch: leaf.pitch,
      children: [],
    }));
  }
  return [];
}

/** The sun's own tree: on an app base the sun IS the center app — its
 *  menus are the first app's; on a menu base the sun is the app
 *  itself, and the ring's planets are its menus, each carrying its own
 *  sub-menus. */
export function sunTree(system: ForgedSystem): ForgedNode[] {
  if (system.base === "app") {
    return system.planets[0] ? forgedTree(system.planets[0]) : [];
  }
  return system.planets.map((planet) => ({
    label: planet.name,
    logo: planet.logo,
    speech: planet.speech,
    muted: planet.muted,
    avatar: planet.avatar,
    voice: planet.voice,
    pitch: planet.pitch,
    children: (planet.submenu ?? []).map((leaf) => ({
      label: leaf.name,
      logo: leaf.logo,
      speech: leaf.speech,
      muted: leaf.muted,
      avatar: leaf.avatar,
      voice: leaf.voice,
      pitch: leaf.pitch,
      children: [],
    })),
  }));
}

/** A system as the forms capture it — the builder's seed data, plus the
 *  bookkeeping the deck needs to keep it ordered and gateway-linked. */
export interface ForgedSystem {
  base: ForgeBase;
  /** The system's name — its identity, never a body. App base renders
   *  the first app at the center instead; a menu base's sun is the app
   *  itself. */
  sun: string;
  note: string;
  /** The first ring: apps (app base) or menus (menu base). */
  planets: ForgedPlanet[];
  /** The menu base's sun speaks about itself too — the identity's own
   *  words, face, voice and pitch, the very five fields every level
   *  carries. Absent (and on an app base, where the center app holds
   *  the seat), the sun stays quiet. */
  speech?: string;
  muted?: boolean;
  avatar?: string;
  voice?: string;
  pitch?: number;
  /** The show's soundtrack — one looping background piece for the whole
   *  presentation, edited from any level's console. A link (http/https)
   *  rides the record; a file picked this session lives outside the
   *  model, so a refresh falls back to the saved link, or silence. */
  music?: string;
  /** The soundtrack's loudness, 0..1 — the levels' voices speak over it. */
  musicVolume?: number;
  /** Deck-order stamp, set at forge time and kept through edits. */
  seq?: number;
  /** The gateway item id once the record has landed remotely. */
  itemId?: string;
}

/** Data Gateway collection holding the forged systems. */
export const FORGED_COLLECTION = "forged_system";

/** localStorage key for the per-browser cache — what the deck shows
 *  when the gateway hasn't answered (or the schema isn't pushed yet). */
const CACHE_KEY = "zf-forged-systems";

/** One system's walkable levels beneath its bodies — menus and
 *  sub-menus, the chain a console walks below the first ring. The
 *  bodies themselves aren't levels; the mission readout counts them
 *  separately. An app base walks app → menu → sub-menu, a menu base
 *  menu → sub-menu, and a body with neither walks nowhere. */
export function forgedLevelCount(system: ForgedSystem): number {
  let levels = 0;
  for (const planet of system.planets) {
    if (planet.menus) {
      for (const menu of planet.menus) levels += 1 + (menu.submenu?.length ?? 0);
    } else {
      levels += planet.submenu?.length ?? 0;
    }
  }
  return levels;
}

/* ---- the voice: per-level narration writes ----------------------------- */

/** One level's voice change: new words (null takes them back), a mute
 *  toggle, the cartoon face, the narration voice and its pitch — the
 *  presentation console's write. Null clears a set field. */
export interface VoicePatch {
  text?: string | null;
  muted?: boolean;
  avatar?: string | null;
  voice?: string | null;
  pitch?: number | null;
}

/** Apply a patch to one node, immutably — absent patch fields leave the
 *  level's own words, mute, face and voice alone. */
function withVoice<
  T extends { speech?: string; muted?: boolean; avatar?: string; voice?: string; pitch?: number },
>(node: T, patch: VoicePatch): T {
  return {
    ...node,
    ...(patch.text !== undefined ? { speech: patch.text ?? undefined } : {}),
    ...(patch.muted !== undefined ? { muted: patch.muted === true ? true : undefined } : {}),
    ...(patch.avatar !== undefined ? { avatar: patch.avatar ?? undefined } : {}),
    ...(patch.voice !== undefined ? { voice: patch.voice ?? undefined } : {}),
    ...(patch.pitch !== undefined ? { pitch: patch.pitch ?? undefined } : {}),
  } as T;
}

/** Write a patch at the level a trail of names ends on — the rest of
 *  the list comes back untouched when the trail misses. */
function patchVoiceLevel(
  nodes: (ForgedMenu | ForgedLeaf)[],
  path: string[],
  patch: VoicePatch,
): (ForgedMenu | ForgedLeaf)[] {
  const [head, ...rest] = path;
  let changed = false;
  const next = nodes.map((node): ForgedMenu | ForgedLeaf => {
    if (node.name !== head) return node;
    if (rest.length === 0) {
      changed = true;
      return withVoice(node, patch);
    }
    const children = (node as ForgedMenu).submenu;
    if (!children || children.length === 0) return node;
    const patched = patchVoiceLevel(children, rest, patch);
    if (patched === children) return node;
    changed = true;
    return { ...(node as ForgedMenu), submenu: patched as ForgedLeaf[] };
  });
  return changed ? next : nodes;
}

/** A body's voice change, immutably: an empty path is the body itself,
 *  a deeper trail lands on its menus (app base) or sub-menus (menu
 *  base). Unmatched trails leave the ring untouched. */
export function patchPlanetVoice(
  planets: ForgedPlanet[],
  index: number,
  path: string[],
  patch: VoicePatch,
): ForgedPlanet[] {
  return planets.map((planet, i) => {
    if (i !== index) return planet;
    if (path.length === 0) return withVoice(planet, patch);
    if (planet.menus) {
      const menus = patchVoiceLevel(planet.menus, path, patch);
      return menus === planet.menus ? planet : { ...planet, menus: menus as ForgedMenu[] };
    }
    if (planet.submenu) {
      const subs = patchVoiceLevel(planet.submenu, path, patch);
      return subs === planet.submenu ? planet : { ...planet, submenu: subs as ForgedLeaf[] };
    }
    return planet;
  });
}

/** The menu base's sun — the system identity itself — takes a voice
 *  patch the same way any level does: the ring comes back untouched,
 *  the identity's own words, face and voice move. */
export function patchSystemVoice(system: ForgedSystem, patch: VoicePatch): ForgedSystem {
  return withVoice(system, patch);
}

/** The show soundtrack's change: a new source (null takes it back) or
 *  a loudness — the soundtrack console's write. */
export interface MusicPatch {
  url?: string | null;
  volume?: number;
}

/** The soundtrack belongs to the whole show, so its patch lands on the
 *  system itself — the ring comes back untouched, the music fields
 *  move. Volume clamps to 0..1. */
export function patchSystemMusic(system: ForgedSystem, patch: MusicPatch): ForgedSystem {
  return {
    ...system,
    ...(patch.url !== undefined ? { music: patch.url ?? undefined } : {}),
    ...(patch.volume !== undefined
      ? { musicVolume: Math.min(1, Math.max(0, patch.volume)) }
      : {}),
  };
}

/* ---- the wire: icon logos cross JSON as shelf names ------------------- */

function logoToStored(logo: BodyLogo): unknown {
  return logo.kind === "icon"
    ? {
        kind: "icon",
        name: FORGE_ICONS.find((shelfEntry) => shelfEntry.icon === logo.icon)?.name ?? DEFAULT_FORGE_ICON.name,
      }
    : { kind: "image", name: logo.name, src: logo.src };
}

function logoFromStored(raw: unknown): BodyLogo | null {
  if (typeof raw !== "object" || raw === null) return null;
  const logo = raw as Record<string, unknown>;
  if (logo.kind === "icon") {
    // the shelf name comes back as its glyph; an unknown name falls to
    // the shelf's own spark
    const icon =
      typeof logo.name === "string"
        ? (FORGE_ICONS.find((shelfEntry) => shelfEntry.name === logo.name)?.icon ?? DEFAULT_FORGE_ICON.icon)
        : DEFAULT_FORGE_ICON.icon;
    return { kind: "icon", icon };
  }
  if (logo.kind === "image" && typeof logo.src === "string") {
    return { kind: "image", name: typeof logo.name === "string" ? logo.name : "upload", src: logo.src };
  }
  return null;
}

/** A sub-menu crosses as a leaf: name, logo and its presentation voice
 *  (words and mute) — the hierarchy stops one level under the menu,
 *  exactly as the simulator keeps it. */
function submenuToJson(submenu: ForgedLeaf[] | undefined): unknown {
  if (!submenu || submenu.length === 0) return undefined;
  return submenu.map((child) => ({
    name: child.name,
    logo: logoToStored(child.logo),
    speech: child.speech,
    muted: child.muted === true ? true : undefined,
    avatar: child.avatar,
    voice: child.voice,
    pitch: child.pitch,
  }));
}

function submenuFromJson(raw: unknown): ForgedLeaf[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const children: ForgedLeaf[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const body = entry as Record<string, unknown>;
    if (typeof body.name !== "string" || body.name.length === 0) continue;
    const logo = logoFromStored(body.logo);
    if (!logo) continue;
    children.push({
      name: body.name,
      logo,
      speech: typeof body.speech === "string" && body.speech.trim().length > 0 ? body.speech : undefined,
      muted: body.muted === true ? true : undefined,
      avatar: typeof body.avatar === "string" && body.avatar.length > 0 ? body.avatar : undefined,
      voice: typeof body.voice === "string" && body.voice.length > 0 ? body.voice : undefined,
      pitch: typeof body.pitch === "number" && Number.isFinite(body.pitch) ? body.pitch : undefined,
    });
  }
  return children.length > 0 ? children : undefined;
}

/** An app's menus cross with their sub-menus nested beneath them — the
 *  whole app → menu → sub-menu chain rides inside planetsJson. */
function menusToJson(menus: ForgedMenu[] | undefined): unknown {
  if (!menus || menus.length === 0) return undefined;
  return menus.map((menu) => ({
    name: menu.name,
    logo: logoToStored(menu.logo),
    submenu: submenuToJson(menu.submenu),
    speech: menu.speech,
    muted: menu.muted === true ? true : undefined,
    avatar: menu.avatar,
    voice: menu.voice,
    pitch: menu.pitch,
  }));
}

function menusFromJson(raw: unknown): ForgedMenu[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const menus: ForgedMenu[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const body = entry as Record<string, unknown>;
    if (typeof body.name !== "string" || body.name.length === 0) continue;
    const logo = logoFromStored(body.logo);
    if (!logo) continue;
    menus.push({
      name: body.name,
      logo,
      submenu: submenuFromJson(body.submenu),
      speech: typeof body.speech === "string" && body.speech.trim().length > 0 ? body.speech : undefined,
      muted: body.muted === true ? true : undefined,
      avatar: typeof body.avatar === "string" && body.avatar.length > 0 ? body.avatar : undefined,
      voice: typeof body.voice === "string" && body.voice.length > 0 ? body.voice : undefined,
      pitch: typeof body.pitch === "number" && Number.isFinite(body.pitch) ? body.pitch : undefined,
    });
  }
  return menus.length > 0 ? menus : undefined;
}

/** The ring travels as one JSON string field — a whole forged system is
 *  one gateway record, and the ring's shape stays the page's business. */
/** The system identity's own voice, the same five fields every level
 *  carries — what the menu base's sun says about itself. */
type SunVoice = Pick<ForgedSystem, "speech" | "muted" | "avatar" | "voice" | "pitch">;

/** The ring's rows as they cross the wire. */
function ringToJson(planets: ForgedPlanet[]): unknown[] {
  return planets.map((planet) => ({
    name: planet.name,
    label: planet.label,
    logo: logoToStored(planet.logo),
    speech: planet.speech,
    muted: planet.muted === true ? true : undefined,
    avatar: planet.avatar,
    voice: planet.voice,
    pitch: planet.pitch,
    submenu: submenuToJson(planet.submenu),
    menus: menusToJson(planet.menus),
  }));
}

/** The identity's voice crosses only when there is something to keep —
 *  a sun with nothing to say crosses as nothing at all. */
function voiceToJson(voice: SunVoice): unknown {
  if (
    voice.speech === undefined &&
    voice.muted === undefined &&
    voice.avatar === undefined &&
    voice.voice === undefined &&
    voice.pitch === undefined
  ) {
    return undefined;
  }
  return {
    speech: voice.speech,
    muted: voice.muted === true ? true : undefined,
    avatar: voice.avatar,
    voice: voice.voice,
    pitch: voice.pitch,
  };
}

function voiceFromJson(raw: unknown): SunVoice {
  if (typeof raw !== "object" || raw === null) return {};
  const body = raw as Record<string, unknown>;
  return {
    ...(typeof body.speech === "string" && body.speech.trim().length > 0 ? { speech: body.speech } : {}),
    ...(body.muted === true ? { muted: true } : {}),
    ...(typeof body.avatar === "string" && body.avatar.length > 0 ? { avatar: body.avatar } : {}),
    ...(typeof body.voice === "string" && body.voice.length > 0 ? { voice: body.voice } : {}),
    ...(typeof body.pitch === "number" && Number.isFinite(body.pitch) ? { pitch: body.pitch } : {}),
  };
}

/** The soundtrack back off the wire — links only, volume guarded. */
function musicFromJson(raw: unknown): Pick<ForgedSystem, "music" | "musicVolume"> {
  if (typeof raw !== "object" || raw === null) return {};
  const body = raw as Record<string, unknown>;
  return {
    ...(typeof body.url === "string" && /^https?:\/\//i.test(body.url) ? { music: body.url } : {}),
    ...(typeof body.volume === "number" && Number.isFinite(body.volume) ? { musicVolume: body.volume } : {}),
  };
}

/** The soundtrack crosses beside the voice — links only: a picked
 *  file's blob: URL dies with the session, so it never boards. */
function musicToJson(system: ForgedSystem): unknown {
  const url =
    typeof system.music === "string" && /^https?:\/\//i.test(system.music) ? system.music : undefined;
  const volume =
    typeof system.musicVolume === "number" && Number.isFinite(system.musicVolume)
      ? system.musicVolume
      : undefined;
  return url === undefined && volume === undefined ? undefined : { url, volume };
}

/** The whole ring — and, since the sun learned to speak, the identity's
 *  voice, and since the soundtrack, its music — crosses as one JSON
 *  string. The collection's schema never grew a field: everything rides
 *  the very string the ring has always ridden. */
function ringToWire(planets: ForgedPlanet[], system: ForgedSystem): string {
  return JSON.stringify({ ring: ringToJson(planets), sun: voiceToJson(system), music: musicToJson(system) });
}

function planetsFromEntries(entries: unknown[]): ForgedPlanet[] | null {
  const planets: ForgedPlanet[] = [];
  for (const entry of entries) {
    if (typeof entry !== "object" || entry === null) continue;
    const body = entry as Record<string, unknown>;
    if (typeof body.name !== "string" || body.name.length === 0) continue;
    const logo = logoFromStored(body.logo);
    if (!logo) continue;
    planets.push({
      name: body.name,
      label: typeof body.label === "string" ? body.label : undefined,
      logo,
      speech: typeof body.speech === "string" && body.speech.trim().length > 0 ? body.speech : undefined,
      muted: body.muted === true ? true : undefined,
      avatar: typeof body.avatar === "string" && body.avatar.length > 0 ? body.avatar : undefined,
      voice: typeof body.voice === "string" && body.voice.length > 0 ? body.voice : undefined,
      pitch: typeof body.pitch === "number" && Number.isFinite(body.pitch) ? body.pitch : undefined,
      submenu: submenuFromJson(body.submenu),
      menus: menusFromJson(body.menus),
    });
  }
  return planets.length > 0 ? planets : null;
}

/** Parse the ring's wire string — the bare array every record written
 *  before the sun could speak carries, the { ring, sun } object since,
 *  and { ring, sun, music } once a soundtrack rides along — into the
 *  planets, the identity's own voice and the music. Null when neither
 *  shape holds a usable ring. */
function ringFromWire(raw: unknown): {
  planets: ForgedPlanet[];
  sun: SunVoice;
  music: Pick<ForgedSystem, "music" | "musicVolume">;
} | null {
  let parsed: unknown;
  if (typeof raw === "string" && raw.length > 0) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  } else {
    parsed = raw;
  }
  // the legacy form: the ring alone, the sun with no voice of its own
  if (Array.isArray(parsed)) {
    const planets = planetsFromEntries(parsed);
    return planets ? { planets, sun: {}, music: {} } : null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const body = parsed as Record<string, unknown>;
  if (!Array.isArray(body.ring)) return null;
  const planets = planetsFromEntries(body.ring);
  return planets
    ? { planets, sun: voiceFromJson(body.sun), music: musicFromJson(body.music) }
    : null;
}/* ---- the gateway: same envelope discipline as broadcast-doc ----------- */

/**
 * The gateway wraps every collection payload as `{ data: { <op><Schema>s: … } }`
 * — the HTTP layer returns the body verbatim. Dig that single payload out;
 * fall back to the response itself so flatter shapes (and tests) still work.
 */
function unwrapCollectionPayload(response: unknown): Record<string, unknown> {
  if (typeof response !== "object" || response === null) return {};
  const data = (response as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) return response as Record<string, unknown>;
  const payloads = Object.values(data as Record<string, unknown>).filter(
    (value): value is Record<string, unknown> =>
      typeof value === "object" && value !== null && !Array.isArray(value),
  );
  return payloads.find((payload) => Object.keys(payload).length > 0) ?? {};
}

/** Pull items out of whatever envelope the gateway returned — narrowly. */
function extractItems(response: unknown): Record<string, unknown>[] {
  const candidates = [
    unwrapCollectionPayload(response).items,
    (response as { data?: { items?: unknown } }).data?.items,
    (response as { items?: unknown }).items,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(
        (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
      );
    }
  }
  return [];
}

function extractItemId(item: Record<string, unknown>): string | null {
  // "ItemId" is the gateway's own key for it; the rest defend against
  // envelope shapes that normalize the name.
  for (const key of ["ItemId", "id", "Id", "itemId", "_id"]) {
    const value = item[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

/** The collection's fields, listed explicitly — the SDK's default
 *  selection is ItemId only, which can never parse into a system. */
const WIRE_FIELDS = ["base", "sun", "note", "planetsJson", "seq"] as const;

/** Validate an untrusted record into a ForgedSystem, or null when it
 *  isn't one. seq rides as a string: the gateway's numeric write path is
 *  32-bit and a ms epoch overflows it (the broadcast adapter's lesson). */
export function parseForgedSystem(raw: unknown): ForgedSystem | null {
  if (typeof raw !== "object" || raw === null) return null;
  const doc = raw as Record<string, unknown>;
  if ((doc.base !== "app" && doc.base !== "menu") || typeof doc.sun !== "string" || doc.sun.length === 0) {
    return null;
  }
  const ring = ringFromWire(doc.planetsJson);
  if (!ring) return null;
  const seq = typeof doc.seq === "string" ? Number(doc.seq) : typeof doc.seq === "number" ? doc.seq : NaN;
  return {
    base: doc.base,
    sun: doc.sun,
    note: typeof doc.note === "string" ? doc.note : "",
    ...ring.sun,
    ...ring.music,
    planets: ring.planets,
    seq: Number.isFinite(seq) ? seq : Date.now(),
    itemId: extractItemId(doc) ?? undefined,
  };
}

function toWire(system: ForgedSystem): Record<string, unknown> {
  return {
    base: system.base,
    sun: system.sun,
    note: system.note,
    planetsJson: ringToWire(system.planets, system),
    seq: String(system.seq ?? Date.now()),
  };
}

/** The deck, oldest first — forge order, stable across reloads. The
 *  deck is the sky this tenant's operatives share: whatever the
 *  gateway answers, every signed-in account screens — the inviter's
 *  forges and the invitee's alike. That shared sight is the whole
 *  point of inviting an operative in; no creator filter stands
 *  between them. */
export async function readForgedSystems(client: BlocksClient): Promise<ForgedSystem[]> {
  const collection = client.data.collection<Record<string, unknown>>(FORGED_COLLECTION);
  const response = await collection.list({ fields: [...WIRE_FIELDS] });
  return extractItems(response)
    .map(parseForgedSystem)
    .filter((system): system is ForgedSystem => system !== null)
    .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
}

export async function createForgedSystem(client: BlocksClient, system: ForgedSystem): Promise<string | null> {
  const collection = client.data.collection<Record<string, unknown>>(FORGED_COLLECTION);
  const created = await collection.create(toWire(system));
  return extractItemId(unwrapCollectionPayload(created));
}

export async function updateForgedSystem(client: BlocksClient, itemId: string, system: ForgedSystem): Promise<void> {
  const collection = client.data.collection<Record<string, unknown>>(FORGED_COLLECTION);
  await collection.update(itemId, toWire(system));
}

export async function deleteForgedSystem(client: BlocksClient, itemId: string): Promise<void> {
  const collection = client.data.collection<Record<string, unknown>>(FORGED_COLLECTION);
  await collection.delete(itemId);
}

/* ---- the cache: what the deck shows when the gateway can't ------------ */

/** The deck as this browser last saw it — each record must carry the
 *  whole shape before it rejoins; anything half-written is dropped. */
export function loadCachedSystems(): ForgedSystem[] {
  try {
    const raw = window.localStorage.getItem(userScopedKey(CACHE_KEY));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const systems: ForgedSystem[] = [];
    parsed.forEach((entry, index) => {
      if (typeof entry !== "object" || entry === null) return;
      const record = entry as Record<string, unknown>;
      if ((record.base !== "app" && record.base !== "menu") || typeof record.sun !== "string") return;
      // the cache once held the ring as a plain array — read both forms
      const ring = ringFromWire(typeof record.planetsJson === "string" ? record.planetsJson : record.planets);
      if (!ring) return;
      systems.push({
        base: record.base,
        sun: record.sun,
        note: typeof record.note === "string" ? record.note : "",
        ...ring.sun,
        ...ring.music,
        planets: ring.planets,
        seq: typeof record.seq === "number" && Number.isFinite(record.seq) ? record.seq : Date.now() + index,
        itemId: typeof record.itemId === "string" ? record.itemId : undefined,
      });
    });
    return systems;
  } catch {
    return [];
  }
}

/** The deck writes itself back on every change — icon logos as shelf
 *  names, the gateway item id along for the ride. A full or blocked
 *  store must never take the deck down. */
export function saveCachedSystems(systems: ForgedSystem[]): void {
  try {
    const storable = systems.map((system) => ({
      base: system.base,
      sun: system.sun,
      note: system.note,
      seq: system.seq,
      itemId: system.itemId,
      planetsJson: ringToWire(system.planets, system),
    }));
    window.localStorage.setItem(userScopedKey(CACHE_KEY), JSON.stringify(storable));
  } catch {
    // quota refused (private mode, 1 MB logos) — the session deck lives on
  }
}
