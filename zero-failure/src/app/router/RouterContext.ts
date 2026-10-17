// The router's navigate function, shareable without import cycles:
// routes.tsx provides it, feature components (rails, CTAs) consume it —
// a separate module keeps feature → router imports one-way.
import { createContext, useContext } from "react";

export const RouterContext = createContext<(nextPath: string) => void>(() => {});

export function useRouterNavigate() {
  return useContext(RouterContext);
}
