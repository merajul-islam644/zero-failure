// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setCurrentUserScope } from "../../shared/storage/userScope";
import { readDeskSidecar } from "./deskSidecar";

describe("readDeskSidecar", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setCurrentUserScope({ sub: "user-a" });
  });

  afterEach(() => {
    setCurrentUserScope(undefined);
  });

  it("reads the run desk's maps back — repos with names, file sets, homes", () => {
    window.localStorage.setItem(
      "zf-playwright-repos:user-a",
      JSON.stringify({
        "blocks-os": { name: "blocks-os", files: 214, dirs: 22, bytes: 5 },
        "blocks-os:Billing>Cards": { name: "cards-module", files: 31, dirs: 4, bytes: 1 },
      }),
    );
    window.localStorage.setItem("zf-playwright-files:user-a", JSON.stringify({ leaf: { count: 2 } }));
    window.localStorage.setItem("zf-playwright-runpaths:user-a", JSON.stringify({ "blocks-os": "D:/repos/blocks-os" }));
    const sidecar = readDeskSidecar();
    expect(sidecar.repos).toEqual([
      { key: "blocks-os", name: "blocks-os", files: 214 },
      { key: "blocks-os:Billing>Cards", name: "cards-module", files: 31 },
    ]);
    expect(sidecar.fileSets).toBe(1);
    expect(sidecar.homes).toEqual(["blocks-os"]);
  });

  it("falls back to the level key when a summary carries no name", () => {
    window.localStorage.setItem("zf-playwright-repos:user-a", JSON.stringify({ mystery: 7 }));
    expect(readDeskSidecar().repos).toEqual([{ key: "mystery", name: "mystery", files: 0 }]);
  });

  it("reads empty when the cache is", () => {
    expect(readDeskSidecar()).toEqual({ repos: [], fileSets: 0, homes: [] });
  });

  it("survives junk in the cache", () => {
    window.localStorage.setItem("zf-playwright-repos:user-a", "{not json");
    window.localStorage.setItem("zf-playwright-files:user-a", "42");
    expect(readDeskSidecar()).toEqual({ repos: [], fileSets: 0, homes: [] });
  });

  it("sees only this account's drawer", () => {
    window.localStorage.setItem("zf-playwright-repos:user-a", JSON.stringify({ "blocks-os": { name: "blocks-os" } }));
    setCurrentUserScope({ sub: "user-b" });
    expect(readDeskSidecar().repos).toEqual([]);
  });
});
