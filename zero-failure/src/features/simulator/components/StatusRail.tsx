// The status rail: the command rail's sci-fi sibling on the right edge.
// Two seats: PANEL — the stage deck's toggle, its state owned one level up
// so the rail and the deck's ✕ share one truth — and the signed-in
// account's flyout. The rail adds the HUD chrome and the flyout's usual
// courtesies (outside click and Escape close it, with stopPropagation so
// the window-level key handlers never see the flyout's own Escape).

import { useEffect, useRef, useState } from "react";
import { CircleUser } from "lucide-react";
import { AccountBar } from "./AccountBar";
import { RunPanelsButton } from "./panels/RunPanelsControl";

export function StatusRail({ deckOpen, onToggleDeck }: { deckOpen: boolean; onToggleDeck: () => void }) {
  const [openPanel, setOpenPanel] = useState(false);
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!openPanel) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && event.target instanceof Node && !rootRef.current.contains(event.target)) {
        setOpenPanel(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // document fires before window: stop the flyout's close here so no
        // window-level handler reacts to it too
        event.stopPropagation();
        setOpenPanel(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openPanel]);

  return (
    <nav ref={rootRef} className="sim-rail sim-rail-right" aria-label="Session controls">
      <div className="sim-rail-btns">
        <div className="sim-rail-slot">
          <button
            type="button"
            className={`sim-rail-btn${openPanel ? " sim-rail-btn-on" : ""}`}
            aria-expanded={openPanel}
            aria-label="Account"
            title="Signed-in account"
            onClick={() => setOpenPanel((cur) => !cur)}
          >
            <span className="sim-rail-btn-face">
              <CircleUser size={17} strokeWidth={1.8} aria-hidden />
              <span className="sim-rail-btn-tag">ACCT</span>
            </span>
          </button>
          {openPanel && (
            <div className="sim-rail-flyout" role="group" aria-label="Account">
              <p className="sim-rail-flyout-title">Account</p>
              <AccountBar />
            </div>
          )}
        </div>
        <div className="sim-rail-slot">
          <RunPanelsButton on={deckOpen} onToggle={onToggleDeck} />
        </div>
      </div>
    </nav>
  );
}
