// Topmost canvas layer but one: the open planet menu and its submenus,
// painted after the scene so a menu floats above packets, labels and
// neighboring planets — each deeper nesting level paints above the rings
// before it, and only the speaking bubble outranks the fan. All rings
// share the host planet's transform, so the whole menu rides the orbit
// with it.
//
// Every ring circles the body that opened it: the root ring revolves
// around the host planet, a submenu ring revolves around the opened
// parent mini — menus orbit their planet the way submenus orbit their
// menu. Ring sizing is dynamic AND equidistant: every mini sits on one
// circle around that body — same distance for all of them — and the
// circle widens with the item count, so a crowded fan gets more room
// while a sparse one tucks in closer.

import type { OpenPlanetMenu, PlatformMenuItem } from "../../script/platformMenus";
import { PLATFORM_MENUS } from "../../script/platformMenus";
import { CAST_BY_ID } from "../../script/cast";
import { useOrbitTime } from "../../state/PlayerContext";
import { useMotionReduced } from "../../state/SettingsContext";
import { orbitPosition } from "./orbits";
import { PlanetMenu } from "./PlanetMenu";

interface PlanetMenuLayerProps {
  menu: OpenPlanetMenu | null;
  onSelect: (label: string, depth: number) => void;
}

/** The base circle fits three minis comfortably; each item past three
 *  widens the radius by ITEM_WIDEN. Base 130 keeps even an inner-ring
 *  planet's fan on the 1600x900 frame at every orbit point. */
const FAN_R = 130;
/** Radius added per item past three: on a full clock-face circle each
 *  extra mini only needs this much more radius to keep its body, label
 *  and a breath of sky clear of its neighbors. */
const ITEM_WIDEN = 14;
/** The sun's menu hue: its photosphere is drawn in literal star colors
 *  (#ff7a1a rim), not the OS character hue, so its menu burns the same
 *  solar amber instead of inheriting OS's blue. */
export const SUN_HUE = "25 100% 55%";

/** Ring circle per open level: the same count-scaled circle at every
 *  depth — the root ring circles the host planet, each submenu ring
 *  circles the opened parent mini. rx = ry — every mini of a ring is
 *  equidistant from the body it circles. */
export function ringsForLevels(counts: number[]): { rx: number; ry: number }[] {
  return counts.map((count) => {
    const r = FAN_R + Math.max(0, count - 3) * ITEM_WIDEN;
    return { rx: r, ry: r };
  });
}

/** Where the ring at `depth` is centered — the body it circles, along
 *  with the rim its rays spring from: the host planet's center for the
 *  root ring (edged just past `hostEdge` — the host body's own rim,
 *  which the sun overshoots), the opened parent mini's position for
 *  deeper rings (edged to its halo). */
function ringCenter(
  levels: { items: PlatformMenuItem[]; selected?: string }[],
  rings: { rx: number; ry: number }[],
  depth: number,
  hostEdge: number
): { x: number; y: number; edge: number } {
  if (depth === 0) return { x: 0, y: 0, edge: hostEdge };
  const parent = levels[depth - 1]!;
  const ring = rings[depth - 1]!;
  const index = Math.max(
    0,
    parent.items.findIndex((item) => item.label === parent.selected)
  );
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / Math.max(parent.items.length, 1);
  return { x: ring.rx * Math.cos(angle), y: ring.ry * Math.sin(angle), edge: 38 };
}

export function PlanetMenuLayer({ menu, onSelect }: PlanetMenuLayerProps) {
  const t = useOrbitTime();
  const motionReduced = useMotionReduced();
  const tOrbit = motionReduced ? 0 : t;

  if (!menu) return null;
  const root = PLATFORM_MENUS[menu.planet];
  if (!root) return null;

  // One entry per open level: the root ring, then one ring per opened
  // submenu. Each level remembers which of its items is opened past it,
  // so the walked branch reads highlighted on its own ring.
  const levels: { items: PlatformMenuItem[]; selected?: string }[] = [];
  let level = root;
  for (let depth = 0; ; depth++) {
    levels.push({ items: level, selected: menu.path[depth] });
    const label = menu.path[depth];
    if (!label) break;
    const next = level.find((item) => item.label === label)?.children;
    if (!next) break;
    level = next;
  }

  const rings = ringsForLevels(levels.map(({ items }) => items.length));

  const point = orbitPosition(menu.planet, tOrbit);
  // Rays spring from just past the circled body's rim: a planet's body
  // tops out at r≈50, but the sun's photosphere burns to r≈74 with a
  // glow past it — a planet-sized edge would start its rays inside the
  // star.
  const hostEdge = menu.planet === "os" ? 84 : 52;
  return (
    <g
      className="sim-planet-menus"
      transform={`translate(${point.x} ${point.y})`}
      // The whole menu wears its host planet's hue: every ring and mini
      // inherits this --node-hue, so each planet's menu glows in its own
      // color (the sun in literal solar amber — see SUN_HUE).
      style={
        { "--node-hue": menu.planet === "os" ? SUN_HUE : CAST_BY_ID[menu.planet].hue } as React.CSSProperties
      }
    >
      {levels.map(({ items, selected }, depth) => {
        const center = ringCenter(levels, rings, depth, hostEdge);
        return (
          <PlanetMenu
            key={depth}
            items={items}
            depth={depth}
            ring={rings[depth]!}
            selected={selected}
            center={center}
            animate={!motionReduced}
            onSelect={onSelect}
          />
        );
      })}
    </g>
  );
}
