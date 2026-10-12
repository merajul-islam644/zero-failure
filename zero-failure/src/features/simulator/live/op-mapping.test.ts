// Live connector ground rules: the operation map is total over every
// SDK-backed platform's operations, refusals (LIVE_READ_ONLY) provably never
// touch the client, and live error classification stays honest — timeouts,
// permission denials and transport failures each record what actually
// happened, never a faked success.

import { describe, expect, it, vi } from "vitest";
import { BlocksApiError, type BlocksClient } from "@seliseblocks/client";
import { PLATFORMS } from "../script/cast";
import { OPERATIONS } from "../connectors/registry";
import { capabilityFor } from "./capabilities";
import { liveOpEntryFor, REFUSAL } from "./op-mapping";
import { createLiveConnector, createNoLiveApiConnector } from "../connectors/live/live-connector";
import type { OperationRequest } from "../engine/types";

const request = (operation: string): OperationRequest => ({
  runId: "RUN-TEST",
  correlationId: "c1",
  requestId: "c1#a1",
  operation,
  payload: {},
  idempotencyKey: "RUN-TEST:c1"
});

/**
 * A BlocksClient stand-in covering every namespace the live handlers touch.
 * Unconfigured methods throw — a handler must never reach one accidentally.
 */
function liveFakeClient(behavior: {
  userInfo?: () => Promise<unknown>;
  me?: () => Promise<unknown>;
  rolesList?: () => Promise<unknown>;
  schemasList?: () => Promise<unknown>;
  languages?: () => Promise<unknown>;
  translations?: () => Promise<unknown>;
  notifications?: () => Promise<unknown>;
} = {}): BlocksClient {
  const forbidden = (name: string) => () => Promise.reject(new Error(`${name} must not be called by this test`));
  return {
    auth: { userInfo: behavior.userInfo ?? forbidden("auth.userInfo") },
    iam: {
      me: behavior.me ?? forbidden("iam.me"),
      roles: { list: behavior.rolesList ?? forbidden("iam.roles.list") }
    },
    data: {
      schemas: { list: behavior.schemasList ?? forbidden("data.schemas.list") },
      objects: { list: forbidden("data.objects.list") }
    },
    localization: {
      languages: behavior.languages ?? forbidden("localization.languages"),
      translations: behavior.translations ?? forbidden("localization.translations")
    },
    notifier: { getNotifications: behavior.notifications ?? forbidden("notifier.getNotifications") }
  } as unknown as BlocksClient;
}

// The exhaustive refusal list — send-test-notification is the critical one:
// live mode must never be able to send a real notification.
const REFUSAL_KEYS = [
  "data-gateway:create-test-record",
  "data-gateway:read-test-record",
  "data-gateway:store-evidence-metadata",
  "storage:register-evidence-metadata",
  "utilities:send-test-notification"
];

describe("operation mapping totality", () => {
  it("maps every operation of every SDK-backed platform to a handler or refusal", () => {
    for (const platform of PLATFORMS) {
      const capability = capabilityFor(platform);
      for (const operation of OPERATIONS[platform]) {
        const entry = liveOpEntryFor(platform, operation.id);
        if (capability.kind === "sdk-read") {
          expect(entry, `${platform}:${operation.id}`).toBeDefined();
        } else {
          // No-live-api platforms never consult the map — their connector
          // short-circuits with NO_LIVE_API before any handler could run.
          expect(entry, `${platform}:${operation.id}`).toBeUndefined();
        }
      }
    }
  });

  it("refuses exactly the mutating operations — and only those", () => {
    const refused = PLATFORMS.flatMap((p) =>
      OPERATIONS[p].map((op) => [`${p}:${op.id}`, liveOpEntryFor(p, op.id)] as const)
    )
      .filter(([, entry]) => entry === REFUSAL)
      .map(([key]) => key)
      .sort();
    expect(refused).toEqual([...REFUSAL_KEYS].sort());
  });
});

describe("live connector against a working tenant", () => {
  it("mapped reads succeed with live, non-simulated responses", async () => {
    const connector = createLiveConnector({
      platform: "iam",
      displayName: "IAM",
      operations: OPERATIONS.iam,
      client: liveFakeClient({
        userInfo: async () => ({ email: "demo@example.test", sub: "u1" })
      })
    });
    const response = await connector.execute("authenticate-identity", request("authenticate-identity"));
    expect(response.status).toBe("succeeded");
    expect(response.mode).toBe("live");
    expect(response.simulated).toBe(false);
    expect(response.responseSummary).toContain("demo@example.test");
    expect(response.durationMs).toBeGreaterThan(0);
  });

  it("carries the real response values dialogue quotes", async () => {
    const connector = createLiveConnector({
      platform: "iam",
      displayName: "IAM",
      operations: OPERATIONS.iam,
      client: liveFakeClient({ userInfo: async () => ({ email: "demo@example.test", sub: "u1" }) })
    });
    const response = await connector.execute("authenticate-identity", request("authenticate-identity"));
    expect(response.data).toEqual({ user: "demo@example.test" });
  });

  it("the honest OS remap anchors the run to the live platform session", async () => {
    const connector = createLiveConnector({
      platform: "os",
      displayName: "OS",
      operations: OPERATIONS.os,
      client: liveFakeClient({ userInfo: async () => ({ email: "os@example.test", sub: "u9" }) })
    });
    const response = await connector.execute("manage-test-run", request("manage-test-run"));
    expect(response.status).toBe("succeeded");
    expect(response.responseSummary).toContain("os@example.test");
    expect(response.data).toEqual({ user: "os@example.test" });
  });

  it("the logic remap reads the live notifier feed", async () => {
    const connector = createLiveConnector({
      platform: "logic",
      displayName: "Logic",
      operations: OPERATIONS.logic,
      client: liveFakeClient({
        notifications: async () => ({ notifications: [], totalNotificationsCount: 9, unReadNotificationsCount: 0 })
      })
    });
    const response = await connector.execute("coordinate-step", request("coordinate-step"));
    expect(response.status).toBe("succeeded");
    expect(response.responseSummary).toContain("9");
    expect(response.data).toEqual({ notifications: 9 });
  });

  it("refused writes record LIVE_READ_ONLY without ever touching the client", async () => {
    const schemasList = vi.fn();
    const connector = createLiveConnector({
      platform: "data-gateway",
      displayName: "Data Gateway",
      operations: OPERATIONS["data-gateway"],
      client: liveFakeClient({ schemasList: schemasList as unknown as () => Promise<unknown> })
    });
    for (const operation of ["create-test-record", "read-test-record", "store-evidence-metadata"]) {
      const response = await connector.execute(operation, request(operation));
      expect(response.status, operation).toBe("failed");
      expect(response.errorDetails?.code, operation).toBe("LIVE_READ_ONLY");
      expect(response.errorDetails?.retriable, operation).toBe(false);
      expect(response.simulated, operation).toBe(false);
    }
    expect(schemasList).not.toHaveBeenCalled();
  });

  it("no-live-api platforms record NO_LIVE_API so dependency blocking stays honest", async () => {
    const connector = createNoLiveApiConnector({
      platform: "release",
      displayName: "Release Manager",
      operations: OPERATIONS.release
    });
    const response = await connector.execute("start-deployment-job", request("start-deployment-job"));
    expect(response.status).toBe("not-configured");
    expect(response.errorDetails?.code).toBe("NO_LIVE_API");
    expect(response.responseSummary).toContain("No live API");
    expect(response.mode).toBe("live");
    expect(response.simulated).toBe(false);
  });
});

describe("live error classification", () => {
  const connectorWith = (client: BlocksClient) =>
    createLiveConnector({
      platform: "data-gateway",
      displayName: "Data Gateway",
      operations: OPERATIONS["data-gateway"],
      client
    });

  it("permission failures record not-configured, never a fake success", async () => {
    for (const status of [401, 403]) {
      const response = await connectorWith(
        liveFakeClient({ schemasList: () => Promise.reject(new BlocksApiError(status, "Denied", {})) })
      ).execute("query-project-record", request("query-project-record"));
      expect(response.status, String(status)).toBe("not-configured");
      expect(response.errorDetails?.code, String(status)).toBe("LIVE_PERMISSION_DENIED");
    }
  });

  it("a missing block records LIVE_BLOCK_UNAVAILABLE", async () => {
    const response = await connectorWith(
      liveFakeClient({ schemasList: () => Promise.reject(new BlocksApiError(404, "Not Found", {})) })
    ).execute("query-project-record", request("query-project-record"));
    expect(response.status).toBe("not-configured");
    expect(response.errorDetails?.code).toBe("LIVE_BLOCK_UNAVAILABLE");
  });

  it("server errors are retriable API failures; client errors are not", async () => {
    const retryable = await connectorWith(
      liveFakeClient({ schemasList: () => Promise.reject(new BlocksApiError(500, "Server Error", {})) })
    ).execute("query-project-record", request("query-project-record"));
    expect(retryable.status).toBe("failed");
    expect(retryable.errorDetails?.code).toBe("LIVE_API_ERROR");
    expect(retryable.errorDetails?.retriable).toBe(true);

    const permanent = await connectorWith(
      liveFakeClient({ schemasList: () => Promise.reject(new BlocksApiError(400, "Bad Request", {})) })
    ).execute("query-project-record", request("query-project-record"));
    expect(permanent.errorDetails?.retriable).toBe(false);
  });

  it("transport failures record LIVE_TRANSPORT_ERROR", async () => {
    const response = await connectorWith(
      liveFakeClient({ schemasList: () => Promise.reject(new TypeError("Failed to fetch")) })
    ).execute("query-project-record", request("query-project-record"));
    expect(response.status).toBe("failed");
    expect(response.errorDetails?.code).toBe("LIVE_TRANSPORT_ERROR");
    expect(response.errorDetails?.retriable).toBe(true);
  });

  it("a hung live call records a real timed-out under the operation's own timeout", async () => {
    vi.useFakeTimers();
    try {
      const pending = connectorWith(
        liveFakeClient({ schemasList: () => new Promise(() => {}) })
      ).execute("isolated-timeout-probe", request("isolated-timeout-probe"));
      const check = expect(pending).resolves.toMatchObject({
        status: "timed-out",
        responseSummary: expect.stringContaining("Timed out after 800 ms"),
        simulated: false
      });
      // The probe operation's configured timeout is 800 ms.
      await vi.advanceTimersByTimeAsync(850);
      await check;
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("negative test stays meaningful live", () => {
  it("check-missing-key fails (denial is the pass) when the live dictionary lacks the probe key", async () => {
    const connector = createLiveConnector({
      platform: "localization",
      displayName: "Localization",
      operations: OPERATIONS.localization,
      client: liveFakeClient({
        languages: async () => [{ code: "en", isDefault: true }],
        translations: async () => ({ "existing.key": "translated" })
      })
    });
    const response = await connector.execute("check-missing-key", request("check-missing-key"));
    expect(response.status).toBe("failed");
    expect(response.errorDetails?.code).toBe("MISSING_KEY_DETECTED");
    expect(response.responseSummary).toContain("en");
    expect(response.data).toEqual({ language: "en", keysChecked: 1, keyPresent: false });
  });

  it("verify-idempotency-support succeeds by construction without any client call", async () => {
    const connector = createLiveConnector({
      platform: "utilities",
      displayName: "Utilities",
      operations: OPERATIONS.utilities,
      client: liveFakeClient()
    });
    const response = await connector.execute("verify-idempotency-support", request("verify-idempotency-support"));
    expect(response.status).toBe("succeeded");
    expect(response.responseSummary).toContain("by construction");
  });
});
