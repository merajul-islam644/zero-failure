import { describe, expect, it } from "vitest";
import { isOwnForge } from "./systemsDoc";

// The deck's creator filter: a forged_system record rides a
// platform-managed CreatedBy stamp, and an account sees its own
// forges — plus any record whose stamp never rode back.
describe("isOwnForge", () => {
  const mine = new Set(["u-1", "a@b.c"]);

  it("keeps a record this account created", () => {
    expect(isOwnForge({ CreatedBy: "u-1" }, mine)).toBe(true);
  });

  it("drops a record another account created", () => {
    expect(isOwnForge({ CreatedBy: "u-2" }, mine)).toBe(false);
  });

  it("matches any of the account's identity strings", () => {
    expect(isOwnForge({ CreatedBy: "a@b.c" }, mine)).toBe(true);
  });

  it("trims the stamp before matching", () => {
    expect(isOwnForge({ CreatedBy: " u-1 " }, mine)).toBe(true);
  });

  it("keeps a record whose creator stamp never rode back", () => {
    expect(isOwnForge({}, mine)).toBe(true);
  });

  it("keeps nothing but its own when signed out", () => {
    const none = new Set<string>([]);
    expect(isOwnForge({ CreatedBy: "u-1" }, none)).toBe(false);
    expect(isOwnForge({}, none)).toBe(true);
  });
});
