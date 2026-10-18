// The dossier's own registry window: the operatives this tenant
// holds, newest invite first, each wearing the registry's own status
// — the activation flag splits the still-pending invitations from
// the ones already through the door. The gate lives one level up:
// the dossier renders this window only for an operative whose own
// clearance carries the registry's read grant. A row's access file
// opens one level up too — this window's chamfer clips everything
// painted inside it, and a fixed overlay must not ride in a clipped
// box — so a row only reports the id upward and the dossier hosts
// the editor.

import { useRouterNavigate } from "../../app/router/RouterContext";
import { Skeleton } from "../../shared/ui/Skeleton";
import { accUserDisplayName, accUserStatus, byInviteRecency, type AccUser } from "./consoleApi";
import { useAccessUsers } from "./useAccess";

const MAX_ROWS = 8;

/** the invite moment as the wire told it, compact — an absent or
 *  unreadable date reads as a dash, never a fabricated one */
function inviteMoment(raw: string): string {
  if (!raw) return "—";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

const STATUS_TEXT = { pending: "PENDING", active: "ACTIVE", held: "HELD" } as const;
const STATUS_CLASS = { pending: "is-pending", active: "is-good", held: "is-warn" } as const;

export function InvitedOperativesPanel({ onOpenFile }: { onOpenFile: (userId: string) => void }) {
  const navigate = useRouterNavigate();
  const users = useAccessUsers({ pageNo: 1, pageSize: MAX_ROWS });
  const totalCount = users.data?.totalCount ?? 0;
  const rows = [...(users.data?.users ?? [])].sort(byInviteRecency);
  const overflow = totalCount - rows.length;

  return (
    <section className="acct-invited" aria-label="Invited operatives">
      <div className="acct-invited-head">
        <h3 className="acct-panel-head">Invited operatives — {totalCount} on file</h3>
        <button
          type="button"
          className="acct-invited-link"
          onClick={() => navigate("/access")}
          title="Open the access console"
        >
          FULL REGISTRY{overflow > 0 ? ` · +${overflow} MORE` : ""} →
        </button>
      </div>

      {users.isLoading ? (
        <>
          {[0, 1].map((row) => (
            <div key={row} className="acc-row acc-row-skeleton">
              <Skeleton className="skeleton-line" />
            </div>
          ))}
        </>
      ) : users.isError ? (
        <p className="acct-invited-empty">Registry out of reach — the full console holds the retry.</p>
      ) : rows.length === 0 ? (
        <p className="acct-invited-empty">
          No operatives on file yet — the first invite writes the first line.
        </p>
      ) : (
        rows.map((user) => (
          <InvitedRow
            key={user.itemId || user.email}
            user={user}
            onOpen={() => onOpenFile(user.itemId)}
          />
        ))
      )}
    </section>
  );
}

/** one operative line: the identity block (the invite moment and the
 *  signal address), the clearance chips, the registry's own status
 *  word, and the door into the access file — reported upward, since
 *  the editor itself lives outside this clipped window */
function InvitedRow({ user, onOpen }: { user: AccUser; onOpen: () => void }) {
  const status = accUserStatus(user);
  return (
    <div className="acc-row">
      <div className="acc-row-id">
        <span className="acc-row-name">{accUserDisplayName(user) || "Unknown operative"}</span>
        <span className="acc-row-email">
          invited {inviteMoment(user.createdDate)} · {user.email || "no signal address"}
        </span>
      </div>
      <div className="acct-chips acc-row-chips">
        {user.roles.slice(0, 3).map((role) => (
          <span key={role} className="acct-chip">
            {role}
          </span>
        ))}
        {user.roles.length > 3 && <span className="acct-chip">+{user.roles.length - 3}</span>}
        {user.roles.length === 0 && <span className="acct-empty">no roles</span>}
      </div>
      <span className={`acc-row-status ${STATUS_CLASS[status]}`}>
        <i aria-hidden />
        {STATUS_TEXT[status]}
      </span>
      <button type="button" className="acc-row-open" disabled={!user.itemId} onClick={onOpen}>
        Open file
      </button>
    </div>
  );
}
