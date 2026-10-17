// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { currentUserIds, setCurrentUserScope, userScopedKey } from "./userScope";

// Each test rides its own base key — the module's one-migration-per-
// key bookkeeping lives for the whole tab, so a reused key would
// remember the previous test's migration.
describe("userScopedKey", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setCurrentUserScope(undefined);
  });

  afterEach(() => {
    setCurrentUserScope(undefined);
  });

  it("keeps the bare key when nobody is signed in", () => {
    expect(userScopedKey("zf-key-bare")).toBe("zf-key-bare");
  });

  it("namespaces by the signed-in account", () => {
    setCurrentUserScope({ sub: "user-a" });
    expect(userScopedKey("zf-key-scoped")).toBe("zf-key-scoped:user-a");
  });

  it("takes the first identity claim IAM provides", () => {
    setCurrentUserScope({ userId: "u-77", email: "a@b.c" });
    expect(userScopedKey("zf-key-first")).toBe("zf-key-first:u-77");
    setCurrentUserScope({ email: "a@b.c" });
    expect(userScopedKey("zf-key-first2")).toBe("zf-key-first2:a@b.c");
  });

  it("hands the first account the old shared drawer", () => {
    window.localStorage.setItem("zf-key-legacy", '{"old":true}');
    setCurrentUserScope({ sub: "user-a" });
    expect(userScopedKey("zf-key-legacy")).toBe("zf-key-legacy:user-a");
    expect(window.localStorage.getItem("zf-key-legacy:user-a")).toBe('{"old":true}');
  });

  it("gives a second account its own empty drawer", () => {
    window.localStorage.setItem("zf-key-second", "legacy");
    setCurrentUserScope({ sub: "user-a" });
    expect(userScopedKey("zf-key-second")).toBe("zf-key-second:user-a");
    setCurrentUserScope({ sub: "user-b" });
    expect(userScopedKey("zf-key-second")).toBe("zf-key-second:user-b");
    expect(window.localStorage.getItem("zf-key-second:user-b")).toBe(null);
  });

  it("ignores claims without any recognizable identity", () => {
    setCurrentUserScope({ role: "viewer" });
    expect(userScopedKey("zf-key-none")).toBe("zf-key-none");
  });

  it("collects every identity string of the account", () => {
    setCurrentUserScope({ sub: "u-1", email: "a@b.c", role: "viewer" });
    expect(currentUserIds()).toEqual(["u-1", "a@b.c"]);
  });

  it("collects nothing when nobody is signed in", () => {
    expect(currentUserIds()).toEqual([]);
  });
});
