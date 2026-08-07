/**
 * Shared cookie-consent configuration.
 *
 * Safe to import from both server-side code (API routes) and client-side code
 * (browser bundle). Contains no secrets.
 */

/** Bump this when the cookie policy changes to invalidate old consents. */
export const COOKIE_POLICY_VERSION = "1";

/** First-party cookie that stores the anonymous visitor id. */
export const COOKIE_ID_NAME = "cookie_consent_id";

/** How long the anonymous-id cookie lives, in seconds (1 year). */
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** localStorage key holding the chosen categories (analytics, marketing, ...). */
export const CONSENT_PREFS_KEY = "cookie_consent_prefs";

/** Event fired by the "Configurar cookies" footer button. */
export const OPEN_SETTINGS_EVENT = "open-cookie-settings";

/** Allowed values for `consent_action` (mirrors the DB CHECK constraint). */
export const ALLOWED_ACTIONS = [
  "accepted",
  "rejected",
  "custom",
  "withdrawn",
] as const;
export type ConsentAction = (typeof ALLOWED_ACTIONS)[number];

/** Allowed values for `consent_method` (mirrors the DB CHECK constraint). */
export const ALLOWED_METHODS = ["banner", "settings_panel"] as const;
export type ConsentMethod = (typeof ALLOWED_METHODS)[number];

export interface ConsentPrefs {
  necessary_cookies: boolean;
  analytics_cookies: boolean;
  marketing_cookies: boolean;
  preferences_cookies: boolean;
}

/** Categories a visitor can toggle from the settings panel. */
export const TOGGLEABLE: Array<keyof Omit<ConsentPrefs, "necessary_cookies">> =
  ["analytics_cookies", "marketing_cookies", "preferences_cookies"];

export const isConsentAction = (v: unknown): v is ConsentAction =>
  ALLOWED_ACTIONS.includes(v as ConsentAction);

export const isConsentMethod = (v: unknown): v is ConsentMethod =>
  ALLOWED_METHODS.includes(v as ConsentMethod);

export const toBoolean = (v: unknown): boolean =>
  v === true || v === "true" || v === 1 || v === "1";
