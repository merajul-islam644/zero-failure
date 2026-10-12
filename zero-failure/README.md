# zero-failure

Blocks starter app: React 18 + Vite + TypeScript, with a real hosted Blocks IAM login and a project-scoped profile page as the landing page.

Every Blocks API call in this app goes through [`@seliseblocks/client`](https://www.npmjs.com/package/@seliseblocks/client) via a single `createBlocksClient()` instance in `src/lib/blocks/client.ts` — there is no hand-written `fetch()` wrapper for Blocks endpoints anywhere in this app. Each SDK module is exercised in context rather than in one dedicated demo panel: `auth` in the hosted login flow, `iam` on the Profile page and user menu, and `localization` in `LocalizationProvider`. Add more pages under `src/features/` as your app needs them.

## Setup

```bash
npm install
npm run dev
```

`.env` already has working defaults for this project — you only need to fill in `VITE_BLOCKS_OIDC_CLIENT_ID` (see below) before login will work.

## Login setup (required)

This app signs users in directly against this project's tenant (no CLI-style account impersonation) through Blocks IAM's hosted IdP controller. Before login will work, register a **public** OIDC client for this app in Blocks IAM with:

- `redirect_uris`: EVERY origin the app is served from, each with `/login/callback` -- your dev origin, and each deployed URL. `blocks release setup` assigns a random-suffixed domain (find it via `blocks release repos list --json`, the `url` field), and until that origin's callback is registered the first login there fails with `redirect_uri_not_registered`; `blocks release deploy --register-callback` registers it for you.
- `client_type`: `public` (no client secret — this is a browser app and cannot keep one; this scaffold never asks for or ships a client secret).
- `tenant_id` used for login: this project's tenant (`VITE_BLOCKS_X_BLOCKS_KEY`).

Then set `VITE_BLOCKS_OIDC_CLIENT_ID` in `.env` to the new client's id. Until then, the login page shows a setup notice instead of failing silently.

## Testing login locally over HTTPS on the real project domain

Blocks SSO sets a **Secure, domain-scoped** session-related cookie as part of the OIDC exchange; browsers refuse to store or send that on plain `http://localhost`. To test the real login flow locally, run the dev server on the project's actual domain over HTTPS instead of `localhost`:

1. Find the app's registered Blocks domain in the Blocks OS project settings, or ask whoever created the project. It must match the OIDC redirect URI's host.
2. Point it at your machine — add to your hosts file (`/etc/hosts`, or `C:\Windows\System32\drivers\etc\hosts` as Administrator): `127.0.0.1  <domain>`.
3. Confirm `.env` has `VITE_BLOCKS_DEV_HOST=<domain>` (generated from `--app-domain`) and `VITE_BLOCKS_DEV_PORT=5173`.
4. Generate a local HTTPS cert for that exact domain: `npm run cert`. Trust it in your OS store to remove the browser warning (command printed by the script), then restart the browser.
5. `npm run dev` -> open `https://<domain>:<port>` (not `localhost`).
6. Register that exact origin's `/login/callback` as a redirect URI on the OIDC client — byte-for-byte, including the port.

`.cert/` is gitignored — each developer generates and trusts their own cert.

## Blocks Release deployment

The scaffold includes `Dockerfile` and `nginx.conf` for Blocks Release. The Release service must pass Docker build arg `ci_build=<environment>` plus the public `VITE_BLOCKS_*` build args documented in the Dockerfile. The generated `package.json` also provides `build:dev`, `build:test`, `build:stg`, `build:iat`, `build:uat`, `build:preprod`, `build:prodshadow`, and `build:prod` scripts for local checks.

During each environment build, `scripts/write-release-env.mjs` writes `dist/env.<environment>` from client-safe Docker build args or local `.env` files. Root `.env` remains gitignored and must not be committed.

## Synced viewing (Broadcast)

The simulator's Broadcast toggle (top bar) turns on a shared playback head: every signed-in viewer with Broadcast on watches the same story — same scenario, same mode, same play/pause, same rate, same position. There is no push channel in the Blocks SDK, so sync is a 4-second poll plus wall-clock projection (the head is extrapolated from the doc's `epochMs`, so followers stay frame-accurate between polls; drift beyond 400 ms is corrected, gently up to 2.5 s, then with a hard seek).

The room state lives in one Data Gateway document. To enable Broadcast on a tenant, create a collection named `broadcast_state` (Data Gateway → new collection) and make sure signed-in users have **read and write** permission on it. Until the collection exists — or the account lacks permission — the toggle stays available and the status line says exactly which gap was hit; sync never silently no-ops.

The document shape the app reads and writes (note: on the wire `epochMs` and `updatedAt` travel as **strings** — see the gateway facts below):

```json
{
  "epochMs": "1760250000000",
  "headMs": 42000,
  "playing": true,
  "rate": 1,
  "scenarioId": "default-storyline",
  "mode": "simulated",
  "updatedAt": "1760250000000",
  "updatedBy": "Jane Doe",
  "rev": 7
}
```

- `epochMs` — writer's wall clock (ms) when this state was authored; the projection origin. String-typed on the wire.
- `headMs` — the head position (timeline ms) at `epochMs`.
- `playing` / `rate` — transport state; `rate` is one of `0.5, 1, 2, 4, 8, 16`.
- `scenarioId` / `mode` — which story the head indexes into; followers switch to match.
- `updatedAt` — authoring timestamp, kept distinct from `epochMs` for diagnostics. String-typed on the wire.
- `updatedBy` — display name of the last writer only. No tokens, credentials, or emails are ever stored in this document.
- `rev` — writer count; every write bumps it so readers can order states and ignore their own echoes. Revs live and die with one row — when the room's row is replaced (e.g. maintenance deleted it and a tab re-created it), readers detect the new `ItemId` and re-baseline their rev memory, so a fresh row starting at `rev: 1` is followed even by a tab that once saw `rev: 104`.

Any document that fails validation (wrong types, negative head, unknown mode) is ignored by every viewer — a bad write disables sync for that reader rather than corrupting playback. Live mode remains read-only throughout: Broadcast coordinates *viewing* only, it never performs story operations on tenant data.

### Narration rhythm is the presenter's

With narration on, the audiobook pauses the story at every dialogue line and resumes after. Publishing each of those pauses from *every* playing tab would make two tabs fight over the room's rhythm — 4-second polls cannot phase-lock two speech engines, and the room's play/pause would flip-flop at every line. So narration pauses/resumes are published **only by the presenting tab** (the doc is empty, or `updatedBy` is this viewer's display name), and never from a hidden tab (browsers interrupt hidden-tab audio every few seconds; that churn stays local).

Two known, accepted limitations:

- **Two tabs of the *same* user both pass the presenter gate** (the doc carries display names, not accounts), so they can still fight each other's narration rhythm. Distinct users in a room are calm.
- A follower running its own narration may occasionally hear a line cut short when the room re-syncs — a local artifact of the reconcile pause, not a desync.

### Data Gateway facts this feature depends on

Learned the hard way against `blocksapi.slsblx.com` — worth knowing before touching the collection:

- **The gateway wraps every collection payload** as `{ data: { <op><Schema>s: … } }` — e.g. `data.getbroadcast_states.items`, `data.insertbroadcast_state.itemId`. The SDK's HTTP layer returns that body verbatim; the app unwraps it defensively.
- **The SDK's default field selection is `ItemId` only.** Reads must pass an explicit `fields` list, or nothing parses.
- **Numeric writes are 32-bit.** A ms epoch (~1.7e12) overflows the numeric write path into a masked "Unexpected Execution Error" — hence `epochMs`/`updatedAt` as strings; `headMs`, `rate` and `rev` (small floats) stay numeric.
- **Deletes are `mutation { deletebroadcast_state(where: { ItemId: { eq: "<id>" } }, input: { isHardDelete: true }) { acknowledged } }`** — soft delete is the default without `isHardDelete`. Multiple aliased delete fields in **one** mutation document (`d1: deletebroadcast_state(…) d2: deletebroadcast_state(…) …`) commit in a single request — how a 24-row cleanup became one call.
- **The physical collection is named `blx_broadcast_states`** (`blx_{SchemaName}s`); the schema/collection name the app and CLI use is `broadcast_state`.
- **`update` on a vanished row acknowledges with `totalImpactedData: 0`** — it does not error. The app treats impact 0 as "row gone under us" and falls through to a create, so the room always keeps a real document (unit-tested; exercised live after a cleanup).
- The Data app playground is handy for one-off record surgery, but its LB instance can serve a stale schema cache ("Field `getbroadcast_states` does not exist on type `Query`") while the app itself talks to a healthy instance — reload the playground or trust the app's own traffic before concluding the schema broke.

## What's included

- `/login` — login page (redirects to Blocks IAM).
- `/login/callback` — completes the hosted IAM callback via `blocksClient.auth.idp.callback()`, then returns to the page you started from.
- `/` and `/profile` — protected; redirect to `/login` when signed out.
- Sidebar + topbar shell matching the `@seliseblocks/blocks-kit` look (icon-only rail on narrow screens, avatar dropdown, notifications menu, active-item accent bar).
- `blocks/localization/*.en.json` local i18n seed files for AI or human edits. Sync them through `blocks localization validate` and `blocks localization push`; the runtime app reads Localization service data through `blocksClient.localization`.

IAM's hosted login sets the session as a **Secure, httpOnly** cookie by default -- this app never reads, stores, or refreshes a token itself. "Signed in" is determined by calling `blocksClient.auth.userInfo()` (`GET /iam/v4/auth/me`), which the browser's cookie authenticates automatically; this is different from `blocksClient.iam.me()`, the full IAM profile call used on the Profile page. Logging out calls `blocksClient.auth.logout()` so IAM ends the session server-side. A cached bearer token (and `blocksClient.auth.oidc.refreshToken()` to refresh it) is only used if a tenant's OIDC config explicitly returns tokens in the response body instead of a cookie.
