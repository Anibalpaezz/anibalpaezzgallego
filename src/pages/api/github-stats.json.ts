import type { APIRoute } from "astro";

const USERNAME = "Anibalpaezz";

const CONTRIBUTIONS_URL = `https://github.com/users/${USERNAME}/contributions`;
const PROFILE_URL = `https://api.github.com/users/${USERNAME}`;

function json(data: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

export const prerender = false;

export const GET: APIRoute = async () => {
  // Número de contribuciones del último año, a partir del propio histórico que
  // usa el gráfico (/api/contributions.svg): los `data-level` de las celdas.
  let contributions: number | null = null;
  try {
    const token = import.meta.env.GITHUB_TOKEN as string | undefined;
    const headers: Record<string, string> = {
      "X-Requested-With": "XMLHttpRequest",
      Accept: "text/html",
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(CONTRIBUTIONS_URL, { headers });
    if (res.ok) {
      const html = await res.text();
      const levels = [...html.matchAll(/data-level="(\d)"/g)].map((m) =>
        Number(m[1]),
      );
      if (levels.length > 0) contributions = levels.reduce((a, b) => a + b, 0);
    }
  } catch {
    contributions = null;
  }

  // Datos del perfil (+ seguidores, repos, stars) vía API pública de GitHub.
  let repos: number | null = null;
  let followers: number | null = null;
  let stars: number | null = null;
  try {
    const res = await fetch(PROFILE_URL, {
      headers: {
        Accept: "application/vnd.github+json",
      },
    });
    if (res.ok) {
      const perfil = (await res.json()) as {
        public_repos?: number;
        followers?: number;
      };
      repos = perfil.public_repos ?? null;
      followers = perfil.followers ?? null;
    }
  } catch {
    repos = null;
    followers = null;
  }

  if (contributions === null && repos === null && followers === null) {
    return json({ error: "GitHub stats unavailable" }, 502);
  }

  return json({
    contributions,
    repos,
    followers,
    stars,
  });
};