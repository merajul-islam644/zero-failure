// Run state: which scenario is selected and its pre-executed RunResult.
// Execution is up-front and deterministic (the whole scenario before the
// first frame), so playback and seeking stay a pure fold. The component tree
// is strict-mode safe: the effect below is cancel-on-unmount only and never
// starts anything on cleanup — a double mount just executes the same pure
// run twice and keeps the last result.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import type { ExecutionMode, RunResult, ScenarioDefinition } from "../engine/types";
import { executeScenario } from "./runner";
import { SCENARIOS, SCENARIO_DEFAULT, scenarioById } from "../scenarios/registry";
import { registryFor, type ConnectorRegistry } from "../connectors/registry";

interface RunContextValue {
  scenario: ScenarioDefinition;
  scenarioId: string;
  scenarios: ScenarioDefinition[];
  selectScenario: (id: string) => void;
  /** Monotonic counter — bumped to re-execute the same scenario. */
  runNonce: number;
  rerun: () => void;
  run: RunResult | null;
  running: boolean;
  mode: ExecutionMode;
  /** Static connector tables for the inspector (never executed by the UI). */
  simulatedRegistry: ConnectorRegistry;
  liveRegistry: ConnectorRegistry;
}

const RunContext = createContext<RunContextValue | null>(null);

export function RunProvider({ children }: { children: ReactNode }) {
  const [scenarioId, setScenarioId] = useState(SCENARIO_DEFAULT.id);
  const [runNonce, setRunNonce] = useState(0);
  const [run, setRun] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);

  const scenario = useMemo(() => scenarioById(scenarioId), [scenarioId]);

  // Simulation is deterministic and synchronous-resolving; live mode will
  // later record real executions into the same shape.
  const mode: ExecutionMode = "simulated";

  useEffect(() => {
    let cancelled = false;
    setRunning(true);
    executeScenario(scenario, mode).then((result) => {
      if (cancelled) return;
      setRun(result);
      setRunning(false);
    });
    return () => {
      cancelled = true;
    };
  }, [scenario, mode, runNonce]);

  // Registries are static description data (platform, auth method, operation
  // list, config status) — built once for the inspector tables.
  const simulatedRegistry = useMemo(() => registryFor("simulated"), []);
  const liveRegistry = useMemo(() => registryFor("live"), []);

  const value = useMemo<RunContextValue>(
    () => ({
      scenario,
      scenarioId,
      scenarios: SCENARIOS,
      selectScenario: setScenarioId,
      runNonce,
      rerun: () => setRunNonce((n) => n + 1),
      run,
      running,
      mode,
      simulatedRegistry,
      liveRegistry
    }),
    [scenario, scenarioId, runNonce, run, running, simulatedRegistry, liveRegistry]
  );

  return <RunContext.Provider value={value}>{children}</RunContext.Provider>;
}

export function useRun(): RunContextValue {
  const ctx = useContext(RunContext);
  if (!ctx) throw new Error("useRun must be used inside <RunProvider>");
  return ctx;
}
