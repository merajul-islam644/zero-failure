// User settings: theme, motion, narration (voice + toggle) and sound
// effects. Persisted in
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
import type { ExecutionMode } from "../engine/types";

export type ThemePreference = "system" | "dark" | "light";
export type MotionPreference = "system" | "reduce" | "full";
/** "auto" = engine default; otherwise a speechSynthesis voiceURI. */
export type VoicePreference = string;

export interface Settings {
  theme: ThemePreference;
  motion: MotionPreference;
  narration: boolean;
  sfx: boolean;
  voice: VoicePreference;
  /** Per-character voice: "cast" (auto-assign), "auto" (default) or a voiceURI. */
  castVoices: Record<string, string>;
  /** Which connector registry executes: simulated fakes or read-only live probes. */
  executionMode: ExecutionMode;
  /** Broadcast: slave the clock to the shared playback head (Phase C). */
  broadcast: boolean;
  /** Schema version — drives the one-time audio-defaults migration. */
  version: number;
}

const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  motion: "system",
  // Sound on: the simulator is a narrated demo, and audio hidden in the
  // Config panel read as "no voice" to every visitor who never found it.
  narration: true,
  sfx: true,
  voice: "auto",
  castVoices: {},
  executionMode: "simulated",
  broadcast: false,
  version: 2
};

const STORAGE_KEY = "zero-failure-settings";

function loadSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    // v1 saved narration:false / sfx:false silently on first mount — an
    // opt-in nobody could find. Bump once to the sound-on defaults; after
    // that a stored off stays off (deliberate choice via the toggles).
    const stale = parsed.version !== DEFAULT_SETTINGS.version;
    return {
      theme: parsed.theme ?? DEFAULT_SETTINGS.theme,
      motion: parsed.motion ?? DEFAULT_SETTINGS.motion,
      narration: stale ? DEFAULT_SETTINGS.narration : (parsed.narration ?? DEFAULT_SETTINGS.narration),
      sfx: stale ? DEFAULT_SETTINGS.sfx : (parsed.sfx ?? DEFAULT_SETTINGS.sfx),
      voice: parsed.voice ?? DEFAULT_SETTINGS.voice,
      castVoices: parsed.castVoices ?? DEFAULT_SETTINGS.castVoices,
      // Newer fields merge additively with ?? — deliberately NOT a version
      // bump: bumping `version` would re-run the audio-defaults migration and
      // reset every existing visitor's narration/sfx choices.
      executionMode: parsed.executionMode === "live" ? "live" : "simulated",
      broadcast: parsed.broadcast ?? DEFAULT_SETTINGS.broadcast,
      version: DEFAULT_SETTINGS.version
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
  setVoice: (voice: VoicePreference) => void;
  setCastVoice: (platform: string, voice: string) => void;
  setExecutionMode: (mode: ExecutionMode) => void;
  setBroadcast: (on: boolean) => void;
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
      setSfx: (sfx) => setSettings((s) => ({ ...s, sfx })),
      setVoice: (voice) => setSettings((s) => ({ ...s, voice })),
      setCastVoice: (platform, castVoice) =>
        setSettings((s) => ({
          ...s,
          castVoices: { ...s.castVoices, [platform]: castVoice }
        })),
      setExecutionMode: (executionMode) => setSettings((s) => ({ ...s, executionMode })),
      setBroadcast: (broadcast) => setSettings((s) => ({ ...s, broadcast }))
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

/** True when the viewer prefers reduced motion — either explicitly, or via
 *  the OS while on "system". JS-driven animation (orbit positions) freezes
 *  off this; CSS animation keeps keying on the html[data-motion] attribute. */
export function useMotionReduced(): boolean {
  const { motion } = useSettings();
  const [mediaReduce, setMediaReduce] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    if (motion !== "system") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setMediaReduce(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [motion]);

  return motion === "reduce" || (motion === "system" && mediaReduce);
}
