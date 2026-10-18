import { describe, expect, it } from "vitest";
import type { PlatformId } from "../engine/types";
import { menuLevelWords, PLATFORM_MENUS, type PlatformMenuItem } from "./platformMenus";

// The menu walk's voice track: the body speaks its name and role, every
// walked level speaks its authored line — and a trail that misses the
// tree never speaks at all.
describe("menuLevelWords", () => {
  it("speaks the planet's name and role at the body level", () => {
    expect(menuLevelWords("os", [])).toBe("OS — Team Leader.");
  });

  it("speaks a planet with no authored menus too", () => {
    expect(menuLevelWords("iam", [])).toBe("IAM — Security Officer.");
  });

  it("speaks the authored line of a walked menu", () => {
    expect(menuLevelWords("logic", ["Workflow"])).toBe("Event-driven workflows across the tenant.");
  });

  it("speaks a sub-menu's line one level deeper", () => {
    expect(menuLevelWords("utilities", ["Payments", "Saved Cards"])).toBe("Tokenized cards kept on file.");
  });

  it("authors a line for every level of every planet's tree", () => {
    for (const [planet, items] of Object.entries(PLATFORM_MENUS)) {
      const walk = (entries: PlatformMenuItem[], trail: string[]) => {
        for (const item of entries) {
          const words = menuLevelWords(planet as PlatformId, [...trail, item.label]);
          expect(words, `${planet}:${[...trail, item.label].join(">")}`).toBeTruthy();
          if (item.children) walk(item.children, [...trail, item.label]);
        }
      };
      walk(items ?? [], []);
    }
  });

  it("returns null when the trail misses the tree", () => {
    expect(menuLevelWords("logic", ["Nope"])).toBeNull();
    expect(menuLevelWords("monitor", ["Monitor", "Deeper"])).toBeNull();
    expect(menuLevelWords("iam", ["Ghost menu"])).toBeNull();
  });

  it("returns null for an unknown planet", () => {
    expect(menuLevelWords("nope" as PlatformId, [])).toBeNull();
  });
});
