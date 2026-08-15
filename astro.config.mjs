// @ts-check
import { defineConfig } from "astro/config";

import react from "@astrojs/react";

import tailwindcss from "@tailwindcss/vite";

import sitemap from "@astrojs/sitemap";

import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  // Production origin. Canonical tags, og:url, robots.txt and the sitemap all
  // derive from this. Update here if the domain changes.
  site: "https://anibalpaezzgallego.com",

  // Default `output: "static"`: every route is prerendered (static) except the
  // endpoints that opt out with `export const prerender = false` (e.g.
  // /api/consent), which run on demand. On Cloudflare Pages the non-prerendered
  // routes become Pages Functions.
  adapter: cloudflare({}),

  integrations: [
    react(),
    // Generates sitemap-0.xml + sitemap-index.xml from the built pages.
    // The default locale (es) is served at bare paths (/, /about, ...), so the
    // duplicated /es/ variants are excluded to avoid duplicate URLs in the index.
    sitemap({
      filter: (page) => !page.includes("/es/"),
    }),
  ],

  build: {
    inlineStylesheets: "always",
  },

  vite: {
    plugins: [tailwindcss()],
  },
});
