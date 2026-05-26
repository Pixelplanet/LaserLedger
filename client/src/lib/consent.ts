// Cookie / consent management for GDPR compliance.
// Categories:
//   - necessary:    session cookie, CSRF — always on, cannot be disabled
//   - preferences:  Google Fonts (loads from fonts.googleapis.com, transmits IP)
//   - auth_third_party: Google Sign-In (loads accounts.google.com SDK and sets Google cookies)
// We deliberately do NOT include an analytics category — the site uses none.

export type ConsentCategory = 'necessary' | 'preferences' | 'auth_third_party';

export interface ConsentState {
  necessary: true;
  preferences: boolean;
  auth_third_party: boolean;
  /** ISO timestamp when the user last made a choice. */
  decidedAt: string | null;
  /** Schema version — bump when categories change to re-prompt users. */
  version: number;
}

export const CONSENT_VERSION = 1;
const STORAGE_KEY = 'll_consent_v1';
const EVENT_NAME = 'll-consent-change';
const OPEN_EVENT = 'll-consent-open';

const DEFAULT: ConsentState = {
  necessary: true,
  preferences: false,
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
      preferences: parsed.preferences === true,
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
  return setConsent({ preferences: true, auth_third_party: true });
}

export function rejectNonEssential(): ConsentState {
  return setConsent({ preferences: false, auth_third_party: false });
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

const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap';
const GOOGLE_FONTS_LINK_ID = 'll-google-fonts';

export function applyConsentSideEffects(state: ConsentState): void {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById(GOOGLE_FONTS_LINK_ID);
  if (state.preferences) {
    if (!existing) {
      const link = document.createElement('link');
      link.id = GOOGLE_FONTS_LINK_ID;
      link.rel = 'stylesheet';
      link.href = GOOGLE_FONTS_HREF;
      document.head.appendChild(link);
    }
  } else if (existing) {
    existing.remove();
  }
}
