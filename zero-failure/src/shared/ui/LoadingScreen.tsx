// Page loading wears the same console as the sector jump: the streak
// field, the chamfered readout and a scanning bar — the machine is
// thinking, never a bare spinner. `label` names what it's waiting on.
export function LoadingScreen({ label = "LOADING" }: { label?: string }) {
  return (
    <div className="sim-jump sim-jump-hold" role="status" aria-live="polite">
      <span className="sim-jump-streaks" aria-hidden />
      <span className="sim-jump-flash" aria-hidden />
      <span className="sim-jump-box">
        <span className="sim-jump-kicker">SYSTEM CHECK</span>
        <strong className="sim-jump-target">{label}</strong>
        <span className="sim-jump-bar">
          <i />
        </span>
      </span>
    </div>
  );
}
