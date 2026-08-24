# Aníbal Páez Gallego — Portfolio

Personal portfolio website for Aníbal Páez Gallego, a full-stack developer
specializing in React, TypeScript, Node.js, PostgreSQL and Supabase.

Production: <https://anibalpaezzgallego.com>

## Tech stack

- **Framework:** [Astro 7](https://astro.build/) (static-site generation,
  `@astrojs/cloudflare` adapter — every route is prerendered except the on-demand
  endpoints `/api/consent` and `/api/propina-*`, which run as Cloudflare Pages
  Functions) with React islands (`@astrojs/react`) on the `/blog`, `/contact`,
  GitHub heatmap, delivery-tips card/viewer and cookie-consent UI.
- **Styling:** Tailwind CSS v4 (via `@tailwindcss/vite`) with a custom
  light/dark HSL theme plus seasonal accent themes (spring/summer/autumn/winter,
  resolved from `localStorage` or the current date in `src/lib/seasonTheme.ts`)
  and hand-written utilities in `src/styles/global.css`.
- **i18n:** 5 locales — `es` (default), `en`, `fr`, `de`, `zh`. Copy lives in
  `src/lib/translations.ts` and is read at build time with `t(lang, key)`
  (`.astro` pages) and at runtime with `LanguageContext` (React islands).
- **Data / services:**
  - Supabase — contact form submissions, the cookie-consent log
    (`cookie_consent_log`) and the delivery-tips summary/viewer (`propinas`)
  - EmailJS — contact form email delivery
  - GitHub API — contribution calendar and profile stats (commits, repos,
    streaks, languages), fetched at build time into `src/data/github-stats.json`
    and rendered by the heatmap island on `/about`
  - dev.to API — blog feed
- **SEO:** per-locale meta tags, canonical URLs, Open Graph/Twitter cards,
  JSON-LD (Person + WebSite) and a generated sitemap (`@astrojs/sitemap`,
  excluding the duplicate `/es/` paths since Spanish is served at the root).

## Project structure

```
src/
├── components/
│   ├── Nav.astro            # Top navigation (SSR-rendered, no React)
│   ├── Footer.astro
│   ├── content/             # Page bodies: HomeContent, AboutContent, ...
│   └── ui/                  # shadcn-style components (only the ones in use)
├── data/
│   └── github-stats.json    # Generated at build time by scripts/fetch-github-stats.mjs
├── integrations/supabase/   # Browser client (client.ts) + generated DB types
├── layouts/
│   └── BaseLayout.astro     # Shared <head>: SEO, fonts, analytics, shell
├── pages/
│   ├── *.astro              # Spanish routes at the root (e.g. /about, /resume)
│   ├── 404.astro            # Locale detected from the URL path
│   ├── api/                 # On-demand endpoints (consent + propinas)
│   └── [lang]/*.astro       # Localized routes (e.g. /en/about)
├── react/
│   ├── pages/               # Blog.tsx and Contact.tsx page islands
│   └── *.tsx                # CookieConsent, GithubHeatmap, TipSummary, …
├── contexts/                # LanguageContext, ThemeContext (React islands)
├── hooks/                   # use-toast (used by the contact island)
├── lib/
│   ├── translations.ts      # All UI copy for the 5 locales
│   ├── t.ts                 # t(), SEO/canonical helpers
│   ├── seasonTheme.ts       # Seasonal accent theme resolution
│   ├── github-stats.ts      # Typed access to github-stats.json
│   └── supabase-server.ts   # Service-role client (server-only)
├── scripts/
│   └── app.ts               # Vanilla JS: theme, mobile menu, cookie banner…
├── styles/global.css        # Tailwind v4 entry + custom theme/animations
└── types/global.d.ts        # Window globals used by inline scripts
```

## Commands

| Command                | Action                                                                                    |
| :--------------------- | :---------------------------------------------------------------------------------------- |
| `npm install`          | Install dependencies                                                                      |
| `npm run dev`          | Start the dev server at `localhost:4321`                                                  |
| `npm run build`        | Build the production site to `./dist/` (runs the GitHub stats fetch first via `prebuild`) |
| `npm run stats`        | Refresh `src/data/github-stats.json` manually                                             |
| `npm run preview`      | Preview the production build locally                                                      |
| `npm run check`        | Run `astro check` (TypeScript diagnostics)                                                |
| `npm run format`       | Format the whole repo with Prettier                                                       |
| `npm run format:check` | Check formatting without modifying files                                                  |

## GitHub stats & heatmap

`scripts/fetch-github-stats.mjs` runs automatically before every build
(`prebuild`) and writes `src/data/github-stats.json`: contribution calendar,
total contributions, current/longest streaks, repos, followers, stars, total
commits and language breakdown for `@Anibalpaezz`. It uses the GraphQL API when
`GITHUB_TOKEN` is set (required for calendar data) and falls back to the public
REST API otherwise. `/about` renders the data through the `GithubHeatmap`
island plus stat cards.

## Environment variables

See `.env.example` for a documented template. Copy it to `.env` (git-ignored)
or set the following as environment variables on Cloudflare Pages:

```
PUBLIC_SUPABASE_PROJECT_ID
PUBLIC_SUPABASE_URL
PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY    # server-only — NEVER prefix with PUBLIC_
PUBLIC_EMAILJS_SERVICE_ID
PUBLIC_EMAILJS_TEMPLATE_ID
PUBLIC_EMAILJS_PUBLIC_KEY
GITHUB_TOKEN                 # optional, build-time only (see .env.example)
```

`SUPABASE_SERVICE_ROLE_KEY` is read only by `src/lib/supabase-server.ts` (used by
`/api/consent` and the `/api/propina-*` endpoints). It must never be prefixed
with `PUBLIC_` and is never bundled to the client. `GITHUB_TOKEN` (optional,
used at build time by `scripts/fetch-github-stats.mjs`) is a secret on Cloudflare
Pages too.

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

Third-party analytics scripts are loaded only after the visitor grants
analytics consent. The Vercel Analytics / Speed Insights loaders were removed
during the Cloudflare migration; add a provider in
`src/lib/consent-client.ts` (gated on `analytics_cookies`) if you need one.

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

## Delivery tips viewer (`propinas`)

The Projects page shows a card with a summary of the tips recorded while working
as a delivery driver (total, count, average, max and breakdown by shift), with a
link to a public viewer at `/propinas` (localized variants under `/en/propinas`,
etc.). Both are React islands (`src/react/TipSummary.tsx`,
`src/react/PropinasViewer.tsx`) that read data from two on-demand endpoints:

- `GET /api/propina-summary` → aggregate statistics
- `GET /api/propina-records?page=1&perPage=25&turno=...&metodo=...` → paginated,
  filterable records (`turno`: `mañana|tarde|noche`, `metodo`:
  `efectivo|tarjeta`)

Both endpoints use `src/lib/propinas.ts` with the service-role key, so the
`propinas` table can stay fully private (no RLS policies required). Expected
schema:

```sql
CREATE TABLE propinas (
    id INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    fecha TIMESTAMPTZ NOT NULL,
    turno TEXT CHECK (turno IN ('mañana', 'tarde', 'noche')),
    cantidad NUMERIC(6,2) NOT NULL CHECK (cantidad >= 0),
    metodo_pago TEXT CHECK (metodo_pago IN ('efectivo', 'tarjeta')),
    direccion TEXT,
    clima TEXT,
    notas TEXT
);
```

## Deploying

The site is deployed on Cloudflare Pages from the `main` branch (build command
`npm run build`, output directory `dist`). The production origin is set in
`astro.config.mjs` (`site`, currently `https://anibalpaezzgallego.com`) and is
used for canonical tags, the sitemap and `robots.txt` — update it there if the
domain changes.

### Missing assets

- `public/photos/og-image.png` — Open Graph social preview image (1200×630,
  PNG). Until it's added, social links point to a 404; add the file and
  redeploy.

## Notes

- The blog and contact pages are React islands by design; unifying the two
  i18n paths (`t()` vs `LanguageContext`) is a deliberately deferred
  architectural change.
- `inlineStylesheets` is set to `"always"` in `astro.config.mjs`.
