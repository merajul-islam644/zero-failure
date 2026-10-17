// Account entry on the simulator's top bar. The simulator itself is public —
// this is the only auth affordance on the main screen: a sign-in link when
// signed out (routes through the scaffold's /login → hosted IAM IdP flow),
// and a name chip with sign-out when signed in.

import { LogIn, LogOut } from "lucide-react";
import { useAuth } from "../../../app/providers/AuthProvider";
import { useCurrentUser, userDisplayName, userInitials } from "../../profile/useCurrentUser";
import { useT } from "../../../lib/i18n/LocalizationProvider";

export function AccountBar() {
  const { status, logout } = useAuth();
  const { t } = useT();
  const me = useCurrentUser();
  const profile = me.data?.data;
  const name = userDisplayName(profile);

  if (status === "loading") {
    return <span className="sim-account" aria-hidden />;
  }

  if (status !== "authenticated") {
    return (
      <a className="sim-account" href="/login?returnTo=/simulator">
        <LogIn size={14} aria-hidden />
        <span>{t("nav.signIn")}</span>
      </a>
    );
  }

  return (
    <span className="sim-account sim-account-user" title={name || profile?.email}>
      <span className="sim-account-avatar" aria-hidden>
        {userInitials(profile)}
      </span>
      <span className="sim-account-name">{name}</span>
      <button
        className="sim-account-exit"
        onClick={() => void logout()}
        aria-label={t("nav.logout")}
        title={t("nav.logout")}
      >
        <LogOut size={14} aria-hidden />
      </button>
    </span>
  );
}
