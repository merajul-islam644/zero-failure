// The access file editor: one operative's clearance, openable from the
// registry. The discipline is the platform's own confirm-before-mutate
// rule — every tick stages locally (no network), the staged delta
// reads out live, and one transmission carries both complete desired
// sets only after the operator has reviewed and confirmed it. A
// refusal leaves the staging untouched; nothing auto-saves.

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Search, X } from "lucide-react";
import { Skeleton } from "../../shared/ui/Skeleton";
import {
  accUserDisplayName,
  computeAccessDelta,
  permissionForms,
  permissionRef,
  type AccPermission,
} from "./consoleApi";
import { useAccessPermissions, useAccessUser, useAssignableRoles, useUpdateUserAccess } from "./useAccess";

const PERM_PAGE_SIZE = 50;

export function AccessEditorModal({
  userId,
  meItemId,
  onClose,
  onSaved,
}: {
  userId: string;
  meItemId?: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const detail = useAccessUser(userId);
  const roles = useAssignableRoles();
  const save = useUpdateUserAccess();

  // the staged clearance: null means "untouched" — the desired sets
  // then read straight off the fresh file, so a transmission always
  // carries the operative's complete end state
  const [pendingRoles, setPendingRoles] = useState<string[] | null>(null);
  const [pendingPermissions, setPendingPermissions] = useState<string[] | null>(null);
  const [deltaOpen, setDeltaOpen] = useState(false);
  const [alert, setAlert] = useState<string | null>(null);

  // the catalog's own sweep and page — the registry of definitions is
  // bigger than one screen and never the edit target itself
  const [permSearchInput, setPermSearchInput] = useState("");
  const [permSearch, setPermSearch] = useState("");
  const [permPage, setPermPage] = useState(1);
  const permissions = useAccessPermissions({
    pageNo: permPage,
    pageSize: PERM_PAGE_SIZE,
    search: permSearch || undefined,
  });

  useEffect(() => {
    if (permSearchInput === permSearch) return;
    const id = window.setTimeout(() => {
      setPermSearch(permSearchInput.trim());
      setPermPage(1);
    }, 300);
    return () => window.clearTimeout(id);
  }, [permSearchInput, permSearch]);

  const fresh = detail.data;
  const freshRoles = fresh?.roles;
  const freshPermissions = fresh?.permissions;
  const desiredRoles = pendingRoles ?? freshRoles ?? [];
  const desiredPermissions = pendingPermissions ?? freshPermissions ?? [];

  const delta = useMemo(
    () => computeAccessDelta(freshRoles ?? [], freshPermissions ?? [], desiredRoles, desiredPermissions),
    [freshRoles, freshPermissions, desiredRoles, desiredPermissions]
  );
  const deltaCount =
    delta.addedRoles.length +
    delta.removedRoles.length +
    delta.addedPermissions.length +
    delta.removedPermissions.length;

  const saving = save.isPending;
  const loading = detail.isLoading || roles.isLoading;
  const failed = detail.isError || roles.isError;
  const isSelf = Boolean(meItemId) && meItemId === userId;

  const toggleRole = (slug: string) => {
    if (!slug) return;
    setDeltaOpen(false);
    setAlert(null);
    setPendingRoles(
      desiredRoles.includes(slug) ? desiredRoles.filter((entry) => entry !== slug) : [...desiredRoles, slug]
    );
  };

  // a permission is staged in the form the platform's own console
  // transmits — the resolved resource string, never the bare id (the
  // gateway stores a grant verbatim, so an id would read back as a
  // raw GUID chip) — but checked and unchecked against every form the
  // file might have carried — id, name, or resource — so a grant
  // already held never reads as absent, and a staged replace can't
  // silently drop it
  const togglePermission = (perm: AccPermission) => {
    const ref = permissionRef(perm);
    if (!ref) return;
    const forms = permissionForms(perm);
    setDeltaOpen(false);
    setAlert(null);
    setPendingPermissions(
      desiredPermissions.some((entry) => forms.includes(entry))
        ? desiredPermissions.filter((entry) => !forms.includes(entry))
        : [...desiredPermissions, ref]
    );
  };

  const revert = () => {
    setPendingRoles(null);
    setPendingPermissions(null);
    setDeltaOpen(false);
    setAlert(null);
  };

  const onPrimary = () => {
    if (saving || deltaCount === 0 || !fresh) return;
    // the two-click commit: first press opens the review, the second
    // — on exactly this staged delta — fires the one transmission
    if (!deltaOpen) {
      setDeltaOpen(true);
      return;
    }
    save.mutate(
      { userId, roles: desiredRoles, permissions: desiredPermissions },
      {
        onSuccess: () => {
          onSaved(`Clearance transmitted — ${accUserDisplayName(fresh) || "operative"} updated`);
          onClose();
        },
        onError: (error) => {
          setDeltaOpen(false);
          setAlert(
            error instanceof Error && error.message
              ? error.message
              : "The gateway refused the transmission — your clearance may not cover this file."
          );
        },
      }
    );
  };

  const requestClose = () => {
    if (saving) return;
    if (deltaOpen) {
      setDeltaOpen(false);
      return;
    }
    onClose();
  };

  // one Escape = one step back: the review collapses before the file does
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || saving) return;
      if (deltaOpen) setDeltaOpen(false);
      else onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [deltaOpen, saving, onClose]);

  const permTotalPages = Math.max(1, Math.ceil((permissions.data?.totalCount ?? 0) / PERM_PAGE_SIZE));
  const name = fresh ? accUserDisplayName(fresh) : "";

  return (
    <div
      className="dash-modal acc-modal"
      role="dialog"
      aria-modal="true"
      aria-label={`Access file — ${name || "operative"}`}
    >
      <button type="button" className="dash-modal-backdrop" aria-label="Close" tabIndex={-1} onClick={requestClose} />
      <div className="dash-modal-panel acc-panel">
        <button type="button" className="dash-modal-close" aria-label="Close" onClick={requestClose} disabled={saving}>
          <X size={14} aria-hidden />
        </button>
        <p className="dash-kicker">Access file</p>
        {loading ? <Skeleton className="skeleton-line-lg" /> : <h3>{failed ? "File sealed" : name || "Unknown operative"}</h3>}
        {isSelf && !failed && (
          <p className="acc-self-note">THIS IS YOU — a transmission lands on your own clearance at once.</p>
        )}
        {alert && (
          <div className="acc-alert" role="alert">
            {alert}
          </div>
        )}

        {failed ? (
          <div className="acc-empty acc-empty-panel">
            <p>The registry would not open this file — the console's clearance may not cover it.</p>
            <button
              type="button"
              className="acc-row-open"
              onClick={() => {
                void detail.refetch();
                void roles.refetch();
              }}
            >
              Retry uplink
            </button>
          </div>
        ) : loading ? (
          <div className="acc-cols">
            <div className="acc-col">
              <Skeleton className="skeleton-line" />
              <Skeleton className="skeleton-line" />
              <Skeleton className="skeleton-line" />
            </div>
            <div className="acc-col">
              <Skeleton className="skeleton-line" />
              <Skeleton className="skeleton-line" />
              <Skeleton className="skeleton-line" />
            </div>
          </div>
        ) : (
          <>
            <div className="acc-cols">
              <section className="acc-col">
                <h4 className="acc-col-head">Clearance — assignable roles</h4>
                <div className="acc-checks">
                  {(roles.data ?? []).map((role) => (
                    <label key={role.slug || role.itemId || role.name} className="acc-check">
                      <input
                        type="checkbox"
                        checked={desiredRoles.includes(role.slug)}
                        disabled={saving}
                        onChange={() => toggleRole(role.slug)}
                      />
                      <span className="acc-check-box" aria-hidden />
                      <span className="acc-check-body">
                        <span className="acc-check-name">{role.name || role.slug || "unnamed role"}</span>
                        {role.slug && <span className="acc-check-meta">{role.slug}</span>}
                      </span>
                    </label>
                  ))}
                  {(roles.data ?? []).length === 0 && <span className="acct-empty">No assignable roles returned</span>}
                </div>
              </section>

              <section className="acc-col">
                <h4 className="acc-col-head">Authorizations — catalog</h4>
                <div className="dash-shelf-scope acc-mini-search">
                  <Search className="dash-shelf-scope-icon" size={13} aria-hidden />
                  <input
                    className="dash-shelf-input"
                    type="text"
                    value={permSearchInput}
                    placeholder="sweep the catalog…"
                    aria-label="Search permissions"
                    spellCheck={false}
                    autoComplete="off"
                    onChange={(event) => setPermSearchInput(event.target.value)}
                  />
                </div>
                <div className="acc-checks">
                  {(permissions.data?.permissions ?? []).map((perm) => {
                    const forms = permissionForms(perm);
                    const checked = desiredPermissions.some((entry) => forms.includes(entry));
                    return (
                      <label key={perm.itemId || perm.name} className="acc-check">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={saving || !perm.itemId}
                          onChange={() => togglePermission(perm)}
                        />
                        <span className="acc-check-box" aria-hidden />
                        <span className="acc-check-body">
                          <span className="acc-check-name">{perm.name}</span>
                          <span className="acc-check-meta">
                            {perm.resource || `${perm.roles.length} holder${perm.roles.length === 1 ? "" : "s"}`}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                  {permissions.isError && <span className="acct-empty">The catalog refused the sweep</span>}
                  {!permissions.isError && (permissions.data?.permissions.length ?? 0) === 0 && (
                    <span className="acct-empty">{permSearch ? "Nothing in the sweep" : "No permissions on file"}</span>
                  )}
                </div>
                {permTotalPages > 1 && (
                  <div className="acc-pager acc-pager-mini">
                    <button
                      type="button"
                      className="acc-pager-btn"
                      aria-label="Previous catalog page"
                      disabled={permPage <= 1}
                      onClick={() => setPermPage((page) => Math.max(1, page - 1))}
                    >
                      <ArrowLeft size={12} aria-hidden />
                    </button>
                    <span className="acc-pager-readout">
                      PAGE {permPage}/{permTotalPages}
                    </span>
                    <button
                      type="button"
                      className="acc-pager-btn"
                      aria-label="Next catalog page"
                      disabled={permPage >= permTotalPages}
                      onClick={() => setPermPage((page) => Math.min(permTotalPages, page + 1))}
                    >
                      <ArrowRight size={12} aria-hidden />
                    </button>
                  </div>
                )}
              </section>
            </div>

            <div className={`acc-delta${deltaOpen ? " is-open" : ""}`}>
              {deltaCount === 0 ? (
                <span className="acc-delta-none">NO CHANGES STAGED — tick a box to stage one</span>
              ) : (
                <div className="acc-delta-items">
                  {(desiredRoles.length === 0 || desiredPermissions.length === 0) && (
                    <span className="acc-delta-item acc-delta-note">
                      A MEMBER NEVER RIDES WITH NOTHING — this transmission lifts the file through a
                      revoke-and-regrant, restoring exactly the boxes still ticked
                    </span>
                  )}
                  {delta.addedRoles.map((entry) => (
                    <span key={`add-role-${entry}`} className="acc-delta-item acc-delta-add">
                      + role: {entry}
                    </span>
                  ))}
                  {delta.removedRoles.map((entry) => (
                    <span key={`drop-role-${entry}`} className="acc-delta-item acc-delta-remove">
                      − role: {entry}
                    </span>
                  ))}
                  {delta.addedPermissions.map((entry) => (
                    <span key={`add-perm-${entry}`} className="acc-delta-item acc-delta-add">
                      + perm: {entry}
                    </span>
                  ))}
                  {delta.removedPermissions.map((entry) => (
                    <span key={`drop-perm-${entry}`} className="acc-delta-item acc-delta-remove">
                      − perm: {entry}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="dash-form-actions">
              <button
                type="button"
                className="dash-form-back"
                onClick={revert}
                disabled={saving || (deltaCount === 0 && !alert)}
              >
                Revert staged
              </button>
              <button type="button" className="dash-open" onClick={onPrimary} disabled={saving || deltaCount === 0}>
                {saving ? "TRANSMITTING…" : deltaOpen ? "CONFIRM TRANSMIT" : "REVIEW CHANGES"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
