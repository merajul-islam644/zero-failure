// The section rail: a slim chamfered icon column hugging the left edge,
// in the vein of classic planetarium HUDs — the same column the dashboard
// family flanks its pages with, so no seat ever disappears between
// sectors: the machine carries its full menu everywhere, and the sector
// you're on stays lit while the rest lead out. Each button is a two-layer
// chamfer — the outer ring paints the 1px edge, the inner face carries
// the surface — because clip-path shears plain borders away.

import { LayoutDashboard, MonitorPlay, Presentation, Rocket } from "lucide-react";
import { useRouterNavigate } from "../../../app/router/RouterContext";

/** Which of the rail's sectors is currently on screen — the five
 *  machine sectors, plus the account family (the dossier, the access
 *  registry and the role registry reached from it; no rail
 *  button lights for any of them — the right rail's ACCT is their
 *  anchor). */
export type RailSector = "deck" | "sim" | "presentation" | "playwright" | "create" | "account" | "access" | "roles";

export function CommandRail({ active }: { active?: RailSector }) {
  const navigate = useRouterNavigate();
  // Rail links route in-app (no full reload — the sector jump plays).
  const followLink = (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    navigate(href);
  };

  return (
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
  );
}
