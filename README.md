# Aníbal Páez Gallego — Portfolio

Personal portfolio website for Aníbal Páez Gallego, a full-stack developer
specializing in React, TypeScript, Node.js, PostgreSQL and Supabase.

Production: <https://anibalpaezzgallego.vercel.app>

## Tech stack

- **Framework:** [Astro 6](https://astro.build/) (static site generation) with
  React islands (`@astrojs/react`) on the `/blog` and `/contact` routes.
- **Styling:** Tailwind CSS v4 (via `@tailwindcss/vite`) with a custom
  light/dark HSL theme and hand-written utilities in `src/styles/global.css`.
- **i18n:** 5 locales — `es` (default), `en`, `fr`, `de`, `zh`. Copy lives in
  `src/lib/translations.ts` and is read at build time with `t(lang, key)`
  (`.astro` pages) and at runtime with `LanguageContext` (React islands).
- **Data / services:**
  - Supabase — contact form submissions and the Tip Tracker stats
  - EmailJS — contact form email delivery
  - GitHub API — repo stats shown on project cards
  - dev.to API — blog feed
  - Vercel Analytics + Speed Insights
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

| Command            | Action                                        |
| :----------------- | :-------------------------------------------- |
| `npm install`      | Install dependencies                          |
| `npm run dev`      | Start the dev server at `localhost:4321`      |
| `npm run build`    | Build the production site to `./dist/`        |
| `npm run preview`  | Preview the production build locally          |
| `npm run check`    | Run `astro check` (TypeScript diagnostics)    |
| `npm run format`   | Format the whole repo with Prettier           |
| `npm run format:check` | Check formatting without modifying files |

## Environment variables

Copy `.env` (git-ignored) from a secure location or set the following on Vercel:

```
PUBLIC_SUPABASE_PROJECT_ID
PUBLIC_SUPABASE_URL
PUBLIC_SUPABASE_PUBLISHABLE_KEY
PUBLIC_EMAILJS_SERVICE_ID
PUBLIC_EMAILJS_TEMPLATE_ID
PUBLIC_EMAILJS_PUBLIC_KEY
```

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
