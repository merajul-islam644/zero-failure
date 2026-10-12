// Live operation mapping: (platform, operation) → read-only SDK handler.
//
// The hard safety rule lives here: every mutating operation is "refused"
// before any client call exists to make. No code path in live mode can send
// a mail, create a record, or push a notification — the connector layer
// turns "refused" into a recorded failure (LIVE_READ_ONLY), never a real
// write. Entries are total over every operation of every SDK-backed
// platform (proven by op-mapping.test.ts); platforms without a live API
// never reach this map (the connector short-circuits them first).

import type { BlocksClient } from "@seliseblocks/client";
import type { ErrorDetails, OperationRequest } from "../engine/types";

export type LiveOpOutcome = {
  status: "succeeded" | "failed";
  responseSummary: string;
  errorDetails?: ErrorDetails;
  /** Real values read off the tenant response — dialogue quotes these. */
  data?: Record<string, unknown>;
};

export type LiveOpHandler = (client: BlocksClient, request: OperationRequest) => Promise<LiveOpOutcome>;

export type LiveOpEntry = LiveOpHandler | "refused";

/** A read-only refusal: the operation would mutate tenant data, so live mode records a failure instead. */
export const REFUSAL = "refused";

const readOnlyError = (operation: string): ErrorDetails => ({
  code: "LIVE_READ_ONLY",
  message: `Live mode never mutates tenant data: "${operation}" would create, send or store something real, so it was refused before any call was made.`,
  retriable: false
});

const firstLanguageCode = (languages: Array<Record<string, unknown>>): string | null => {
  const preferred = languages.find((l) => l.isDefault === true) ?? languages[0];
  if (!preferred) return null;
  const code = preferred.code ?? preferred.culture ?? preferred.languageCode;
  return typeof code === "string" && code.length > 0 ? code : null;
};

/** The key does not exist in any real dictionary — the missing-key negative test stays meaningful live. */
const DELIBERATELY_ABSENT_KEY = "simulator.probe.key-that-must-not-exist";

export const LIVE_OP_HANDLERS: Record<string, LiveOpEntry> = {
  // ---- os (sdk-read: the tenant's own session is the platform's live truth) ----
  "os:manage-test-run": async (client) => {
    const info = await client.auth.userInfo();
    const who = info.email ?? info.name ?? info.sub ?? "the signed-in user";
    return {
      status: "succeeded",
      responseSummary: `Live run anchored to the platform session of ${who}`,
      data: { user: who }
    };
  },

  // ---- logic (sdk-read: the notifier feed genuinely lives under /logic/v4) ----
  "logic:coordinate-step": async (client) => {
    const inbox = await client.notifier.getNotifications({ page: 1, pageSize: 1 });
    const count = inbox.totalNotificationsCount;
    return {
      status: "succeeded",
      responseSummary: `Live orchestration context read from the notifier feed (${count} notification(s) in the inbox)`,
      data: { notifications: count }
    };
  },

  // ---- iam (sdk-read) ----
  "iam:authenticate-identity": async (client) => {
    const info = await client.auth.userInfo();
    const who = info.email ?? info.name ?? info.sub ?? "the signed-in user";
    return {
      status: "succeeded",
      responseSummary: `Identity confirmed for ${who} via the live IAM session`,
      data: { user: who }
    };
  },
  "iam:authorize-operation": async (client) => {
    const me = await client.iam.me();
    const roles = me.data?.roles ?? [];
    return {
      status: "succeeded",
      responseSummary: `Access policy checked against the live session (${roles.length} role(s) assigned)`,
      data: { roles: roles.length }
    };
  },
  "iam:authorize-deployment-identity": async (client) => {
    const roles = await client.iam.roles.list({ pageNo: 1, pageSize: 5 });
    const total = roles.totalCount ?? roles.data?.length ?? 0;
    return {
      status: "succeeded",
      responseSummary: `Deployment identity checked against the live role directory (${total} role(s) visible)`,
      data: { roles: total }
    };
  },

  // ---- data-gateway (sdk-read) ----
  "data-gateway:query-project-record": async (client) => {
    const schemas = await client.data.schemas.list({ pageNo: 1, pageSize: 10 });
    const count = schemas.data?.totalCount ?? schemas.data?.items?.length ?? 0;
    // Honest divergence: this summary never claims "environment matches" —
    // the env-match assertion fails live unless a future API confirms it.
    return {
      status: "succeeded",
      responseSummary: `Live gateway read succeeded: ${count} schema(s) visible on this tenant`,
      data: { schemas: count }
    };
  },
  "data-gateway:create-test-record": REFUSAL,
  "data-gateway:read-test-record": REFUSAL, // nothing was created, so there is nothing to read back
  "data-gateway:load-translation-resources": async (client) => {
    const schemas = await client.data.schemas.list({ pageNo: 1, pageSize: 5 });
    const count = schemas.data?.totalCount ?? schemas.data?.items?.length ?? 0;
    return {
      status: "succeeded",
      responseSummary: `Live read succeeded: ${count} schema(s) reachable for resource loading`,
      data: { schemas: count }
    };
  },
  "data-gateway:isolated-timeout-probe": async (client) => {
    const schemas = await client.data.schemas.list({ pageNo: 1, pageSize: 1 });
    const count = schemas.data?.totalCount ?? schemas.data?.items?.length ?? 0;
    return {
      status: "succeeded",
      responseSummary: `Live probe responded: ${count} schema(s) visible (a slow tenant records a real timed-out)`,
      data: { schemas: count }
    };
  },
  "data-gateway:store-evidence-metadata": REFUSAL,

  // ---- utilities (sdk-read; its only live surface is a refused write) ----
  "utilities:verify-idempotency-support": async () => ({
    status: "succeeded",
    responseSummary:
      "Live mode refuses every write, so replays cannot duplicate side effects — idempotency holds by construction",
    data: { supported: true }
  }),
  "utilities:send-test-notification": REFUSAL, // critical: this would send a real notification

  // ---- localization (sdk-read) ----
  "localization:check-missing-key": async (client) => {
    const languages = await client.localization.languages();
    const language = firstLanguageCode(languages);
    if (!language) {
      return {
        status: "failed",
        responseSummary: "No languages configured on this tenant — the missing-key check could not run",
        errorDetails: { code: "LIVE_EMPTY_TENANT", message: "The tenant exposes no localization language.", retriable: false }
      };
    }
    const dictionary = await client.localization.translations("common", language);
    const present = Object.prototype.hasOwnProperty.call(dictionary, DELIBERATELY_ABSENT_KEY);
    const data = { language, keysChecked: Object.keys(dictionary).length, keyPresent: present };
    if (present) {
      return {
        status: "succeeded",
        responseSummary: "The deliberately absent key unexpectedly resolved against the live dictionary",
        data
      };
    }
    return {
      status: "failed",
      responseSummary: `Deliberately absent key is absent from the live ${language} dictionary (${data.keysChecked} keys checked)`,
      errorDetails: {
        code: "MISSING_KEY_DETECTED",
        message: "The negative test holds: the dictionary does not contain the probe key.",
        retriable: false
      },
      data
    };
  },

  // ---- storage (sdk-read) ----
  "storage:register-evidence-metadata": REFUSAL
};

export function liveOpEntryFor(platform: string, operation: string): LiveOpEntry | undefined {
  return LIVE_OP_HANDLERS[`${platform}:${operation}`];
}
