// @ts-check
import { defineConfig } from "astro/config";

import react from "@astrojs/react";

import tailwindcss from "@tailwindcss/vite";

import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  // Production origin. Canonical tags, og:url, robots.txt and the sitemap all
  // derive from this. Update here if the domain changes.
  site: "https://anibalpaezzgallego.vercel.app",

  integrations: [
    react(),
    // Generates sitemap-0.xml + sitemap-index.xml from the built pages.
    sitemap(),
  ],

  build: {
    inlineStylesheets: "always",
  },

  vite: {
    plugins: [tailwindcss()],
  },
});
