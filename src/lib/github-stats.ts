import raw from "@/data/github-stats.json";

export interface GitHubDay {
  date: string;
  count: number;
  level: number;
}

export interface GitHubWeek {
  firstDay: string;
  days: GitHubDay[];
}

export interface GitHubCalendar {
  weeks: GitHubWeek[];
}

export interface LanguageStat {
  name: string;
  bytes: number;
  color: string | null;
  percentage: number;
}

export type GitHubStatsSource = "graphql" | "rest" | null;

export interface GitHubStats {
  username: string;
  generatedAt: string | null;
  source: GitHubStatsSource;
  repos: number;
  followers: number | null;
  stars: number | null;
  totalCommits: number | null;
  commitsRepos: number;
  totalContributions: number | null;
  currentStreak: number | null;
  longestStreak: number | null;
  languages: LanguageStat[];
  calendar: GitHubCalendar;
}

export const githubStats = raw as GitHubStats;

export function hasCalendar(stats: GitHubStats): boolean {
  return stats.calendar.weeks.length > 0;
}

export function formatNumber(
  n: number | null | undefined,
  locale: string,
): string {
  return typeof n === "number" ? n.toLocaleString(locale) : "—";
}

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Java: "#b07219",
  "C++": "#f34b7d",
  C: "#555555",
  CSharp: "#178600",
  PHP: "#4F5D95",
  Ruby: "#701516",
  Go: "#00ADD8",
  Rust: "#dea584",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  "C#": "#178600",
  HTML: "#e34c26",
  CSS: "#563d7c",
  SCSS: "#c6538c",
  Sass: "#c6538c",
  Astro: "#ff5d01",
  Shell: "#89e051",
  PLpgSQL: "#336791",
  PostgreSQL: "#336791",
  SQL: "#e38c00",
  Markdown: "#083fa1",
  JSON: "#292929",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  Dart: "#00B4AB",
  Lua: "#000080",
  Perl: "#0298c3",
  Haskell: "#5e5086",
  Scala: "#c22d40",
  Elixir: "#6e4a7e",
  Zig: "#ec915c",
};

export function languageColor(lang: LanguageStat): string {
  if (lang.color) return lang.color;
  return LANGUAGE_COLORS[lang.name] ?? "#64748b";
}
