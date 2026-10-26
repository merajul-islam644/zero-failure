import { Activity, LogIn } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { isLoginConfigured } from "../../lib/blocks/config";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { Alert } from "../../shared/ui/Alert";
import seliseLogo from "../../assets/selise-blocks-logo.png";

export function LoginPage({ returnTo }: { returnTo?: string }) {
  const { login } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const { t } = useT();
  const configured = isLoginConfigured();

  async function handleLogin() {
    setError(undefined);
    setPending(true);
    try {
      await login(returnTo);
    } catch (caught) {
      setError((caught as Error).message);
      setPending(false);
    }
  }

  return (
    <div className="auth-screen">
      {/* the observatory sky behind the terminal — pure decor */}
      <span className="auth-stars" aria-hidden />
      <span className="auth-stars auth-stars-far" aria-hidden />
      <span className="auth-nebula" aria-hidden />
      {/* the mission brief stands beside the terminal, not inside it */}
      <section className="auth-brief">
        {/* the official logo crowns the briefing, above the kicker —
            shown as provided, on a light chip so it reads on the night sky */}
        {/* <div className="auth-brief-brand">
          <img src={seliseLogo} alt="SELISE Blocks" />
        </div> */}
        <span className="auth-brief-kicker">{t("auth.briefKicker")}</span>
        <h1 className="auth-brief-title">{t("dashboard.title")}</h1>
        <p className="auth-brief-sub">{t("dashboard.hero.title")}</p>
        <p className="auth-brief-body">{t("dashboard.hero.body")}</p>
      </section>
      <div className="auth-card">
        <span className="auth-corner tl" aria-hidden />
        <span className="auth-corner tr" aria-hidden />
        <span className="auth-corner bl" aria-hidden />
        <span className="auth-corner br" aria-hidden />
        {/* the panel clips the instrument sweep to the console face; the
            brackets stay outside it, on the card */}
        <div className="auth-panel">
          <span className="auth-scan" aria-hidden />
          <div className="auth-brand">
            <span className="brand-mark"><Activity size={18} /></span>
            <span>{t("dashboard.title")}</span>
          </div>
          <span className="auth-kicker">{t("auth.kicker")}</span>
          <h2>{t("auth.welcome")}</h2>
          <p>{t("auth.subtitle")}</p>
          {!configured ? (
            <Alert tone="warn">
              {t("auth.notConfigured")} <code>{window.location.origin}/login/callback</code>
            </Alert>
          ) : null}
          {error ? <Alert tone="error">{error}</Alert> : null}
          <button className="primary-button auth-submit" disabled={!configured || pending} onClick={handleLogin}>
            <LogIn size={18} /> {pending ? t("auth.redirecting") : t("auth.continue")}
          </button>
          <span className="auth-foot">{t("auth.foot")}</span>
        </div>
      </div>
    </div>
  );
}
