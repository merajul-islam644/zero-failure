import type { ReactNode } from "react";

export function Alert({ children, tone = "warn" }: { children: ReactNode; tone?: "error" | "info" | "warn" }) {
  // role="alert": this is the error channel for sign-in and other blocking
  // failures — the announcement must not depend on focus reaching the box.
  return <div className={`alert alert-${tone}`} role="alert">{children}</div>;
}
