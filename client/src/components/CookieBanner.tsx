import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  acceptAll,
  applyConsentSideEffects,
  getConsent,
  hasDecided,
  onOpenCookieSettings,
  rejectNonEssential,
  setConsent,
  type ConsentState,
} from '../lib/consent';

type Mode = 'hidden' | 'banner' | 'customize';

export function CookieBanner() {
  const [mode, setMode] = useState<Mode>('hidden');
  const [draft, setDraft] = useState<ConsentState>(() => getConsent());

  // On mount: apply persisted side-effects, then decide whether to show banner.
  useEffect(() => {
    const current = getConsent();
    applyConsentSideEffects(current);
    setDraft(current);
    if (!hasDecided()) setMode('banner');
  }, []);

  // Allow re-opening from the footer or privacy page.
  useEffect(() => {
    return onOpenCookieSettings(() => {
      setDraft(getConsent());
      setMode('customize');
    });
  }, []);

  if (mode === 'hidden') return null;

  const close = (next: ConsentState) => {
    applyConsentSideEffects(next);
    setMode('hidden');
  };

  const handleAcceptAll = () => close(acceptAll());
  const handleRejectAll = () => close(rejectNonEssential());
  const handleSave = () =>
    close(
      setConsent({
        auth_third_party: draft.auth_third_party,
      }),
    );

  return (
    <div
      className="cookie-banner-root"
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-banner-title"
    >
      <div className="cookie-banner">
        {mode === 'banner' && (
          <>
            <div className="cookie-banner-text">
              <h2 id="cookie-banner-title">We respect your privacy</h2>
              <p>
                LaserLedger uses a strictly necessary session cookie to keep you signed in.
                The only optional category below is &ldquo;Sign in with Google&rdquo;, which
                loads a Google script only if you allow it. No analytics, advertising
                trackers or third-party fonts are used.{' '}
                <Link to="/privacy" className="footer-link">
                  Read the full privacy policy
                </Link>
                .
              </p>
            </div>
            <div className="cookie-banner-actions">
              <button
                type="button"
                className="btn ghost"
                onClick={() => setMode('customize')}
              >
                Customize
              </button>
              <button type="button" className="btn ghost" onClick={handleRejectAll}>
                Reject non-essential
              </button>
              <button type="button" className="btn primary" onClick={handleAcceptAll}>
                Accept all
              </button>
            </div>
          </>
        )}

        {mode === 'customize' && (
          <>
            <div className="cookie-banner-text">
              <h2 id="cookie-banner-title">Cookie &amp; tracking preferences</h2>
              <p>
                Toggle the optional categories below. Necessary cookies are always on because
                the site cannot function without them. You can change these choices at any
                time from the footer or the{' '}
                <Link to="/privacy" className="footer-link">
                  privacy page
                </Link>
                .
              </p>
            </div>

            <ul className="cookie-categories">
              <li>
                <label className="cookie-cat">
                  <input type="checkbox" checked disabled />
                  <div>
                    <strong>Strictly necessary</strong>
                    <p>
                      Session cookie (<code>ll_session</code>, HTTP-only, SameSite=Lax) and
                      CSRF token. Required to sign in and submit content. Stored only on
                      <code> laserledger</code> (first party).
                    </p>
                  </div>
                </label>
              </li>
              <li>
                <label className="cookie-cat">
                  <input
                    type="checkbox"
                    checked={draft.auth_third_party}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, auth_third_party: e.target.checked }))
                    }
                  />
                  <div>
                    <strong>Third-party sign-in — Google</strong>
                    <p>
                      Loads the Google Identity Services script from
                      <code> accounts.google.com</code> and may set Google cookies on that
                      domain when you choose to sign in with Google. Not required — you can
                      always create a password-based account instead.
                    </p>
                  </div>
                </label>
              </li>
            </ul>

            <div className="cookie-banner-actions">
              <button type="button" className="btn ghost" onClick={handleRejectAll}>
                Reject non-essential
              </button>
              <button type="button" className="btn ghost" onClick={handleAcceptAll}>
                Accept all
              </button>
              <button type="button" className="btn primary" onClick={handleSave}>
                Save choices
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default CookieBanner;
