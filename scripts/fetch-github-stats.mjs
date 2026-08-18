import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const USERNAME = "Anibalpaezz";
const MAX_REPOS = 100;
const GRAPHQL_URL = "https://api.github.com/graphql";
const REST_BASE = "https://api.github.com";

const token = process.env.GITHUB_TOKEN;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.join(__dirname, "..", "src", "data", "github-stats.json");

const LEVEL_INDEX = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

function emptyStats() {
  return {
    username: USERNAME,
    generatedAt: null,
    source: null,
    repos: 0,
    followers: null,
    stars: null,
    totalCommits: null,
    commitsRepos: 0,
    totalContributions: null,
    currentStreak: null,
    longestStreak: null,
    languages: [],
    calendar: { weeks: [] },
  };
}

function computeStreaks(days) {
  let longest = 0;
  let run = 0;
  for (const d of days) {
    if (d.count > 0) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }
  }
  let current = 0;
  let i = days.length - 1;
  if (i >= 0 && days[i].count === 0) i -= 1;
  while (i >= 0 && days[i].count > 0) {
    current += 1;
    i -= 1;
  }
  return { current, longest };
}

function buildLanguages(acc) {
  const total = Object.values(acc).reduce((sum, l) => sum + l.bytes, 0);
  return Object.values(acc)
    .sort((a, b) => b.bytes - a.bytes)
    .map((l) => ({
      name: l.name,
      color: l.color,
      bytes: l.bytes,
      percentage: total > 0 ? Math.round((l.bytes / total) * 1000) / 10 : 0,
    }));
}

const GRAPHQL_QUERY = `
  query GitHubStats($login: String!, $first: Int!, $langFirst: Int!, $cursor: String) {
    user(login: $login) {
      login
      followers { totalCount }
      repositories(first: $first, after: $cursor, privacy: PUBLIC, isFork: false, orderBy: { field: UPDATED_AT, direction: DESC }) {
        totalCount
        nodes {
          stargazerCount
          languages(first: $langFirst, orderBy: { field: SIZE, direction: DESC }) {
            edges { size node { name color } }
          }
          defaultBranchRef {
            target { ... on Commit { history { totalCount } } }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            firstDay
            contributionDays { date contributionCount contributionLevel }
          }
        }
      }
    }
  }
`;

async function graphqlFetch(variables) {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ query: GRAPHQL_QUERY, variables }),
  });
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}`);
  const body = await res.json();
  if (body.errors && body.errors.length) {
    throw new Error(body.errors.map((e) => e.message).join("; "));
  }
  return body.data;
}

async function fetchViaGraphQL() {
  const stats = emptyStats();
  stats.source = "graphql";
  stats.generatedAt = new Date().toISOString();

  const langAcc = {};
  const days = [];
  let totalCommits = 0;
  let repoCount = 0;
  let stars = 0;
  let cursor = null;
  let calendar = null;

  for (;;) {
    const data = await graphqlFetch({
      login: USERNAME,
      first: 100,
      langFirst: 10,
      cursor,
    });
    const user = data.user;
    if (!user) throw new Error("Usuario no encontrado");
    stats.repos = user.repositories.totalCount;
    stats.followers = user.followers.totalCount;
    if (!calendar)
      calendar = user.contributionsCollection?.contributionCalendar;

    for (const repo of user.repositories.nodes || []) {
      if (repoCount >= MAX_REPOS) break;
      repoCount += 1;
      stars += repo.stargazerCount || 0;
      const commits = repo.defaultBranchRef?.target?.history?.totalCount;
      if (Number.isInteger(commits)) totalCommits += commits;
      for (const edge of repo.languages?.edges || []) {
        const { name, color } = edge.node;
        langAcc[name] = langAcc[name] || { name, color: null, bytes: 0 };
        langAcc[name].bytes += edge.size || 0;
        if (!langAcc[name].color && color) langAcc[name].color = color;
      }
    }
    if (repoCount >= MAX_REPOS) break;
    if (!user.repositories.pageInfo?.hasNextPage) break;
    cursor = user.repositories.pageInfo.endCursor;
  }

  if (calendar) {
    stats.totalContributions = calendar.totalContributions ?? null;
    stats.calendar.weeks = (calendar.weeks || []).map((week) => ({
      firstDay: week.firstDay,
      days: (week.contributionDays || []).map((d) => ({
        date: d.date,
        count: d.contributionCount,
        level: LEVEL_INDEX[d.contributionLevel] ?? 0,
      })),
    }));
    for (const week of stats.calendar.weeks) {
      for (const d of week.days) days.push(d);
    }
    const streaks = computeStreaks(days);
    stats.currentStreak = streaks.current;
    stats.longestStreak = streaks.longest;
  }

  stats.totalCommits = totalCommits;
  stats.commitsRepos = repoCount;
  stats.stars = stars;
  stats.languages = buildLanguages(langAcc);
  return stats;
}

async function restFetch(ghPath) {
  const res = await fetch(`${REST_BASE}${ghPath}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "anibalpaezzgallego-portfolio",
    },
  });
  if (!res.ok) throw new Error(`REST ${ghPath}: HTTP ${res.status}`);
  return res;
}

async function fetchViaREST() {
  const stats = emptyStats();
  stats.source = "rest";
  stats.generatedAt = new Date().toISOString();

  const profile = await (await restFetch(`/users/${USERNAME}`)).json();
  stats.followers = profile.followers ?? null;

  let repos = [];
  let page = 1;
  for (;;) {
    const res = await restFetch(
      `/users/${USERNAME}/repos?per_page=100&page=${page}&sort=updated&type=public`,
    );
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    repos = repos.concat(batch);
    if (batch.length < 100 || repos.length > 500) break;
    page += 1;
  }

  const owned = repos.filter((r) => !r.fork);
  stats.repos = owned.length;

  const langAcc = {};
  let totalCommits = 0;
  let stars = 0;
  let counted = 0;
  for (const repo of owned.slice(0, MAX_REPOS)) {
    counted += 1;
    stars += repo.stargazers_count || 0;
    const langs = await (
      await restFetch(`/repos/${repo.full_name}/languages`)
    ).json();
    for (const [name, bytes] of Object.entries(langs)) {
      langAcc[name] = langAcc[name] || { name, color: null, bytes: 0 };
      langAcc[name].bytes += bytes;
    }
    const commitRes = await restFetch(
      `/repos/${repo.full_name}/commits?per_page=1`,
    );
    const link = commitRes.headers.get("link") || "";
    const last = link.match(/[?&]page=(\d+)>\s*;\s*rel="last"/);
    totalCommits += last ? Number(last[1]) : 0;
  }

  stats.stars = stars;
  stats.totalCommits = totalCommits;
  stats.commitsRepos = counted;
  stats.languages = buildLanguages(langAcc);
  return stats;
}

async function persist(stats, source) {
  await writeFile(outFile, JSON.stringify(stats, null, 2) + "\n", "utf8");
  console.log(
    `[github-stats] Snapshot actualizado (${source}): ${stats.repos} repos, ${stats.totalCommits} commits, ${stats.totalContributions} contribuciones, ${stats.languages.length} lenguajes.`,
  );
}

async function readExisting() {
  try {
    return JSON.parse(await readFile(outFile, "utf8"));
  } catch {
    return null;
  }
}

async function main() {
  await mkdir(path.dirname(outFile), { recursive: true });

  if (token) {
    try {
      await persist(await fetchViaGraphQL(), "GraphQL");
      return;
    } catch (err) {
      console.warn(
        `[github-stats] GraphQL falló (${err?.message ?? err}); intentando REST...`,
      );
    }
  } else {
    console.warn(
      "[github-stats] GITHUB_TOKEN no definido; usando API REST pública (sin gráfico de contribuciones).",
    );
  }

  try {
    await persist(await fetchViaREST(), "REST");
  } catch (err) {
    console.warn(
      `[github-stats] REST falló (${err?.message ?? err}); conservando el snapshot existente.`,
    );
    if (!(await readExisting())) {
      await persist(emptyStats(), "vacío");
    }
  }
}

main().catch((err) => {
  console.error(`[github-stats] Error fatal: ${err?.message ?? err}`);
  process.exit(1);
});
