// The sign-in landing screen: a live mission-control deck in the same
// visual language as the simulator's stage — deep space, HUD panels.
// The mission at a glance is the whole five-sector operation now: the
// forged deck this tenant's operatives share (straight from the data
// gateway — inviter and invitee alike), the playwright run desk's
// readiness on this browser (linked repos, run homes), and the
// simulator's own catalog (scenarios, scenes, cast, assertions).
// Nothing invented — every number reads the app's real registries and
// caches. The decorative chrome (starfield, radar sweep) carries no
// data of its own; the clocks are real (UTC wall time, time-on-page)
// and the boot lines report the real counts.

import { useEffect, useRef, useState } from "react";
import { MonitorPlay, Presentation, Rocket } from "lucide-react";
// Parked with the playwright sector card below — comes back with it:
// import { Theater } from "lucide-react";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { useRouterNavigate } from "../../app/router/RouterContext";
import { ChokroMark } from "../../shared/ui/ChokroMark";
// The rails reuse the simulator's chamfered HUD classes — pull the sheet
// that styles them (Vite dedupes it against the simulator's own import).
import "../simulator/styles/simulator.css";
import { DashboardRails } from "./DashboardRails";
import { readDeskSidecar } from "./deskSidecar";
import { forgedLevelCount, type ForgedSystem } from "../create/systemsDoc";
import { useForgedSystems } from "../create/useForgedSystems";
import { ASSERTIONS } from "../simulator/run/assertions";
import { CAST } from "../simulator/script/cast";
import { SCENES } from "../simulator/script/scenes";

// A readout that boots up: counts 0 → target once, like instrumentation
// powering on. Reduced motion skips the count and shows the number.
function useCountUp(target: number): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const duration = 1100;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return value;
}

// One HUD stat tile; the stagger delay boots it in after its siblings.
function StatTile({ value, label, delay }: { value: number; label: string; delay: number }) {
  const shown = useCountUp(value);
  return (
    <div className="dash-stat" style={{ animationDelay: `${delay}ms` }}>
      <strong>{shown}</strong>
      <span>{label}</span>
    </div>
  );
}

// Real wall-clock instruments: UTC time and time-on-page (T+), ticking
// once a second — the two clocks every mission console carries.
function MissionClocks() {
  const [now, setNow] = useState(() => new Date());
  const startedRef = useRef(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const utc = now.toISOString().slice(11, 19);
  const elapsed = Math.max(0, now.getTime() - startedRef.current);
  const hh = String(Math.floor(elapsed / 3_600_000)).padStart(2, "0");
  const mm = String(Math.floor((elapsed % 3_600_000) / 60_000)).padStart(2, "0");
  const ss = String(Math.floor((elapsed % 60_000) / 1000)).padStart(2, "0");
  return (
    <span className="dash-clocks">
      {utc} UTC · T+{hh}:{mm}:{ss}
    </span>
  );
}

// The sky: a drifting, twinkling starfield on its own canvas, sized to
// the viewport. Reduced motion draws one static frame and stops.
function Starfield() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    type Star = { x: number; y: number; z: number; tw: number };
    let stars: Star[] = [];
    let w = 0;
    let h = 0;
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = Array.from({ length: Math.round((w * h) / 9000) }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        z: 0.3 + Math.random() * 0.7,
        tw: Math.random() * Math.PI * 2
      }));
    };
    resize();
    window.addEventListener("resize", resize);
    let raf = 0;
    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const star of stars) {
        star.x -= star.z * 0.06;
        if (star.x < -2) {
          star.x = w + 2;
          star.y = Math.random() * h;
        }
        const alpha = 0.22 + 0.5 * star.z * (0.6 + 0.4 * Math.sin(t / 900 + star.tw));
        ctx.fillStyle = `rgba(214, 232, 255, ${alpha.toFixed(3)})`;
        const size = star.z > 0.82 ? 2 : 1;
        ctx.fillRect(star.x, star.y, size, size);
      }
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return <canvas ref={ref} className="dash-stars" aria-hidden />;
}

// Power-on: the operation self-checks once per browser session (real
// counts, straight from the registries and the deck cache), then the
// deck takes over. Click anywhere skips it; reduced motion never shows.
const BOOT_MS = 2100;

export function DashboardPage() {
  const { t } = useT();
  const navigate = useRouterNavigate();
  // The tenant's forged deck — cache-first, so the counts are real the
  // moment the page mounts; the gateway replaces them when it answers.
  const systems = useForgedSystems();
  // The run desk's sidecars on this browser, read once per visit.
  const [sidecar] = useState(readDeskSidecar);

  const [booted, setBooted] = useState(() => {
    try {
      return sessionStorage.getItem("zero-failure-booted") === "1";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    if (booted) {
      try {
        sessionStorage.setItem("zero-failure-booted", "1");
      } catch {
        /* private mode: the intro just replays next visit */
      }
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setBooted(true);
      return;
    }
    const id = window.setTimeout(() => setBooted(true), BOOT_MS);
    return () => window.clearTimeout(id);
  }, [booted]);

  const skipBoot = () => setBooted(true);

  const bootLines = [
    { text: "SECTOR GRID", value: "5 OK" },
    { text: "FORGED DECK", value: `${systems.length} OK` },
    { text: "STORYLINE", value: `${SCENES.length} OK` },
    { text: "PLATFORMS", value: `${CAST.length} OK` }
  ];

  const deckBodies = systems.reduce((sum, system) => sum + system.planets.length, 0);

  // Every tile counts what the app still holds today — the forged deck,
  // its bodies, the scripted storyline, the speaking cast. (The old
  // walk-level/repo/run-home tiles went out with those sectors.)
  const stats = [
    { label: t("dashboard.stat.systems"), value: systems.length },
    { label: t("dashboard.stat.bodies"), value: deckBodies },
    { label: t("dashboard.stat.scenes"), value: SCENES.length },
    { label: t("dashboard.stat.cast"), value: CAST.length }
  ];

  // The hero's way into every sector — the operation's four doors.
  const sectors = [
    { href: "/create", icon: Rocket, name: t("dashboard.sector.create"), hint: t("dashboard.sector.create.hint") },
    { href: "/presentation", icon: Presentation, name: t("dashboard.sector.pres"), hint: t("dashboard.sector.pres.hint") },
    // PARKED (playwright): the sector's menu card, kept authored —
    // un-comment to put the fourth door back.
    // { href: "/playwright", icon: Theater, name: t("dashboard.sector.pw"), hint: t("dashboard.sector.pw.hint") },
    { href: "/simulator", icon: MonitorPlay, name: t("dashboard.sector.sim"), hint: t("dashboard.sector.sim.hint") }
  ];

  return (
    <div className="dash-space">
      <Starfield />
      {!booted && (
        <button type="button" className="dash-boot" onClick={skipBoot} aria-label="System check — select to skip">
          <span className="dash-boot-box" aria-hidden>
            <span className="dash-boot-title">CHOKRO // OPS CONSOLE</span>
            {bootLines.map((line, i) => (
              <span key={line.text} className="dash-boot-line" style={{ animationDelay: `${140 + i * 260}ms` }}>
                {line.text}
                <b>{line.value}</b>
              </span>
            ))}
            <span className="dash-boot-line dash-boot-ready" style={{ animationDelay: `${140 + bootLines.length * 260}ms` }}>
              DECK READY
            </span>
          </span>
        </button>
      )}
      <DashboardRails>
        {/* The live header strip: ops tag + the two real clocks. */}
        <div className="dash-topbar">
          <span className="dash-topbar-tag">
            <i className="dash-live-dot" aria-hidden />
            OPS // CHOKRO
          </span>
          <MissionClocks />
        </div>

        {/* The briefing banner: the operation's name, the four doors into
            it, and the stage dial sweeping the scene count on the right. */}
        <section className="dash-hero">
          <span className="dash-hero-edge" aria-hidden />
          <div className="dash-hero-main">
            <p className="dash-kicker">{t("dashboard.hero.title")}</p>
            <h2>
              <span className="dash-hero-mark">
                <ChokroMark size={34} />
              </span>
              {t("dashboard.title")}
            </h2>
            <p className="dash-hero-body">{t("dashboard.hero.body")}</p>
            <div className="dash-sectors">
              {sectors.map((sector, i) => (
                <a
                  key={sector.href}
                  className="dash-sector"
                  href={sector.href}
                  style={{ animationDelay: `${340 + i * 90}ms` }}
                  onClick={(event) => {
                    event.preventDefault();
                    navigate(sector.href);
                  }}
                >
                  <sector.icon size={18} strokeWidth={1.8} aria-hidden />
                  <span className="dash-sector-name">{sector.name}</span>
                  <span className="dash-sector-hint">{sector.hint}</span>
                </a>
              ))}
            </div>
          </div>
          {/* The stage dial: one tick per scene around a live radar sweep,
              the scene count glowing dead center. Decorative motion; the
              number is real and the storyline card says it too. */}
          <div className="dash-radar" aria-hidden>
            <span className="dash-radar-sweep" />
            <span className="dash-radar-ticks" />
            <span className="dash-radar-cross" />
            <strong className="dash-radar-readout">{SCENES.length}</strong>
            <span className="dash-radar-label">{t("dashboard.stat.scenes")}</span>
          </div>
        </section>

        {/* The assertion matrix: one tick per scripted assertion — the
            whole check-list, lit and shimmering in play order. */}
        <div className="dash-matrix" aria-hidden>
          {ASSERTIONS.map((_, i) => (
            <i key={i} style={{ animationDelay: `${i * 90}ms` }} />
          ))}
        </div>

        {/* HUD readouts: the operation at a glance — the deck this account
            owns and the run desk's readiness on this browser. */}
        <div className="dash-stats">
          {stats.map((stat, i) => (
            <StatTile key={stat.label} value={stat.value} label={stat.label} delay={180 + i * 70} />
          ))}
        </div>

        <div className="dash-grid">
          {/* The forged deck: every system this tenant's operatives
              forged, straight from the gateway — the create sector
              authors them, every signed-in account screens them. */}
          <section className="dash-card dash-card-wide">
            <h3>
              <span className="dash-h3-no">01</span>
              {t("dashboard.deck.title")}
              <span className="dash-h3-tag">GATEWAY</span>
              <span className="dash-h3-count">{systems.length} SYSTEMS</span>
            </h3>
            <p className="dash-card-hint">{t("dashboard.deck.hint")}</p>
            {systems.length === 0 ? (
              <p className="dash-empty">{t("dashboard.deck.empty")}</p>
            ) : (
              <div className="dash-table-scroll dash-deck-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{t("dashboard.deck.col.system")}</th>
                      <th>{t("dashboard.deck.col.base")}</th>
                      <th>{t("dashboard.deck.col.bodies")}</th>
                      <th>{t("dashboard.deck.col.levels")}</th>
                      <th>{t("dashboard.deck.col.note")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {systems.map((system: ForgedSystem, i) => (
                      <tr key={system.itemId ?? `${system.sun}-${i}`}>
                        <td className="dash-cell-title">
                          <span className="dash-row-no">{String(i + 1).padStart(2, "0")}</span>
                          {system.sun}
                        </td>
                        <td>
                          <span className="dash-base-tag">{system.base === "app" ? "APP" : "MENU"}</span>
                        </td>
                        <td className="dash-num">{system.planets.length}</td>
                        <td className="dash-num">{forgedLevelCount(system)}</td>
                        <td className="dash-cell-desc">{system.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="dash-card-foot">
              <span>
                SYSTEMS <b>{systems.length}</b>
              </span>
              <span>
                BODIES <b>{deckBodies}</b>
              </span>
              <span>{t("dashboard.deck.foot")}</span>
            </div>
          </section>

          {/* PARKED (playwright): the run desk's readiness card — which
              levels carry a linked repository, the loose-file sets, the
              launch pads. The code stays authored below; un-comment the
              section to put the card back. */}
          {/* <section className="dash-card dash-card-wide">
            <h3>
              <span className="dash-h3-no">02</span>
              {t("dashboard.rundesk.title")}
              <span className="dash-h3-tag">PLAYWRIGHT</span>
              <span className="dash-h3-count">{sidecar.repos.length} REPOS</span>
            </h3>
            <p className="dash-card-hint">{t("dashboard.rundesk.hint")}</p>
            {sidecar.repos.length === 0 ? (
              <p className="dash-empty">{t("dashboard.rundesk.empty")}</p>
            ) : (
              <ul className="dash-list">
                {sidecar.repos.map((repo) => (
                  <li key={repo.key} className="dash-list-row">
                    <span className="dash-dot" style={{ "--dash-hue": "var(--sim-accent)" } as React.CSSProperties} aria-hidden />
                    <span className="dash-list-name">{repo.name}</span>
                    <span className="dash-list-meta">{repo.files} files</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="dash-card-foot">
              <span>
                REPOS <b>{sidecar.repos.length}</b>
              </span>
              <span>
                {t("dashboard.rundesk.filesets")} <b>{sidecar.fileSets}</b>
              </span>
              <span>
                {t("dashboard.rundesk.homes")} <b>{sidecar.homes.length}</b>
              </span>
            </div>
          </section> */}
        </div>
      </DashboardRails>
    </div>
  );
}
