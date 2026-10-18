import { Rocket } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import type { BlocksClient } from "@seliseblocks/client";
import type { BodyLogo } from "./iconCatalog";
import { forgedLevelCount, readForgedSystems, type ForgedSystem } from "./systemsDoc";

// every test logo is the same shape — the count never reads it
const glyph: BodyLogo = { kind: "icon", icon: Rocket };

// The deck's one read: every record the gateway answers reaches every
// operative's deck — the sky is shared, inviter and invitee alike, so
// no creator filter stands between an account and the tenant's forges.
describe("readForgedSystems", () => {
  const wireSystem = (over: Record<string, unknown>) => ({
    base: "app",
    sun: "OS",
    note: "",
    planetsJson: JSON.stringify({ ring: [{ name: "Billing", logo: { kind: "icon", name: "rocket" } }] }),
    ...over,
  });

  function fakeClient(items: Record<string, unknown>[]): BlocksClient {
    const list = vi.fn().mockResolvedValue({ data: { items } });
    return { data: { collection: () => ({ list }) } } as unknown as BlocksClient;
  }

  it("screens every record the gateway answers, whoever forged it", async () => {
    const systems = await readForgedSystems(
      fakeClient([
        wireSystem({ ItemId: "a", seq: "2", CreatedBy: "the-inviter" }),
        wireSystem({ ItemId: "b", base: "menu", sun: "Pay", seq: "1", CreatedBy: "the-invitee" }),
      ])
    );

    expect(systems.map((system) => system.sun)).toEqual(["Pay", "OS"]);
  });

  it("orders the deck by forge order, oldest first", async () => {
    const systems = await readForgedSystems(
      fakeClient([wireSystem({ ItemId: "a", seq: "30" }), wireSystem({ ItemId: "b", seq: "20" }), wireSystem({ ItemId: "c", seq: "10" })])
    );

    expect(systems.map((system) => system.seq)).toEqual([10, 20, 30]);
  });

  it("drops a stranger record instead of breaking the deck", async () => {
    const systems = await readForgedSystems(
      fakeClient([wireSystem({ ItemId: "a" }), { ItemId: "b", base: "somewhere" }, wireSystem({ ItemId: "c", planetsJson: "not json" })])
    );

    expect(systems).toHaveLength(1);
  });
});

// The mission readout's level math: a body's walkable chain — menus
// and sub-menus — counted the same way every console walks it.
describe("forgedLevelCount", () => {
  const system = (planets: ForgedSystem["planets"]): ForgedSystem => ({
    base: "app",
    sun: "OS",
    note: "",
    planets,
  });

  it("counts a menu base's menu → sub-menu chains", () => {
    const menuBase: ForgedSystem = {
      ...system([
        { name: "Billing", logo: glyph, submenu: [{ name: "Cards", logo: glyph }, { name: "Loans", logo: glyph }] },
        { name: "Vault", logo: glyph, submenu: [] },
      ]),
      base: "menu",
    };
    expect(forgedLevelCount(menuBase)).toBe(2);
  });

  it("counts an app base's app → menu → sub-menu chains", () => {
    const appBase = system([
      {
        name: "Console",
        logo: glyph,
        menus: [
          { name: "Payments", logo: glyph, submenu: [{ name: "Cards", logo: glyph }] },
          { name: "Vault", logo: glyph },
        ],
      },
      { name: "Portal", logo: glyph },
    ]);
    expect(forgedLevelCount(appBase)).toBe(3);
  });

  it("counts nothing for a deck of bare bodies", () => {
    expect(forgedLevelCount(system([{ name: "Sun", logo: glyph }]))).toBe(0);
  });
});
