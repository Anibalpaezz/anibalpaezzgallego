# Aníbal Páez Gallego — Portfolio

Personal portfolio website for Aníbal Páez Gallego, a full-stack developer
specializing in React, TypeScript, Node.js, PostgreSQL and Supabase.

Production: <https://anibalpaezzgallego.vercel.app>

## Tech stack

- **Framework:** [Astro 6](https://astro.build/) (static-site generation,
  `@astrojs/vercel` adapter — every route is prerendered except `/api/consent`,
  which runs as a Vercel Serverless Function) with React islands
  (`@astrojs/react`) on the `/blog`, `/contact` and cookie-consent UI.
- **Styling:** Tailwind CSS v4 (via `@tailwindcss/vite`) with a custom
  light/dark HSL theme and hand-written utilities in `src/styles/global.css`.
- **i18n:** 5 locales — `es` (default), `en`, `fr`, `de`, `zh`. Copy lives in
  `src/lib/translations.ts` and is read at build time with `t(lang, key)`
  (`.astro` pages) and at runtime with `LanguageContext` (React islands).
- **Data / services:**
  - Supabase — contact form submissions, the Tip Tracker stats, and the
    cookie-consent log (`cookie_consent_log`)
  - EmailJS — contact form email delivery
  - GitHub API — repo stats shown on project cards
  - dev.to API — blog feed
  - Vercel Analytics + Speed Insights (loaded via the consent manager)
- **SEO:** per-locale meta tags, canonical URLs, Open Graph/Twitter cards,
  JSON-LD (Person + WebSite) and a generated sitemap (`@astrojs/sitemap`).

## Project structure

```
src/
├── components/
│   ├── Nav.astro            # Top navigation (SSR-rendered, no React)
│   ├── Footer.astro
│   ├── content/             # Page bodies: HomeContent, AboutContent, ...
│   └── ui/                  # shadcn-style components (only the ones in use)
├── layouts/
│   └── BaseLayout.astro     # Shared <head>: SEO, fonts, analytics, shell
├── pages/
│   ├── *.astro              # Spanish routes at the root (e.g. /about)
│   └── [lang]/*.astro       # Localized routes (e.g. /en/about)
├── react/                   # React islands used by /blog and /contact
├── contexts/                # LanguageContext, ThemeContext (React islands)
├── hooks/                   # use-toast (used by the contact island)
├── lib/
│   ├── translations.ts      # All UI copy for the 5 locales
│   └── t.ts                 # t(), SEO/canonical helpers
├── scripts/
│   └── app.ts               # Vanilla JS: theme, mobile menu, cookie banner…
├── styles/global.css        # Tailwind v4 entry + custom theme/animations
└── types/global.d.ts        # Window globals used by inline scripts
```

## Commands

| Command                | Action                                     |
| :--------------------- | :----------------------------------------- |
| `npm install`          | Install dependencies                       |
| `npm run dev`          | Start the dev server at `localhost:4321`   |
| `npm run build`        | Build the production site to `./dist/`     |
| `npm run preview`      | Preview the production build locally       |
| `npm run check`        | Run `astro check` (TypeScript diagnostics) |
| `npm run format`       | Format the whole repo with Prettier        |
| `npm run format:check` | Check formatting without modifying files   |

## Environment variables

Copy `.env` (git-ignored) from a secure location or set the following on Vercel:

```
PUBLIC_SUPABASE_PROJECT_ID
PUBLIC_SUPABASE_URL
PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY    # server-only — NEVER prefix with PUBLIC_
PUBLIC_EMAILJS_SERVICE_ID
PUBLIC_EMAILJS_TEMPLATE_ID
PUBLIC_EMAILJS_PUBLIC_KEY
```

`SUPABASE_SERVICE_ROLE_KEY` is read only by `src/lib/supabase-server.ts` (used by
`/api/consent`). It must never be prefixed with `PUBLIC_` and is never bundled
to the client.

## Cookie consent

`/api/consent` records a visitor's choice in the `cookie_consent_log` table
(which must already exist in Supabase). The banner is a React island
(`src/react/CookieConsent.tsx`) mounted in `BaseLayout`.

Flow:

1. First visit → no `cookie_consent_id` cookie → the banner appears with
   **Accept all**, **Reject all** and **Customize** (checkboxes for analytics,
   marketing and preferences; necessary is always on).
2. A choice calls `POST /api/consent`. The server solves the visitor's IP from
   `x-forwarded-for`, the `user-agent`, and inserts the row with the service
   role key. `anonymous_id` is a UUID stored in the `cookie_consent_id` cookie
   (Max-Age 1 year, SameSite=Lax) and reused on every submission.
3. The "Configurar cookies" button in the footer re-opens the panel at any
   time (fired via the `open-cookie-settings` event) and writes a new row with
   `consent_method = 'settings_panel'` (`custom` or `withdrawn`).
4. When a change to the policy invalidates existing consents, bump
   `COOKIE_POLICY_VERSION` in `src/lib/consent.ts`. It is sent on every request.

Third-party analytics (Vercel Analytics / Speed Insights) are loaded only after
the visitor grants analytics consent via `loadAnalyticsIfConsented()` /
`loadSpeedInsightsIfConsented()` in `src/lib/consent-client.ts`.

### Testing locally

- `npm run dev`, open the site and delete the `cookie_consent_id` cookie to see
  the banner again.
- To verify the API write to Supabase, either accept/reject in the UI and check
  the `cookie_consent_log` table, or `curl` it directly:

  ```
  curl -X POST http://localhost:4321/api/consent \
    -H "Content-Type: application/json" \
    -d '{"anonymous_id":"550e8400-e29b-41d4-a716-446655440000","necessary_cookies":true,"analytics_cookies":true,"marketing_cookies":false,"preferences_cookies":true,"consent_action":"accept_all","consent_method":"banner"}'
  ```

  In local dev there is no real proxy, so `x-forwarded-for` is empty and the
  stored `ip_address` is `null`. To simulate the header add it explicitly:

  ```
  curl -X POST http://localhost:4321/api/consent \
    -H "Content-Type: application/json" \
    -H "x-forwarded-for: 203.0.113.10, 10.0.0.1" \
    -d '{"anonymous_id":"af0bd4ec-9b1e-4b2a-b6c2-3c1f2d9d8e7f","necessary_cookies":true,"analytics_cookies":false,"marketing_cookies":false,"preferences_cookies":false,"consent_action":"reject_all","consent_method":"settings_panel"}'
  ```

  The endpoint stores the **first** IP in the list (`203.0.113.10`).

- Invalid `consent_action` / `consent_method` return `400` with a clear error,
  instead of throwing a DB `CHECK` constraint violation.

## Deploying

The site is deployed on Vercel from the `main` branch. The production origin
is set in `astro.config.mjs` (`site`) and is used for canonical tags, the
sitemap and `robots.txt` — update it there if the domain changes.

### Missing assets

- `public/photos/og-image.png` — Open Graph social preview image (1200×630,
  PNG). Until it's added, social links point to a 404; add the file and
  redeploy.

## Notes

- The blog and contact pages are React islands by design; unifying the two
  i18n paths (`t()` vs `LanguageContext`) is a deliberately deferred
  architectural change.
- `inlineStylesheets` is kept as a build-time decision; see `astro.config.mjs`.
