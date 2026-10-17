// The ten platform characters — roles and personalities. Canvas geometry
// lives in components/canvas/orbits.ts: OS is the sun at the center, the
// other nine revolve on elliptical orbit rings.

import type { CharacterDef, PlatformId } from "../engine/types";

export const CAST: CharacterDef[] = [
  {
    id: "os",
    name: "OS",
    role: "Team Leader",
    personality: "Calm, organized",
    hue: "232 89% 62%",
    glyph: "RadioTower"
  },
  {
    id: "iam",
    name: "IAM",
    role: "Security Officer",
    personality: "Strict, careful",
    hue: "0 72% 58%",
    glyph: "ShieldCheck"
  },
  {
    id: "data-gateway",
    name: "Data Gateway",
    role: "Data Manager",
    personality: "Precise, logical",
    hue: "187 85% 50%",
    glyph: "Database"
  },
  {
    id: "logic",
    name: "Logic",
    role: "Workflow Coordinator",
    personality: "Systematic",
    hue: "268 83% 66%",
    glyph: "Workflow"
  },
  {
    id: "release",
    name: "Release",
    role: "Deployment Engineer",
    personality: "Practical",
    hue: "27 95% 58%",
    glyph: "Rocket"
  },
  {
    id: "monitor",
    name: "Monitor",
    role: "Observability Engineer",
    personality: "Analytical",
    hue: "115 76% 46%",
    glyph: "Activity"
  },
  {
    id: "ai-agent",
    name: "AI Agent",
    role: "Intelligent Investigator",
    personality: "Curious, analytical",
    hue: "52 96% 55%",
    glyph: "Brain"
  },
  {
    id: "utilities",
    name: "Utilities",
    role: "Notification Officer",
    personality: "Helpful",
    hue: "210 89% 58%",
    glyph: "Bell"
  },
  {
    id: "localization",
    name: "Localization",
    role: "Language Specialist",
    personality: "Detail-oriented",
    hue: "316 78% 62%",
    glyph: "Languages"
  },
  {
    id: "storage",
    name: "Studio",
    role: "Studio Manager",
    personality: "Reliable",
    hue: "165 66% 45%",
    glyph: "HardDrive"
  }
];

export const PLATFORMS: readonly PlatformId[] = CAST.map((c) => c.id);

export const CAST_BY_ID: Record<PlatformId, CharacterDef> = Object.fromEntries(
  CAST.map((c) => [c.id, c])
) as Record<PlatformId, CharacterDef>;

export function displayName(id: PlatformId): string {
  return CAST_BY_ID[id].name;
}
