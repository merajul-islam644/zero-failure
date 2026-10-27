// The access-control sector: the account family's registry console.
// Every operative on file, one page at a sweep, each row opening its
// access file. Same full-display HUD as the dossier it answers to —
// deep sky, chamfered rails, the OPS tag — with the account rail's
// ACCT light carrying it.

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Search, UserPlus } from "lucide-react";
import { useRouterNavigate } from "../../app/router/RouterContext";
import { Skeleton } from "../../shared/ui/Skeleton";
import { DashboardRails } from "../dashboard/DashboardRails";
import { useCurrentUser } from "../profile/useCurrentUser";
import { accUserDisplayName } from "./consoleApi";
import { AccessEditorModal } from "./AccessEditorModal";
import { InviteUserModal } from "./InviteUserModal";
import { useAccessUsers } from "./useAccess";

const PAGE_SIZE = 10;

export function AccessConsolePage() {
  const navigate = useRouterNavigate();
  const me = useCurrentUser();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [editorUserId, setEditorUserId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [toast, setToast] = useState<{ key: number; text: string } | null>(null);

  const users = useAccessUsers({ pageNo: page, pageSize: PAGE_SIZE, search: search || undefined });

  // the sweep debounce: typing stages in the input; 300ms of quiet
  // commits the search and rewinds the registry to its first page
  useEffect(() => {
    if (searchInput === search) return;
    const id = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(id);
  }, [searchInput, search]);

  // the confirmation strip fades itself out
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const totalCount = users.data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const rows = users.data?.users ?? [];

  return (
    <div className="dash-space">
      <h1 className="sr-only">Access control</h1>
      <DashboardRails active="access">
        <div className="dash-topbar">
          <div className="dash-topbar-side">
            <span className="dash-topbar-tag">
              <i className="dash-live-dot" aria-hidden />
              OPS // ACCESS CONTROL
            </span>
          </div>
          <div className="dash-topbar-side">
            <button
              type="button"
              className="dash-back"
              aria-label="Back to the dossier"
              title="Back to the dossier"
              onClick={() => navigate("/account")}
            >
              <ArrowLeft size={15} aria-hidden />
            </button>
          </div>
        </div>

        <section className="acc-console" aria-label="Access control">
          <div className="acc-head">
            <div className="acc-head-title">
              <p className="dash-kicker">Access control</p>
              <h2>Operative registry</h2>
            </div>
            <div className="dash-shelf-scope acc-search">
              <Search className="dash-shelf-scope-icon" size={14} aria-hidden />
              <input
                className="dash-shelf-input"
                type="text"
                value={searchInput}
                placeholder="sweep by name or address…"
                aria-label="Search operatives"
                spellCheck={false}
                autoComplete="off"
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>
            <button
              type="button"
              className="dash-open rc-new"
              onClick={() => setInviteOpen(true)}
              title="Invite a new operative"
            >
              <UserPlus size={13} aria-hidden />
              New operative
            </button>
            <span className="acc-count">{totalCount} ON FILE</span>
          </div>

          <div className="acc-table">
            {users.isLoading ? (
              <>
                {[0, 1, 2, 3].map((row) => (
                  <div key={row} className="acc-row acc-row-skeleton">
                    <Skeleton className="skeleton-line" />
                  </div>
                ))}
              </>
            ) : users.isError ? (
              <div className="acc-empty acc-empty-panel">
                <h3>SIGNAL LOST</h3>
                <p>The registry refused this console's credentials — the files may sit above your clearance.</p>
                <button type="button" className="acc-row-open" onClick={() => void users.refetch()}>
                  Retry uplink
                </button>
              </div>
            ) : rows.length === 0 ? (
              <div className="acc-empty acc-empty-panel">
                <h3>NO OPERATIVES ON FILE</h3>
                <p>{search ? "The sweep came back empty — widen it." : "The registry holds no one yet."}</p>
              </div>
            ) : (
              rows.map((user) => (
                <div key={user.itemId || user.email} className="acc-row">
                  <div className="acc-row-id">
                    <span className="acc-row-name">{accUserDisplayName(user) || "Unknown operative"}</span>
                    <span className="acc-row-email">{user.email || "no signal address"}</span>
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
                  <span className={`acc-row-status${user.active ? " is-good" : " is-warn"}`}>
                    <i aria-hidden />
                    {user.active ? "ACTIVE" : "HELD"}
                  </span>
                  <button
                    type="button"
                    className="acc-row-open"
                    disabled={!user.itemId}
                    onClick={() => setEditorUserId(user.itemId)}
                  >
                    Open file
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="acc-pager">
            <button
              type="button"
              className="acc-pager-btn"
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ArrowLeft size={13} aria-hidden />
            </button>
            <span className="acc-pager-readout">
              PAGE {page}/{totalPages} · {totalCount} ON FILE
            </span>
            <button
              type="button"
              className="acc-pager-btn"
              aria-label="Next page"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              <ArrowRight size={13} aria-hidden />
            </button>
          </div>
        </section>
      </DashboardRails>

      {editorUserId && (
        <AccessEditorModal
          userId={editorUserId}
          meItemId={me.data?.data?.itemId}
          onClose={() => setEditorUserId(null)}
          onSaved={(text) => setToast({ key: Date.now(), text })}
        />
      )}

      {inviteOpen && (
        <InviteUserModal
          onClose={() => setInviteOpen(false)}
          onSaved={(text) => setToast({ key: Date.now(), text })}
        />
      )}

      {toast && (
        <div key={toast.key} className="dash-toast" role="status" aria-live="polite">
          <i className="dash-live-dot" aria-hidden />
          {toast.text}
        </div>
      )}
    </div>
  );
}
