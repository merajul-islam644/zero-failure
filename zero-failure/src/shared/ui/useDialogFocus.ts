import { useEffect, useRef } from "react";

/** Wire a hand-rolled dialog with the focus behavior its `aria-modal="true"`
 *  claims: the panel takes focus when the dialog opens, Tab cycles inside it
 *  instead of walking the page behind, and whatever held focus when the
 *  dialog opened gets it back on close. Attach the returned ref to the
 *  dialog's panel element and give it tabIndex={-1}.
 *
 *  Tab-only and capture-phase on purpose: each dialog keeps its own Escape
 *  handling, and stacked dialogs (a picker over an editor) degrade to the
 *  topmost panel winning the wrap, which is the right outcome. */
export function useDialogFocus<T extends HTMLElement>(): React.RefObject<T> {
  const panelRef = useRef<T | null>(null);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const opener = document.activeElement as HTMLElement | null;
    panel.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null);
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const active = document.activeElement;
      const inside = panel.contains(active);
      if (event.shiftKey) {
        if (!inside || active === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (!inside || active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      opener?.focus?.();
    };
  }, []);

  return panelRef;
}
