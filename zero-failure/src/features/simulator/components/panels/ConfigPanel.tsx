// Config panel: scenario selection (default storyline + the 14 failure /
// recovery scenarios), re-run, and the playback accessibility settings.
// Selecting a scenario re-executes the run up-front and restarts the story —
// the animation is always a faithful rendering of the executed run.

import { useRun } from "../../run/RunContext";
import { usePlayer } from "../../state/PlayerContext";
import { useSettings, type MotionPreference, type ThemePreference } from "../../state/SettingsContext";

export function ConfigPanel() {
  const { scenarios, scenarioId, selectScenario, rerun, running } = useRun();
  const { clock, restart } = usePlayer();
  const settings = useSettings();

  const pickScenario = (id: string) => {
    selectScenario(id);
    clock.restart();
  };

  return (
    <div className="sim-config">
      <section className="sim-inspector-section">
        <h3 className="sim-inspector-heading">Scenario</h3>
        <select
          className="sim-select"
          value={scenarioId}
          onChange={(e) => pickScenario(e.target.value)}
          aria-label="Select failure scenario"
        >
          {scenarios.map((scenario) => (
            <option key={scenario.id} value={scenario.id}>
              {scenario.title}
            </option>
          ))}
        </select>
        <p className="sim-scenario-hint">
          {scenarios.find((s) => s.id === scenarioId)?.description}
        </p>
        <p className="sim-scenario-hint">
          <strong>Expected:</strong>{" "}
          {scenarios.find((s) => s.id === scenarioId)?.expectedOutcome}
        </p>
        <button
          type="button"
          className="sim-report-btn"
          disabled={running}
          onClick={() => {
            rerun();
            clock.restart();
          }}
        >
          {running ? "Executing…" : "Run again from start"}
        </button>
      </section>

      <section className="sim-inspector-section">
        <h3 className="sim-inspector-heading">Appearance</h3>
        <label className="sim-field">
          <span>Theme</span>
          <select
            className="sim-select"
            value={settings.theme}
            onChange={(e) => settings.setTheme(e.target.value as ThemePreference)}
          >
            <option value="system">System</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>
        <label className="sim-field">
          <span>Motion</span>
          <select
            className="sim-select"
            value={settings.motion}
            onChange={(e) => settings.setMotion(e.target.value as MotionPreference)}
          >
            <option value="system">System</option>
            <option value="reduce">Reduce</option>
            <option value="full">Full</option>
          </select>
        </label>
      </section>

      <section className="sim-inspector-section">
        <h3 className="sim-inspector-heading">Audio (off by default)</h3>
        <label className="sim-toggle">
          <input
            type="checkbox"
            checked={settings.narration}
            onChange={(e) => settings.setNarration(e.target.checked)}
          />
          <span>Narrate dialogue (mutes above 2×)</span>
        </label>
        <label className="sim-toggle">
          <input
            type="checkbox"
            checked={settings.sfx}
            onChange={(e) => settings.setSfx(e.target.checked)}
          />
          <span>Packet sound effects</span>
        </label>
      </section>

      <section className="sim-inspector-section">
        <h3 className="sim-inspector-heading">Playback keys</h3>
        <ul className="sim-keymap">
          <li><kbd>Space</kbd> play / pause</li>
          <li><kbd>←</kbd> / <kbd>→</kbd> skip 10 s</li>
          <li><kbd>↑</kbd> / <kbd>↓</kbd> speed</li>
          <li><kbd>PgUp</kbd> / <kbd>PgDn</kbd> scene</li>
          <li><kbd>Home</kbd> / <kbd>End</kbd> start / end</li>
          <li><kbd>R</kbd> restart</li>
        </ul>
      </section>
    </div>
  );
}
