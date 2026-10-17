// Execution-mode picker for the status rail's mode flyout: a segmented
// Simulated | Live choice. Both options stay visible, so going live is an
// explicit choice rather than a hidden flip behind one button's label.
// Switching locks only while a run is playing. All live reads are
// read-only; the connector layer refuses every write (LIVE_READ_ONLY).

import { FlaskConical, RadioTower } from "lucide-react";
import type { ExecutionMode } from "../engine/types";
import { useRun } from "../run/RunContext";
import { useSettings } from "../state/SettingsContext";

const OPTIONS: Array<{ mode: ExecutionMode; label: string; title: string }> = [
  {
    mode: "simulated",
    label: "Simulated",
    title: "Deterministic simulated connectors — nothing real is contacted",
  },
  {
    mode: "live",
    label: "Live",
    title: "Execute against real SELISE Blocks services (read-only)",
  },
];

export function LiveModeToggle({ onModeChange }: { onModeChange?: (mode: ExecutionMode) => void }) {
  const { mode, running } = useRun();
  const { setExecutionMode } = useSettings();

  return (
    <div className="sim-mode-picker" role="radiogroup" aria-label="Execution mode">
      {OPTIONS.map(({ mode: value, label, title }) => {
        const on = mode === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={on}
            className={`sim-mode-option${on ? " sim-mode-option-on" : ""}${value === "live" ? " sim-mode-option-live" : ""}`}
            disabled={running}
            title={running ? "Wait for the current run to finish" : title}
            onClick={() => {
              setExecutionMode(value);
              onModeChange?.(value);
            }}
          >
            {value === "live" ? (
              <RadioTower size={13} aria-hidden />
            ) : (
              <FlaskConical size={13} aria-hidden />
            )}
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
