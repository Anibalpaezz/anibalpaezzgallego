import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  COOKIE_POLICY_VERSION,
  isConsentAction,
  isConsentMethod,
  isIp,
  isUuid,
  toBoolean,
} from "@/lib/consent";

export const prerender = false;

interface ConsentBody {
  anonymous_id?: unknown;
  necessary_cookies?: unknown;
  analytics_cookies?: unknown;
  marketing_cookies?: unknown;
  preferences_cookies?: unknown;
  consent_action?: unknown;
  consent_method?: unknown;
  page_url?: unknown;
}

const ALLOWED_ACTIONS_MESSAGE = "accept_all, reject_all, custom, withdrawn";
const ALLOWED_METHODS_MESSAGE = "banner, settings_panel, api";

function json(data: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  if (
    request.headers.get("content-type")?.includes("application/json") !== true
  ) {
    return json(
      { ok: false, error: "Content-Type must be application/json" },
      400,
    );
  }

  let body: ConsentBody;
  try {
    body = (await request.json()) as ConsentBody;
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, 400);
  }

  // anonymous_id maps to a UUID NOT NULL column: reject anything that is not a
  // valid RFC 4122 UUID (a clear 400 instead of a Postgres "invalid input" error).
  if (!isUuid(body.anonymous_id)) {
    return json(
      {
        ok: false,
        error: "anonymous_id is required and must be a valid UUID",
      },
      400,
    );
  }

  // Validate consent_action / consent_method against the same allowed lists
  // that the DB CHECK constraints enforce (clear error instead of a SQL error).
  if (!isConsentAction(body.consent_action)) {
    return json(
      {
        ok: false,
        error: `consent_action must be one of: ${ALLOWED_ACTIONS_MESSAGE}`,
      },
      400,
    );
  }
  if (!isConsentMethod(body.consent_method)) {
    return json(
      {
        ok: false,
        error: `consent_method must be one of: ${ALLOWED_METHODS_MESSAGE}`,
      },
      400,
    );
  }

  // Derive server-side (never trust the client for these).
  const forwarded = request.headers.get("x-forwarded-for");
  const rawIp =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "";
  // Only pass a token the `INET` column can parse; otherwise leave it NULL.
  const ipAddress = rawIp && isIp(rawIp) ? rawIp : null;
  const userAgent = request.headers.get("user-agent") || null;
  // First tag of Accept-Language (VARCHAR(10) column).
  const browserLanguage =
    request.headers.get("accept-language")?.split(",")[0]?.trim()?.slice(0, 10) ||
    null;

  const { error } = await supabaseAdmin.from("cookie_consent_log").insert({
    anonymous_id: body.anonymous_id,
    ip_address: ipAddress,
    user_agent: userAgent,
    browser_language: browserLanguage,
    page_url:
      typeof body.page_url === "string" && body.page_url.length > 0
        ? body.page_url.slice(0, 2048)
        : null,
    policy_version: COOKIE_POLICY_VERSION,
    necessary_cookies: toBoolean(body.necessary_cookies),
    analytics_cookies: toBoolean(body.analytics_cookies),
    marketing_cookies: toBoolean(body.marketing_cookies),
    preferences_cookies: toBoolean(body.preferences_cookies),
    consent_action: body.consent_action,
    consent_method: body.consent_method,
  });

  if (error) {
    // Surface the underlying cause so it shows up in the response (and in the
    // dev console we also log it server-side).
    console.error("[consent] insert failed:", error.code, error.message, error.details);
    return json(
      {
        ok: false,
        error: "Failed to record consent",
        detail: error.message,
        code: error.code,
      },
      500,
    );
  }

  return json({ ok: true, policy_version: COOKIE_POLICY_VERSION }, 200);
};
