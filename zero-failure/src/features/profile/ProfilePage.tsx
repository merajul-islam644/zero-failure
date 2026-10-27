// The account sector: the signed-in operative's dossier, wearing the
// same full-display HUD as the deck — the deep sky behind chamfered
// panels, the sector rails flanking. The IAM record (the gateway's
// iam.me) reads as the file: a holo portrait whose own face uploads
// in place, the callsign and clearance, the roles and authorizations
// as chips, and the session's own marks — signed-in moment and the
// login tally, the two truths the gateway actually hands a browser (a
// cookie session's expiry never leaves the server) — and, for an
// operative whose clearance carries the registry's read grant, the
// tenant's invited operatives drawn right inside the file.

import { useEffect, useRef, useState } from "react";
import { Camera, KeyRound, LogOut, RefreshCw, ShieldCheck, UserPlus } from "lucide-react";
import { useAuth } from "../../app/providers/AuthProvider";
import { useRouterNavigate } from "../../app/router/RouterContext";
import { blocksConfig } from "../../lib/blocks/config";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { Skeleton } from "../../shared/ui/Skeleton";
import { DashboardRails } from "../dashboard/DashboardRails";
import { AccessEditorModal } from "../access/AccessEditorModal";
import { InviteUserModal } from "../access/InviteUserModal";
import { InvitedOperativesPanel } from "../access/InvitedOperativesPanel";
import { useCanManageRoles, useCanOpenAccess } from "../access/useAccess";
import { PORTRAIT_ACCEPT, portraitError } from "./portraitApi";
import { usePortraitUpload } from "./usePortrait";
import { useCurrentUser, userDisplayName, userInitials } from "./useCurrentUser";

export function ProfilePage() {
  const me = useCurrentUser();
  const { logout } = useAuth();
  const { t } = useT();
  const navigate = useRouterNavigate();
  const canOpenAccess = useCanOpenAccess();
  const canManageRoles = useCanManageRoles();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editorUserId, setEditorUserId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ key: number; text: string } | null>(null);
  const portraitUpload = usePortraitUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  // the picked file's local stand-in: the url it shows while the real
  // one travels, and the bound url it stands in for ("" when the file
  // wore no face before, so a first upload knows its moment too)
  const [preview, setPreview] = useState<{ url: string; forUrl: string } | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const profile = me.data?.data;
  const name = userDisplayName(profile);
  const portraitSrc =
    preview?.url ??
    (typeof profile?.profileImageUrl === "string" ? profile.profileImageUrl : "");

  // the session's one honest timestamp: the moment this operative last
  // came through the gateway's door — the raw IAM record carries it as
  // an unknown shape, so anything that isn't a real date reads as
  // unknown, never as a fabricated time
  const lastLogin = profile?.lastLoggedInTime;
  const signedInRaw = typeof lastLogin === "string" && lastLogin ? new Date(lastLogin) : undefined;
  const signedIn = signedInRaw && !Number.isNaN(signedInRaw.getTime()) ? signedInRaw : undefined;
  const logins = typeof profile?.logInCount === "number" ? profile.logInCount : 0;

  // the confirmation strip fades itself out
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  // each preview's object url dies the moment it stops rendering —
  // replaced by the next pick, superseded by the bound url, or the
  // page unmounts
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview.url);
  }, [preview]);

  // the preview stands in only until the gateway answers with the
  // freshly bound url — then the real one takes the frame back
  useEffect(() => {
    const bound = profile?.profileImageUrl;
    if (preview && typeof bound === "string" && bound && bound !== preview.forUrl) {
      setPreview(null);
    }
  }, [preview, profile?.profileImageUrl]);

  // a changed frame retries the picture — a once-broken url must not
  // haunt the one that replaced it
  useEffect(() => setImgFailed(false), [portraitSrc]);

  // the portrait's door: validate before any wire moves, show the
  // local picture immediately, then let the five steps run — a
  // refusal anywhere drops the stand-in and tells the operator
  const pickPortrait = (file: File | undefined) => {
    if (!file) return;
    const problem = portraitError(file);
    if (problem) {
      setToast({ key: Date.now(), text: problem });
      return;
    }
    const userId = profile?.itemId;
    if (!userId) {
      setToast({ key: Date.now(), text: "No operative on file to bind the portrait to." });
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview({ url, forUrl: typeof profile?.profileImageUrl === "string" ? profile.profileImageUrl : "" });
    setImgFailed(false);
    portraitUpload.mutate(
      { file, userId },
      {
        onSuccess: () => {
          setToast({ key: Date.now(), text: "Portrait bound — the file wears your face now." });
        },
        onError: (error) => {
          setPreview(null);
          setToast({
            key: Date.now(),
            text:
              error instanceof Error && error.message
                ? error.message
                : "Portrait upload failed — the wire refused it.",
          });
        },
      }
    );
  };

  return (
    <div className="dash-space">
      <DashboardRails active="account">
        <div className="dash-topbar">
          <div className="dash-topbar-side">
            <span className="dash-topbar-tag">
              <i className="dash-live-dot" aria-hidden />
              OPS // ACCOUNT
            </span>
          </div>
          <div className="dash-topbar-side">
            <button
              type="button"
              className="dash-back"
              aria-label="Refresh the dossier"
              title="Refresh the dossier"
              onClick={() => void me.refetch()}
            >
              <RefreshCw size={15} aria-hidden />
            </button>
          </div>
        </div>

        <section className="acct-dossier" aria-label={t("profile.title")}>
          {/* the file's face: the holo portrait, the callsign, the clearance.
              The portrait is its own upload door — the camera shows on
              hover, the ring keeps orbiting whatever face it frames */}
          <header className="acct-id">
            {me.isLoading ? (
              <Skeleton className="acct-holo" />
            ) : (
              <button
                type="button"
                className={`acct-holo-btn${portraitUpload.isPending ? " is-uploading" : ""}`}
                aria-label="Upload a portrait"
                title="Upload a portrait"
                disabled={portraitUpload.isPending}
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="acct-holo" aria-hidden>
                  <svg viewBox="0 0 120 120">
                    {(!portraitSrc || imgFailed) && (
                      <>
                        <circle className="acct-holo-disc" cx={60} cy={60} r={38} />
                        <text className="acct-holo-initials" x={60} y={60} dy={11}>
                          {userInitials(profile)}
                        </text>
                      </>
                    )}
                  </svg>
                  {portraitSrc && !imgFailed && (
                    <img
                      className="acct-holo-img"
                      src={portraitSrc}
                      alt=""
                      onError={() => setImgFailed(true)}
                    />
                  )}
                  {/* the projection laid over the face: two orbit rings
                      riding counter to each other, the scanline field
                      breathing across, the bright band forever walking
                      the frame — a holo, not a photo in a circle */}
                  <svg className="acct-holo-veil" viewBox="0 0 120 120">
                    <g className="acct-holo-ring">
                      <ellipse
                        className="acct-holo-orbit"
                        cx={60}
                        cy={60}
                        rx={54}
                        ry={19}
                        transform="rotate(-14 60 60)"
                      />
                    </g>
                    <g className="acct-holo-ring is-alt">
                      <ellipse
                        className="acct-holo-orbit"
                        cx={60}
                        cy={60}
                        rx={57}
                        ry={15}
                        transform="rotate(21 60 60)"
                      />
                    </g>
                  </svg>
                  <span className="acct-holo-scan" />
                  {/* the targeting frame: cardinal ticks standing watch,
                      corner brackets drawing in when the door opens */}
                  <svg className="acct-holo-reticle" viewBox="0 0 120 120">
                    <g className="acct-holo-ticks">
                      <line x1={60} y1={1} x2={60} y2={9} />
                      <line x1={60} y1={111} x2={60} y2={119} />
                      <line x1={1} y1={60} x2={9} y2={60} />
                      <line x1={111} y1={60} x2={119} y2={60} />
                    </g>
                    <g className="acct-holo-corners">
                      <path d="M4 32 V4 H32" />
                      <path d="M88 4 H116 V32" />
                      <path d="M116 88 V116 H88" />
                      <path d="M32 116 H4 V88" />
                    </g>
                  </svg>
                </span>
                <span className="acct-holo-cam" aria-hidden>
                  <Camera size={16} strokeWidth={1.8} />
                </span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={PORTRAIT_ACCEPT}
              hidden
              onChange={(event) => {
                pickPortrait(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <div className="acct-id-body">
              <p className="dash-kicker">Operative dossier</p>
              {me.isLoading ? (
                <Skeleton className="skeleton-line-lg" />
              ) : (
                <h2>
                  {name || (me.isError ? "Session unavailable" : "Unknown operative")}
                </h2>
              )}
              {me.isLoading ? (
                <Skeleton className="skeleton-line" />
              ) : (
                <p className="acct-id-line">{profile?.email ?? "no signal address on file"}</p>
              )}
              <div className="acct-id-foot">
                <span className={`acct-clearance${me.isSuccess ? " is-good" : " is-warn"}`}>
                  <i aria-hidden />
                  {me.isSuccess ? "Clearance verified" : "Signal lost"}
                </span>
                {/* the registry: the operative files this dossier's
                    tenant holds, each clearance editable in place —
                    the door only renders for an operative whose own
                    clearance carries the registry's read grant */}
                {canOpenAccess && (
                  <button
                    type="button"
                    className="acct-exit acc-entry"
                    onClick={() => navigate("/access")}
                    title="Open access control"
                  >
                    <ShieldCheck size={13} aria-hidden />
                    Access control
                  </button>
                )}
                {/* the definitions: the role registry this dossier's
                    tenant serves — its own door, its own live probe,
                    no hardcoded permission name */}
                {canManageRoles && (
                  <button
                    type="button"
                    className="acct-exit acc-entry"
                    onClick={() => navigate("/roles")}
                    title="Manage roles"
                  >
                    <KeyRound size={13} aria-hidden />
                    Roles
                  </button>
                )}
                {/* the invitation: one address in, an activation mail
                    out — the same registry family's write side */}
                {canOpenAccess && (
                  <button
                    type="button"
                    className="acct-exit acc-entry"
                    onClick={() => setInviteOpen(true)}
                    title="Invite an operative"
                  >
                    <UserPlus size={13} aria-hidden />
                    Invite
                  </button>
                )}
                <button
                  type="button"
                  className="acct-exit"
                  onClick={() => void logout()}
                  title={t("nav.logout")}
                >
                  <LogOut size={13} aria-hidden />
                  End session
                </button>
              </div>
            </div>
          </header>

          {/* the file's leaves: clearance, authorizations, the session window */}
          <div className="acct-grid">
            <section className="acct-panel">
              <h3 className="acct-panel-head">Clearance — roles</h3>
              {me.isLoading ? (
                <Skeleton className="skeleton-line" />
              ) : (
                <div className="acct-chips">
                  {profile?.roles?.length ? (
                    profile.roles.map((role) => (
                      <span key={role} className="acct-chip">
                        {role}
                      </span>
                    ))
                  ) : (
                    <span className="acct-empty">No roles assigned</span>
                  )}
                </div>
              )}
            </section>

            <section className="acct-panel">
              <h3 className="acct-panel-head">
                Authorizations — {profile?.permissions?.length ?? 0}
              </h3>
              {me.isLoading ? (
                <Skeleton className="skeleton-line" />
              ) : (
                <div className="acct-chips">
                  {profile?.permissions?.length ? (
                    profile.permissions.map((permission) => (
                      <span key={permission} className="acct-chip">
                        {permission}
                      </span>
                    ))
                  ) : (
                    <span className="acct-empty">No permissions returned</span>
                  )}
                </div>
              )}
            </section>

            <section className="acct-panel">
              <h3 className="acct-panel-head">Session</h3>
              <span className={`acct-clearance${signedIn ? " is-good" : " is-warn"}`}>
                <i aria-hidden />
                {signedIn ? "Session active — the gateway verifies it on every call" : "Session unavailable"}
              </span>
              <dl className="acct-times">
                <div>
                  <dt>Signed in</dt>
                  <dd>{signedIn ? signedIn.toLocaleString() : "unknown"}</dd>
                </div>
                <div>
                  <dt>Logins on file</dt>
                  <dd>{logins > 0 ? logins.toLocaleString() : "unknown"}</dd>
                </div>
              </dl>
            </section>
          </div>

          {/* the registry window: the operatives this dossier's tenant
              holds, newest invite first — its own door, the same live
              probe the buttons above read, no hardcoded name anywhere */}
          {canOpenAccess && <InvitedOperativesPanel onOpenFile={setEditorUserId} />}

          {/* the catalog lines: this body's id and the tenant it serves */}
          <div className="acct-catalog">
            <div className="acct-cat-row">
              <span className="acct-cat-key">USR-ID</span>
              <span className="acct-cat-val">{profile?.itemId ?? "Not available"}</span>
            </div>
            <div className="acct-cat-row">
              <span className="acct-cat-key">TENANT</span>
              {/* Truncated: the full key rides in every request anyway, but
                  the dossier is screenshot-facing — print enough to confirm
                  which tenant, not the whole credential. */}
              <span className="acct-cat-val">
                {blocksConfig.xBlocksKey ? `${blocksConfig.xBlocksKey.slice(0, 8)}…` : "Not available"}
              </span>
            </div>
          </div>
        </section>
      </DashboardRails>

      {inviteOpen && (
        <InviteUserModal
          onClose={() => setInviteOpen(false)}
          onSaved={(text) => {
            setInviteOpen(false);
            setToast({ key: Date.now(), text });
          }}
        />
      )}

      {/* the access file editor lives at the page's root, beside the
          invite form — a fixed overlay can't ride inside the registry
          window, whose chamfer clips everything painted within it */}
      {editorUserId && (
        <AccessEditorModal
          userId={editorUserId}
          meItemId={me.data?.data?.itemId}
          onClose={() => setEditorUserId(null)}
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
