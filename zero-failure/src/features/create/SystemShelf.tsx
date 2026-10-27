// The forged systems' shared shelf: every sector that shows the systems
// as cards — the authoring bay, the presentation and the playwright
// sectors — shows them through this one shelf. The deck splits in two
// labeled parts, the app base's worlds above the menu base's. The HUD
// filter bar is parked, not deleted — its markup, state and imports
// all wait below in comments, so un-commenting the marked blocks puts
// the command line back on the shelf. The card actions (the pencil and
// the two-press trash) ride through to the authoring bay alone; the
// other sectors pass none and their cards read only.

// Parked with the filter — these imports come back with it:
// import { useState } from "react";
// import { Search, X } from "lucide-react";
import { SystemCard } from "./SystemCard";
import type { ForgedSystem } from "./systemsDoc";

interface SystemShelfProps {
  systems: ForgedSystem[];
  /** A card clicked — the sector decides what opening means (the full
   *  view, the live show, the live deck). */
  onOpen: (system: ForgedSystem) => void;
  /** The authoring bay's pencil and trash — absent, the cards read only. */
  onEdit?: (system: ForgedSystem) => void;
  onDelete?: (system: ForgedSystem) => void;
}

/** One labeled part of the shelf: the base's name, its census, and the
 *  cards beneath — or a quiet line when nothing sits there. */
function ShelfSection({
  title,
  systems,
  emptyCopy,
  onOpen,
  onEdit,
  onDelete,
}: {
  title: string;
  systems: ForgedSystem[];
  emptyCopy: string;
  onOpen: (system: ForgedSystem) => void;
  onEdit?: (system: ForgedSystem) => void;
  onDelete?: (system: ForgedSystem) => void;
}) {
  return (
    <section className="dash-shelf-section">
      <header className="dash-shelf-head">
        <h2 className="dash-shelf-title">{title}</h2>
        <span className="dash-shelf-count">
          {systems.length} {systems.length === 1 ? "system" : "systems"}
        </span>
      </header>
      {systems.length > 0 ? (
        <div className="dash-systems">
          {systems.map((system, index) => (
            <SystemCard
              key={system.itemId ?? `${system.sun}:${system.seq ?? index}`}
              system={system}
              onOpen={() => onOpen(system)}
              onEdit={onEdit ? () => onEdit(system) : undefined}
              onDelete={onDelete ? () => onDelete(system) : undefined}
            />
          ))}
        </div>
      ) : (
        <p className="dash-shelf-empty">{emptyCopy}</p>
      )}
    </section>
  );
}

export function SystemShelf({ systems, onOpen, onEdit, onDelete }: SystemShelfProps) {
  // Parked with the filter — un-comment to narrow both parts at once by
  // the sun's name, case aside. Empty means the whole deck shows.
  // const [query, setQuery] = useState("");
  // const q = query.trim().toLowerCase();
  // const matches = (system: ForgedSystem) => q.length === 0 || system.sun.toLowerCase().includes(q);
  const appBase = systems.filter((system) => system.base === "app");
  const menuBase = systems.filter((system) => system.base === "menu");
  return (
    <section className="dash-shelf">
      {/* The HUD command line, parked whole — the mono tag with the live
          dot, the chamfered scope (its masked edge lights on focus and
          stays lit while a query holds) and the census readout.
          Un-comment this block with the state above and the two imports
          to put the filter back on the shelf.
      <div className="dash-shelf-bar">
        <span className="dash-shelf-tag">
          <i className="dash-live-dot" aria-hidden />
          Filter //
        </span>
        <div className={`dash-shelf-scope${q.length > 0 ? " is-hot" : ""}`}>
          <Search className="dash-shelf-scope-icon" size={14} aria-hidden />
          <input
            className="dash-shelf-input"
            type="text"
            value={query}
            placeholder="type a system's name…"
            aria-label="Filter systems by name"
            spellCheck={false}
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              // Esc wipes the query first — a second Esc is free to
              // reach whatever sits above the shelf.
              if (event.key === "Escape" && query.length > 0) {
                event.stopPropagation();
                setQuery("");
              }
            }}
          />
          {query.length > 0 && (
            <button
              type="button"
              className="dash-shelf-clear"
              aria-label="Clear the filter"
              title="Clear"
              onClick={() => setQuery("")}
            >
              <X size={12} aria-hidden />
            </button>
          )}
        </div>
        <span className={`dash-shelf-readout${q.length > 0 ? " is-narrowed" : ""}`} aria-live="polite">
          {appBase.length + menuBase.length} / {systems.length} systems
        </span>
      </div>
      */}
      <ShelfSection
        title="App Base"
        systems={appBase}
        // parked with the filter — the "matches" copy returns with it
        // emptyCopy={
        //   q.length > 0
        //     ? `No app base system matches “${query.trim()}”.`
        //     : "No app base system forged yet."
        // }
        emptyCopy="No app base system forged yet."
        onOpen={onOpen}
        onEdit={onEdit}
        onDelete={onDelete}
      />
      <ShelfSection
        title="Menu Base"
        systems={menuBase}
        // parked with the filter — the "matches" copy returns with it
        // emptyCopy={
        //   q.length > 0
        //     ? `No menu base system matches “${query.trim()}”.`
        //     : "No menu base system forged yet."
        // }
        emptyCopy="No menu base system forged yet."
        onOpen={onOpen}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </section>
  );
}
