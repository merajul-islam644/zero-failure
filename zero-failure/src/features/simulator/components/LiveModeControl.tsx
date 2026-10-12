// Live-mode controls: the topbar toggle plus the honesty strip shown while
// live. Two mount points, one concern — exactly one honesty strip is ever
// visible. In live mode the simulation strip's claim ("no real services are
// contacted") would be false, so it must not render: this strip takes its
// place, per SimulationBadge's own header comment. All live reads are
// read-only; the connector layer refuses every write (LIVE_READ_ONLY).

import { RadioTower } from "lucide-react";
import type { ExecutionMode } from "../engine/types";
import { useRun } from "../run/RunContext";
import { useSettings } from "../state/SettingsContext";
import { isBlocksConfigured } from "../../../lib/blocks/config";

export function LiveHonestyStrip() {
  return (
    <div className="sim-badge sim-badge-live" role="note" aria-label="Live notice">
      <RadioTower size={14} aria-hidden />
      <span>
        <strong>LIVE</strong> — reads real SELISE Blocks services (read-only)
      </span>
    </div>
  );
}

export function LiveModeToggle({ onModeChange }: { onModeChange?: (mode: ExecutionMode) => void }) {
  const { mode, running } = useRun();
  const { setExecutionMode } = useSettings();
  const configured = isBlocksConfigured();
  const live = mode === "live";
  const title = !configured
    ? "Blocks API is not configured in this environment"
    : running
      ? "Wait for the current run to finish"
      : live
        ? "Switch back to the simulated connectors"
        : "Execute the scenario against real SELISE Blocks services (read-only)";

  return (
    <button
      type="button"
      className={`sim-mode-toggle${live ? " sim-mode-live" : ""}`}
      onClick={() => {
        const next = live ? "simulated" : "live";
        setExecutionMode(next);
        onModeChange?.(next);
      }}
      disabled={!configured || running}
      aria-pressed={live}
      title={title}
    >
      <RadioTower size={14} aria-hidden />
      <span>{live ? "Live" : "Simulated"}</span>
    </button>
  );
}
