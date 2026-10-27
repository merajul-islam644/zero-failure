import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { completeLogin } from "../../lib/blocks/auth";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { Alert } from "../../shared/ui/Alert";
import { LoadingScreen } from "../../shared/ui/LoadingScreen";

export function CallbackPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { refresh } = useAuth();
  const { t } = useT();
  const [error, setError] = useState<string | undefined>();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    completeLogin(window.location.href)
      .then(async (result) => {
        if (result.ok) {
          // Land the session before navigating: RequireAuth reads status,
          // and navigating while it still says "unauthenticated" (this page
          // load's own probe ran before the cookie existed) bounces the deep
          // link straight back to /login.
          await refresh();
          onNavigate(result.returnTo);
          return;
        }

        setError(result.message);
      })
      .catch((err: unknown) => {
        // A rejected exchange (network down, bad code) must surface, not
        // spin the loading screen forever.
        setError(err instanceof Error ? err.message : "Sign-in failed");
      });
  }, [onNavigate, refresh]);

  if (error) {
    return (
      <div className="auth-screen">
        <h1 className="sr-only">Signing in</h1>
        <div className="auth-card">
          <h2>{t("auth.failed")}</h2>
          <Alert tone="error">{error}</Alert>
          <button className="primary-button auth-submit" onClick={() => onNavigate("/login")}>{t("auth.back")}</button>
        </div>
      </div>
    );
  }

  return <LoadingScreen label="AUTH LINK" />;
}
