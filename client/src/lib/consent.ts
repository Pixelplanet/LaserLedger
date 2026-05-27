// Cookie / consent management for GDPR compliance.
// Categories:
//   - necessary:        session cookie, CSRF — always on, cannot be disabled
//   - auth_third_party: Google Sign-In (loads accounts.google.com SDK and sets Google cookies)
// We deliberately do NOT include an analytics category — the site uses none.
// Webfonts are self-hosted (see client/src/main.tsx) and therefore not consent-gated.

export type ConsentCategory = 'necessary' | 'auth_third_party';

export interface ConsentState {
  necessary: true;
  auth_third_party: boolean;
  /** ISO timestamp when the user last made a choice. */
  decidedAt: string | null;
  /** Schema version — bump when categories change to re-prompt users. */
  version: number;
}

export const CONSENT_VERSION = 2;
const STORAGE_KEY = 'll_consent_v1';
const EVENT_NAME = 'll-consent-change';
const OPEN_EVENT = 'll-consent-open';

const DEFAULT: ConsentState = {
  necessary: true,
  auth_third_party: false,
  decidedAt: null,
  version: CONSENT_VERSION,
};

function read(): ConsentState {
  if (typeof window === 'undefined') return DEFAULT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    if (parsed.version !== CONSENT_VERSION) return DEFAULT;
    return {
      necessary: true,
      auth_third_party: parsed.auth_third_party === true,
      decidedAt: typeof parsed.decidedAt === 'string' ? parsed.decidedAt : null,
      version: CONSENT_VERSION,
    };
  } catch {
    return DEFAULT;
  }
}

function write(state: ConsentState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage may be unavailable (private mode); silently degrade.
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: state }));
}

export function getConsent(): ConsentState {
  return read();
}

export function hasDecided(): boolean {
  return read().decidedAt !== null;
}

export function setConsent(partial: Partial<Omit<ConsentState, 'necessary' | 'version' | 'decidedAt'>>): ConsentState {
  const current = read();
  const next: ConsentState = {
    ...current,
    ...partial,
    necessary: true,
    decidedAt: new Date().toISOString(),
    version: CONSENT_VERSION,
  };
  write(next);
  return next;
}

export function acceptAll(): ConsentState {
  return setConsent({ auth_third_party: true });
}

export function rejectNonEssential(): ConsentState {
  return setConsent({ auth_third_party: false });
}

export function withdrawAll(): ConsentState {
  // Equivalent to reject-all and explicitly remove any tokens for third-party services.
  return rejectNonEssential();
}

export function onConsentChange(cb: (state: ConsentState) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<ConsentState>).detail);
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}

export function openCookieSettings(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

export function onOpenCookieSettings(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener(OPEN_EVENT, handler);
  return () => window.removeEventListener(OPEN_EVENT, handler);
}

// ─── Side-effect appliers ────────────────────────────────────────────────────

/**
 * Apply DOM side-effects for the current consent state.
 *
 * Currently a no-op: webfonts are self-hosted and the Google Sign-In SDK is
 * loaded on-demand from the login page only after the user opts in. Kept so
 * callers can invoke it unconditionally and future consent-gated assets have
 * a single place to plug in.
 */
export function applyConsentSideEffects(_state: ConsentState): void {
  // Intentionally empty — see docblock above.
  void _state;
}
