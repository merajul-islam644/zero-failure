// The ten platform characters — roles, personalities, canvas geometry.
// Positions live in the 1600x900 command-center viewBox:
// OS top-center, senior platforms row two, specialists row three, services row four.

import type { CharacterDef, PlatformId } from "../engine/types";

export const CAST: CharacterDef[] = [
  {
    id: "os",
    name: "OS",
    role: "Team Leader",
    personality: "Calm, organized",
    hue: "222 89% 60%",
    glyph: "RadioTower",
    x: 800,
    y: 120
  },
  {
    id: "iam",
    name: "IAM",
    role: "Security Officer",
    personality: "Strict, careful",
    hue: "0 72% 58%",
    glyph: "ShieldCheck",
    x: 300,
    y: 310
  },
  {
    id: "data-gateway",
    name: "Data Gateway",
    role: "Data Manager",
    personality: "Precise, logical",
    hue: "190 85% 50%",
    glyph: "Database",
    x: 633,
    y: 310
  },
  {
    id: "logic",
    name: "Logic",
    role: "Workflow Coordinator",
    personality: "Systematic",
    hue: "262 83% 66%",
    glyph: "Workflow",
    x: 966,
    y: 310
  },
  {
    id: "release",
    name: "Release",
    role: "Deployment Engineer",
    personality: "Practical",
    hue: "27 95% 58%",
    glyph: "Rocket",
    x: 300,
    y: 500
  },
  {
    id: "monitor",
    name: "Monitor",
    role: "Observability Engineer",
    personality: "Analytical",
    hue: "152 76% 44%",
    glyph: "Activity",
    x: 633,
    y: 500
  },
  {
    id: "ai-agent",
    name: "AI Agent",
    role: "Intelligent Investigator",
    personality: "Curious, analytical",
    hue: "42 96% 55%",
    glyph: "Brain",
    x: 966,
    y: 500
  },
  {
    id: "utilities",
    name: "Utilities",
    role: "Notification Officer",
    personality: "Helpful",
    hue: "199 89% 56%",
    glyph: "Bell",
    x: 467,
    y: 700
  },
  {
    id: "localization",
    name: "Localization",
    role: "Language Specialist",
    personality: "Detail-oriented",
    hue: "316 78% 62%",
    glyph: "Languages",
    x: 800,
    y: 700
  },
  {
    id: "storage",
    name: "Storage",
    role: "Evidence Manager",
    personality: "Reliable",
    hue: "172 66% 45%",
    glyph: "HardDrive",
    x: 1133,
    y: 700
  }
];

export const PLATFORMS: readonly PlatformId[] = CAST.map((c) => c.id);

export const CAST_BY_ID: Record<PlatformId, CharacterDef> = Object.fromEntries(
  CAST.map((c) => [c.id, c])
) as Record<PlatformId, CharacterDef>;

export function displayName(id: PlatformId): string {
  return CAST_BY_ID[id].name;
}
