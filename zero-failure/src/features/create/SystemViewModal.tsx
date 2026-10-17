// The full solar-system view a card opens — shared by the create bay,
// the presentation and the playwright sectors: the same live deck those
// pages screen — the simulator's own canvas, the real deep sky, worlds
// sweeping their Kepler rings — framed in the modal scaffolding. The
// scrim or the ✕ puts it away.

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { ForgedOrbitDeck } from "./ForgedOrbitDeck";
import type { ForgedSystem } from "./systemsDoc";

export function SystemViewModal({ system, onClose }: { system: ForgedSystem; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    panelRef.current?.focus();
  }, []);
  return (
    <div className="dash-view">
      <button
        type="button"
        className="dash-modal-backdrop"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        className="dash-modal-panel dash-view-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`${system.sun} — solar-system view`}
        tabIndex={-1}
        ref={panelRef}
      >
        <button type="button" className="dash-modal-close" aria-label="Close" onClick={onClose}>
          <X size={16} aria-hidden />
        </button>
        <ForgedOrbitDeck system={system} />
      </div>
    </div>
  );
}
