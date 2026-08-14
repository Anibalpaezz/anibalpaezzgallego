/**
 * Client-side cookie-consent helpers.
 *
 * Only ever runs in the browser. Keeps the anonymous visitor id in a first-party
 * cookie (`cookie_consent_id`) and the chosen categories in localStorage.
 */
import {
  COOKIE_ID_NAME,
  COOKIE_MAX_AGE,
  CONSENT_PREFS_KEY,
  COOKIE_POLICY_VERSION,
  isUuid,
  type ConsentAction,
  type ConsentMethod,
  type ConsentPrefs,
} from "@/lib/consent";

export const ALL_CATEGORIES_ON: ConsentPrefs = {
  necessary_cookies: true,
  analytics_cookies: true,
  marketing_cookies: true,
  preferences_cookies: true,
};

export const ALL_CATEGORIES_OFF: ConsentPrefs = {
  necessary_cookies: true,
  analytics_cookies: false,
  marketing_cookies: false,
  preferences_cookies: false,
};

export function getCookie(name: string): string | undefined {
  const match = document.cookie.match(
    new RegExp(
      "(?:^|; )" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)",
    ),
  );
  return match ? decodeURIComponent(match[1]) : undefined;
}

export function setCookie(
  name: string,
  value: string,
  maxAgeSec: number,
): void {
  const cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSec}; Path=/; SameSite=Lax`;
  document.cookie = cookie;
}

function uuidFallback(): string {
  const h = "0123456789abcdef";
  const seg = (n: number) =>
    Array.from({ length: n }, () => h[Math.floor(Math.random() * 16)]).join("");
  return `${seg(8)}-${seg(4)}-4${seg(3)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${seg(3)}-${seg(12)}`;
}

/**
 * Returns the persistent anonymous id. Generates a UUID and stores it in the
 * `cookie_consent_id` cookie on first call; reuses it afterwards.
 *
 * The value is always a valid RFC 4122 UUID (the `anonymous_id UUID` column
 * rejects anything else). If a stored cookie holds a non-UUID value (e.g. from
 * an older version), it is regenerated.
 */
export function getOrCreateAnonymousId(): string {
  const existing = getCookie(COOKIE_ID_NAME);
  if (existing && isUuid(existing)) return existing;

  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : uuidFallback();
  setCookie(COOKIE_ID_NAME, id, COOKIE_MAX_AGE);
  return id;
}

export function hasConsentCookie(): boolean {
  return Boolean(getCookie(COOKIE_ID_NAME));
}

export function readConsentPrefs(): ConsentPrefs | null {
  try {
    const raw = localStorage.getItem(CONSENT_PREFS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentPrefs>;
    if (typeof parsed !== "object" || parsed === null) return null;
    return {
      necessary_cookies: true,
      analytics_cookies: parsed.analytics_cookies === true,
      marketing_cookies: parsed.marketing_cookies === true,
      preferences_cookies: parsed.preferences_cookies === true,
    };
  } catch {
    return null;
  }
}

export function writeConsentPrefs(prefs: ConsentPrefs): void {
  try {
    localStorage.setItem(CONSENT_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable (e.g. private mode) — ignore */
  }
}

export interface ConsentRecord {
  anonymous_id: string;
  prefs: ConsentPrefs;
  action: ConsentAction;
  method: ConsentMethod;
  pageUrl: string;
}

/** Posts a consent decision to /api/consent. */
export async function submitConsent(record: ConsentRecord): Promise<boolean> {
  try {
    const res = await fetch("/api/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anonymous_id: record.anonymous_id,
        necessary_cookies: record.prefs.necessary_cookies,
        analytics_cookies: record.prefs.analytics_cookies,
        marketing_cookies: record.prefs.marketing_cookies,
        preferences_cookies: record.prefs.preferences_cookies,
        consent_action: record.action,
        consent_method: record.method,
        policy_version: COOKIE_POLICY_VERSION,
        page_url: record.pageUrl,
      }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean };
    return data.ok === true;
  } catch {
    return false;
  }
}

/**
 * Integration point for third-party analytics / marketing scripts.
 *
 * Only runs when the visitor has explicitly allowed analytics. Call this after
 * the user makes a choice, or on every page load for returning visitors.
 *
 * New providers should be added here, gated on their own category.
 */
