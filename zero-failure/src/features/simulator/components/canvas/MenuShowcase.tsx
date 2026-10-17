// The story rail's showcase mirror of the open menu: the selected planet with
// its menu ring — or, one selection deeper, the selected mini planet with
// its submenu ring — drawn in exactly the canvas fan's design, by the same
// PlanetMenu component. The ring is a display dial: grabbing its band
// spins the minis around the host to whatever orientation suits the
// viewer, while the circle itself never moves — same center, same radius,
// same distances — and letting go mid-twist coasts the wheel through
// several more revolutions before it eases to a stop. Nothing is
// clickable: the minis carry no role, focus or handlers, and the only
// interaction is the twist. Rendered inside the story-rail drawer (see
// simulator.css).

import { useEffect, useRef, useState } from "react";
import { CAST_BY_ID } from "../../script/cast";
import type { OpenPlanetMenu, PlatformMenuItem } from "../../script/platformMenus";
import { PLATFORM_MENUS } from "../../script/platformMenus";
import { useMotionReduced } from "../../state/SettingsContext";
import { CharacterNode } from "./CharacterNode";
import { LABEL_Y, NODE_GLYPH, NODE_HALO_R, NODE_R, PlanetMenu } from "./PlanetMenu";
import { ringsForLevels, SUN_HUE } from "./PlanetMenuLayer";
import { ShowcaseSky } from "./ShowcaseSky";

/** Release velocity that counts as a toss (radians per ms): slower
 *  releases just place the ring where the hand left it. */
const FLICK_VELOCITY = 0.002;
/** A flick this fast coasts the full five revolutions. */
const FAST_FLICK_VELOCITY = 0.02;
/** Pause longer than this before letting go and the ring was placed,
 *  not tossed — no coast. */
const PLACED_AFTER_MS = 90;

export function MenuShowcase({ menu }: { menu: OpenPlanetMenu | null }) {
  const motionReduced = useMotionReduced();
  // The dial: radians the showcased ring is spun past its canonical
  // clock-face spread. A fresh selection starts at the top again.
  const [rotation, setRotation] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const dragRef = useRef<{
    startPointer: number;
    startRotation: number;
    lastAngle: number;
    lastTime: number;
    velocity: number;
  } | null>(null);
  const spinRef = useRef<number | null>(null);
  // Latest rotation for closures — the rAF coast and a mid-spin grab —
  // without re-arming them on every frame's render.
  const rotationRef = useRef(rotation);
  rotationRef.current = rotation;
  if (!menu) return null;
  // Platforms without authored menus still showcase their bare planet —
  // the pick itself is the content until sections arrive.
  const root = PLATFORM_MENUS[menu.planet] ?? [];

  // Walk the open path down to its deepest node — that node is the
  // showcase's center, its children the showcased ring. A leaf center
  // simply has no ring: the pick itself is the showcase.
  let level = root;
  let tail: PlatformMenuItem | null = null;
  for (const label of menu.path) {
    const next = level.find((item) => item.label === label);
    if (!next) return null;
    tail = next;
    level = next.children ?? [];
  }
  const items = tail === null ? root : level;
  const ring = items.length > 0 ? ringsForLevels([items.length])[0]! : null;

  const character = CAST_BY_ID[menu.planet];
  // Same hue rule as the canvas fan: the mirrored menu wears its host
  // planet's color (the sun in literal solar amber — see SUN_HUE; the
  // CharacterNode center sets its own, to the character value).
  const hue = menu.planet === "os" ? SUN_HUE : character.hue;

  // The dial: pointer position as an angle around the ring's center — the
  // showcase's origin — so a grab-and-twist maps straight onto radians.
  function pointerAngle(event: React.PointerEvent<SVGCircleElement>): number | null {
    const ctm = event.currentTarget.ownerSVGElement?.getScreenCTM();
    if (!ctm) return null;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
    return Math.atan2(p.y, p.x);
  }

  function stopCoast() {
    if (spinRef.current !== null) {
      cancelAnimationFrame(spinRef.current);
      spinRef.current = null;
    }
    setSpinning(false);
  }

  // A spin outlives nothing: a new pick replaces the showcase (keyed
  // remount) and this cleanup stops the wheel dead instead of leaking a
  // frame loop into an unmounted svg.
  useEffect(
    () => () => {
      if (spinRef.current !== null) cancelAnimationFrame(spinRef.current);
    },
    []
  );

  function dialDown(event: React.PointerEvent<SVGCircleElement>) {
    // Grabbing a coasting wheel catches it first.
    stopCoast();
    if (dragRef.current) return;
    const angle = pointerAngle(event);
    if (angle === null) return;
    // Capture so the twist keeps tracking when the pointer leaves the rail
    // (synthetic events carry no live pointer id — irrelevant there).
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // no live pointer to capture — the drag still works while it stays
      // over the band, which is the common case
    }
    dragRef.current = {
      startPointer: angle,
      startRotation: rotationRef.current,
      lastAngle: angle,
      lastTime: performance.now(),
      velocity: 0
    };
    setDragging(true);
  }

  function dialMove(event: React.PointerEvent<SVGCircleElement>) {
    const drag = dragRef.current;
    const angle = drag ? pointerAngle(event) : null;
    if (!drag || angle === null) return;
    const now = performance.now();
    const dt = Math.max(1, now - drag.lastTime);
    // Release velocity of the toss, exponential-averaged over recent moves
    // so one slow final sample can't kill the flick.
    drag.velocity = drag.velocity * 0.7 + ((angle - drag.lastAngle) / dt) * 0.3;
    drag.lastAngle = angle;
    drag.lastTime = now;
    setRotation(drag.startRotation + angle - drag.startPointer);
  }

  function dialUp() {
    const drag = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    if (!drag) return;
    // Arm the new coast only after any pending one is dead — overwritten
    // rAF ids can't be cancelled later.
    stopCoast();
    // A hand that paused before letting go placed the ring, not tossed it.
    if (performance.now() - drag.lastTime > PLACED_AFTER_MS) return;
    // Reduced motion opts out of the coast: the wheel only ever turns
    // under the viewer's own hand.
    if (motionReduced || Math.abs(drag.velocity) < FLICK_VELOCITY) return;
    // The coast: a pull lets go into several full revolutions — 2 for the
    // gentlest toss, 5 for a hard flick — easing out to a stop.
    const strength = Math.min(1, Math.abs(drag.velocity) / FAST_FLICK_VELOCITY);
    const total = Math.sign(drag.velocity) * (2 + strength * 3) * 2 * Math.PI;
    const dur = 1800 + strength * 1600;
    const startRot = rotationRef.current;
    const began = performance.now();
    setSpinning(true);
    const tick = (now: number) => {
      const t = Math.min(1, (now - began) / dur);
      setRotation(startRot + total * (1 - Math.pow(1 - t, 3)));
      if (t < 1) {
        spinRef.current = requestAnimationFrame(tick);
      } else {
        spinRef.current = null;
        setSpinning(false);
      }
    };
    spinRef.current = requestAnimationFrame(tick);
  }

  // A planet picked before any of its menu planets are authored: a quiet
  // empty state in the same visual language — a ghost mini where the fan
  // will live — instead of a lone, unexplained body.
  if (tail === null && items.length === 0) {
    return (
      <svg
        className="sim-menu-showcase"
        viewBox="-105 -60 210 136"
        role="img"
        aria-label={`${character.name} has no menu planets yet`}
        style={{ "--node-hue": hue } as React.CSSProperties}
      >
        <ShowcaseSky bounds={{ left: -105, top: -60, width: 210, height: 136 }} contentR={26} />
        <g className="sim-menu-showcase-empty">
          <circle className="sim-menu-showcase-ghost" r={26} />
          <text className="sim-menu-showcase-empty-title" y={48}>
            {character.name}
          </text>
          <text className="sim-menu-showcase-empty-note" y={68}>
            No menu planets yet
          </text>
        </g>
      </svg>
    );
  }

  const center = { x: 0, y: 0, edge: tail === null ? 52 : 38 };

  // Size the viewBox to the ring's reach — halo and label included — so
  // any item count centers and scales like the canvas frame's meet-fit.
  const r = ring ? ring.rx : 0;
  const padX = r + 105;
  const padTop = r + 50;
  const padBottom = r + 78;
  const viewBox = `${-padX} ${-padTop} ${padX * 2} ${padTop + padBottom}`;
  const TailIcon = tail?.icon;

  return (
    <svg
      className="sim-menu-showcase"
      viewBox={viewBox}
      role="img"
      aria-label={tail ? `${tail.label} menu` : `${character.name} menu`}
      // Same hue rule as the canvas fan: the mirrored menu wears its
      // host planet's color (the CharacterNode center sets its own, to
      // the same value).
      style={{ "--node-hue": hue } as React.CSSProperties}
      data-dragging={dragging || spinning ? "" : undefined}
      data-rotation={rotation.toFixed(3)}
    >
      <ShowcaseSky
        bounds={{ left: -padX, top: -padTop, width: padX * 2, height: padTop + padBottom }}
        contentR={ring ? ring.rx : 26}
      />
      {tail && TailIcon ? (
        // The selected mini itself, highlighted like its canvas twin.
        <g className="sim-menu-node" data-selected="">
          <circle className="sim-menu-node-halo" r={NODE_HALO_R} />
          <circle className="sim-menu-node-body" r={NODE_R} />
          <g className="sim-menu-node-glyph" transform={`translate(${-NODE_GLYPH / 2} ${-NODE_GLYPH / 2})`}>
            <TailIcon size={NODE_GLYPH} strokeWidth={1.8} aria-hidden />
          </g>
          <text className="sim-menu-node-name" y={LABEL_Y} textAnchor="middle">
            {tail.label}
          </text>
        </g>
      ) : (
        <>
          <CharacterNode character={character} state="idle" dimmed={false} />
          <text className="sim-node-name" y={74} textAnchor="middle">
            {character.name}
          </text>
          <text className="sim-node-role" y={92} dx={16} textAnchor="middle">
            {character.role}
          </text>
        </>
      )}
      {ring && (
        <>
          {/* The invisible band riding the ring's own circle: the grab
              surface for the dial. Its annulus sits exactly on the minis'
              circle, so twisting it spins the fan while the circle stays
              put. */}
          <circle
            className="sim-menu-band"
            r={ring.rx}
            onPointerDown={dialDown}
            onPointerMove={dialMove}
            onPointerUp={dialUp}
            onPointerCancel={dialUp}
          />
          <PlanetMenu
            items={items}
            depth={0}
            ring={ring}
            center={center}
            animate={!motionReduced && !dragging && !spinning}
            interactive={false}
            rotation={rotation}
            onSelect={() => {}}
          />
        </>
      )}
    </svg>
  );
}
