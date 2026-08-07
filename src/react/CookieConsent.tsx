import { useEffect, useState } from "react";
import { ShieldCheck, Cookie, X } from "lucide-react";
import { translations } from "@/lib/translations";
import {
  COOKIE_POLICY_VERSION,
  OPEN_SETTINGS_EVENT,
  type ConsentAction,
  type ConsentPrefs,
} from "@/lib/consent";
import {
  ALL_CATEGORIES_OFF,
  ALL_CATEGORIES_ON,
  getOrCreateAnonymousId,
  hasConsentCookie,
  readConsentPrefs,
  submitConsent,
  writeConsentPrefs,
  loadAnalyticsIfConsented,
  loadSpeedInsightsIfConsented,
} from "@/lib/consent-client";

type Lang = "es" | "en" | "fr" | "de" | "zh";

function tr(lang: Lang, key: string): string {
  let value: any = (translations[lang] as any) ?? translations.es;
  for (const k of key.split(".")) value = value?.[k];
  return typeof value === "string" ? value : key;
}

export default function CookieConsent({ lang }: { lang: Lang }) {
  const [bannerVisible, setBannerVisible] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState(
    () => readConsentPrefs() ?? { ...ALL_CATEGORIES_OFF },
  );

  useEffect(() => {
    // Show the banner on first visit (no anon-id cookie yet).
    if (!hasConsentCookie()) setBannerVisible(true);
    else {
      // Returning visitor: load analytics if previously allowed (no-op otherwise).
      loadAnalyticsIfConsented();
      loadSpeedInsightsIfConsented();
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      setPanelVisible(true);
      setBannerVisible(false);
    };
    window.addEventListener(OPEN_SETTINGS_EVENT, handler);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, handler);
  }, []);

  const persist = async (
    next: ConsentPrefs,
    action: ConsentAction,
    method: "banner" | "settings_panel",
  ) => {
    setSaving(true);
    writeConsentPrefs(next);
    // Reuse the same anonymous id: generate it now (first time) or read it back.
    const anonymous_id = getOrCreateAnonymousId();
    await submitConsent({
      anonymous_id,
      prefs: next,
      action,
      method,
      pageUrl: window.location.href,
    });
    setSaving(false);
    setBannerVisible(false);
    setPanelVisible(false);
    loadAnalyticsIfConsented();
    loadSpeedInsightsIfConsented();
  };

  const handleAcceptAll = () => {
    persist({ ...ALL_CATEGORIES_ON }, "accept_all", "banner");
  };

  const handleRejectAll = () => {
    persist({ ...ALL_CATEGORIES_OFF }, "reject_all", "banner");
  };

  const handleSaveCustom = () => {
    const nothingExtraEnabled =
      !prefs.analytics_cookies &&
      !prefs.marketing_cookies &&
      !prefs.preferences_cookies;
    persist(
      { ...prefs, necessary_cookies: true },
      nothingExtraEnabled ? "withdrawn" : "custom",
      "settings_panel",
    );
  };

  const toggle = (
    key: "analytics_cookies" | "marketing_cookies" | "preferences_cookies",
  ) => {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  };

  if (!bannerVisible && !panelVisible) return null;

  return (
    <>
      {bannerVisible && (
        <div className="fixed bottom-0 left-0 right-0 z-[60] p-4 animate-slide-up">
          <div className="mx-auto max-w-3xl rounded-xl border border-border bg-card shadow-lg p-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <Cookie className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {tr(lang, "cookieBanner.text")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleAcceptAll}
                  disabled={saving}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60 transition-opacity"
                >
                  {tr(lang, "cookieBanner.acceptAll")}
                </button>
                <button
                  type="button"
                  onClick={handleRejectAll}
                  disabled={saving}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60 transition-colors"
                >
                  {tr(lang, "cookieBanner.rejectAll")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPanelVisible(true);
                    setBannerVisible(false);
                  }}
                  disabled={saving}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60 transition-colors"
                >
                  {tr(lang, "cookieBanner.customize")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {panelVisible && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setPanelVisible(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-6 w-6 text-primary" />
                <h2 className="text-lg font-bold">
                  {tr(lang, "cookieBanner.settingsTitle")}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPanelVisible(false)}
                className="rounded-md p-1 hover:bg-secondary transition-colors"
                aria-label={tr(lang, "cookieBanner.close")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              {tr(lang, "cookieBanner.settingsIntro")}
            </p>

            <div className="mt-5 space-y-3">
              {(
                [
                  ["necessary", "necessary_cookies", true],
                  ["analytics", "analytics_cookies", prefs.analytics_cookies],
                  ["marketing", "marketing_cookies", prefs.marketing_cookies],
                  [
                    "preferences",
                    "preferences_cookies",
                    prefs.preferences_cookies,
                  ],
                ] as const
              ).map(([key, field, checked]) => (
                <label
                  key={key}
                  className="flex items-start gap-3 rounded-lg border border-border p-3"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-primary"
                    checked={checked}
                    disabled={field === "necessary_cookies"}
                    onChange={() =>
                      toggle(
                        field as
                          | "analytics_cookies"
                          | "marketing_cookies"
                          | "preferences_cookies",
                      )
                    }
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {tr(lang, `cookieBanner.${key}`)}
                      {field === "necessary_cookies" && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({tr(lang, "cookieBanner.necessaryLabel")})
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {tr(lang, `cookieBanner.${key}Desc`)}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleSaveCustom}
                disabled={saving}
                className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60 transition-opacity"
              >
                {saving
                  ? tr(lang, "cookieBanner.saving")
                  : tr(lang, "cookieBanner.save")}
              </button>
            </div>

            <p className="mt-3 text-[11px] text-muted-foreground">
              v{COOKIE_POLICY_VERSION}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
