import { Home } from "lucide-react";
import { useT } from "../../lib/i18n/LocalizationProvider";

// The diagnostics console: the observatory again, the failure spoken in
// the machine's own voice — a fault readout, the plain-language line
// under it, one way back. Same copy as before.
export function ErrorPage({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const { t } = useT();
  return (
    <section className="auth-screen nf-screen">
      <h1 className="sr-only">Diagnostics</h1>
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
          <span className="auth-kicker">DIAGNOSTICS</span>
          <h2 className="nf-code nf-code-word">{t("common.error")}</h2>
          <p className="nf-message">The page could not finish loading. Try again or return home.</p>
          <button className="primary-button auth-submit" onClick={() => onNavigate?.("/")}>
            <Home size={16} /> {t("notFound.home")}
          </button>
        </div>
      </div>
    </section>
  );
}
