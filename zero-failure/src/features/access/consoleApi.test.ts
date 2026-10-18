import { describe, expect, it, vi } from "vitest";
import type { BlocksClient } from "@seliseblocks/client";
import {
  accUserDisplayName,
  accUserStatus,
  assignRolePermissions,
  byInviteRecency,
  clearUserAccessOverrides,
  computeAccessDelta,
  createRole,
  createUser,
  fetchAssignableRoles,
  fetchEmailAvailable,
  fetchPermissions,
  fetchRolePermissions,
  fetchRoles,
  fetchUser,
  fetchUsers,
  normalizeAssignableRoles,
  normalizePermission,
  normalizeRole,
  normalizeRoleDef,
  normalizeRolePage,
  normalizeStringArray,
  normalizeUser,
  normalizeUserPage,
  permissionForms,
  permissionRef,
  updateUserAccess,
} from "./consoleApi";

// a client with nothing but vi.fn()s — the console's wire, mocked at
// exactly the seams the real browser client fills
function fakeClient(iam: Record<string, ReturnType<typeof vi.fn>> = {}): BlocksClient {
  return {
    iam: {
      users: {
        list: iam.usersList ?? vi.fn(),
        get: iam.usersGet ?? vi.fn(),
        updateAccess: iam.updateAccess ?? vi.fn(),
        revokeAccess: iam.revokeAccess ?? vi.fn(),
        create: iam.usersCreate ?? vi.fn(),
        emailAvailable: iam.emailAvailable ?? vi.fn(),
      },
      roles: {
        assignable: iam.assignable ?? vi.fn(),
        list: iam.rolesList ?? vi.fn(),
        create: iam.rolesCreate ?? vi.fn(),
        assignPermissions: iam.assignPermissions ?? vi.fn(),
      },
      permissions: { list: iam.permissionsList ?? vi.fn() },
    },
  } as unknown as BlocksClient;
}

// Loose IAM answers must degrade, never throw — every normalize here
// is the console's promise that a stranger field reads as a default.
describe("normalizeStringArray", () => {
  it("keeps strings only, trimmed and in first-seen order", () => {
    expect(normalizeStringArray([" viewer ", "editor", "", 42, null, "viewer", "auditor"])).toEqual([
      "viewer",
      "editor",
      "auditor",
    ]);
  });

  it("reads nothing from a non-array", () => {
    expect(normalizeStringArray("editor")).toEqual([]);
    expect(normalizeStringArray(undefined)).toEqual([]);
  });
});

describe("normalizeUser", () => {
  it("maps a full record through", () => {
    expect(
      normalizeUser({
        itemId: "u-1",
        email: "jane@blocks.dev",
        firstName: "Jane",
        lastName: "Doe",
        active: true,
        isVerified: true,
        lastLoggedInTime: "2026-03-03T10:00:00Z",
        createdDate: "2026-03-01T09:00:00Z",
        roles: ["editor"],
        permissions: ["p-1", "p-2"],
      })
    ).toEqual({
      itemId: "u-1",
      email: "jane@blocks.dev",
      firstName: "Jane",
      lastName: "Doe",
      active: true,
      verified: true,
      lastLoggedInTime: "2026-03-03T10:00:00Z",
      createdDate: "2026-03-01T09:00:00Z",
      roles: ["editor"],
      permissions: ["p-1", "p-2"],
    });
  });

  it("reads the registry's org-keyed roles object", () => {
    expect(
      normalizeUser({
        itemId: "u-1",
        email: "jane@blocks.dev",
        active: true,
        roles: { default: ["data-viewer"] },
      })
    ).toMatchObject({ roles: ["data-viewer"], permissions: [] });
  });

  it("merges every org's arrays in the org-keyed form, deduped", () => {
    expect(
      normalizeUser({
        roles: { default: ["clouduser", "auditor"], hq: ["auditor", "viewer"] },
        permissions: { default: ["blocks-iam::iam::users"] },
      })
    ).toMatchObject({
      roles: ["clouduser", "auditor", "viewer"],
      permissions: ["blocks-iam::iam::users"],
    });
  });

  it("degrades a stranger record to defaults", () => {
    expect(normalizeUser({ roles: "editor", active: "yes" })).toEqual({
      itemId: "",
      email: "",
      firstName: "",
      lastName: "",
      active: false,
      verified: false,
      lastLoggedInTime: "",
      createdDate: "",
      roles: [],
      permissions: [],
    });
    expect(normalizeUser(null)).toEqual({
      itemId: "",
      email: "",
      firstName: "",
      lastName: "",
      active: false,
      verified: false,
      lastLoggedInTime: "",
      createdDate: "",
      roles: [],
      permissions: [],
    });
  });
});

describe("accUserDisplayName", () => {
  it("prefers the given name, then the address, then the id", () => {
    expect(accUserDisplayName({ ...normalizeUser(null), firstName: "Jane", lastName: "Doe" })).toBe("Jane Doe");
    expect(accUserDisplayName({ ...normalizeUser(null), email: "jane@blocks.dev" })).toBe("jane@blocks.dev");
    expect(accUserDisplayName({ ...normalizeUser(null), itemId: "u-1" })).toBe("u-1");
  });
});

describe("accUserStatus", () => {
  it("reads an unanswered activation mail as pending", () => {
    expect(accUserStatus(normalizeUser({ active: true }))).toBe("pending");
    expect(accUserStatus(normalizeUser({ active: true, isVerified: false }))).toBe("pending");
  });

  it("splits verified accounts by the live flag", () => {
    expect(accUserStatus(normalizeUser({ isVerified: true, active: true }))).toBe("active");
    expect(accUserStatus(normalizeUser({ isVerified: true, active: false }))).toBe("held");
  });
});

describe("byInviteRecency", () => {
  const row = (createdDate: string) => ({ ...normalizeUser(null), createdDate });

  it("puts the newest invite first", () => {
    const rows = [row("2026-03-01"), row("2026-03-09"), row("2026-03-05")].sort(byInviteRecency);
    expect(rows.map((user) => user.createdDate)).toEqual(["2026-03-09", "2026-03-05", "2026-03-01"]);
  });

  it("sinks absent and unreadable dates below every dated row", () => {
    const rows = [row(""), row("2026-03-09"), row("not-a-date")].sort(byInviteRecency);
    expect(rows.map((user) => user.createdDate)).toEqual(["2026-03-09", "", "not-a-date"]);
  });

  it("keeps the wire order among the undated", () => {
    const rows = [row("later"), row("")].sort(byInviteRecency);
    expect(rows.map((user) => user.createdDate)).toEqual(["later", ""]);
  });
});

describe("normalizeUserPage", () => {
  it("normalizes a full page", () => {
    const page = normalizeUserPage({ data: [{ itemId: "u-1", roles: ["editor"] }], totalCount: 9 }, 10);
    expect(page.users).toHaveLength(1);
    expect(page.users[0]?.roles).toEqual(["editor"]);
    expect(page.totalCount).toBe(9);
    expect(page.pageSize).toBe(10);
  });

  it("falls back when the envelope rides in half-empty", () => {
    expect(normalizeUserPage({}, 10)).toEqual({ users: [], totalCount: 0, pageSize: 10 });
    const page = normalizeUserPage({ data: [{ itemId: "u-1" }] }, 10);
    expect(page.totalCount).toBe(1);
  });
});

describe("normalizeRole / normalizePermission", () => {
  it("falls back through name → slug → itemId", () => {
    expect(normalizeRole({ itemId: "r-1", slug: "editor" }).name).toBe("editor");
    expect(normalizeRole({ itemId: "r-1" }).name).toBe("r-1");
  });

  it("falls back through name → resource → itemId", () => {
    expect(normalizePermission({ itemId: "p-1", resource: "dashboard::view" }).name).toBe("dashboard::view");
    expect(normalizePermission({ itemId: "p-1" }).name).toBe("p-1");
  });
});

describe("normalizeAssignableRoles", () => {
  it("reads a bare array", () => {
    expect(normalizeAssignableRoles([{ slug: "editor", name: "Editor" }])).toEqual([
      { itemId: "", name: "Editor", slug: "editor" },
    ]);
  });

  it("reads a { data } page and an { items } bundle", () => {
    expect(normalizeAssignableRoles({ data: [{ slug: "editor" }] })).toHaveLength(1);
    expect(normalizeAssignableRoles({ items: [{ slug: "viewer" }] })).toHaveLength(1);
  });

  it("reads the real { hierarchy, standalone } envelope, merged and deduped", () => {
    expect(
      normalizeAssignableRoles({
        hierarchy: [{ slug: "clouduser", name: "System User" }],
        standalone: [{ slug: "data-viewer", name: "Data Viewer" }],
      })
    ).toEqual([
      { itemId: "", name: "System User", slug: "clouduser" },
      { itemId: "", name: "Data Viewer", slug: "data-viewer" },
    ]);
    expect(
      normalizeAssignableRoles({
        hierarchy: [{ slug: "clouduser", name: "System User" }],
        standalone: [{ slug: "clouduser", name: "System User" }, { slug: "viewer" }],
      })
    ).toEqual([
      { itemId: "", name: "System User", slug: "clouduser" },
      { itemId: "", name: "viewer", slug: "viewer" },
    ]);
  });

  it("reads one side alone when the other is missing", () => {
    expect(normalizeAssignableRoles({ hierarchy: [{ slug: "clouduser" }] })).toHaveLength(1);
    expect(normalizeAssignableRoles({ standalone: [{ slug: "viewer" }] })).toHaveLength(1);
  });

  it("reads nothing from garbage", () => {
    expect(normalizeAssignableRoles("editor")).toEqual([]);
    expect(normalizeAssignableRoles(undefined)).toEqual([]);
  });
});

describe("permissionForms", () => {
  it("covers every reference form a file might carry", () => {
    expect(
      permissionForms(
        normalizePermission({
          itemId: "p-1",
          name: "View Users",
          resource: "blocks-iam::iam::users",
        })
      )
    ).toEqual(["p-1", "View Users", "blocks-iam::iam::users"]);
  });

  it("drops the forms the catalog left empty", () => {
    expect(permissionForms(normalizePermission({ itemId: "p-1" }))).toEqual(["p-1"]);
  });
});

// One tick's staged form: the resource string — what the platform's
// own console transmits and what reads back as itself on the user's
// authorization list. An id-staged tick would come back as a raw
// GUID chip, since the gateway stores a grant verbatim.
describe("permissionRef", () => {
  it("stages the resource string when the catalog answers with one", () => {
    expect(
      permissionRef(
        normalizePermission({
          itemId: "p-1",
          name: "View Users",
          resource: "blocks-iam::iam::users",
        })
      )
    ).toBe("blocks-iam::iam::users");
  });

  it("falls back to the display name when no resource came", () => {
    expect(permissionRef(normalizePermission({ itemId: "p-1", name: "View Users" }))).toBe("View Users");
  });

  it("falls back to the id only as the last resort", () => {
    expect(permissionRef(normalizePermission({ itemId: "p-1" }))).toBe("p-1");
  });

  it("reads as empty when the catalog left every form blank", () => {
    expect(permissionRef(normalizePermission({}))).toBe("");
  });
});

describe("computeAccessDelta", () => {
  it("reports additions in sorted order", () => {
    const delta = computeAccessDelta(["viewer"], [], ["viewer", "editor", "auditor"], []);
    expect(delta).toEqual({
      addedRoles: ["auditor", "editor"],
      removedRoles: [],
      addedPermissions: [],
      removedPermissions: [],
    });
  });

  it("reports removals", () => {
    const delta = computeAccessDelta(["viewer", "editor"], ["p-1", "p-2"], ["viewer"], ["p-2"]);
    expect(delta.removedRoles).toEqual(["editor"]);
    expect(delta.removedPermissions).toEqual(["p-1"]);
    expect(delta.addedRoles).toEqual([]);
    expect(delta.addedPermissions).toEqual([]);
  });

  it("reports a no-op as four empty arrays", () => {
    const delta = computeAccessDelta(["viewer"], ["p-1"], ["viewer"], ["p-1"]);
    expect(delta).toEqual({
      addedRoles: [],
      removedRoles: [],
      addedPermissions: [],
      removedPermissions: [],
    });
  });

  it("survives duplicates in the desired sets", () => {
    const delta = computeAccessDelta([], [], ["editor", "editor"], ["p-1", "p-1"]);
    expect(delta.addedRoles).toEqual(["editor"]);
    expect(delta.addedPermissions).toEqual(["p-1"]);
  });
});

describe("fetchUsers", () => {
  it("sends the zero-based paged read body and normalizes the page", async () => {
    const usersList = vi.fn().mockResolvedValue({ data: [{ itemId: "u-1", active: true }], totalCount: 1 });
    const page = await fetchUsers(fakeClient({ usersList }), {
      pageNo: 2,
      pageSize: 10,
      search: "  jane  ",
    });
    // the wire's shape: term under filter (name column — no @ in it),
    // page counted from zero
    expect(usersList).toHaveBeenCalledWith({ filter: { name: "jane" }, page: 1, pageSize: 10 });
    expect(page.totalCount).toBe(1);
    expect(page.users[0]?.active).toBe(true);
  });

  it("sweeps the email column when the term is address-shaped", async () => {
    const usersList = vi.fn().mockResolvedValue({ data: [], totalCount: 0 });
    await fetchUsers(fakeClient({ usersList }), { pageNo: 1, pageSize: 10, search: "jane@x.io" });
    expect(usersList).toHaveBeenCalledWith({ filter: { email: "jane@x.io" }, page: 0, pageSize: 10 });
  });

  it("rides the blank filter when the sweep is empty", async () => {
    const usersList = vi.fn().mockResolvedValue({ data: [], totalCount: 0 });
    await fetchUsers(fakeClient({ usersList }), { pageNo: 1, pageSize: 10, search: "   " });
    expect(usersList).toHaveBeenCalledWith({ filter: {}, page: 0, pageSize: 10 });
  });
});

describe("fetchUser", () => {
  it("reads the operative out of the { data } envelope", async () => {
    const usersGet = vi.fn().mockResolvedValue({ data: { itemId: "u-1", roles: ["editor"] } });
    const user = await fetchUser(fakeClient({ usersGet }), "u-1");
    expect(usersGet).toHaveBeenCalledWith("u-1");
    expect(user.itemId).toBe("u-1");
    expect(user.roles).toEqual(["editor"]);
  });
});

describe("fetchAssignableRoles", () => {
  it("reads the { data } page the assignable call rides", async () => {
    const assignable = vi.fn().mockResolvedValue({ data: [{ itemId: "r-1", slug: "editor", name: "Editor" }] });
    const roles = await fetchAssignableRoles(fakeClient({ assignable }));
    expect(roles).toEqual([{ itemId: "r-1", name: "Editor", slug: "editor" }]);
  });
});

describe("normalizeRoleDef / normalizeRolePage", () => {
  it("maps a registry row through", () => {
    expect(
      normalizeRoleDef({
        itemId: "r-1",
        name: "Data Viewer",
        slug: "data-viewer",
        description: "read-only",
        count: 93,
        canCreateOwn: false,
        isArchived: false,
      })
    ).toEqual({
      itemId: "r-1",
      name: "Data Viewer",
      slug: "data-viewer",
      description: "read-only",
      permissionCount: 93,
      canCreateOwn: false,
      isArchived: false,
    });
  });

  it("falls back through name → slug → itemId and degrades to defaults", () => {
    expect(normalizeRoleDef({ itemId: "r-1", slug: "editor" }).name).toBe("editor");
    expect(normalizeRoleDef({ itemId: "r-1" }).name).toBe("r-1");
    expect(normalizeRoleDef("garbage")).toEqual({
      itemId: "",
      name: "",
      slug: "",
      description: "",
      permissionCount: 0,
      canCreateOwn: false,
      isArchived: false,
    });
  });

  it("normalizes a registry page with the same fallbacks as the users page", () => {
    const page = normalizeRolePage({ data: [{ slug: "editor", count: 4 }], totalCount: 7 }, 10);
    expect(page.roles).toHaveLength(1);
    expect(page.roles[0]?.permissionCount).toBe(4);
    expect(page.totalCount).toBe(7);
    expect(normalizeRolePage({}, 10)).toEqual({ roles: [], totalCount: 0, pageSize: 10 });
  });
});

describe("fetchRoles", () => {
  it("sends the zero-based paged read body and normalizes the page", async () => {
    const rolesList = vi.fn().mockResolvedValue({
      data: [{ itemId: "r-1", slug: "editor", count: 4 }],
      totalCount: 1,
    });
    const page = await fetchRoles(fakeClient({ rolesList }), {
      pageNo: 2,
      pageSize: 10,
      search: "  edi  ",
    });
    expect(rolesList).toHaveBeenCalledWith({ filter: { search: "edi" }, page: 1, pageSize: 10 });
    expect(page.totalCount).toBe(1);
    expect(page.roles[0]?.slug).toBe("editor");
  });

  it("sends the blank search the wire demands when the sweep is empty", async () => {
    const rolesList = vi.fn().mockResolvedValue({ data: [], totalCount: 0 });
    await fetchRoles(fakeClient({ rolesList }), { pageNo: 1, pageSize: 10, search: "   " });
    expect(rolesList).toHaveBeenCalledWith({ filter: { search: "" }, page: 0, pageSize: 10 });
  });
});

describe("fetchRolePermissions", () => {
  it("walks the pages until the held set is whole", async () => {
    const permissionsList = vi
      .fn()
      .mockResolvedValueOnce({
        data: [{ itemId: "p-1", name: "One" }, { itemId: "p-2", name: "Two" }],
        totalCount: 3,
      })
      .mockResolvedValueOnce({ data: [{ itemId: "p-3", name: "Three" }], totalCount: 3 });
    const held = await fetchRolePermissions(fakeClient({ permissionsList }), "data-viewer");
    expect(permissionsList).toHaveBeenCalledTimes(2);
    expect(permissionsList).toHaveBeenNthCalledWith(1, {
      filter: { search: "", isBuiltIn: "" },
      page: 0,
      pageSize: 200,
      roles: ["data-viewer"],
    });
    expect(permissionsList).toHaveBeenNthCalledWith(2, {
      filter: { search: "", isBuiltIn: "" },
      page: 1,
      pageSize: 200,
      roles: ["data-viewer"],
    });
    expect(held.map((perm) => perm.itemId)).toEqual(["p-1", "p-2", "p-3"]);
  });

  it("stops after one read when the page came back short", async () => {
    const permissionsList = vi.fn().mockResolvedValue({ data: [{ itemId: "p-1" }], totalCount: 1 });
    const held = await fetchRolePermissions(fakeClient({ permissionsList }), "editor");
    expect(permissionsList).toHaveBeenCalledTimes(1);
    expect(held).toHaveLength(1);
  });

  it("caps the walk at five pages and dedupes whatever repeats", async () => {
    const permissionsList = vi.fn().mockResolvedValue({
      data: [{ itemId: "p-1", name: "One" }, { itemId: "p-1", name: "One" }],
      totalCount: 5000,
    });
    const held = await fetchRolePermissions(fakeClient({ permissionsList }), "clouduser");
    expect(permissionsList).toHaveBeenCalledTimes(5);
    expect(held).toHaveLength(1);
  });

  it("reads nothing when the walk comes back empty", async () => {
    const permissionsList = vi.fn().mockResolvedValue({ data: [], totalCount: 0 });
    const held = await fetchRolePermissions(fakeClient({ permissionsList }), "lonely");
    expect(held).toEqual([]);
  });
});

describe("fetchPermissions", () => {
  it("sends the zero-based paged filter body and normalizes the page", async () => {
    const permissionsList = vi.fn().mockResolvedValue({
      data: [{ itemId: "p-1", name: "View Users", resource: "blocks-iam::iam::users", type: 1, isBuiltIn: true }],
      totalCount: 171,
    });
    const page = await fetchPermissions(fakeClient({ permissionsList }), {
      pageNo: 3,
      pageSize: 50,
      search: "  view  ",
    });
    expect(permissionsList).toHaveBeenCalledWith({
      filter: { search: "view", isBuiltIn: "" },
      page: 2,
      pageSize: 50,
    });
    expect(page.totalCount).toBe(171);
    expect(page.permissions[0]?.name).toBe("View Users");
    expect(page.permissions[0]?.kind).toBe("endpoint");
  });

  it("rides the blank filter when the sweep is empty", async () => {
    const permissionsList = vi.fn().mockResolvedValue({ data: [], totalCount: 0 });
    await fetchPermissions(fakeClient({ permissionsList }), { pageNo: 1, pageSize: 50, search: "   " });
    expect(permissionsList).toHaveBeenCalledWith({
      filter: { search: "", isBuiltIn: "" },
      page: 0,
      pageSize: 50,
    });
  });
});

describe("createRole", () => {
  it("sends the name and the optionals that ride", async () => {
    const rolesCreate = vi.fn().mockResolvedValue({});
    await createRole(fakeClient({ rolesCreate }), {
      name: "Editor",
      slug: "editor",
      description: "content",
    });
    expect(rolesCreate).toHaveBeenCalledTimes(1);
    expect(rolesCreate).toHaveBeenCalledWith({ name: "Editor", slug: "editor", description: "content" });
  });

  it("leaves the absent optionals out of the body, not empty", async () => {
    const rolesCreate = vi.fn().mockResolvedValue({});
    await createRole(fakeClient({ rolesCreate }), { name: "Editor" });
    expect(rolesCreate).toHaveBeenCalledWith({ name: "Editor" });
    const body = rolesCreate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect("slug" in body).toBe(false);
    expect("description" in body).toBe(false);
  });

  it("propagates a refusal", async () => {
    const rolesCreate = vi.fn().mockRejectedValue(new Error("403"));
    await expect(createRole(fakeClient({ rolesCreate }), { name: "X" })).rejects.toThrow("403");
  });
});

describe("assignRolePermissions", () => {
  it("sends the delta on the slug, exactly once", async () => {
    const assignPermissions = vi.fn().mockResolvedValue({});
    await assignRolePermissions(fakeClient({ assignPermissions }), {
      slug: "editor",
      addPermissions: ["p-1", "p-2"],
      removePermissions: ["p-3"],
    });
    expect(assignPermissions).toHaveBeenCalledTimes(1);
    expect(assignPermissions).toHaveBeenCalledWith({
      slug: "editor",
      addPermissions: ["p-1", "p-2"],
      removePermissions: ["p-3"],
    });
  });

  it("sends copies, so later staging cannot bend the in-flight request", async () => {
    const assignPermissions = vi.fn().mockResolvedValue({});
    const addPermissions = ["p-1"];
    const removePermissions = ["p-2"];
    const pending = assignRolePermissions(fakeClient({ assignPermissions }), {
      slug: "editor",
      addPermissions,
      removePermissions,
    });
    addPermissions.push("p-9");
    removePermissions.push("p-8");
    await pending;
    expect(assignPermissions).toHaveBeenCalledWith({
      slug: "editor",
      addPermissions: ["p-1"],
      removePermissions: ["p-2"],
    });
  });

  it("propagates a refusal", async () => {
    const assignPermissions = vi.fn().mockRejectedValue(new Error("403"));
    await expect(
      assignRolePermissions(fakeClient({ assignPermissions }), {
        slug: "editor",
        addPermissions: [],
        removePermissions: [],
      })
    ).rejects.toThrow("403");
  });
});

describe("fetchEmailAvailable", () => {
  it("reads the answer off the envelope", async () => {
    const emailAvailable = vi.fn().mockResolvedValue({ isAvailable: true });
    await expect(fetchEmailAvailable(fakeClient({ emailAvailable }), "jane@blocks.dev")).resolves.toBe(true);
    expect(emailAvailable).toHaveBeenCalledWith({ email: "jane@blocks.dev" });
  });

  it("reads a taken address as unavailable", async () => {
    const emailAvailable = vi.fn().mockResolvedValue({ isAvailable: false });
    await expect(fetchEmailAvailable(fakeClient({ emailAvailable }), "jane@blocks.dev")).resolves.toBe(false);
  });

  it("reads a stranger answer as unavailable, never as free", async () => {
    const emailAvailable = vi.fn().mockResolvedValue("yes");
    await expect(fetchEmailAvailable(fakeClient({ emailAvailable }), "jane@blocks.dev")).resolves.toBe(false);
  });

  it("propagates a refusal", async () => {
    const emailAvailable = vi.fn().mockRejectedValue(new Error("500"));
    await expect(fetchEmailAvailable(fakeClient({ emailAvailable }), "jane@blocks.dev")).rejects.toThrow("500");
  });
});

describe("createUser", () => {
  it("sends the address with the optionals that ride", async () => {
    const usersCreate = vi.fn().mockResolvedValue({});
    await createUser(fakeClient({ usersCreate }), {
      email: "jane@blocks.dev",
      firstName: "Jane",
      lastName: "Doe",
      password: "s3cret",
      roles: ["editor", "viewer"],
    });
    expect(usersCreate).toHaveBeenCalledTimes(1);
    expect(usersCreate).toHaveBeenCalledWith({
      email: "jane@blocks.dev",
      firstName: "Jane",
      lastName: "Doe",
      password: "s3cret",
      roles: ["editor", "viewer"],
    });
  });

  it("leaves absent optionals out of the body — an empty password means activation mail", async () => {
    const usersCreate = vi.fn().mockResolvedValue({});
    await createUser(fakeClient({ usersCreate }), { email: "jane@blocks.dev" });
    const body = usersCreate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(usersCreate).toHaveBeenCalledWith({ email: "jane@blocks.dev" });
    expect("firstName" in body).toBe(false);
    expect("lastName" in body).toBe(false);
    expect("password" in body).toBe(false);
    expect("roles" in body).toBe(false);
  });

  it("sends roles as a copy, so later staging cannot bend the in-flight request", async () => {
    const usersCreate = vi.fn().mockResolvedValue({});
    const roles = ["editor"];
    const pending = createUser(fakeClient({ usersCreate }), { email: "jane@blocks.dev", roles });
    roles.push("viewer");
    await pending;
    expect(usersCreate).toHaveBeenCalledWith({ email: "jane@blocks.dev", roles: ["editor"] });
  });

  it("propagates a refusal", async () => {
    const usersCreate = vi.fn().mockRejectedValue(new Error("403"));
    await expect(createUser(fakeClient({ usersCreate }), { email: "x@y.dev" })).rejects.toThrow("403");
  });
});

describe("updateUserAccess", () => {
  it("sends both complete sets, exactly once", async () => {
    const updateAccess = vi.fn().mockResolvedValue({});
    await updateUserAccess(fakeClient({ updateAccess }), {
      userId: "u-1",
      roles: ["editor"],
      permissions: ["p-1", "p-2"],
    });
    expect(updateAccess).toHaveBeenCalledTimes(1);
    expect(updateAccess).toHaveBeenCalledWith({ userId: "u-1", roles: ["editor"], permissions: ["p-1", "p-2"] });
  });

  it("sends copies, so later staging cannot bend the in-flight request", async () => {
    const updateAccess = vi.fn().mockResolvedValue({});
    const roles = ["editor"];
    const permissions = ["p-1"];
    const pending = updateUserAccess(fakeClient({ updateAccess }), { userId: "u-1", roles, permissions });
    roles.push("viewer");
    permissions.push("p-2");
    await pending;
    expect(updateAccess).toHaveBeenCalledWith({ userId: "u-1", roles: ["editor"], permissions: ["p-1"] });
  });

  it("propagates a refusal", async () => {
    const updateAccess = vi.fn().mockRejectedValue(new Error("403"));
    await expect(
      updateUserAccess(fakeClient({ updateAccess }), { userId: "u-1", roles: [], permissions: [] })
    ).rejects.toThrow("403");
  });
});

// The transmission for a desired set that bottoms out empty: the plain
// write keeps a list that arrives empty ("a member never rides with
// nothing"), so the last grant only moves through a revoke and an
// immediate re-grant of exactly what the operator kept.
describe("clearUserAccessOverrides", () => {
  it("revokes first, silently, then re-grants what stays — also silently", async () => {
    const revokeAccess = vi.fn().mockResolvedValue({});
    const updateAccess = vi.fn().mockResolvedValue({});
    await clearUserAccessOverrides(fakeClient({ revokeAccess, updateAccess }), {
      userId: "u-1",
      roles: ["data-viewer"],
      permissions: [],
    });
    expect(revokeAccess).toHaveBeenCalledTimes(1);
    expect(revokeAccess).toHaveBeenCalledWith({ userId: "u-1", notifyUser: false });
    expect(updateAccess).toHaveBeenCalledTimes(1);
    expect(updateAccess).toHaveBeenCalledWith({
      userId: "u-1",
      roles: ["data-viewer"],
      permissions: [],
      notifyUser: false,
    });
  });

  it("rides revoke before re-grant — a refusal on the revoke leaves nothing re-granted", async () => {
    const calls: string[] = [];
    const revokeAccess = vi.fn().mockImplementation(async () => {
      calls.push("revoke");
    });
    const updateAccess = vi.fn().mockImplementation(async () => {
      calls.push("regrant");
    });
    await clearUserAccessOverrides(fakeClient({ revokeAccess, updateAccess }), {
      userId: "u-1",
      roles: [],
      permissions: ["p-1"],
    });
    expect(calls).toEqual(["revoke", "regrant"]);

    const refused = vi.fn().mockRejectedValue(new Error("You cannot revoke your own access"));
    await expect(
      clearUserAccessOverrides(fakeClient({ revokeAccess: refused, updateAccess }), {
        userId: "u-1",
        roles: [],
        permissions: [],
      })
    ).rejects.toThrow("You cannot revoke your own access");
  });
});
