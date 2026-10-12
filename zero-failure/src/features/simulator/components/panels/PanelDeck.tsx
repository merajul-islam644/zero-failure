// Side-panel deck: Inspector (connectors + live message log), Results
// (progressive dashboard + verdict), Evidence (grouped history), Config
// (scenario + settings) — plus the full-report takeover. Below 1024 px the
// deck becomes an overlay drawer toggled by a floating button.

import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import type { Timeline } from "../../engine/timeline";
import type { LiveActivityEvent } from "../../live/activity";
import type { BroadcastActions } from "../../live/broadcast/useBroadcastActions";
import { InspectorPanel } from "./InspectorPanel";
import { ResultsDashboard } from "./ResultsDashboard";
import { EvidencePanel } from "./EvidencePanel";
import { ConfigPanel } from "./ConfigPanel";
import { ReportView } from "./ReportView";

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
  actions
}: {
  timeline: Timeline;
  liveEvents: LiveActivityEvent[];
  actions: BroadcastActions;
}) {
  const [tab, setTab] = useState<Tab>("inspector");
  const [reportOpen, setReportOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const pickTab = (next: Tab) => {
    setTab(next);
    setDrawerOpen(true); // on mobile, choosing a tab opens the drawer
  };

  return (
    <>
      <button
        type="button"
        className="sim-drawer-btn"
        aria-expanded={drawerOpen}
        aria-controls="sim-panel-deck"
        onClick={() => setDrawerOpen((open) => !open)}
      >
        <SlidersHorizontal size={18} aria-hidden />
        Panels
      </button>

      <aside
        id="sim-panel-deck"
        className={`sim-aside${drawerOpen ? " sim-aside-open" : ""}`}
        aria-label="Run panels"
      >
        <div className="sim-aside-top">
          <div className="sim-tabs" role="tablist" aria-label="Panel tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
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
            onClick={() => setDrawerOpen(false)}
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        {tab === "inspector" && <InspectorPanel timeline={timeline} liveEvents={liveEvents} />}
        {tab === "results" && (
          <ResultsDashboard timeline={timeline} onOpenReport={() => setReportOpen(true)} />
        )}
        {tab === "evidence" && <EvidencePanel timeline={timeline} />}
        {tab === "config" && <ConfigPanel actions={actions} />}

        {reportOpen && <ReportView timeline={timeline} onClose={() => setReportOpen(false)} />}
      </aside>
    </>
  );
}
