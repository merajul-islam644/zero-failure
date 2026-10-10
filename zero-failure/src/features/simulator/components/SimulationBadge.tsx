// Permanent, non-dismissible honesty strip. Every screen of the app shows it;
// live-mode (M3+) gets its own adjacent strip rather than ever reusing this one.

import { FlaskConical } from "lucide-react";

export function SimulationBadge() {
  return (
    <div className="sim-badge" role="note" aria-label="Simulation notice">
      <FlaskConical size={14} aria-hidden />
      <span>
        <strong>SIMULATION ONLY</strong> — no real SELISE Blocks services are contacted
      </span>
    </div>
  );
}
