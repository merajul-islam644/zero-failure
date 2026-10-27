import { Home } from "lucide-react";
import { useT } from "../../lib/i18n/LocalizationProvider";

// The lost sector: the login gate's own observatory — drifting stars,
// a HUD console, the 404 as a glowing readout. Same vocabulary as every
// other surface of the machine; same copy as before.
export function NotFoundPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { t } = useT();
  return (
    <section className="auth-screen nf-screen">
      <h1 className="sr-only">Page not found</h1>
      <span className="auth-stars" aria-hidden />
      <span className="auth-stars auth-stars-far" aria-hidden />
      <span className="auth-nebula" aria-hidden />
      <div className="auth-card nf-card">
        <span className="auth-corner tl" aria-hidden />
        <span className="auth-corner tr" aria-hidden />
        <span className="auth-corner bl" aria-hidden />
        <span className="auth-corner br" aria-hidden />
        <div className="auth-panel">
          <span className="auth-scan" aria-hidden />
          <span className="auth-kicker">NAVIGATION FAULT</span>
          <h2 className="nf-code">{t("notFound.title")}</h2>
          <p className="nf-message">{t("notFound.message")}</p>
          <button
            className="primary-button auth-submit"
            onClick={(event) => {
              event.preventDefault();
              onNavigate("/");
            }}
          >
            <Home size={16} /> {t("notFound.home")}
          </button>
        </div>
      </div>
    </section>
  );
}
