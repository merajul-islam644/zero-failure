import { useEffect, useRef, useState } from "react";
import { AppShell } from "../layout/AppShell";
import { RedirectIfAuthenticated, RequireAuth } from "./guards";
import { RouterContext } from "./RouterContext";
import { CallbackPage } from "../../features/auth/CallbackPage";
import { ErrorPage } from "../../features/auth/ErrorPage";
import { LoginPage } from "../../features/auth/LoginPage";
import { NotFoundPage } from "../../features/auth/NotFoundPage";
import { DashboardPage } from "../../features/dashboard/DashboardPage";
import { CreateSolarSystemPage } from "../../features/create/CreateSolarSystemPage";
import { PresentationPage } from "../../features/presentation/PresentationPage";
import { PlaywrightPage } from "../../features/playwright/PlaywrightPage";
import { AccessConsolePage } from "../../features/access/AccessConsolePage";
import { RolesConsolePage } from "../../features/access/RolesConsolePage";
import { ProfilePage } from "../../features/profile/ProfilePage";
import { SimulatorPage } from "../../features/simulator/components/SimulatorPage";

const protectedRoutes = {
  "/error": ErrorPage
};

// The warp transition names the sector you're jumping to. Console chrome,
// not user data — plain English like the rest of the HUD labels.
const JUMP_LABELS: Record<string, string> = {
  "/": "CHOKRO",
  "/simulator": "SIMULATOR",
  "/presentation": "PRESENTATION",
  "/playwright": "PLAYWRIGHT",
  "/create": "CREATE SOLAR SYSTEM",
  "/account": "ACCOUNT",
  "/access": "ACCESS CONTROL",
  "/roles": "ROLE CONTROL",
  "/error": "DIAGNOSTICS",
  "/login": "AUTH GATE"
};

export function AppRouter() {
  const [path, setPath] = useState(() => window.location.pathname);
  const [search, setSearch] = useState(() => window.location.search);
  const [jump, setJump] = useState<{ key: number; label: string } | null>(null);
  const prevPathRef = useRef(path);

  useEffect(() => {
    const onPopState = () => {
      setPath(window.location.pathname);
      setSearch(window.location.search);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Every sector change (button or browser back) plays the warp overlay.
  // It renders in the same commit as the new page, opaque from frame one,
  // so the swap is never visible. Reduced motion jumps cut straight to it.
  useEffect(() => {
    if (prevPathRef.current === path) return;
    prevPathRef.current = path;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setJump({ key: Date.now(), label: JUMP_LABELS[path] ?? "SECTOR" });
  }, [path]);

  useEffect(() => {
    if (!jump) return;
    const id = window.setTimeout(() => setJump(null), 1150);
    return () => window.clearTimeout(id);
  }, [jump]);

  function navigate(nextPath: string) {
    const [nextPathname = "/", queryString = ""] = nextPath.split("?");
    window.history.pushState({}, "", nextPath);
    setPath(nextPathname);
    setSearch(queryString ? `?${queryString}` : "");
  }

  function renderRoutes() {
    if (path === "/login/callback") {
    return <CallbackPage onNavigate={navigate} />;
  }

  if (path === "/login") {
    const requested = new URLSearchParams(search).get("returnTo") || undefined;
    // Only same-origin paths are navigable targets: a crafted returnTo
    // ("https://…" or protocol-relative "//…") must not reach pushState.
    const returnTo =
      requested && requested.startsWith("/") && !requested.startsWith("//") ? requested : undefined;
    return (
      <RedirectIfAuthenticated onNavigate={navigate}>
        <LoginPage returnTo={returnTo} />
      </RedirectIfAuthenticated>
    );
  }

  // The simulator keeps the whole viewport for itself — no AppShell sidebar.
  if (path === "/simulator") {
    return (
      <RequireAuth currentPath={path} onNavigate={navigate}>
        <SimulatorPage />
      </RequireAuth>
    );
  }

  // "/" is the dashboard: the screen a successful sign-in lands on. Like the
  // simulator it owns the whole viewport — the space deck is the page, no
  // shell sidebar; the rails carry navigation (the simulator's rail links
  // back here, the hero's CTA leads out). The presentation and playwright
  // sectors share that same full-viewport shell through DashboardRails.
  if (path === "/") {
    return (
      <RequireAuth currentPath={path} onNavigate={navigate}>
        <DashboardPage />
      </RequireAuth>
    );
  }

  if (path === "/presentation") {
    return (
      <RequireAuth currentPath={path} onNavigate={navigate}>
        <PresentationPage />
      </RequireAuth>
    );
  }

  if (path === "/playwright") {
    return (
      <RequireAuth currentPath={path} onNavigate={navigate}>
        <PlaywrightPage />
      </RequireAuth>
    );
  }

  if (path === "/create") {
    return (
      <RequireAuth currentPath={path} onNavigate={navigate}>
        <CreateSolarSystemPage />
      </RequireAuth>
    );
  }

  // The account sector rides the same full-viewport HUD as the other
  // space sectors — the dossier is one more console of the machine,
  // not a page inside the shell sidebar.
  if (path === "/account") {
    return (
      <RequireAuth currentPath={path} onNavigate={navigate}>
        <ProfilePage />
      </RequireAuth>
    );
  }

  // The access-control sector: the account family's registry console —
  // every operative on file, each one's clearance editable from its
  // access file. Reached from the dossier, full viewport like it.
  if (path === "/access") {
    return (
      <RequireAuth currentPath={path} onNavigate={navigate}>
        <AccessConsolePage />
      </RequireAuth>
    );
  }

  // The role-control sector: the account family's definition console —
  // every role on file, each one's permission set editable from its
  // role file, new roles defined from the same console. Reached from
  // the dossier, full viewport like it.
  if (path === "/roles") {
    return (
      <RequireAuth currentPath={path} onNavigate={navigate}>
        <RolesConsolePage />
      </RequireAuth>
    );
  }

  const Page = protectedRoutes[path as keyof typeof protectedRoutes];
  if (!Page) {
    return <NotFoundPage onNavigate={navigate} />;
  }

  // /error's "return home" needs the router callback — render it directly
  // like the other full-viewport sectors instead of inside the shell, which
  // would mount it prop-less.
  if (path === "/error") {
    return <ErrorPage onNavigate={navigate} />;
  }

  return (
    <RequireAuth currentPath={path} onNavigate={navigate}>
      <AppShell activePath={path} onNavigate={navigate}>
        <Page />
      </AppShell>
    </RequireAuth>
  );
  }

  return (
    <RouterContext.Provider value={navigate}>
      {renderRoutes()}
      {jump && (
        <div className="sim-jump" key={jump.key} role="status" aria-live="polite">
          <span className="sim-jump-streaks" aria-hidden />
          <span className="sim-jump-flash" aria-hidden />
          <span className="sim-jump-box">
            <span className="sim-jump-kicker">COURSE LAID IN</span>
            <strong className="sim-jump-target">{jump.label}</strong>
            <span className="sim-jump-bar">
              <i />
            </span>
          </span>
        </div>
      )}
    </RouterContext.Provider>
  );
}
