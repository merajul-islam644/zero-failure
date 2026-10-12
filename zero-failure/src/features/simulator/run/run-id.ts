// Shared run identity, so the runner and the process-rule evaluator never
// import from each other.

export const RUN_ID = "RUN-001";

/**
 * Live runs get a unique id per execution — two live runs are two real
 * executions, never the same recorded story. Simulated keeps RUN-001 so
 * every deterministic replay stays byte-identical.
 */
let liveRunSequence = 0;

export function generateRunId(): string {
  liveRunSequence += 1;
  return `RUN-${Date.now().toString(36).toUpperCase()}-${liveRunSequence}`;
}
