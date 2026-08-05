const USERNAME = "Anibalpaezz";

const GITHUB_CONTRIBUTIONS_URL = `https://github.com/users/${USERNAME}/contributions`;

const CELL = 11;
const GAP = 3;
const STRIDE = CELL + GAP;
const WEEKS = 53;
const DAYS = 7;
const PADDING_X = 4;
const PADDING_Y = 4;

const LEVEL_COLORS = ["#21262d", "#0e4429", "#006d32", "#26a641", "#39d353"];

interface Day {
  date: Date;
  level: number;
}

async function fetchContributions(): Promise<Day[]> {
  const token = import.meta.env.GITHUB_TOKEN as string | undefined;
  const headers: Record<string, string> = {
    "X-Requested-With": "XMLHttpRequest",
    Accept: "text/html",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(GITHUB_CONTRIBUTIONS_URL, { headers });
  if (!res.ok) throw new Error(`GitHub contributions HTTP ${res.status}`);
  const html = await res.text();

  const cells: Day[] = [];
  const re = /data-date="(\d{4}-\d{2}-\d{2})"[^>]*data-level="(\d)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const level = Number(m[2]);
    if (Number.isInteger(level) && level >= 0 && level <= 4) {
      cells.push({ date: new Date(m[1] + "T00:00:00Z"), level });
    }
  }
  if (cells.length === 0) throw new Error("No contribution cells parsed");
  return cells;
}

function emptyGraph(): string {
  const parts: string[] = [];
  for (let w = 0; w < WEEKS; w++) {
    for (let d = 0; d < DAYS; d++) {
      parts.push(
        `<rect x="${PADDING_X + w * STRIDE}" y="${PADDING_Y + d * STRIDE}" width="${CELL}" height="${CELL}" rx="2" fill="${LEVEL_COLORS[0]}"/>`,
      );
    }
  }
  return parts.join("\n  ");
}

export const prerender = true;

export async function GET(): Promise<Response> {
  try {
    const cells = await fetchContributions();

    const start = new Date(cells[0].date);
    const end = new Date(cells[cells.length - 1].date);
    const levelByDate = new Map<string, number>();
    for (const c of cells) {
      levelByDate.set(c.date.toISOString().slice(0, 10), c.level);
    }

    const firstSunday = new Date(start);
    firstSunday.setUTCDate(start.getUTCDate() - start.getUTCDay());

    const width = WEEKS * STRIDE + PADDING_X * 2;
    const height = DAYS * STRIDE + PADDING_Y * 2;

    const rects: string[] = [];
    for (let w = 0; w < WEEKS; w++) {
      for (let d = 0; d < DAYS; d++) {
        const date = new Date(firstSunday);
        date.setUTCDate(firstSunday.getUTCDate() + w * DAYS + d);
        if (date > end) break;
        const key = date.toISOString().slice(0, 10);
        const level = levelByDate.get(key) ?? 0;
        rects.push(
          `<rect x="${PADDING_X + w * STRIDE}" y="${PADDING_Y + d * STRIDE}" width="${CELL}" height="${CELL}" rx="2" fill="${LEVEL_COLORS[level]}"/>`,
        );
      }
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="GitHub contribution graph for ${USERNAME}">
  <rect width="100%" height="100%" fill="transparent"/>
  ${rects.join("\n  ")}
</svg>`;
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    const width = WEEKS * STRIDE + PADDING_X * 2;
    const height = DAYS * STRIDE + PADDING_Y * 2;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="GitHub contribution graph for ${USERNAME}">
  <rect width="100%" height="100%" fill="transparent"/>
  ${emptyGraph()}
</svg>`;
    return new Response(svg, {
      headers: { "Content-Type": "image/svg+xml" },
    });
  }
}
