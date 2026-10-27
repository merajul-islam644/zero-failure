// The invite dialog: one address, a name, an optional password, and
// the roles the operative starts under. An empty password is the
// invitation itself — the platform mails an activation link — so the
// form never sends an empty secret, and the review strip never shows
// one. The duplicate-address check runs live as the operator types;
// a collision blocks the transmit before the wire ever sees it. One
// explicit confirm, then exactly one create; nothing auto-saves.

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useDialogFocus } from "../../shared/ui/useDialogFocus";
import { useAssignableRoles, useCreateUser, useEmailAvailable } from "./useAccess";

const EMAIL_SHAPE = /^\S+@\S+\.\S+$/;

export function InviteUserModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const dialogRef = useDialogFocus<HTMLDivElement>();
  const create = useCreateUser();
  const roles = useAssignableRoles();

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [pendingRoles, setPendingRoles] = useState<string[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [alert, setAlert] = useState<string | null>(null);

  const saving = create.isPending;
  const trimmedEmail = email.trim();
  const emailShaped = EMAIL_SHAPE.test(trimmedEmail);

  // the live duplicate check: quiet for 400ms after the last keystroke,
  // then one read — taken seriously only once it answered
  const [checkedEmail, setCheckedEmail] = useState("");
  useEffect(() => {
    if (!emailShaped || trimmedEmail === checkedEmail) return;
    const id = window.setTimeout(() => setCheckedEmail(trimmedEmail), 400);
    return () => window.clearTimeout(id);
  }, [emailShaped, trimmedEmail, checkedEmail]);
  const availability = useEmailAvailable(checkedEmail);
  const addressTaken = availability.isSuccess && availability.data === false && checkedEmail === trimmedEmail;

  const trimmedFirstName = firstName.trim();
  const trimmedLastName = lastName.trim();
  const canStage = Boolean(trimmedEmail) && emailShaped && !addressTaken && !saving;

  const toggleRole = (slug: string) => {
    if (!slug) return;
    setReviewOpen(false);
    setAlert(null);
    setPendingRoles((list) =>
      list.includes(slug) ? list.filter((entry) => entry !== slug) : [...list, slug]
    );
  };

  const onPrimary = () => {
    if (!canStage) return;
    // the two-click commit: first press opens the review, the second
    // — on exactly this staged invite — fires the one create
    if (!reviewOpen) {
      setReviewOpen(true);
      return;
    }
    create.mutate(
      {
        email: trimmedEmail,
        firstName: trimmedFirstName || undefined,
        lastName: trimmedLastName || undefined,
        password: password || undefined,
        roles: pendingRoles.length ? pendingRoles : undefined,
      },
      {
        onSuccess: () => {
          onSaved(`Operative invited — ${trimmedEmail}`);
          onClose();
        },
        onError: (error) => {
          setReviewOpen(false);
          setAlert(
            error instanceof Error && error.message
              ? error.message
              : "The gateway refused the invite — your clearance may not cover it."
          );
        },
      }
    );
  };

  const requestClose = () => {
    if (saving) return;
    if (reviewOpen) {
      setReviewOpen(false);
      return;
    }
    onClose();
  };

  // one Escape = one step back: the review collapses before the form does
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || saving) return;
      if (reviewOpen) setReviewOpen(false);
      else onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [reviewOpen, saving, onClose]);

  const roleOptions = roles.data ?? [];

  return (
    <div className="dash-modal acc-modal" role="dialog" aria-modal="true" aria-label="Invite an operative">
      <button type="button" className="dash-modal-backdrop" aria-label="Close" tabIndex={-1} onClick={requestClose} />
      <div ref={dialogRef} tabIndex={-1} className="dash-modal-panel acc-panel acc-panel-create">
        <button type="button" className="dash-modal-close" aria-label="Close" onClick={requestClose} disabled={saving}>
          <X size={14} aria-hidden />
        </button>
        <p className="dash-kicker">Access control</p>
        <h3>Invite an operative</h3>
        {alert && (
          <div className="acc-alert" role="alert">
            {alert}
          </div>
        )}

        <div className="acc-field">
          <label htmlFor="acc-invite-email">Signal address — email</label>
          <input
            id="acc-invite-email"
            className="acc-field-input"
            type="email"
            value={email}
            placeholder="who is being invited…"
            spellCheck={false}
            autoComplete="off"
            disabled={saving}
            onChange={(event) => setEmail(event.target.value)}
          />
          {addressTaken && <span className="acc-field-warn">That address is already on file.</span>}
        </div>
        <div className="acc-field-pair">
          <div className="acc-field">
            <label htmlFor="acc-invite-first">First name — optional</label>
            <input
              id="acc-invite-first"
              className="acc-field-input"
              type="text"
              value={firstName}
              placeholder="given name"
              spellCheck={false}
              autoComplete="off"
              disabled={saving}
              onChange={(event) => setFirstName(event.target.value)}
            />
          </div>
          <div className="acc-field">
            <label htmlFor="acc-invite-last">Last name — optional</label>
            <input
              id="acc-invite-last"
              className="acc-field-input"
              type="text"
              value={lastName}
              placeholder="family name"
              spellCheck={false}
              autoComplete="off"
              disabled={saving}
              onChange={(event) => setLastName(event.target.value)}
            />
          </div>
        </div>
        <div className="acc-field">
          <label htmlFor="acc-invite-password">Password — optional</label>
          <input
            id="acc-invite-password"
            className="acc-field-input"
            type="password"
            value={password}
            placeholder="empty — an activation mail sets it"
            autoComplete="new-password"
            disabled={saving}
            onChange={(event) => setPassword(event.target.value)}
          />
          <span className="acc-field-hint">Left empty, the platform mails the operative an activation link instead.</span>
        </div>

        <div className="acc-field">
          <label>Starting roles — optional</label>
          <div className="acc-checks acc-checks-tight">
            {roleOptions.map((role) => (
              <label key={role.slug || role.itemId || role.name} className="acc-check">
                <input
                  type="checkbox"
                  checked={pendingRoles.includes(role.slug)}
                  disabled={saving || !role.slug}
                  onChange={() => toggleRole(role.slug)}
                />
                <span className="acc-check-box" aria-hidden />
                <span className="acc-check-body">
                  <span className="acc-check-name">{role.name || role.slug || "unnamed role"}</span>
                  {role.slug && <span className="acc-check-meta">{role.slug}</span>}
                </span>
              </label>
            ))}
            {roleOptions.length === 0 && <span className="acct-empty">No assignable roles returned</span>}
          </div>
        </div>

        <div className={`acc-delta${reviewOpen ? " is-open" : ""}`}>
          {reviewOpen ? (
            <div className="acc-delta-items">
              <span className="acc-delta-item acc-delta-add">+ invite: {trimmedEmail}</span>
              {(trimmedFirstName || trimmedLastName) && (
                <span className="acc-delta-item">
                  name: {[trimmedFirstName, trimmedLastName].filter(Boolean).join(" ")}
                </span>
              )}
              {password && <span className="acc-delta-item">password: set</span>}
              {!password && <span className="acc-delta-item">password: activation mail</span>}
              {pendingRoles.map((slug) => (
                <span key={`role-${slug}`} className="acc-delta-item">
                  role: {slug}
                </span>
              ))}
            </div>
          ) : (
            <span className="acc-delta-none">NOTHING SENT YET — review before the invite</span>
          )}
        </div>

        <div className="dash-form-actions">
          <button type="button" className="dash-form-back" onClick={requestClose} disabled={saving}>
            Discard
          </button>
          <button type="button" className="dash-open" onClick={onPrimary} disabled={!canStage}>
            {saving ? "TRANSMITTING…" : reviewOpen ? "CONFIRM INVITE" : "REVIEW INVITE"}
          </button>
        </div>
      </div>
    </div>
  );
}
