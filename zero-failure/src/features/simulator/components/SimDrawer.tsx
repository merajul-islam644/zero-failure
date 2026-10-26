// The one drawer. Every right-side sheet in the simulator — the repo
// picker, the run-panel deck, whatever comes next — is this component
// with different content: the overlay, the slide-in, the Escape and
// backdrop-click close live here exactly once (Escape stops at document
// so no window-level handler ever reacts to a sheet's own close).
// Callers own only what's inside — and, if they must, the
// width via the --sim-drawer-w variable.

import { useEffect, type CSSProperties, type ReactNode } from "react";

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
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // document fires before window: the sheet's close stays its own
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const style = {
    ...(hue !== undefined ? { "--node-hue": hue } : null),
    ...(width ? { "--sim-drawer-w": width } : null)
  } as CSSProperties;

  return (
    <div className="sim-drawer-overlay" onClick={onClose}>
      <aside
        className="sim-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        style={style}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </aside>
    </div>
  );
}
