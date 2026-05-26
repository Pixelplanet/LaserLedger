import { Link } from 'react-router-dom';
import PageBlock from '../components/PageBlock';
import { openCookieSettings } from '../lib/consent';

export default function PrivacyPage() {
  const updated = '2026-05-26';
  return (
    <PageBlock
      title="Privacy Policy"
      subtitle={`How LaserLedger collects, uses, stores and protects your personal data — written to comply with the EU General Data Protection Regulation (GDPR) and the German Federal Data Protection Act (BDSG). Last updated: ${updated}.`}
    >
      <h2>1. Controller</h2>
      <p>
        The controller responsible for processing your personal data within the meaning of
        Art. 4(7) GDPR is:
      </p>
      <p>
        <strong>Thomas Winnerl</strong>
        <br />
        Pixelplanet
        <br />
        Email:{' '}
        <a href="mailto:privacy@lasertools.org">privacy@lasertools.org</a>
      </p>
      <p>
        We have not appointed a Data Protection Officer because we are not legally required
        to do so under Art. 37 GDPR. For privacy-related requests please use the address
        above.
      </p>

      <h2>2. Scope of this policy</h2>
      <p>
        This policy applies to the website <code>laserledger</code> and all related
        sub-domains operated by the controller. It does not apply to third-party services
        that are linked to from LaserLedger; consult their own policies.
      </p>

      <h2>3. Hosting &amp; access logs</h2>
      <p>
        The site is hosted on a server located in the European Union (Hetzner Online GmbH,
        Germany). When you visit a page, the server automatically processes the following
        technical data to make the connection work and to protect against abuse:
      </p>
      <ul>
        <li>IP address (truncated after 30 days)</li>
        <li>Date and time of the request</li>
        <li>HTTP method, requested URL and response status</li>
        <li>User agent string and referrer URL sent by your browser</li>
      </ul>
      <p>
        Legal basis: Art. 6(1)(f) GDPR (legitimate interest in operating a secure, stable
        service). Retention: 30 days, after which records are deleted automatically.
      </p>

      <h2>4. Cookies and similar technologies</h2>
      <p>
        We use a minimal set of cookies. The table below lists each cookie or storage item,
        its purpose, its lifetime and its legal basis. You can change your optional
        choices at any time using the{' '}
        <button
          type="button"
          className="footer-link"
          onClick={() => openCookieSettings()}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}
        >
          cookie settings dialog
        </button>
        .
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Provider</th>
              <th>Category</th>
              <th>Purpose</th>
              <th>Lifetime</th>
              <th>Legal basis</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>ll_session</code></td>
              <td>LaserLedger (first party)</td>
              <td>Strictly necessary</td>
              <td>
                Signed, HTTP-only, SameSite=Lax session cookie that keeps you signed in
                after login.
              </td>
              <td>Session / up to 30&nbsp;days</td>
              <td>Art. 6(1)(b) GDPR (contract), §&nbsp;25(2) TTDSG</td>
            </tr>
            <tr>
              <td><code>ll_csrf</code></td>
              <td>LaserLedger (first party)</td>
              <td>Strictly necessary</td>
              <td>
                Cross-site request forgery token bound to your session, required for any
                state-changing request.
              </td>
              <td>Session</td>
              <td>Art. 6(1)(f) GDPR, §&nbsp;25(2) TTDSG</td>
            </tr>
            <tr>
              <td><code>ll_consent_v1</code></td>
              <td>LaserLedger (first party, localStorage)</td>
              <td>Strictly necessary</td>
              <td>
                Stores your cookie-banner choices so we do not ask you again on every page
                load.
              </td>
              <td>12&nbsp;months</td>
              <td>§&nbsp;25(2) TTDSG (required to honour your choice)</td>
            </tr>
            <tr>
              <td>Google Fonts cache</td>
              <td>Google Ireland Ltd. / Google LLC (USA)</td>
              <td>Preferences (optional)</td>
              <td>
                Downloads the Inter and IBM Plex Mono webfonts from
                <code> fonts.googleapis.com</code> and <code>fonts.gstatic.com</code>.
                Transmits your IP address to Google. Only loaded if you accept the
                &ldquo;Preferences&rdquo; category.
              </td>
              <td>Browser HTTP cache (typ. up to 1&nbsp;year)</td>
              <td>Art. 6(1)(a) GDPR, §&nbsp;25(1) TTDSG (consent)</td>
            </tr>
            <tr>
              <td>Google Sign-In cookies</td>
              <td>Google Ireland Ltd. / Google LLC (USA)</td>
              <td>Third-party sign-in (optional)</td>
              <td>
                When you choose &ldquo;Sign in with Google&rdquo; we load the Google
                Identity Services script. Google sets its own cookies on
                <code> accounts.google.com</code> under its own policy. We only receive
                the verified email, the Google account ID and an avatar URL.
              </td>
              <td>Set by Google (typ. up to 2&nbsp;years)</td>
              <td>Art. 6(1)(a) GDPR, §&nbsp;25(1) TTDSG (consent)</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        We do <strong>not</strong> use analytics, advertising, A/B-testing, fingerprinting,
        session-replay or cross-site tracking cookies.
      </p>

      <h2>5. Account data</h2>
      <p>
        When you create an account we process the data you provide and the data the system
        generates as a consequence of your actions:
      </p>
      <ul>
        <li>Email address (required, used for sign-in and security notifications)</li>
        <li>Password (stored only as an Argon2id hash; we never see the plaintext)</li>
        <li>Display name and (optionally) a short bio and avatar URL</li>
        <li>
          Email-verification, password-reset and login-attempt timestamps for security and
          rate-limiting
        </li>
        <li>The role assigned to your account (user, moderator, admin)</li>
      </ul>
      <p>
        Legal basis: Art. 6(1)(b) GDPR (performance of the user contract). Retention: for
        as long as the account exists. You may delete your account at any time from the
        <Link to="/account"> account page</Link>; deletion is irreversible and anonymises
        the public posts you have made.
      </p>

      <h2>6. Sign in with Google (optional)</h2>
      <p>
        If you enable the &ldquo;Third-party sign-in&rdquo; category in the cookie dialog
        and choose to sign in with Google, we use Google Identity Services provided by
        Google Ireland Ltd., Gordon House, Barrow Street, Dublin 4, Ireland, with
        processing also taking place at Google LLC (USA). Google issues us a short-lived
        ID token that we verify server-side; from this token we extract only the verified
        email address, the stable Google account identifier (<code>sub</code>) and, if
        present, your display name and profile picture URL.
      </p>
      <p>
        Legal basis: Art. 6(1)(a) GDPR (consent). Transfer to the USA is covered by the
        <strong> EU&ndash;U.S. Data Privacy Framework</strong> for which Google LLC is
        certified. You can withdraw consent at any time in the cookie settings; doing so
        does not affect the lawfulness of past processing.
      </p>

      <h2>7. User-generated content</h2>
      <p>
        Submissions, comments, votes, reports and images you upload are stored together
        with your user ID, IP address and timestamps. Public fields are visible to
        everyone; moderation logs are visible only to moderators and administrators.
        Uploaded images are processed with{' '}
        <a href="https://sharp.pixelplumbing.com/" target="_blank" rel="noopener noreferrer">
          libvips/Sharp
        </a>{' '}
        into thumbnail, card and original variants and stored on the same EU server. Image
        EXIF metadata is stripped on upload.
      </p>
      <p>Legal basis: Art. 6(1)(b) GDPR. Retention: until you delete the content or your account.</p>

      <h2>8. Transactional email</h2>
      <p>
        We send transactional email (account verification, password reset, moderation
        notifications) via our own SMTP relay. We do not run marketing newsletters and do
        not share your address with third parties for marketing purposes.
      </p>
      <p>Legal basis: Art. 6(1)(b) GDPR.</p>

      <h2>9. Recipients and processors</h2>
      <ul>
        <li>
          <strong>Hetzner Online GmbH</strong>, Germany &mdash; hosting infrastructure
          (data processing agreement in place pursuant to Art. 28 GDPR).
        </li>
        <li>
          <strong>Google Ireland Ltd. / Google LLC</strong> &mdash; only if you opted in to
          Google Fonts or Sign in with Google (see sections 4 and 6).
        </li>
      </ul>
      <p>We do not sell, rent or trade personal data.</p>

      <h2>10. International transfers</h2>
      <p>
        All primary processing takes place inside the EU. The only routine transfer outside
        the EU is to Google LLC when you opt in to a Google service, which is governed by
        the EU&ndash;U.S. Data Privacy Framework and Google&rsquo;s Standard Contractual
        Clauses.
      </p>

      <h2>11. Your rights under GDPR</h2>
      <p>You have the following rights regarding your personal data:</p>
      <ul>
        <li>Right of access (Art. 15)</li>
        <li>Right to rectification (Art. 16)</li>
        <li>Right to erasure / &ldquo;to be forgotten&rdquo; (Art. 17)</li>
        <li>Right to restriction of processing (Art. 18)</li>
        <li>Right to data portability (Art. 20)</li>
        <li>Right to object to processing based on legitimate interests (Art. 21)</li>
        <li>
          Right to withdraw consent at any time (Art. 7(3)) &mdash; e.g. via the cookie
          settings dialog
        </li>
      </ul>
      <p>
        You can exercise most of these rights directly from the{' '}
        <Link to="/account">account page</Link>: you can export all data attached to your
        account, change your details, or permanently delete the account. For requests we
        cannot serve in-app, email us at{' '}
        <a href="mailto:privacy@lasertools.org">privacy@lasertools.org</a> and we will
        respond within 30 days as required by Art. 12(3) GDPR.
      </p>
      <p>
        You also have the right to lodge a complaint with a supervisory authority (Art. 77
        GDPR). The competent authority for the controller is the Austrian Data Protection
        Authority (<em>Datenschutzbehörde</em>), Barichgasse 40&ndash;42, 1030 Vienna,
        Austria.
      </p>

      <h2>12. Security</h2>
      <p>
        Traffic to the site is encrypted with TLS&nbsp;1.3. Passwords are hashed with
        Argon2id. Sessions are bound to a signed HTTP-only cookie with SameSite=Lax. We
        enforce a strict Content Security Policy, rate-limit authentication and image
        endpoints, and apply automated image moderation on upload.
      </p>

      <h2>13. Children</h2>
      <p>
        LaserLedger is not directed at children under 16. If we learn that a person under
        16 has provided personal data without parental consent, we will delete the account
        and associated data.
      </p>

      <h2>14. Changes to this policy</h2>
      <p>
        We may update this policy when the site or applicable law changes. Material changes
        will be announced on the site. The version is identified by the
        &ldquo;Last updated&rdquo; date at the top of this page.
      </p>
    </PageBlock>
  );
}
