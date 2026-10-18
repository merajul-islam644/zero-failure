// The dashboard's rails: the same chamfered HUD columns the simulator
// flanks its stage with, so the deck reads as the same machine. Left =
// the five pages (the sector you're on stays lit; the rest lead out).
// Right = the session controls the deck actually has: the account flyout,
// reusing AccountBar untouched. Flyout courtesies copied from the
// simulator's StatusRail: outside click closes, Escape closes.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CircleUser, LayoutDashboard, MonitorPlay, Presentation, Rocket, Theater } from "lucide-react";
import { AccountBar } from "../simulator/components/AccountBar";
import { useRouterNavigate } from "../../app/router/RouterContext";

/** Which of the rail's sectors is currently on screen — the five
 *  machine sectors, plus the account family (the dossier, the access
 *  registry and the role registry reached from it; no left rail
 *  button lights for any of them — the right rail's ACCT is their
 *  anchor). */
export type RailSector = "deck" | "sim" | "presentation" | "playwright" | "create" | "account" | "access" | "roles";

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
      <nav className="sim-rail" aria-label="Sections">
        <div className="sim-rail-btns">
          <a
            className={`sim-rail-btn${active === "deck" ? " sim-rail-btn-on" : ""}`}
            href="/"
            aria-label="Dashboard"
            title="Dashboard — the mission-control deck"
            onClick={followLink("/")}
          >
            <span className="sim-rail-btn-face">
              <LayoutDashboard size={17} strokeWidth={1.8} aria-hidden />
              <span className="sim-rail-btn-tag">DECK</span>
            </span>
          </a>
          <a
            className={`sim-rail-btn${active === "create" ? " sim-rail-btn-on" : ""}`}
            href="/create"
            aria-label="Create solar system"
            title="Create solar system — author your own system"
            onClick={followLink("/create")}
          >
            <span className="sim-rail-btn-face">
              <Rocket size={17} strokeWidth={1.8} aria-hidden />
              <span className="sim-rail-btn-tag">CREATE</span>
            </span>
          </a>
          <a
            className={`sim-rail-btn${active === "presentation" ? " sim-rail-btn-on" : ""}`}
            href="/presentation"
            aria-label="Presentation"
            title="Presentation — the mission's slide deck"
            onClick={followLink("/presentation")}
          >
            <span className="sim-rail-btn-face">
              <Presentation size={17} strokeWidth={1.8} aria-hidden />
              <span className="sim-rail-btn-tag">PRES</span>
            </span>
          </a>
          <a
            className={`sim-rail-btn${active === "playwright" ? " sim-rail-btn-on" : ""}`}
            href="/playwright"
            aria-label="Playwright"
            title="Playwright — the e2e suite's deck"
            onClick={followLink("/playwright")}
          >
            <span className="sim-rail-btn-face">
              <Theater size={17} strokeWidth={1.8} aria-hidden />
              <span className="sim-rail-btn-tag">PW</span>
            </span>
          </a>
          <a
            className={`sim-rail-btn${active === "sim" ? " sim-rail-btn-on" : ""}`}
            href="/simulator"
            aria-label="Simulator"
            title="Open the solar-system simulator"
            onClick={followLink("/simulator")}
          >
            <span className="sim-rail-btn-face">
              <MonitorPlay size={17} strokeWidth={1.8} aria-hidden />
              <span className="sim-rail-btn-tag">SIM</span>
            </span>
          </a>
        </div>
      </nav>

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
        </div>
      </nav>
    </>
  );
}
