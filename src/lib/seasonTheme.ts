export type Season = "primavera" | "verano" | "otono" | "invierno";

export type SeasonPreference = Season | "auto";

export const SEASONS: Season[] = ["primavera", "verano", "otono", "invierno"];

export const STORAGE_KEY = "theme_season";

export function isValidSeason(value: unknown): value is Season {
  return typeof value === "string" && (SEASONS as string[]).includes(value);
}

export function getSeason(
  date: Date = new Date(),
  timeZone: string = "Europe/Madrid",
): Season {
  let month: number;
  let day: number;

  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
    const match = /(\d{4})-(\d{2})-(\d{2})/.exec(parts);
    month = match ? Number(match[2]) : date.getMonth() + 1;
    day = match ? Number(match[3]) : date.getDate();
  } catch {
    month = date.getMonth() + 1;
    day = date.getDate();
  }

  if (
    (month === 3 && day >= 21) ||
    (month > 3 && month < 6) ||
    (month === 6 && day <= 20)
  ) {
    return "primavera";
  }

  if (
    (month === 6 && day >= 21) ||
    (month > 6 && month < 9) ||
    (month === 9 && day <= 22)
  ) {
    return "verano";
  }

  if (
    (month === 9 && day >= 23) ||
    (month > 9 && month < 12) ||
    (month === 12 && day <= 20)
  ) {
    return "otono";
  }

  return "invierno";
}

export function getStoredSeason(): Season | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isValidSeason(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function applySeason(season: Season): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-season", season);
}

export function resolveSeason(): Season {
  return getStoredSeason() ?? getSeason();
}

export function setSeasonPreference(preference: SeasonPreference): Season {
  const season =
    preference === "auto" || !isValidSeason(preference)
      ? getSeason()
      : preference;

  if (typeof window !== "undefined") {
    try {
      if (preference === "auto") {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, preference);
      }
    } catch {
      // storage unavailable
    }
  }

  applySeason(season);
  // TODO: Supabase sync — persist the preference (or "auto") on the user
  // profile and hydrate it here when the session loads.
  return season;
}
