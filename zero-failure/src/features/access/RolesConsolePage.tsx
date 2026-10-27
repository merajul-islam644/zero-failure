// The role-control sector: the account family's definition console.
// Every role on file, one page at a sweep, each row opening its
// permission editor. Same full-display HUD as the registry it answers
// to — deep sky, chamfered rails, the OPS tag — with the account
// rail's ACCT light carrying it.

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Plus, Search } from "lucide-react";
import { useRouterNavigate } from "../../app/router/RouterContext";
import { Skeleton } from "../../shared/ui/Skeleton";
import { DashboardRails } from "../dashboard/DashboardRails";
import { RoleCreateModal } from "./RoleCreateModal";
import { RoleEditorModal } from "./RoleEditorModal";
import type { AccRoleDef } from "./consoleApi";
import { useAccessRoles } from "./useAccess";

const PAGE_SIZE = 10;

export function RolesConsolePage() {
  const navigate = useRouterNavigate();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [editorRole, setEditorRole] = useState<AccRoleDef | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [toast, setToast] = useState<{ key: number; text: string } | null>(null);

  const roles = useAccessRoles({ pageNo: page, pageSize: PAGE_SIZE, search: search || undefined });

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

  const totalCount = roles.data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const rows = roles.data?.roles ?? [];

  return (
    <div className="dash-space">
      <DashboardRails active="roles">
        <div className="dash-topbar">
          <div className="dash-topbar-side">
            <span className="dash-topbar-tag">
              <i className="dash-live-dot" aria-hidden />
              OPS // ROLE CONTROL
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

        <section className="acc-console" aria-label="Role control">
          <div className="acc-head">
            <div className="acc-head-title">
              <p className="dash-kicker">Role control</p>
              <h2>Role registry</h2>
            </div>
            <div className="dash-shelf-scope acc-search">
              <Search className="dash-shelf-scope-icon" size={14} aria-hidden />
              <input
                className="dash-shelf-input"
                type="text"
                value={searchInput}
                placeholder="sweep by name or slug…"
                aria-label="Search roles"
                spellCheck={false}
                autoComplete="off"
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>
            <button
              type="button"
              className="dash-open rc-new"
              onClick={() => setCreateOpen(true)}
              title="Define a new role"
            >
              <Plus size={13} aria-hidden />
              New role
            </button>
            <span className="acc-count">{totalCount} ON FILE</span>
          </div>

          <div className="acc-table">
            {roles.isLoading ? (
              <>
                {[0, 1, 2, 3].map((row) => (
                  <div key={row} className="acc-row acc-row-skeleton">
                    <Skeleton className="skeleton-line" />
                  </div>
                ))}
              </>
            ) : roles.isError ? (
              <div className="acc-empty acc-empty-panel">
                <h3>SIGNAL LOST</h3>
                <p>The registry refused this console's credentials — the definitions may sit above your clearance.</p>
                <button type="button" className="acc-row-open" onClick={() => void roles.refetch()}>
                  Retry uplink
                </button>
              </div>
            ) : rows.length === 0 ? (
              <div className="acc-empty acc-empty-panel">
                <h3>NO ROLES ON FILE</h3>
                <p>{search ? "The sweep came back empty — widen it." : "The registry holds no role definitions yet."}</p>
              </div>
            ) : (
              rows.map((role) => (
                <div key={role.slug || role.itemId} className="acc-row">
                  <div className="acc-row-id">
                    <span className="acc-row-name">
                      {role.name || "unnamed role"}
                      {role.isArchived && <span className="acc-builtin-tag">ARCHIVED</span>}
                    </span>
                    <span className="acc-row-email">
                      {role.slug || "no slug"}
                      {role.description ? ` — ${role.description}` : ""}
                    </span>
                  </div>
                  <div className="acct-chips acc-row-chips">
                    <span className="acct-chip">{role.permissionCount} PERMS</span>
                    {role.canCreateOwn && <span className="acct-chip">CAN CREATE OWN</span>}
                  </div>
                  <span className={`acc-row-status${role.isArchived ? " is-warn" : " is-good"}`}>
                    <i aria-hidden />
                    {role.isArchived ? "ARCHIVED" : "ACTIVE"}
                  </span>
                  <button
                    type="button"
                    className="acc-row-open"
                    disabled={!role.slug}
                    onClick={() => setEditorRole(role)}
                  >
                    Open
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

      {editorRole && (
        <RoleEditorModal
          role={editorRole}
          onClose={() => setEditorRole(null)}
          onSaved={(text) => setToast({ key: Date.now(), text })}
        />
      )}

      {createOpen && (
        <RoleCreateModal
          onClose={() => setCreateOpen(false)}
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
