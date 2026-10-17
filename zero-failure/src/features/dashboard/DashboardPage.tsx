// The sign-in landing screen: a live mission-control deck in the same
// visual language as the simulator's stage — deep space, orbiting planets,
// HUD panels. The mission at a glance (what the simulator tests, with
// which cast, across which scenarios) and the one action that matters:
// opening the solar system. Everything shown is the app's own catalog
// data (scenario registry, scenes, cast, assertion list) — nothing
// invented, nothing fetched. The decorative chrome (starfield, radar
// sweep) carries no data of its own; the clocks are real
// (UTC wall time, time-on-page) and the boot lines report the real
// catalog counts.

import { useEffect, useRef, useState } from "react";
import { MonitorPlay } from "lucide-react";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { useRouterNavigate } from "../../app/router/RouterContext";
import seliseLogo from "../../assets/selise-blocks-logo.png";
// The rails reuse the simulator's chamfered HUD classes — pull the sheet
// that styles them (Vite dedupes it against the simulator's own import).
import "../simulator/styles/simulator.css";
import { DashboardRails } from "./DashboardRails";
import { ASSERTIONS } from "../simulator/run/assertions";
import { CAST } from "../simulator/script/cast";
import { SCENES } from "../simulator/script/scenes";
import { SCENARIOS } from "../simulator/scenarios/registry";

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

// Power-on: the catalog self-check types out once per browser session
// (real counts, straight from the registries), then the deck takes over.
// Click anywhere skips it; reduced motion never shows it.
const BOOT_MS = 2100;

export function DashboardPage() {
  const { t } = useT();
  const navigate = useRouterNavigate();

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
    { text: "CATALOG INDEX", value: `${SCENARIOS.length} OK` },
    { text: "STORYLINE", value: `${SCENES.length} OK` },
    { text: "PLATFORMS", value: `${CAST.length} OK` },
    { text: "ASSERTIONS", value: `${ASSERTIONS.length} OK` }
  ];

  const stats = [
    { label: t("dashboard.stat.scenarios"), value: SCENARIOS.length },
    { label: t("dashboard.stat.scenes"), value: SCENES.length },
    { label: t("dashboard.stat.platforms"), value: CAST.length },
    { label: t("dashboard.stat.assertions"), value: ASSERTIONS.length }
  ];

  return (
    <div className="dash-space">
      <Starfield />
      {!booted && (
        <button type="button" className="dash-boot" onClick={skipBoot} aria-label="System check — select to skip">
          <span className="dash-boot-box" aria-hidden>
            <span className="dash-boot-title">ZERO FAILURE // OPS DECK</span>
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
        {/* the official logo pinned to the deck's top-right corner, above
            the sticky ops strip — as provided, on a light chip */}
        <div className="dash-brand">
          <img src={seliseLogo} alt="SELISE Blocks" />
        </div>
        {/* The live header strip: ops tag + the two real clocks. */}
        <div className="dash-topbar">
          <span className="dash-topbar-tag">
            <i className="dash-live-dot" aria-hidden />
            OPS // MISSION DECK
          </span>
          <MissionClocks />
        </div>

        {/* The briefing banner: the mission's name, the way in, and the
            stage dial sweeping the scene count on the right. */}
        <section className="dash-hero">
          <span className="dash-hero-edge" aria-hidden />
          <div className="dash-hero-main">
            <p className="dash-kicker">{t("dashboard.hero.title")}</p>
            <h2>{t("dashboard.title")}</h2>
            <p className="dash-hero-body">{t("dashboard.hero.body")}</p>
            <a
              className="dash-open"
              href="/simulator"
              onClick={(event) => {
                event.preventDefault();
                navigate("/simulator");
              }}
            >
              <MonitorPlay size={16} aria-hidden />
              {t("dashboard.open")}
            </a>
          </div>
          {/* The stage dial: one tick per scene around a live radar sweep,
              the scene count glowing dead center. Decorative motion; the
              number is real but the stats row says it too. */}
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

        {/* HUD readouts: the size of the mission, straight from the catalog. */}
        <div className="dash-stats">
          {stats.map((stat, i) => (
            <StatTile key={stat.label} value={stat.value} label={stat.label} delay={180 + i * 70} />
          ))}
        </div>

        <div className="dash-grid">
          {/* The scenario catalog: every selectable storyline and what it
              proves. The simulator's Config panel selects among these. */}
          <section className="dash-card dash-card-wide">
            <h3>
              <span className="dash-h3-no">01</span>
              {t("dashboard.scenarios.title")}
              <span className="dash-h3-tag">REGISTRY</span>
              <span className="dash-h3-count">{SCENARIOS.length} ENTRIES</span>
            </h3>
            <p className="dash-card-hint">{t("dashboard.scenarios.hint")}</p>
            <div className="dash-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{t("dashboard.scenarios.col.title")}</th>
                    <th>{t("dashboard.scenarios.col.description")}</th>
                  </tr>
                </thead>
                <tbody>
                  {SCENARIOS.map((scenario, i) => (
                    <tr key={scenario.id}>
                      <td className="dash-cell-title">
                        <span className="dash-row-no">{String(i + 1).padStart(2, "0")}</span>
                        {scenario.title}
                      </td>
                      <td className="dash-cell-desc">{scenario.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="dash-card-foot">
              <span>
                ENTRIES <b>{SCENARIOS.length}</b>
              </span>
              <span>SELECTED IN SIM // CONFIG PANEL</span>
            </div>
          </section>

          <section className="dash-card dash-card-scenes">
            <h3>
              <span className="dash-h3-no">02</span>
              {t("dashboard.scenes.title")}
              <span className="dash-h3-tag">PLAY ORDER</span>
              <span className="dash-h3-count">{SCENES.length} SCENES</span>
            </h3>
            <p className="dash-card-hint">{t("dashboard.scenes.hint")}</p>
            <ul className="dash-list">
              {SCENES.map((scene) => (
                <li key={scene.index} className="dash-list-row">
                  <span className="dash-list-index">{scene.index}</span>
                  <span className="dash-list-name">{scene.title}</span>
                  <span className="dash-list-meta">{scene.environment}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="dash-card">
            <h3>
              <span className="dash-h3-no">03</span>
              {t("dashboard.cast.title")}
              <span className="dash-h3-tag">ROSTER</span>
              <span className="dash-h3-count">{CAST.length} PLATFORMS</span>
            </h3>
            <p className="dash-card-hint">{t("dashboard.cast.hint")}</p>
            <ul className="dash-list">
              {CAST.map((character) => (
                <li key={character.id} className="dash-list-row">
                  <span className="dash-dot" style={{ "--dash-hue": character.hue } as React.CSSProperties} aria-hidden />
                  <span className="dash-list-name">{character.name}</span>
                  <span className="dash-sig" aria-hidden>
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="dash-list-meta">{character.role}</span>
                  <span className="dash-onstage">ON STAGE</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </DashboardRails>
    </div>
  );
}
