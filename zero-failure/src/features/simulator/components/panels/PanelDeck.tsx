// Side-panel deck: Inspector (connectors + live message log), Results
// (progressive dashboard + verdict), Evidence (grouped history) — plus the
// full-report takeover.

import { useState } from "react";
import type { Timeline } from "../../engine/timeline";
import { InspectorPanel } from "./InspectorPanel";
import { ResultsDashboard } from "./ResultsDashboard";
import { EvidencePanel } from "./EvidencePanel";
import { ReportView } from "./ReportView";

type Tab = "inspector" | "results" | "evidence";

const TABS: { id: Tab; label: string }[] = [
  { id: "inspector", label: "Inspector" },
  { id: "results", label: "Results" },
  { id: "evidence", label: "Evidence" }
];

export function PanelDeck({ timeline }: { timeline: Timeline }) {
  const [tab, setTab] = useState<Tab>("inspector");
  const [reportOpen, setReportOpen] = useState(false);

  return (
    <aside className="sim-aside" aria-label="Run panels">
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

      {tab === "inspector" && <InspectorPanel timeline={timeline} />}
      {tab === "results" && (
        <ResultsDashboard timeline={timeline} onOpenReport={() => setReportOpen(true)} />
      )}
      {tab === "evidence" && <EvidencePanel timeline={timeline} />}

      {reportOpen && <ReportView timeline={timeline} onClose={() => setReportOpen(false)} />}
    </aside>
  );
}
