// Live-layer ground rules: the capability table stays total and in sync with
// the cast's PLATFORMS, probe errors classify honestly, and every probe maps
// a fake SDK response to the right LiveProbeState — including the timeout
// path (the SDK takes no AbortSignal, so a hung call must surface as
// "unreachable", never hang the poller).

import { describe, expect, it, vi } from "vitest";
import { BlocksApiError, type BlocksClient } from "@seliseblocks/client";
import { PLATFORMS } from "../script/cast";
import { CAPABILITIES, PLATFORM_FOR_PROBE } from "./capabilities";
import { classifyProbeError, PROBES, runAllProbes } from "./probes";
import { TimeoutError, withTimeout } from "./withTimeout";

describe("capability table", () => {
  it("covers every platform in the cast", () => {
    expect(Object.keys(CAPABILITIES).sort()).toEqual([...PLATFORMS].sort());
  });

  it("marks exactly the seven SDK-backed platforms as sdk-read", () => {
    const sdkRead = PLATFORMS.filter((p) => CAPABILITIES[p].kind === "sdk-read").sort();
    expect(sdkRead).toEqual(["data-gateway", "iam", "localization", "logic", "os", "storage", "utilities"]);
    const noLiveApi = PLATFORMS.filter((p) => CAPABILITIES[p].kind === "no-live-api").sort();
    expect(noLiveApi).toEqual(["ai-agent", "monitor", "release"]);
  });

  it("round-trips every probe key back to its platform", () => {
    for (const platform of PLATFORMS) {
      const capability = CAPABILITIES[platform];
      if (capability.kind === "sdk-read" && capability.probe) {
        expect(PLATFORM_FOR_PROBE[capability.probe]).toBe(platform);
      }
    }
  });

  it("leaves exactly one sdk-read platform without a probe — the refused-write one", () => {
    const probeless = PLATFORMS.filter(
      (p) => CAPABILITIES[p].kind === "sdk-read" && CAPABILITIES[p].probe === null
    );
    expect(probeless).toEqual(["utilities"]);
  });
});

describe("classifyProbeError", () => {
  it("reads permission failures as not-configured, not as an outage", () => {
    for (const status of [401, 403]) {
      expect(classifyProbeError(new BlocksApiError(status, "Error", {}))).toEqual({
        kind: "not-configured",
        reason: "Signed-in account lacks permission for this block"
      });
    }
  });

  it("reads 404 as a missing block on this tenant", () => {
    expect(classifyProbeError(new BlocksApiError(404, "Not Found", {}))).toEqual({
      kind: "not-configured",
      reason: "Block or collection not available on this tenant"
    });
  });

  it("reads other API statuses and transport failures as unreachable", () => {
    expect(classifyProbeError(new BlocksApiError(500, "Server Error", {}))).toEqual({
      kind: "unreachable",
      reason: "Blocks API error 500"
    });
    expect(classifyProbeError(new TypeError("Failed to fetch"))).toEqual({
      kind: "unreachable",
      reason: "Network or transport failure"
    });
    expect(classifyProbeError(new TimeoutError("probe iam-me timed out after 8000 ms"))).toEqual({
      kind: "unreachable",
      reason: "probe iam-me timed out after 8000 ms"
    });
  });
});

/** A minimal BlocksClient stand-in with configurable behavior per probe. */
function fakeClient(behavior: {
  userInfo?: () => Promise<unknown>;
  me?: () => Promise<unknown>;
  schemasList?: () => Promise<unknown>;
  languages?: () => Promise<unknown>;
  objectsList?: () => Promise<unknown>;
  notifications?: () => Promise<unknown>;
} = {}): BlocksClient {
  return {
    auth: { userInfo: behavior.userInfo ?? (async () => ({ email: "demo@example.test", sub: "u1" })) },
    iam: { me: behavior.me ?? (async () => ({ firstName: "Demo", lastName: "User", email: "demo@example.test" })) },
    data: {
      schemas: { list: behavior.schemasList ?? (async () => ({ data: { items: [{}], totalCount: 7 } })) },
      objects: { list: behavior.objectsList ?? (async () => ({ hasMore: false, items: [], totalChildCount: 3 })) }
    },
    localization: { languages: behavior.languages ?? (async () => [{ languageCode: "en" }, { languageCode: "bn" }]) },
    notifier: {
      getNotifications:
        behavior.notifications ?? (async () => ({ notifications: [], totalNotificationsCount: 12, unReadNotificationsCount: 1 }))
    }
  } as unknown as BlocksClient;
}

describe("probes against a working tenant", () => {
  it("each probe reports configured with a count-bearing detail", async () => {
    const client = fakeClient();
    await expect(PROBES["os-session"](client)).resolves.toMatchObject({
      status: "configured",
      detail: "Platform session live for demo@example.test"
    });
    await expect(PROBES["iam-me"](client)).resolves.toMatchObject({
      status: "configured",
      detail: "Session confirmed for Demo User"
    });
    await expect(PROBES["data-schemas"](client)).resolves.toMatchObject({
      status: "configured",
      detail: "7 data schemas visible"
    });
    await expect(PROBES["localization-languages"](client)).resolves.toMatchObject({
      status: "configured",
      detail: "2 languages configured"
    });
    await expect(PROBES["storage-objects"](client)).resolves.toMatchObject({
      status: "configured",
      detail: "3 storage objects at root"
    });
    await expect(PROBES["notifier-inbox"](client)).resolves.toMatchObject({
      status: "configured",
      detail: "12 notifications in inbox"
    });
  });

  it("singularizes counts of one", async () => {
    const client = fakeClient({
      schemasList: async () => ({ data: { items: [{}], totalCount: 1 } }),
      languages: async () => [{ languageCode: "en" }],
      objectsList: async () => ({ hasMore: false, items: [], totalChildCount: 1 }),
      notifications: async () => ({ notifications: [], totalNotificationsCount: 1, unReadNotificationsCount: 0 })
    });
    await expect(PROBES["data-schemas"](client)).resolves.toMatchObject({ detail: "1 data schema visible" });
    await expect(PROBES["localization-languages"](client)).resolves.toMatchObject({ detail: "1 language configured" });
    await expect(PROBES["storage-objects"](client)).resolves.toMatchObject({ detail: "1 storage object at root" });
    await expect(PROBES["notifier-inbox"](client)).resolves.toMatchObject({ detail: "1 notification in inbox" });
  });

  it("runAllProbes returns every key even when probes fail", async () => {
    const results = await runAllProbes(
      fakeClient({
        me: () => Promise.reject(new BlocksApiError(403, "Forbidden", {})),
        schemasList: () => Promise.reject(new TypeError("Failed to fetch"))
      })
    );
    expect(Object.keys(results).sort()).toEqual(
      ["data-schemas", "iam-me", "localization-languages", "notifier-inbox", "os-session", "storage-objects"].sort()
    );
    expect(results["iam-me"]).toMatchObject({ status: "not-configured" });
    expect(results["data-schemas"]).toMatchObject({ status: "unreachable" });
    expect(results["localization-languages"]).toMatchObject({ status: "configured" });
  });
});

describe("probe failure paths", () => {
  it("a permission failure classifies as not-configured", async () => {
    const client = fakeClient({ languages: () => Promise.reject(new BlocksApiError(403, "Forbidden", {})) });
    await expect(PROBES["localization-languages"](client)).resolves.toMatchObject({
      status: "not-configured",
      reason: "Signed-in account lacks permission for this block"
    });
  });

  it("a hung call resolves as unreachable once the probe deadline passes", async () => {
    vi.useFakeTimers();
    try {
      const client = fakeClient({ me: () => new Promise(() => {}) });
      const pending = PROBES["iam-me"](client);
      const check = expect(pending).resolves.toMatchObject({
        status: "unreachable",
        reason: expect.stringContaining("timed out")
      });
      // Probe timeout is 8s; step just past it.
      await vi.advanceTimersByTimeAsync(8_500);
      await check;
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("withTimeout", () => {
  it("lets a fast promise through and clears its timer", async () => {
    await expect(withTimeout(Promise.resolve("fast"), 1000)).resolves.toBe("fast");
  });

  it("rejects with a TimeoutError when the deadline wins", async () => {
    vi.useFakeTimers();
    try {
      const pending = withTimeout(new Promise<string>(() => {}), 500, "thing");
      const check = expect(pending).rejects.toBeInstanceOf(TimeoutError);
      await vi.advanceTimersByTimeAsync(501);
      await check;
    } finally {
      vi.useRealTimers();
    }
  });

  it("swallows a late rejection after the deadline (no unhandled rejection)", async () => {
    vi.useFakeTimers();
    try {
      const pending = withTimeout(
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error("late")), 1_000)),
        100,
        "thing"
      );
      const check = expect(pending).rejects.toBeInstanceOf(TimeoutError);
      await vi.advanceTimersByTimeAsync(1_100);
      await check;
    } finally {
      vi.useRealTimers();
    }
  });
});
