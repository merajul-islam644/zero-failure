// User settings: theme, motion, narration and sound effects. Persisted in
// localStorage as a per-viewer convenience only — nothing here is run state.
// Theme and motion apply as attributes on <html>; "system" removes the
// attribute so the CSS media queries govern.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

export type ThemePreference = "system" | "dark" | "light";
export type MotionPreference = "system" | "reduce" | "full";

export interface Settings {
  theme: ThemePreference;
  motion: MotionPreference;
  narration: boolean;
  sfx: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  motion: "system",
  narration: false,
  sfx: false
};

const STORAGE_KEY = "zero-failure-settings";

function loadSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      theme: parsed.theme ?? DEFAULT_SETTINGS.theme,
      motion: parsed.motion ?? DEFAULT_SETTINGS.motion,
      narration: parsed.narration ?? DEFAULT_SETTINGS.narration,
      sfx: parsed.sfx ?? DEFAULT_SETTINGS.sfx
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

interface SettingsContextValue extends Settings {
  setTheme: (theme: ThemePreference) => void;
  setMotion: (motion: MotionPreference) => void;
  setNarration: (on: boolean) => void;
  setSfx: (on: boolean) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "system") delete root.dataset.theme;
    else root.dataset.theme = settings.theme;
    if (settings.motion === "system") delete root.dataset.motion;
    else root.dataset.motion = settings.motion;
  }, [settings.theme, settings.motion]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Private mode / storage blocked — settings stay session-only.
    }
  }, [settings]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      ...settings,
      setTheme: (theme) => setSettings((s) => ({ ...s, theme })),
      setMotion: (motion) => setSettings((s) => ({ ...s, motion })),
      setNarration: (narration) => setSettings((s) => ({ ...s, narration })),
      setSfx: (sfx) => setSettings((s) => ({ ...s, sfx }))
    }),
    [settings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside <SettingsProvider>");
  return ctx;
}
