// Side-panel deck: Inspector (connectors + live message log), Results
// (progressive dashboard + verdict), Evidence (grouped history), Config
// (scenario + settings) — plus the full-report takeover. The deck starts
// folded and the right rail's PANEL seat toggles it (the simulator's
// StatusRail for the stage deck; RunPanelsControl provisions its own
// stack on every other page), so open/onClose are owned one level up and
// the rail and the deck's own ✕ share one state. The
// sheet itself is the shared drawer (SimDrawer) — same overlay, slide-in
// and close as every other drawer in the app; only the content differs.

import { useState } from "react";
import { X } from "lucide-react";
import type { Timeline } from "../../engine/timeline";
import type { LiveActivityEvent } from "../../live/activity";
import type { BroadcastActions } from "../../live/broadcast/useBroadcastActions";
import { InspectorPanel } from "./InspectorPanel";
import { ResultsDashboard } from "./ResultsDashboard";
import { EvidencePanel } from "./EvidencePanel";
import { ConfigPanel } from "./ConfigPanel";
import { ReportView } from "./ReportView";
import { SimDrawer } from "../SimDrawer";

type Tab = "inspector" | "results" | "evidence" | "config";

const TABS: { id: Tab; label: string }[] = [
  { id: "inspector", label: "Inspector" },
  { id: "results", label: "Results" },
  { id: "evidence", label: "Evidence" },
  { id: "config", label: "Config" }
];

export function PanelDeck({
  timeline,
  liveEvents,
  actions,
  open,
  onClose
}: {
  timeline: Timeline;
  liveEvents: LiveActivityEvent[];
  actions: BroadcastActions;
  /** The right rail's PANEL seat (or the ✕) moves it. */
  open: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("inspector");
  const [reportOpen, setReportOpen] = useState(false);

  return (
    <SimDrawer open={open} label="Run panels" width="min(21rem, 92vw)" onClose={onClose}>
      <div className="sim-aside">
        <div className="sim-aside-top">
          <div className="sim-tabs" role="tablist" aria-label="Panel tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`sim-tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`sim-panel-${t.id}`}
                className={`sim-tab${tab === t.id ? " sim-tab-active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="sim-drawer-close"
            aria-label="Close panels"
            onClick={onClose}
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        {tab === "inspector" && (
          <div role="tabpanel" id="sim-panel-inspector" aria-labelledby="sim-tab-inspector">
            <InspectorPanel timeline={timeline} liveEvents={liveEvents} />
          </div>
        )}
        {tab === "results" && (
          <div role="tabpanel" id="sim-panel-results" aria-labelledby="sim-tab-results">
            <ResultsDashboard timeline={timeline} onOpenReport={() => setReportOpen(true)} />
          </div>
        )}
        {tab === "evidence" && (
          <div role="tabpanel" id="sim-panel-evidence" aria-labelledby="sim-tab-evidence">
            <EvidencePanel timeline={timeline} />
          </div>
        )}
        {tab === "config" && (
          <div role="tabpanel" id="sim-panel-config" aria-labelledby="sim-tab-config">
            <ConfigPanel actions={actions} />
          </div>
        )}

        {reportOpen && <ReportView timeline={timeline} onClose={() => setReportOpen(false)} />}
      </div>
    </SimDrawer>
  );
}
