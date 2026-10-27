// The create-solar-system sector: the authoring bay. Empty, it carries
// the bay's briefing and the switch. Once a system is forged the
// briefing steps aside — the switch moves to the topbar's right end and
// the deck shows each forged system as its own card: a live miniature
// of the simulator's sky — the real deep sky (stars, neighbor
// galaxies, comets), the real four rings and Kepler periods, the real
// seats, worlds sweeping them in design units. Every body wears a
// logo from the shelf (iconCatalog); the form's chip raises the picker
// to change it.

import { AppWindow, ArrowLeft, ListTree, Plus, Rocket, Trash2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { blocksClient } from "../../lib/blocks/client";
import { DashboardRails } from "../dashboard/DashboardRails";
import { forgeIconAt, FORGE_ICONS, DEFAULT_FORGE_ICON, type BodyLogo } from "./iconCatalog";
import { SystemShelf } from "./SystemShelf";
import {
  createForgedSystem,
  deleteForgedSystem,
  loadCachedSystems,
  readForgedSystems,
  saveCachedSystems,
  updateForgedSystem,
  type ForgeBase,
  type ForgedPlanet,
  type ForgedSystem,
} from "./systemsDoc";
import { SystemViewModal } from "./SystemViewModal";

/** What the modal is showing right now — the fork, or one base's form. */
type ForgeStep = ForgeBase | "choose";

/** The two bases' shared form, worded per base. */
const FORGE_COPY: Record<ForgeBase, {
  title: string;
  sunLabel: string;
  sunHint: string;
  orbitLabel: string;
  orbitOne: string;
  addLabel: string;
  /** App base: every body also carries the label that sits under its
   *  name — required there, absent on a menu base. */
  withLabel: boolean;
}> = {
  app: {
    title: "App Base Solar System",
    sunLabel: "System name",
    sunHint: "The system's identity — the name itself never takes the sky",
    orbitLabel: "Apps",
    orbitOne: "app",
    addLabel: "Add app",
    withLabel: true,
  },
  menu: {
    title: "Menu Base Solar System",
    sunLabel: "App name",
    sunHint: "The single app the sun stands for",
    orbitLabel: "Menus",
    orbitOne: "menu",
    addLabel: "Add menu",
    withLabel: false,
  },
};

export function CreateSolarSystemPage() {
  // The fork lives in a modal: the switch raises it, and Escape, the ✕
  // or the scrim put it away again. A pick drills the same panel into
  // that base's forge form; Back walks it to the fork.
  const [step, setStep] = useState<ForgeStep | null>(null);
  // Every forged system gets its own card on the deck — the gateway is
  // the source of truth and the cache is what shows while it can't.
  const [systems, setSystems] = useState<ForgedSystem[]>(loadCachedSystems);
  // The card that raised the full solar-system view; null = shut.
  const [viewing, setViewing] = useState<number | null>(null);
  // The forge's after-glow: one confirmation line, a few seconds, gone.
  const [toast, setToast] = useState<{ key: number; text: string } | null>(null);
  // The card being re-edited; null = the modal is a fresh forge.
  const [editing, setEditing] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!step) return;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      // The logo picker stands in front — its Escape is its own, and it
      // marks the event prevented so this handler stands down.
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        setStep(null);
        setEditing(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [step]);

  // The view runs alone (the forge modal can't be up underneath it), so
  // its Escape needs no layering.
  useEffect(() => {
    if (viewing === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setViewing(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [viewing]);

  const forge = (system: ForgedSystem) => {
    // An edit keeps its place in the deck; a fresh forge joins the end.
    const stamped: ForgedSystem = {
      ...system,
      seq: editing !== null ? (systems[editing]?.seq ?? system.seq) : (system.seq ?? Date.now()),
    };
    if (editing !== null) {
      const itemId = systems[editing]?.itemId;
      setSystems((prev) => prev.map((entry, i) => (i === editing ? stamped : entry)));
      setStep(null);
      setEditing(null);
      setToast({
        key: Date.now(),
        text: `${stamped.sun} updated — the system is back on the deck.`,
      });
      if (itemId) {
        updateForgedSystem(blocksClient, itemId, stamped).catch(() => undefined);
      } else {
        createForgedSystem(blocksClient, stamped)
          .then((created) => {
            if (!created) return;
            setSystems((prev) =>
              prev.map((s) => (s.seq !== undefined && s.seq === stamped.seq ? { ...s, itemId: created } : s)),
            );
          })
          .catch(() => undefined);
      }
      return;
    }
    setSystems((prev) => [...prev, stamped]);
    setStep(null);
    setToast({ key: Date.now(), text: `${stamped.sun} forged — the system is on the deck.` });
    createForgedSystem(blocksClient, stamped)
      .then((created) => {
        if (!created) return;
        setSystems((prev) =>
          prev.map((s) => (s.seq !== undefined && s.seq === stamped.seq ? { ...s, itemId: created } : s)),
        );
      })
      .catch(() => undefined);
  };

  /** A card's pencil: the modal reopens on that system's own form,
   *  every field filled with what was forged. */
  const reforge = (index: number) => {
    const system = systems[index];
    if (!system) return;
    setEditing(index);
    setStep(system.base);
  };

  /** A card's trash: the system leaves the deck, the deck confirms —
   *  and the gateway record goes with it when one exists. */
  const demolish = (index: number) => {
    const system = systems[index];
    if (!system) return;
    setSystems((prev) => prev.filter((_, i) => i !== index));
    setToast({ key: Date.now(), text: `${system.sun} deleted — the deck moves on.` });
    if (system.itemId) {
      deleteForgedSystem(blocksClient, system.itemId).catch(() => undefined);
    }
  };

  // The toast retires itself after a few seconds.
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(id);
  }, [toast]);

  // The gateway is the source of truth; the cache is the fallback. On
  // mount the gateway wins when it answers. When it answers empty, the
  // cache seeds it — a schema pushed late adopts what the browser kept.
  // A gateway that errors (schema not pushed, session down) just leaves
  // the cache on the table.
  useEffect(() => {
    let alive = true;
    readForgedSystems(blocksClient)
      .then((remote) => {
        if (!alive) return;
        if (remote.length > 0) {
          // Merge, don't replace: a forge made while this read was in
          // flight is already on the deck, and its gateway record may not
          // have landed yet. Remote wins for records it carries (matched
          // by seq, the one key that rides both ways); local entries the
          // remote hasn't caught up with stay.
          setSystems((prev) => {
            const adopted = new Set(
              remote.flatMap((r) => (r.seq !== undefined ? [r.seq] : [])),
            );
            const pending = prev.filter(
              (s) => !s.itemId && (s.seq === undefined || !adopted.has(s.seq)),
            );
            return [...remote, ...pending].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
          });
          return;
        }
        const cached = loadCachedSystems();
        setSystems(cached);
        for (const system of cached) {
          createForgedSystem(blocksClient, system)
            .then((itemId) => {
              if (!itemId) return;
              setSystems((prev) =>
                prev.map((s) =>
                  s.seq !== undefined && s.seq === system.seq ? { ...s, itemId } : s,
                ),
              );
            })
            .catch(() => undefined);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  // Every change also lands in the cache, so a refresh never loses what
  // the session forged — even with the gateway unreachable.
  useEffect(() => {
    saveCachedSystems(systems);
  }, [systems]);

  return (
    <div className="dash-space">
      <h1 className="sr-only">Create solar system</h1>
      <DashboardRails active="create">
        <div className="dash-topbar">
          <span className="dash-topbar-tag">
            <i className="dash-live-dot" aria-hidden />
            OPS // CREATE
          </span>
          {/* With systems on the deck the briefing is gone — the switch
              lives up here, the topbar's right end. */}
          {systems.length > 0 && (
            <button type="button" className="dash-open" onClick={() => setStep("choose")}>
              <Rocket size={16} aria-hidden />
              Create Solar System
            </button>
          )}
        </div>

        {systems.length === 0 ? (
          <section className="dash-soon">
            <span className="dash-soon-glyph" aria-hidden>
              <Rocket size={26} strokeWidth={1.6} />
            </span>
            <p className="dash-kicker">Authoring bay</p>
            <h2>Create solar system</h2>
            <p>
              Stage a solar system of your own — pick the bodies, their
              orbits and the cast.
            </p>
            <button type="button" className="dash-open" onClick={() => setStep("choose")}>
              <Rocket size={16} aria-hidden />
              Create Solar System
            </button>
          </section>
        ) : (
          <SystemShelf
            systems={systems}
            onOpen={(system) => setViewing(systems.indexOf(system))}
            onEdit={(system) => reforge(systems.indexOf(system))}
            onDelete={(system) => demolish(systems.indexOf(system))}
          />
        )}
      </DashboardRails>

      {viewing !== null && systems[viewing] && (
        <SystemViewModal system={systems[viewing]!} onClose={() => setViewing(null)} />
      )}

      {toast && (
        <div key={toast.key} className="dash-toast" role="status" aria-live="polite">
          <i className="dash-live-dot" aria-hidden />
          {toast.text}
        </div>
      )}

      {step && (
        <div className="dash-modal">
          <button
            type="button"
            className="dash-modal-backdrop"
            aria-label="Close"
            tabIndex={-1}
            onClick={() => {
              setStep(null);
              setEditing(null);
            }}
          />
          <div
            className="dash-modal-panel"
            role="dialog"
            aria-modal="true"
            aria-label={step === "choose" ? "Choose a base" : FORGE_COPY[step].title}
            tabIndex={-1}
            ref={panelRef}
          >
            <button
              type="button"
              className="dash-modal-close"
              aria-label="Close"
              onClick={() => {
                setStep(null);
                setEditing(null);
              }}
            >
              <X size={16} aria-hidden />
            </button>
            {step === "choose" ? (
              <>
                <p className="dash-kicker">Choose a base</p>
                <h3>Create solar system</h3>
                <div className="dash-forge-choices">
                  <button type="button" className="dash-forge-choice" onClick={() => setStep("app")}>
                    <AppWindow size={22} strokeWidth={1.6} aria-hidden />
                    <span>App Base Solar System</span>
                  </button>
                  <button type="button" className="dash-forge-choice" onClick={() => setStep("menu")}>
                    <ListTree size={22} strokeWidth={1.6} aria-hidden />
                    <span>Menu Base Solar System</span>
                  </button>
                </div>
              </>
            ) : editing !== null && systems[editing] ? (
              // The same forge, reopened on an existing system — every
              // field filled with what was forged; submit lands back on
              // its card.
              <ForgeForm
                key={`edit:${editing}`}
                base={step}
                initial={systems[editing]!}
                editing
                onBack={() => {
                  setEditing(null);
                  setStep(null);
                }}
                onForged={forge}
              />
            ) : (
              // Keyed by the base so switching forms starts them fresh.
              <ForgeForm key={step} base={step} onBack={() => setStep("choose")} onForged={forge} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** One sub-menu row in the forge — a leaf with a name and a logo. */
type SubmenuDraft = { name: string; logo: BodyLogo };

/** One menu row under an app — a name, a logo, and the sub-menus
 *  beneath it: the app base's app → menu → sub-menu chain. */
type MenuDraft = { name: string; logo: BodyLogo; submenu: SubmenuDraft[] };

/** One base's forge form: the sun's name, an optional note, and the
 *  first ring of bodies — each with its logo chip and its own tree
 *  beneath it (an app's menus and their sub-menus, or a menu's
 *  sub-menus). Trimmed, validated, then handed up. Reopened with
 *  `initial` for an edit pass: every field starts from what was forged,
 *  and the wording flips. */
function ForgeForm({
  base,
  initial,
  editing = false,
  onBack,
  onForged,
}: {
  base: ForgeBase;
  initial?: ForgedSystem;
  editing?: boolean;
  onBack: () => void;
  onForged: (system: ForgedSystem) => void;
}) {
  const copy = FORGE_COPY[base];
  const [sun, setSun] = useState(initial?.sun ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  // The ring starts as one blank row — a form with zero rows reads dead.
  // An edit pass starts from the forged ring instead. App-base rows
  // carry a label and their menus (menus carrying sub-menus); menu-base
  // rows carry their sub-menus. Every row wears a logo (shelf glyph by
  // default, the user's own upload whenever they prefer).
  const [planets, setPlanets] = useState(() =>
    initial
      ? initial.planets.map((planet) => ({
          name: planet.name,
          label: planet.label ?? "",
          logo: planet.logo,
          submenu: (planet.submenu ?? []).map((child) => ({ name: child.name, logo: child.logo })),
          menus: (planet.menus ?? []).map((menu) => ({
            name: menu.name,
            logo: menu.logo,
            submenu: (menu.submenu ?? []).map((leaf) => ({ name: leaf.name, logo: leaf.logo })),
          })),
        }))
      : [
          {
            name: "",
            label: "",
            logo: { kind: "icon", icon: forgeIconAt(0).icon } as BodyLogo,
            submenu: [] as SubmenuDraft[],
            menus: [] as MenuDraft[],
          },
        ],
  );
  const [error, setError] = useState<string | null>(null);
  // The row whose logo chip raised the picker — a body ("0"), a
  // menu-base sub-menu ("0:2"), an app's menu ("0:1") or a menu's own
  // sub-menu ("0:1:2"); null = picker shut.
  const [pickingFor, setPickingFor] = useState<string | null>(null);

  const setPlanet = (
    index: number,
    value: { name: string; label: string; logo: BodyLogo; submenu: SubmenuDraft[]; menus: MenuDraft[] },
  ) => {
    setPlanets((prev) => prev.map((entry, i) => (i === index ? value : entry)));
  };
  const addPlanet = () =>
    setPlanets((prev) => [
      ...prev,
      {
        name: "",
        label: "",
        logo: { kind: "icon", icon: forgeIconAt(prev.length).icon },
        submenu: [],
        menus: [],
      },
    ]);
  const removePlanet = (index: number) => {
    setPlanets((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
    setPickingFor(null);
  };

  // The sub-menu editor under one menu row — the menu base's leaves.
  const setSub = (planetIndex: number, subIndex: number, value: SubmenuDraft) => {
    setPlanets((prev) =>
      prev.map((entry, i) =>
        i === planetIndex
          ? { ...entry, submenu: entry.submenu.map((sub, j) => (j === subIndex ? value : sub)) }
          : entry,
      ),
    );
  };
  const addSub = (planetIndex: number) => {
    setPlanets((prev) =>
      prev.map((entry, i) =>
        i === planetIndex
          ? {
              ...entry,
              submenu: [
                ...entry.submenu,
                { name: "", logo: { kind: "icon", icon: forgeIconAt(entry.submenu.length + i + 1).icon } },
              ],
            }
          : entry,
      ),
    );
  };
  const removeSub = (planetIndex: number, subIndex: number) => {
    setPlanets((prev) =>
      prev.map((entry, i) =>
        i === planetIndex ? { ...entry, submenu: entry.submenu.filter((_, j) => j !== subIndex) } : entry,
      ),
    );
  };

  // The app base's two-level tree: menus under the app, sub-menus under
  // each menu — the chain runs app → menu → sub-menu.
  const setMenu = (planetIndex: number, menuIndex: number, value: MenuDraft) => {
    setPlanets((prev) =>
      prev.map((entry, i) =>
        i === planetIndex
          ? { ...entry, menus: entry.menus.map((menu, j) => (j === menuIndex ? value : menu)) }
          : entry,
      ),
    );
  };
  const addMenu = (planetIndex: number) => {
    setPlanets((prev) =>
      prev.map((entry, i) =>
        i === planetIndex
          ? {
              ...entry,
              menus: [
                ...entry.menus,
                {
                  name: "",
                  logo: { kind: "icon", icon: forgeIconAt(entry.menus.length + i + 1).icon },
                  submenu: [],
                },
              ],
            }
          : entry,
      ),
    );
  };
  const removeMenu = (planetIndex: number, menuIndex: number) => {
    setPlanets((prev) =>
      prev.map((entry, i) =>
        i === planetIndex ? { ...entry, menus: entry.menus.filter((_, j) => j !== menuIndex) } : entry,
      ),
    );
  };
  const setMenuSub = (planetIndex: number, menuIndex: number, subIndex: number, value: SubmenuDraft) => {
    setPlanets((prev) =>
      prev.map((entry, i) =>
        i === planetIndex
          ? {
              ...entry,
              menus: entry.menus.map((menu, j) =>
                j === menuIndex
                  ? { ...menu, submenu: menu.submenu.map((sub, k) => (k === subIndex ? value : sub)) }
                  : menu,
              ),
            }
          : entry,
      ),
    );
  };
  const addMenuSub = (planetIndex: number, menuIndex: number) => {
    setPlanets((prev) =>
      prev.map((entry, i) =>
        i === planetIndex
          ? {
              ...entry,
              menus: entry.menus.map((menu, j) =>
                j === menuIndex
                  ? {
                      ...menu,
                      submenu: [
                        ...menu.submenu,
                        { name: "", logo: { kind: "icon", icon: forgeIconAt(menu.submenu.length + i + j + 1).icon } },
                      ],
                    }
                  : menu,
              ),
            }
          : entry,
      ),
    );
  };
  const removeMenuSub = (planetIndex: number, menuIndex: number, subIndex: number) => {
    setPlanets((prev) =>
      prev.map((entry, i) =>
        i === planetIndex
          ? {
              ...entry,
              menus: entry.menus.map((menu, j) =>
                j === menuIndex ? { ...menu, submenu: menu.submenu.filter((_, k) => k !== subIndex) } : menu,
              ),
            }
          : entry,
      ),
    );
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedSun = sun.trim();
    if (!trimmedSun) {
      setError(`Give the system a name — the sun stands for it.`);
      return;
    }
    const drafts = planets.map((planet) => ({
      ...planet,
      name: planet.name.trim(),
      label: planet.label.trim(),
    }));
    const used = drafts.filter((draft) => draft.name || draft.label);
    if (used.length === 0) {
      setError(`Name at least one ${copy.orbitOne} — a system needs its first ring.`);
      return;
    }
    if (used.some((draft) => !draft.name || (copy.withLabel && !draft.label))) {
      setError(`Each ${copy.orbitOne} needs both a name${copy.withLabel ? " and a label" : ""}.`);
      return;
    }
    onForged({
      base,
      sun: trimmedSun,
      note: note.trim(),
      planets: used.map((draft) => {
        if (copy.withLabel) {
          // App base: the chain runs app → menu → sub-menu — each app's
          // named menus ride with their named sub-menus. Blank rows
          // never make the forge, the same courtesy the ring's blanks get.
          const menus = draft.menus
            .map((menu) => {
              const submenu = menu.submenu
                .map((sub) => ({ name: sub.name.trim(), logo: sub.logo }))
                .filter((sub) => sub.name.length > 0);
              return {
                name: menu.name.trim(),
                logo: menu.logo,
                submenu: submenu.length > 0 ? submenu : undefined,
              };
            })
            .filter((menu) => menu.name.length > 0);
          return {
            name: draft.name,
            label: draft.label,
            logo: draft.logo,
            menus: menus.length > 0 ? menus : undefined,
          };
        }
        // Menu base: the named sub-menus ride along — blank rows never
        // make the forge, the same courtesy the ring's blanks get.
        const submenu = draft.submenu
          .map((sub) => ({ name: sub.name.trim(), logo: sub.logo }))
          .filter((sub) => sub.name.length > 0);
        return { name: draft.name, logo: draft.logo, submenu: submenu.length > 0 ? submenu : undefined };
      }),
    });
  };

  return (
    <form className="dash-form" onSubmit={submit} noValidate>
      <p className="dash-kicker">
        {editing ? `Editing · ${base === "app" ? "app base" : "menu base"}` : base === "app" ? "App base" : "Menu base"}
      </p>
      <h3>{copy.title}</h3>

      <label className="dash-field">
        <span>{copy.sunLabel}</span>
        <input
          value={sun}
          onChange={(event) => setSun(event.target.value)}
          placeholder={copy.sunHint}
          maxLength={60}
        />
      </label>

      <label className="dash-field">
        <span>
          Note <em>— optional</em>
        </span>
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="One line about this system"
          maxLength={120}
        />
      </label>

      <fieldset className="dash-field">
        <span>
          {copy.orbitLabel}{" "}
          <em>{copy.withLabel ? "— the first one sits at the center" : "— the first ring"}</em>
        </span>
        {planets.map((planet, index) => (
          <div className="dash-form-body" key={index}>
            <div className="dash-form-row">
              {/* the body's logo — the chip raises the shelf to swap it */}
              <button
                type="button"
                className="dash-form-icon"
                title="Pick a logo"
                aria-label={`Pick a logo for ${planet.name.trim() || `planet ${index + 1}`}`}
                onClick={() => setPickingFor(String(index))}
              >
                {planet.logo.kind === "icon" ? (
                  <planet.logo.icon size={16} strokeWidth={1.8} aria-hidden />
                ) : (
                  <img className="dash-form-icon-img" src={planet.logo.src} alt="" aria-hidden />
                )}
              </button>
              <input
                value={planet.name}
                onChange={(event) => setPlanet(index, { ...planet, name: event.target.value })}
                placeholder={
                  copy.withLabel && index === 0
                    ? "App 1 — the center of the system"
                    : `Planet ${index + 1} — ${copy.orbitOne} name`
                }
                maxLength={60}
              />
              <button
                type="button"
                className="dash-form-row-remove"
                aria-label={`Remove ${copy.orbitOne} ${planet.name.trim() || index + 1}`}
                disabled={planets.length === 1}
                onClick={() => removePlanet(index)}
              >
                <Trash2 size={14} aria-hidden />
              </button>
            </div>
            {copy.withLabel && (
              <input
                className="dash-form-row-label"
                value={planet.label}
                onChange={(event) => setPlanet(index, { ...planet, label: event.target.value })}
                placeholder={`Planet ${index + 1} label — the line under its name`}
                maxLength={80}
              />
            )}
            {copy.withLabel ? (
              /* App base: the chain runs app → menu → sub-menu — each
                 app carries its own menus, each menu its sub-menus. */
              <div className="dash-form-submenu">
                {planet.menus.map((menu, menuIndex) => (
                  <div className="dash-form-menu" key={menuIndex}>
                    <div className="dash-form-row dash-form-subrow">
                      <button
                        type="button"
                        className="dash-form-icon"
                        title="Pick a logo"
                        aria-label={`Pick a logo for menu ${menu.name.trim() || menuIndex + 1} of ${
                          planet.name.trim() || `app ${index + 1}`
                        }`}
                        onClick={() => setPickingFor(`${index}:${menuIndex}`)}
                      >
                        {menu.logo.kind === "icon" ? (
                          <menu.logo.icon size={14} strokeWidth={1.8} aria-hidden />
                        ) : (
                          <img className="dash-form-icon-img" src={menu.logo.src} alt="" aria-hidden />
                        )}
                      </button>
                      <input
                        value={menu.name}
                        onChange={(event) => setMenu(index, menuIndex, { ...menu, name: event.target.value })}
                        placeholder={`Menu ${menuIndex + 1} — under ${planet.name.trim() || `app ${index + 1}`}`}
                        maxLength={60}
                      />
                      <button
                        type="button"
                        className="dash-form-row-remove"
                        aria-label={`Remove menu ${menu.name.trim() || menuIndex + 1} of ${
                          planet.name.trim() || `app ${index + 1}`
                        }`}
                        onClick={() => removeMenu(index, menuIndex)}
                      >
                        <Trash2 size={14} aria-hidden />
                      </button>
                    </div>
                    <div className="dash-form-submenu dash-form-submenu-nested">
                      {menu.submenu.map((sub, subIndex) => (
                        <div className="dash-form-row dash-form-subrow" key={subIndex}>
                          <button
                            type="button"
                            className="dash-form-icon"
                            title="Pick a logo"
                            aria-label={`Pick a logo for sub-menu ${sub.name.trim() || subIndex + 1} of ${
                              menu.name.trim() || `menu ${menuIndex + 1}`
                            }`}
                            onClick={() => setPickingFor(`${index}:${menuIndex}:${subIndex}`)}
                          >
                            {sub.logo.kind === "icon" ? (
                              <sub.logo.icon size={14} strokeWidth={1.8} aria-hidden />
                            ) : (
                              <img className="dash-form-icon-img" src={sub.logo.src} alt="" aria-hidden />
                            )}
                          </button>
                          <input
                            value={sub.name}
                            onChange={(event) =>
                              setMenuSub(index, menuIndex, subIndex, { ...sub, name: event.target.value })
                            }
                            placeholder={`Sub-menu ${subIndex + 1} — under ${
                              menu.name.trim() || `menu ${menuIndex + 1}`
                            }`}
                            maxLength={60}
                          />
                          <button
                            type="button"
                            className="dash-form-row-remove"
                            aria-label={`Remove sub-menu ${sub.name.trim() || subIndex + 1} of ${
                              menu.name.trim() || `menu ${menuIndex + 1}`
                            }`}
                            onClick={() => removeMenuSub(index, menuIndex, subIndex)}
                          >
                            <Trash2 size={14} aria-hidden />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="dash-form-submenu-add"
                        onClick={() => addMenuSub(index, menuIndex)}
                      >
                        <Plus size={12} aria-hidden />
                        Add sub-menu
                      </button>
                    </div>
                  </div>
                ))}
                <button type="button" className="dash-form-submenu-add" onClick={() => addMenu(index)}>
                  <Plus size={12} aria-hidden />
                  Add menu
                </button>
              </div>
            ) : (
              /* Menu base: the sun is the app, the ring is its menus —
                 each menu's own sub-menus, one leaf each with a logo
                 and a name. */
              <div className="dash-form-submenu">
                {planet.submenu.map((sub, subIndex) => (
                  <div className="dash-form-row dash-form-subrow" key={subIndex}>
                    <button
                      type="button"
                      className="dash-form-icon"
                      title="Pick a logo"
                      aria-label={`Pick a logo for sub-menu ${sub.name.trim() || subIndex + 1} of ${
                        planet.name.trim() || `planet ${index + 1}`
                      }`}
                      onClick={() => setPickingFor(`${index}:${subIndex}`)}
                    >
                      {sub.logo.kind === "icon" ? (
                        <sub.logo.icon size={14} strokeWidth={1.8} aria-hidden />
                      ) : (
                        <img className="dash-form-icon-img" src={sub.logo.src} alt="" aria-hidden />
                      )}
                    </button>
                    <input
                      value={sub.name}
                      onChange={(event) => setSub(index, subIndex, { ...sub, name: event.target.value })}
                      placeholder={`Sub-menu ${subIndex + 1} — under ${planet.name.trim() || `planet ${index + 1}`}`}
                      maxLength={60}
                    />
                    <button
                      type="button"
                      className="dash-form-row-remove"
                      aria-label={`Remove sub-menu ${sub.name.trim() || subIndex + 1} of ${
                        planet.name.trim() || `planet ${index + 1}`
                      }`}
                      onClick={() => removeSub(index, subIndex)}
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </div>
                ))}
                <button type="button" className="dash-form-submenu-add" onClick={() => addSub(index)}>
                  <Plus size={12} aria-hidden />
                  Add sub-menu
                </button>
              </div>
            )}
          </div>
        ))}
        <button type="button" className="dash-form-add" onClick={addPlanet}>
          <Plus size={14} aria-hidden />
          {copy.addLabel}
        </button>
      </fieldset>

      {error && <p className="dash-form-error" role="alert">{error}</p>}

      <div className="dash-form-actions">
        <button type="button" className="dash-form-back" onClick={onBack}>
          <ArrowLeft size={14} aria-hidden />
          {editing ? "Close" : "Base"}
        </button>
        <button type="submit" className="dash-open dash-form-submit">
          <Rocket size={16} aria-hidden />
          {editing ? "Save changes" : "Forge system"}
        </button>
      </div>

      {pickingFor !== null && (
        <IconPicker
          current={
            (() => {
              const seg = pickingFor.split(":");
              const planet = planets[Number(seg[0])];
              const fallback = { kind: "icon", icon: DEFAULT_FORGE_ICON.icon } as BodyLogo;
              if (!planet) return fallback;
              if (seg.length === 1) return planet.logo;
              if (seg.length === 3) {
                return (
                  planet.menus[Number(seg[1])]?.submenu[Number(seg[2])]?.logo ?? fallback
                );
              }
              // two segments: an app's menu on the app base, a menu's
              // sub-menu on the menu base
              const child = copy.withLabel ? planet.menus[Number(seg[1])] : planet.submenu[Number(seg[1])];
              return child?.logo ?? fallback;
            })()
          }
          onPickLogo={(logo) => {
            const key = pickingFor;
            setPickingFor(null);
            if (key === null) return;
            const seg = key.split(":");
            const planetIndex = Number(seg[0]);
            setPlanets((prev) =>
              prev.map((entry, i) => {
                if (i !== planetIndex) return entry;
                if (seg.length === 1) return { ...entry, logo };
                if (seg.length === 2) {
                  if (copy.withLabel) {
                    const menuIndex = Number(seg[1]);
                    return {
                      ...entry,
                      menus: entry.menus.map((menu, j) => (j === menuIndex ? { ...menu, logo } : menu)),
                    };
                  }
                  const subIndex = Number(seg[1]);
                  return {
                    ...entry,
                    submenu: entry.submenu.map((sub, j) => (j === subIndex ? { ...sub, logo } : sub)),
                  };
                }
                const menuIndex = Number(seg[1]);
                const subIndex = Number(seg[2]);
                return {
                  ...entry,
                  menus: entry.menus.map((menu, j) =>
                    j === menuIndex
                      ? {
                          ...menu,
                          submenu: menu.submenu.map((sub, k) => (k === subIndex ? { ...sub, logo } : sub)),
                        }
                      : menu,
                  ),
                };
              }),
            );
          }}
          onClose={() => setPickingFor(null)}
        />
      )}
    </form>
  );
}

/** The logo shelf, raised over the form: a search box, a grid of the
 *  catalog's glyphs — and, for tastes the shelf can't satisfy, an
 *  upload hatch that turns the user's own image into the logo (read
 *  locally into a data URL; nothing leaves the machine). Escape, the ✕
 *  or the scrim put it back. */
function IconPicker({
  current,
  onPickLogo,
  onClose,
}: {
  current: BodyLogo;
  onPickLogo: (logo: BodyLogo) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    // Capture phase, and marked prevented — so the forge modal's own
    // Escape handler never sees this press.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const takeFile = (file: File | undefined) => {
    setUploadError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("That's not an image — pick a PNG, JPG, SVG or WebP.");
      return;
    }
    if (file.size > 1024 * 1024) {
      setUploadError("Too large — a logo of up to 1 MB keeps the ring nimble.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onPickLogo({ kind: "image", name: file.name, src: reader.result });
      }
    };
    reader.onerror = () => {
      setUploadError("That file refused to read — try another image.");
    };
    reader.readAsDataURL(file);
  };

  const needle = query.trim().toLowerCase();
  const shown = FORGE_ICONS.filter((entry) => entry.name.toLowerCase().includes(needle));

  return (
    <div className="dash-modal dash-icon-modal">
      <button
        type="button"
        className="dash-modal-backdrop"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        className="dash-modal-panel dash-icon-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Pick a logo"
        tabIndex={-1}
      >
        <button type="button" className="dash-modal-close" aria-label="Close" onClick={onClose}>
          <X size={16} aria-hidden />
        </button>
        <p className="dash-kicker">Logo shelf</p>
        <h3>Pick a logo</h3>
        <label className="dash-field">
          <span>Search</span>
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try “shield”, “data”, “coin”…"
            maxLength={40}
          />
        </label>
        {/* the hatch: any image on this laptop becomes the logo */}
        <button type="button" className="dash-icon-upload" onClick={() => fileRef.current?.click()}>
          <Upload size={15} aria-hidden />
          Upload your own — PNG, JPG, SVG or WebP, up to 1 MB
          {current.kind === "image" && (
            <img className="dash-icon-current" src={current.src} alt="" aria-hidden />
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            takeFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        {uploadError && (
          <p className="dash-form-error" role="alert">
            {uploadError}
          </p>
        )}
        {shown.length > 0 ? (
          <ul className="dash-icon-grid">
            {shown.map((entry) => (
              <li key={entry.name}>
                <button
                  type="button"
                  className={`dash-icon-cell${
                    current.kind === "icon" && current.icon === entry.icon ? " on" : ""
                  }`}
                  title={entry.name}
                  aria-label={entry.name}
                  aria-pressed={current.kind === "icon" && current.icon === entry.icon}
                  onClick={() => onPickLogo({ kind: "icon", icon: entry.icon })}
                >
                  <entry.icon size={17} strokeWidth={1.8} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="dash-form-error">No logo matches “{needle}”.</p>
        )}
      </div>
    </div>
  );
}
