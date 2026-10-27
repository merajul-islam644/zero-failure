// The role definition editor: one role's permission set, openable from
// the registry. The platform's assignPermissions is a delta — adds and
// removals ride one transmission, never a replace — so staging is two
// sets (to-attach, to-detach) and the review strip reads straight off
// them. One explicit confirm, then exactly one call; nothing
// auto-saves. The checkmark column reads from the role's whole held
// set, fetched once, so a catalog search can't hide a grant.

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Search, X } from "lucide-react";
import { Skeleton } from "../../shared/ui/Skeleton";
import { useDialogFocus } from "../../shared/ui/useDialogFocus";
import type { AccPermission, AccRoleDef } from "./consoleApi";
import { useAccessPermissions, useAssignRolePermissions, useRolePermissions } from "./useAccess";

const PERM_PAGE_SIZE = 50;

const KIND_LABEL: Record<string, string> = {
  endpoint: "ENDPOINT",
  frontend: "FRONTEND",
  data: "DATA",
};

export function RoleEditorModal({
  role,
  onClose,
  onSaved,
}: {
  role: AccRoleDef;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const dialogRef = useDialogFocus<HTMLDivElement>();
  const held = useRolePermissions(role.slug);
  const save = useAssignRolePermissions();

  // the staged delta, in the wire's own units: ids to attach, ids to
  // detach — never a full replacement set
  const [pendingAdd, setPendingAdd] = useState<string[]>([]);
  const [pendingRemove, setPendingRemove] = useState<string[]>([]);
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

  const heldIds = useMemo(
    () => new Set((held.data ?? []).map((perm) => perm.itemId).filter(Boolean)),
    [held.data]
  );

  // display names for the staged ids, for the review strip — a staged
  // id whose row has scrolled away reads as its id, never as a blank
  const stagedNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const perm of held.data ?? []) names.set(perm.itemId, perm.name);
    for (const perm of permissions.data?.permissions ?? []) names.set(perm.itemId, perm.name);
    return names;
  }, [held.data, permissions.data]);

  const saving = save.isPending;
  const loading = held.isLoading;
  const failed = held.isError;

  // the visible check state: held, minus staged removals, plus staged adds
  const isChecked = (perm: AccPermission): boolean => {
    const id = perm.itemId;
    if (!id) return false;
    if (pendingRemove.includes(id)) return false;
    if (pendingAdd.includes(id)) return true;
    return heldIds.has(id);
  };

  const toggle = (perm: AccPermission) => {
    const id = perm.itemId;
    if (!id) return;
    setDeltaOpen(false);
    setAlert(null);
    const staged = pendingAdd.includes(id) || pendingRemove.includes(id);
    if (isChecked(perm)) {
      // turning off: a staged add cancels itself, a held grant stages a removal
      if (staged) setPendingAdd((list) => list.filter((entry) => entry !== id));
      else setPendingRemove((list) => (list.includes(id) ? list : [...list, id]));
    } else {
      // turning on: a staged removal cancels itself, a stranger stages an add
      if (staged) setPendingRemove((list) => list.filter((entry) => entry !== id));
      else setPendingAdd((list) => (list.includes(id) ? list : [...list, id]));
    }
  };

  const revert = () => {
    setPendingAdd([]);
    setPendingRemove([]);
    setDeltaOpen(false);
    setAlert(null);
  };

  const deltaCount = pendingAdd.length + pendingRemove.length;

  const onPrimary = () => {
    if (saving || deltaCount === 0 || !role.slug) return;
    // the two-click commit: first press opens the review, the second
    // — on exactly this staged delta — fires the one transmission
    if (!deltaOpen) {
      setDeltaOpen(true);
      return;
    }
    save.mutate(
      { slug: role.slug, addPermissions: [...pendingAdd], removePermissions: [...pendingRemove] },
      {
        onSuccess: () => {
          onSaved(`Clearance transmitted — ${role.name || role.slug} updated`);
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
  const label = (id: string) => stagedNames.get(id) || id;

  return (
    <div
      className="dash-modal acc-modal"
      role="dialog"
      aria-modal="true"
      aria-label={`Role file — ${role.name || role.slug}`}
    >
      <button type="button" className="dash-modal-backdrop" aria-label="Close" tabIndex={-1} onClick={requestClose} />
      <div ref={dialogRef} tabIndex={-1} className="dash-modal-panel acc-panel">
        <button type="button" className="dash-modal-close" aria-label="Close" onClick={requestClose} disabled={saving}>
          <X size={14} aria-hidden />
        </button>
        <p className="dash-kicker">Role file</p>
        <h3>{role.name || role.slug}</h3>
        <p className="acc-role-desc">
          {role.slug}
          {role.description ? ` — ${role.description}` : ""}
        </p>
        {alert && (
          <div className="acc-alert" role="alert">
            {alert}
          </div>
        )}

        {failed ? (
          <div className="acc-empty acc-empty-panel">
            <p>The registry would not read this role's grants — the console's clearance may not cover it.</p>
            <button type="button" className="acc-row-open" onClick={() => void held.refetch()}>
              Retry uplink
            </button>
          </div>
        ) : loading ? (
          <div className="acc-col">
            <Skeleton className="skeleton-line" />
            <Skeleton className="skeleton-line" />
            <Skeleton className="skeleton-line" />
            <Skeleton className="skeleton-line" />
          </div>
        ) : (
          <>
            <div className="acc-col">
              <h4 className="acc-col-head">
                Authorizations — {held.data?.length ?? 0} held
              </h4>
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
                  const checked = isChecked(perm);
                  return (
                    <label key={perm.itemId || perm.resource || perm.name} className="acc-check">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={saving || !perm.itemId}
                        onChange={() => toggle(perm)}
                      />
                      <span className="acc-check-box" aria-hidden />
                      <span className="acc-check-body">
                        <span className="acc-check-name">{perm.name}</span>
                        <span className="acc-check-meta">
                          {perm.resource || "no resource"}
                          {perm.kind && (
                            <span className={`acc-type-tag is-${perm.kind}`}>
                              {KIND_LABEL[perm.kind] ?? ""}
                            </span>
                          )}
                          {perm.builtIn && <span className="acc-builtin-tag">BUILT-IN</span>}
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
            </div>

            <div className={`acc-delta${deltaOpen ? " is-open" : ""}`}>
              {deltaCount === 0 ? (
                <span className="acc-delta-none">NO CHANGES STAGED — tick a box to stage one</span>
              ) : (
                <div className="acc-delta-items">
                  {pendingAdd.map((id) => (
                    <span key={`add-${id}`} className="acc-delta-item acc-delta-add">
                      + perm: {label(id)}
                    </span>
                  ))}
                  {pendingRemove.map((id) => (
                    <span key={`drop-${id}`} className="acc-delta-item acc-delta-remove">
                      − perm: {label(id)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="dash-form-actions">
              <button type="button" className="dash-form-back" onClick={revert} disabled={saving || deltaCount === 0}>
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
