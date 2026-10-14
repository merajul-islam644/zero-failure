// One ring of the radial platform menu: mini planets circling the body
// that opened them — the host planet for the root ring, the opened
// parent mini for a submenu ring — same round bodies and glyphs as the
// cast, one step smaller, wearing the host planet's own hue. The ring's
// ellipse arrives as a prop: PlanetMenuLayer sizes it from the item
// count, so a crowded fan gets more room while a sparse one tucks in
// closer. Deeper rings paint above shallower ones because
// PlanetMenuLayer renders them in order. Pure presentation.

import type { PlatformMenuItem } from "../../script/platformMenus";

interface PlanetMenuProps {
  items: PlatformMenuItem[];
  /** 0 for the host planet's own menu, 1 for its first submenu, … */
  depth: number;
  /** Circle this ring's minis sit on — every mini the same distance
   *  from its host; sized by PlanetMenuLayer from the item count. */
  ring: { rx: number; ry: number };
  /** Label opened past this ring, if any — its mini planet reads as the
   *  branch the viewer is walking down. */
  selected?: string;
  /** The body this ring circles: the host planet for the root ring, the
   *  opened parent mini for a submenu ring. Minis spread the full clock
   *  face around it and the rays spring from its rim — `edge` is that
   *  body's halo radius, so lines start just outside it. */
  center: { x: number; y: number; edge: number };
  /** Neon sparks ride the rays planet → menu; frozen under reduced motion. */
  animate: boolean;
  /** Radians added to every mini's clock-face angle: the showcase's drag
   *  dial spins the ring through this — minis revolve, the circle itself
   *  never moves. Zero (canonical, first mini at the top) on the canvas. */
  rotation?: number;
  /** False in the left-rail showcase mirror: same drawing, but the minis
   *  are pure display — no pointer target, no tab stop, no handlers. */
  interactive?: boolean;
  onSelect: (label: string, depth: number) => void;
}

/** Mini-planet sizing: one visible step below the cast (body r 44).
 *  Exported for the left-rail showcase, which draws the selected mini
 *  as the showcase's center in exactly these proportions. */
export const NODE_R = 30;
export const NODE_HALO_R = 36;
export const NODE_GLYPH = 20;
/** Label sits just under the body, planet-name style but smaller. */
export const LABEL_Y = NODE_R + 18;
/** Rays stop this far short of a mini planet's center — its halo (36)
 *  plus a breath of sky. */
const RAY_TARGET_GAP = NODE_HALO_R + 3;
/** The neon spark riding each ray: small, but the glow doubles it. */
const NEON_R = 3.2;

export function PlanetMenu({
  items,
  depth,
  ring,
  selected,
  center,
  animate,
  interactive = true,
  rotation = 0,
  onSelect
}: PlanetMenuProps) {
  // Same rule as the planets themselves: whatever is selected paints
  // above its same-ring siblings. Angles stay keyed to the original
  // index — only the paint order moves.
  const paintOrder = items.map((item, index) => ({ item, index }));
  const picked = paintOrder.findIndex(({ item }) => item.label === selected);
  if (picked >= 0) paintOrder.push(...paintOrder.splice(picked, 1));

  return (
    <g className="sim-planet-menu">
      {paintOrder.map(({ item, index }) => {
        // Full clock-face spread around the ring's center body — the
        // host planet for the root ring, the opened parent mini for a
        // submenu ring — starting at the top (plus the showcase dial's
        // spin: the circle only revolves, every mini keeps its exact
        // distance).
        const angle = -Math.PI / 2 + (index * 2 * Math.PI) / items.length + rotation;
        const cx = Math.round(center.x + ring.rx * Math.cos(angle));
        const cy = Math.round(center.y + ring.ry * Math.sin(angle));
        const Icon = item.icon;
        // Ray from the center body out to this mini's halo, dashed like
        // the orbit rings so it reads as sky furniture, not a diagram
        // edge. Endpoints are mini-local: the positioned <g> below
        // shifts to (cx, cy), so the ray runs from the center body's
        // direction inward.
        const dx = cx - center.x;
        const dy = cy - center.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const ray = {
          x1: -ux * (len - center.edge),
          y1: -uy * (len - center.edge),
          x2: -ux * RAY_TARGET_GAP,
          y2: -uy * RAY_TARGET_GAP
        };
        return (
          <g
            key={item.label}
            className="sim-menu-node"
            transform={`translate(${cx} ${cy})`}
            data-selected={selected === item.label ? "" : undefined}
            {...(interactive
              ? {
                  role: "button" as const,
                  tabIndex: 0,
                  "aria-label": item.label,
                  onClick: (event: React.MouseEvent) => {
                    // The host planet's group toggles the menu — a
                    // mini-planet click must not bubble up into a second
                    // toggle.
                    event.stopPropagation();
                    onSelect(item.label, depth);
                  },
                  onKeyDown: (event: React.KeyboardEvent) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(item.label, depth);
                    }
                  }
                }
              : {})}
          >
            <line className="sim-menu-ray" {...ray} />
            {animate && (
              // The neon light itself: a glowing spark forever riding this
              // ray from the parent body's rim to the mini planet. SMIL
              // motion along the exact ray path; negative begin staggers
              // the rays so the sparks don't pulse in lockstep.
              <circle className="sim-menu-neon" r={NEON_R}>
                <animateMotion
                  dur="1.6s"
                  repeatCount="indefinite"
                  begin={`${(-index * 0.4).toFixed(2)}s`}
                  path={`M ${ray.x1} ${ray.y1} L ${ray.x2} ${ray.y2}`}
                />
              </circle>
            )}
            <circle className="sim-menu-node-halo" r={NODE_HALO_R} />
            <circle className="sim-menu-node-body" r={NODE_R} />
            <g className="sim-menu-node-glyph" transform={`translate(${-NODE_GLYPH / 2} ${-NODE_GLYPH / 2})`}>
              <Icon size={NODE_GLYPH} strokeWidth={1.8} />
            </g>
            <text className="sim-menu-node-name" y={LABEL_Y} textAnchor="middle">
              {item.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}
