import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

async function getGeoFromIp(ip: string | null) {
  if (!ip) return {}
  try {
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,countryCode,regionName,city,timezone`
    )
    const data = await res.json()
    if (data.status !== 'success') return {}
    return {
      country: data.countryCode,
      region: data.regionName,
      city: data.city,
      timezone: data.timezone,
    }
  } catch {
    return {}
  }
}

Deno.serve(async (req) => {
  const body = await req.json()

  const geo = await getGeoFromIp(body.ip_address ?? null)

  const row = {
    anonymous_id: body.anonymous_id,
    user_id: body.user_id ?? null,
    necessary_cookies: body.necessary_cookies,
    analytics_cookies: body.analytics_cookies,
    marketing_cookies: body.marketing_cookies,
    preferences_cookies: body.preferences_cookies,
    consent_action: body.consent_action,
    consent_method: body.consent_method,
    policy_version: body.policy_version,
    ip_address: body.ip_address ?? null,
    user_agent: body.user_agent ?? null,
    browser_language: body.browser_language ?? null,
    page_url: body.page_url ?? null,
    ...geo,
  }

  const { data, error } = await supabase
    .from('cookie_consent_log')
    .insert(row)
    .select()
    .single()

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  })
})