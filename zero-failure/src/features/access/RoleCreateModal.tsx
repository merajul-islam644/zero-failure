// The create-role dialog: a name, an optional slug and description,
// staged locally and reviewed before the one create call â€” the same
// confirm-before-mutate discipline as every console in this family.
// A refusal leaves the form untouched; nothing auto-saves.

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useCreateRole } from "./useAccess";

export function RoleCreateModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const create = useCreateRole();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [alert, setAlert] = useState<string | null>(null);

  const saving = create.isPending;
  const trimmedName = name.trim();
  const trimmedSlug = slug.trim();
  const trimmedDescription = description.trim();
  const canStage = Boolean(trimmedName) && !saving;

  const onPrimary = () => {
    if (!canStage) return;
    // the two-click commit: first press opens the review, the second
    // â€” on exactly this staged definition â€” fires the one create
    if (!reviewOpen) {
      setReviewOpen(true);
      return;
    }
    create.mutate(
      {
        name: trimmedName,
        slug: trimmedSlug || undefined,
        description: trimmedDescription || undefined,
      },
      {
        onSuccess: () => {
          onSaved(`Role on file â€” ${trimmedName} created`);
          onClose();
        },
        onError: (error) => {
          setReviewOpen(false);
          setAlert(
            error instanceof Error && error.message
              ? error.message
              : "The gateway refused the create â€” your clearance may not cover it."
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

  return (
    <div className="dash-modal acc-modal" role="dialog" aria-modal="true" aria-label="Define a new role">
      <button type="button" className="dash-modal-backdrop" aria-label="Close" tabIndex={-1} onClick={requestClose} />
      <div className="dash-modal-panel acc-panel acc-panel-create">
        <button type="button" className="dash-modal-close" aria-label="Close" onClick={requestClose} disabled={saving}>
          <X size={14} aria-hidden />
        </button>
        <p className="dash-kicker">Role control</p>
        <h3>Define a role</h3>
        {alert && (
          <div className="acc-alert" role="alert">
            {alert}
          </div>
        )}

        <div className="acc-field">
          <label htmlFor="acc-create-name">Name</label>
          <input
            id="acc-create-name"
            className="acc-field-input"
            type="text"
            value={name}
            placeholder="what this clearance is calledâ€¦"
            spellCheck={false}
            autoComplete="off"
            disabled={saving}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="acc-field">
          <label htmlFor="acc-create-slug">Slug â€” optional</label>
          <input
            id="acc-create-slug"
            className="acc-field-input"
            type="text"
            value={slug}
            placeholder="auto from the name when left empty"
            spellCheck={false}
            autoComplete="off"
            disabled={saving}
            onChange={(event) => setSlug(event.target.value)}
          />
        </div>
        <div className="acc-field">
          <label htmlFor="acc-create-description">Description â€” optional</label>
          <input
            id="acc-create-description"
            className="acc-field-input"
            type="text"
            value={description}
            placeholder="what holders of this role may doâ€¦"
            spellCheck={false}
            autoComplete="off"
            disabled={saving}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>

        <div className={`acc-delta${reviewOpen ? " is-open" : ""}`}>
          {reviewOpen ? (
            <div className="acc-delta-items">
              <span className="acc-delta-item acc-delta-add">+ role: {trimmedName}</span>
              <span className="acc-delta-item">
                slug: {trimmedSlug || "auto from the name"}
              </span>
              {trimmedDescription && (
                <span className="acc-delta-item">description: {trimmedDescription}</span>
              )}
            </div>
          ) : (
            <span className="acc-delta-none">NOTHING SENT YET â€” review before the create</span>
          )}
        </div>

        <div className="dash-form-actions">
          <button type="button" className="dash-form-back" onClick={requestClose} disabled={saving}>
            Discard
          </button>
          <button type="button" className="dash-open" onClick={onPrimary} disabled={!canStage}>
            {saving ? "TRANSMITTINGâ€¦" : reviewOpen ? "CONFIRM CREATE" : "REVIEW CREATE"}
          </button>
        </div>
      </div>
    </div>
  );
}
