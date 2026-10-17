// The status rail: the command rail's sci-fi sibling on the right edge.
// Everything that used to crowd the top bar lives in its three flyouts —
// execution mode, broadcast, account. Each flyout reuses its top-bar
// control untouched; the rail only adds the HUD chrome, the open/close
// state and the usual courtesies (outside click, Escape with
// stopPropagation so a window-level Escape can't exit zoom by accident).

import { useEffect, useRef, useState } from "react";
import { CircleUser, FlaskConical, RadioTower } from "lucide-react";
import type { ExecutionMode } from "../engine/types";
import type { BroadcastApi } from "../live/broadcast/useBroadcast";
import { useRun } from "../run/RunContext";
import { AccountBar } from "./AccountBar";
import { BroadcastControl } from "./BroadcastControl";
import { LiveModeToggle } from "./LiveModeControl";

type Panel = "mode" | "broadcast" | "account";

interface StatusRailProps {
  broadcast: BroadcastApi;
  onModeChange?: (mode: ExecutionMode) => void;
}

export function StatusRail({ broadcast, onModeChange }: StatusRailProps) {
  const { mode } = useRun();
  const [openPanel, setOpenPanel] = useState<Panel | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!openPanel) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && event.target instanceof Node && !rootRef.current.contains(event.target)) {
        setOpenPanel(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // document fires before window: stopping here keeps zoom mode alive
        event.stopPropagation();
        setOpenPanel(null);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openPanel]);

  const toggle = (panel: Panel) => setOpenPanel((cur) => (cur === panel ? null : panel));
  const live = mode === "live";

  return (
    <nav ref={rootRef} className="sim-rail sim-rail-right" aria-label="Session controls">
      <div className="sim-rail-btns">
        <div className="sim-rail-slot">
          <button
            type="button"
            className={`sim-rail-btn${live || openPanel === "mode" ? " sim-rail-btn-on" : ""}`}
            aria-expanded={openPanel === "mode"}
            aria-label="Execution mode"
            title="Simulation or live connectors"
            onClick={() => toggle("mode")}
          >
            <span className="sim-rail-btn-face">
              {live ? (
                <RadioTower size={17} strokeWidth={1.8} aria-hidden />
              ) : (
                <FlaskConical size={17} strokeWidth={1.8} aria-hidden />
              )}
              <span className="sim-rail-btn-tag">MODE</span>
            </span>
          </button>
          {openPanel === "mode" && (
            <div className="sim-rail-flyout" role="group" aria-label="Execution mode">
              <p className="sim-rail-flyout-title">Execution mode</p>
              <LiveModeToggle onModeChange={onModeChange} />
              <p className="sim-rail-flyout-note">
                {live
                  ? "Reading real SELISE Blocks services — every probe is read-only."
                  : "Deterministic simulated connectors — nothing real is contacted."}
              </p>
            </div>
          )}
        </div>

        <div className="sim-rail-slot">
          <button
            type="button"
            className={`sim-rail-btn${broadcast.enabled || openPanel === "broadcast" ? " sim-rail-btn-on" : ""}`}
            aria-expanded={openPanel === "broadcast"}
            aria-label="Broadcast"
            title="Shared playback — follow or present"
            onClick={() => toggle("broadcast")}
          >
            <span className="sim-rail-btn-face">
              <RadioTower size={17} strokeWidth={1.8} aria-hidden />
              <span className="sim-rail-btn-tag">FEED</span>
            </span>
          </button>
          {openPanel === "broadcast" && (
            <div className="sim-rail-flyout" role="group" aria-label="Broadcast">
              <p className="sim-rail-flyout-title">Broadcast</p>
              <BroadcastControl broadcast={broadcast} />
            </div>
          )}
        </div>

        <div className="sim-rail-slot">
          <button
            type="button"
            className={`sim-rail-btn${openPanel === "account" ? " sim-rail-btn-on" : ""}`}
            aria-expanded={openPanel === "account"}
            aria-label="Account"
            title="Signed-in account"
            onClick={() => toggle("account")}
          >
            <span className="sim-rail-btn-face">
              <CircleUser size={17} strokeWidth={1.8} aria-hidden />
              <span className="sim-rail-btn-tag">ACCT</span>
            </span>
          </button>
          {openPanel === "account" && (
            <div className="sim-rail-flyout" role="group" aria-label="Account">
              <p className="sim-rail-flyout-title">Account</p>
              <AccountBar />
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
