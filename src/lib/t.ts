import { translations } from "./translations";

type Lang = "es" | "en" | "fr" | "de" | "zh";

export function t(lang: Lang, path: string): string {
  const keys = path.split(".");
  let value: any = translations[lang] || translations.es;
  for (const k of keys) {
    if (!value) break;
    value = value[k];
  }
  return typeof value === "string" ? value : path;
}

const SUPPORTED: Lang[] = ["es", "en", "fr", "de", "zh"];

export function isLang(s: string | undefined): s is Lang {
  return SUPPORTED.includes(s as Lang);
}

const LANG_NAMES: Record<Lang, string> = {
  es: "Español",
  en: "English",
  fr: "Français",
  de: "Deutsch",
  zh: "中文",
};

export function langName(l: Lang): string {
  return LANG_NAMES[l];
}

export function allLangs(): Lang[] {
  return SUPPORTED;
}

export interface SeoMeta {
  title: string;
  description: string;
}

const SEO_KEYS = [
  "home",
  "about",
  "projects",
  "resume",
  "blog",
  "contact",
  "404",
] as const;
type SeoKey = (typeof SEO_KEYS)[number];

const FALLBACK_SEO: Record<SeoKey, SeoMeta> = {
  home: {
    title: "Aníbal Páez Gallego | Portfolio",
    description:
      "Portfolio de Aníbal Páez Gallego, desarrollador web full-stack especializado en React, TypeScript, Node.js y PostgreSQL.",
  },
  about: {
    title: "Sobre Mí | Aníbal Páez Gallego",
    description: "Conoce más sobre Aníbal Páez Gallego.",
  },
  projects: {
    title: "Proyectos | Aníbal Páez Gallego",
    description: "Selección de proyectos de Aníbal Páez Gallego.",
  },
  resume: {
    title: "Currículum | Aníbal Páez Gallego",
    description: "Experiencia laboral, educación y CV de Aníbal Páez Gallego.",
  },
  blog: {
    title: "Blog | Aníbal Páez Gallego",
    description: "Artículos y reflexiones sobre desarrollo y tecnología.",
  },
  contact: {
    title: "Contacto | Aníbal Páez Gallego",
    description: "Ponte en contacto con Aníbal Páez Gallego.",
  },
  "404": {
    title: "Página no encontrada | Aníbal Páez Gallego",
    description: "La página que buscas no existe.",
  },
};

export function seoMeta(lang: Lang, key: string): SeoMeta {
  const valid = SEO_KEYS.includes(key as SeoKey) ? (key as SeoKey) : "home";
  const dict = (translations[lang] as Record<string, any>)?.seo?.[valid];
  const esDict = (translations.es as Record<string, any>)?.seo?.[valid];
  const title = dict?.title || esDict?.title || FALLBACK_SEO[valid].title;
  const description =
    dict?.description || esDict?.description || FALLBACK_SEO[valid].description;
  return { title, description };
}

/** Determines which route a pathname belongs to (defaults to the home page). */
export function routeKeyFromPath(pathname: string): string {
  const cleaned = pathname
    .replace(/^\/(en|fr|de|zh|es)\/?/, "/")
    .replace(/\/+$/, "");
  const first = cleaned.split("/")[1];
  return (SEO_KEYS as readonly string[]).includes(first ?? "")
    ? first!
    : "home";
}

/**
 * Builds the canonical URL for a route. Spanish (the default locale) keeps the
 * root path (resolving the duplicate `/` vs `/es`), other locales are prefixed.
 */
export function canonicalUrl(
  lang: Lang,
  pathname: string,
  base: string,
): string {
  const origin = base.replace(/\/+$/, "");
  const key = routeKeyFromPath(pathname);
  const path = key === "home" ? "" : `/${key}`;
  const href = lang === "es" ? `${path || "/"}` : `/${lang}${path}`;
  try {
    return new URL(href, origin).toString();
  } catch {
    return origin + href;
  }
}
