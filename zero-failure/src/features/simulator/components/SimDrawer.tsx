// The one drawer. Every right-side sheet in the simulator — the repo
// picker, the run-panel deck, whatever comes next — is this component
// with different content: the overlay, the slide-in, the Escape and
// backdrop-click close live here exactly once (Escape stops at document
// so no window-level handler ever reacts to a sheet's own close).
// Callers own only what's inside — and, if they must, the
// width via the --sim-drawer-w variable.

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

interface SimDrawerProps {
  open: boolean;
  /** Accessible name of the dialog. */
  label: string;
  /** Node hue (any CSS hue) tinting the accent border; omit for the app accent. */
  hue?: string | number;
  /** Any CSS width. Default: min(24rem, 92vw). */
  width?: string;
  onClose: () => void;
  children: ReactNode;
}

export function SimDrawer({ open, label, hue, width, onClose, children }: SimDrawerProps) {
  const drawerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // document fires before window: the sheet's close stays its own
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      // The sheet claims aria-modal — keep Tab cycling inside it instead
      // of walking the page behind the overlay.
      const drawer = drawerRef.current;
      if (!drawer) return;
      const focusables = Array.from(
        drawer.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null);
      if (focusables.length === 0) {
        event.preventDefault();
        drawer.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === first || active === drawer || !drawer.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !drawer.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Modality bookkeeping: the sheet takes focus when it opens and hands it
  // back to whatever held it before, so a sheet opened from a rail button
  // closes back onto that button.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    drawerRef.current?.focus();
    return () => opener?.focus?.();
  }, [open]);

  if (!open) return null;

  const style = {
    ...(hue !== undefined ? { "--node-hue": hue } : null),
    ...(width ? { "--sim-drawer-w": width } : null)
  } as CSSProperties;

  return (
    <div className="sim-drawer-overlay" onClick={onClose}>
      <aside
        ref={drawerRef}
        className="sim-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        style={style}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </aside>
    </div>
  );
}
