// The command rail: a slim chamfered icon column hugging the stage's left
// edge, in the vein of classic planetarium HUDs. The dashboard link leads
// back to the mission-control deck; below it, three toggles — the story
// rail (scene heading + menu showcase), the run-panel deck, and full-display
// zoom. Both panels start folded: the sky owns the stage until one of these
// is pressed. Each button is a two-layer chamfer — the outer ring paints
// the 1px edge, the inner face carries the surface — because clip-path
// shears plain borders away.

import { LayoutDashboard, Orbit, Settings, ZoomIn } from "lucide-react";
import { useRouterNavigate } from "../../../app/router/RouterContext";

interface CommandRailProps {
  /** The story rail (scene heading + showcase) is unfolded. */
  railOpen: boolean;
  /** The run-panel deck is unfolded. */
  deckOpen: boolean;
  /** Full-display zoom is active. */
  zoomed: boolean;
  onToggleRail: () => void;
  onToggleDeck: () => void;
  onToggleZoom: () => void;
}

export function CommandRail({
  railOpen,
  deckOpen,
  zoomed,
  onToggleRail,
  onToggleDeck,
  onToggleZoom
}: CommandRailProps) {
  const navigate = useRouterNavigate();
  return (
    <nav className="sim-rail" aria-label="Display panels">
      <div className="sim-rail-btns">
        <a
          className="sim-rail-btn"
          href="/"
          aria-label="Dashboard"
          title="Dashboard — the mission-control deck"
          onClick={(event) => {
            event.preventDefault();
            navigate("/");
          }}
        >
          <span className="sim-rail-btn-face">
            <LayoutDashboard size={17} strokeWidth={1.8} aria-hidden />
            <span className="sim-rail-btn-tag">DECK</span>
          </span>
        </a>
        <button
          type="button"
          className={`sim-rail-btn${railOpen ? " sim-rail-btn-on" : ""}`}
          aria-pressed={railOpen}
          aria-label="Toggle the story rail"
          title="Story rail — scene heading and menu showcase"
          onClick={onToggleRail}
        >
          <span className="sim-rail-btn-face">
            <Orbit size={17} strokeWidth={1.8} aria-hidden />
            <span className="sim-rail-btn-tag">STORY</span>
          </span>
        </button>
        <button
          type="button"
          className={`sim-rail-btn${deckOpen ? " sim-rail-btn-on" : ""}`}
          aria-pressed={deckOpen}
          aria-label="Toggle the run panels"
          title="Run panels — Inspector, Results, Evidence, Config"
          onClick={onToggleDeck}
        >
          <span className="sim-rail-btn-face">
            <Settings size={17} strokeWidth={1.8} aria-hidden />
            <span className="sim-rail-btn-tag">PANEL</span>
          </span>
        </button>
        <button
          type="button"
          className={`sim-rail-btn${zoomed ? " sim-rail-btn-on" : ""}`}
          aria-pressed={zoomed}
          aria-label={
            zoomed ? "Exit full-display zoom" : "Zoom — show the solar system across the display"
          }
          title={zoomed ? "Exit zoom (Esc)" : "Zoom to full display"}
          onClick={onToggleZoom}
        >
          <span className="sim-rail-btn-face">
            <ZoomIn size={17} strokeWidth={1.8} aria-hidden />
            <span className="sim-rail-btn-tag">{zoomed ? "EXIT" : "ZOOM"}</span>
          </span>
        </button>
      </div>
    </nav>
  );
}
