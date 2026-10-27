import { PanelLeft } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { navItems } from "./navItems";
import { NotificationsMenu } from "./NotificationsMenu";
import { UserMenu } from "./UserMenu";
import { ChokroMark } from "../../shared/ui/ChokroMark";
import { useT } from "../../lib/i18n/LocalizationProvider";

const COLLAPSED_KEY = "blocks-app:sidebar-collapsed";
const MOBILE_QUERY = "(max-width: 880px)";

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia(MOBILE_QUERY).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}

export function AppShell({
  activePath,
  children,
  onNavigate,
}: {
  activePath: string;
  children: ReactNode;
  onNavigate: (path: string) => void;
}) {
  const isMobile = useIsMobile();
  // Storage can throw (private mode, hardened browsers) — the preference is
  // cosmetic, so a failed read just means the default expansion.
  const [collapsedPref, setCollapsedPref] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === "true";
    } catch {
      return false;
    }
  });
  const { t } = useT();
  // On narrow screens the sidebar is always the icon-only rail below --
  // no separate hamburger/drawer/scrim needed, and no dead-end state where
  // nothing on screen can bring navigation back.
  const collapsed = collapsedPref || isMobile;
  const activeItem = navItems.find((item) => item.href === activePath);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, String(collapsedPref));
    } catch {
      // Persistence is best-effort; the session default still works.
    }
  }, [collapsedPref]);

  return (
    <div className="shell">
      <aside className={collapsed ? "collapsed" : ""}>
        <div className="sidebar-header">
          {collapsed ? null : (
            <a
              className="brand"
              href="/"
              onClick={(event) => {
                event.preventDefault();
                onNavigate("/");
              }}
            >
              <span className="brand-mark">
                <ChokroMark size={24} />
              </span>
              <span>CHOKRO</span>
            </a>
          )}
          {/* Hidden on mobile by CSS (nothing to toggle -- the rail is always
             collapsed there); on desktop it's the only control that can
             re-expand the sidebar, so it must never be the thing collapsing hides. */}
          <button
            className="icon-button sidebar-collapse-toggle"
            onClick={() => setCollapsedPref((value) => !value)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <PanelLeft size={16} />
          </button>
        </div>
        <nav>
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              data-tooltip={t(item.labelKey)}
              className={activePath === item.href ? "active" : ""}
              aria-label={t(item.labelKey)}
              aria-current={activePath === item.href ? "page" : undefined}
              onClick={(event) => {
                event.preventDefault();
                onNavigate(item.href);
              }}
            >
              <item.icon size={18} />
              {collapsed ? null : <span>{t(item.labelKey)}</span>}
            </a>
          ))}
        </nav>
      </aside>
      <div className="content">
        <header className="topbar">
          {activeItem ? (
            <div className="breadcrumb">
              <activeItem.icon size={16} />
              <span>{t(activeItem.labelKey)}</span>
            </div>
          ) : null}
          <div className="topbar-spacer" />
          <LanguageSwitcher />
          <NotificationsMenu />
          <UserMenu onNavigate={onNavigate} />
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
