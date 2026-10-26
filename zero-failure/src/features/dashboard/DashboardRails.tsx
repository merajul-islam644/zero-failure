// The dashboard's rails: the same chamfered HUD columns the simulator
// flanks its stage with, so the deck reads as the same machine. Left =
// the shared section rail (CommandRail — the five pages, the sector
// you're on stays lit; the rest lead out).
// Right = the session controls the deck actually has: the run-panel
// deck's PANEL seat — opening the deck here on its own provisioned
// stack, the same one the simulator mounts around its stage — and the
// account flyout, reusing AccountBar untouched. Flyout courtesies
// copied from the simulator's StatusRail: outside click closes,
// Escape closes.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CircleUser } from "lucide-react";
import { AccountBar } from "../simulator/components/AccountBar";
import { CommandRail, type RailSector } from "../simulator/components/CommandRail";
import { RunPanelsControl } from "../simulator/components/panels/RunPanelsControl";
import { useRouterNavigate } from "../../app/router/RouterContext";

export type { RailSector };

/** The sectors of the account family — the dossier and the consoles
 *  reached from it. They share the right rail's ACCT light. */
const ACCOUNT_SECTORS: readonly RailSector[] = ["account", "access", "roles"];

export function DashboardRails({ active = "deck", children }: { active?: RailSector; children: ReactNode }) {
  const [accountOpen, setAccountOpen] = useState(false);
  const railRef = useRef<HTMLElement | null>(null);
  const navigate = useRouterNavigate();

  // Rail links route in-app (no full reload — the sector jump plays).
  const followLink = (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    navigate(href);
  };

  useEffect(() => {
    if (!accountOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (railRef.current && event.target instanceof Node && !railRef.current.contains(event.target)) {
        setAccountOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [accountOpen]);

  return (
    <>
      <CommandRail active={active} />

      <div className="dash-deck">{children}</div>

      <nav ref={railRef} className="sim-rail sim-rail-right" aria-label="Session controls">
        <div className="sim-rail-btns">
          <div className="sim-rail-slot">
            <button
              type="button"
              className={`sim-rail-btn${accountOpen || ACCOUNT_SECTORS.includes(active) ? " sim-rail-btn-on" : ""}`}
              aria-expanded={accountOpen}
              aria-label="Account"
              title={ACCOUNT_SECTORS.includes(active) ? "Signed-in account — you are here" : "Signed-in account"}
              onClick={() => setAccountOpen((cur) => !cur)}
            >
              <span className="sim-rail-btn-face">
                <CircleUser size={17} strokeWidth={1.8} aria-hidden />
                <span className="sim-rail-btn-tag">ACCT</span>
              </span>
            </button>
            {accountOpen && (
              <div className="sim-rail-flyout" role="group" aria-label="Account">
                <p className="sim-rail-flyout-title">Account</p>
                <AccountBar />
                {/* the flyout's way out: the signed-in dossier, the
                    account sector's own full-display file */}
                <a className="sim-rail-flyout-link" href="/account" onClick={followLink("/account")}>
                  Open the dossier <span aria-hidden>→</span>
                </a>
              </div>
            )}
          </div>
          <RunPanelsControl />
        </div>
      </nav>
    </>
  );
}
