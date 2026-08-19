import { useMemo, useRef, useState } from "react";
import { t } from "@/lib/t";
import type { GitHubDay, GitHubWeek } from "@/lib/github-stats";

export interface GithubHeatmapProps {
  weeks: GitHubWeek[];
  totalContributions: number | null;
  lang: "es" | "en" | "fr" | "de" | "zh";
}

const CELL = 10;
const GAP = 3;
const STRIDE = CELL + GAP;
const ROWS = 7;
const TOOLTIP_ABOVE_MIN = 64;

const LOCALES: Record<string, string> = {
  es: "es-ES",
  en: "en-US",
  fr: "fr-FR",
  de: "de-DE",
  zh: "zh-CN",
};

function parseUTCDate(iso: string): Date {
  return new Date(iso + "T00:00:00Z");
}

function rowOf(date: Date): number {
  return (date.getUTCDay() + 6) % 7;
}

const WEEK_MS = 7 * 86400000;

function mondayOf(date: Date): Date {
  return new Date(date.getTime() - rowOf(date) * 86400000);
}

function dateFmt(locale: string, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale, { timeZone: "UTC", ...opts });
}

interface TipState {
  day: GitHubDay;
  top: number;
  left: number;
  below: boolean;
}

export default function GithubHeatmap({
  weeks,
  totalContributions,
  lang,
}: GithubHeatmapProps) {
  const locale = LOCALES[lang] ?? "es-ES";
  const containerRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TipState | null>(null);

  const columns = useMemo(() => {
    const allDays = weeks
      .flatMap((week) => week.days)
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date));
    const cols: { start: Date; slots: (GitHubDay | null)[] }[] = [];
    for (const day of allDays) {
      const date = parseUTCDate(day.date);
      const start = mondayOf(date);
      const last = cols[cols.length - 1];
      if (!last || last.start.getTime() !== start.getTime()) {
        if (last) {
          const gapWeeks =
            Math.round((start.getTime() - last.start.getTime()) / WEEK_MS) - 1;
          for (let g = 1; g <= gapWeeks; g++) {
            cols.push({
              start: new Date(last.start.getTime() + g * WEEK_MS),
              slots: new Array(ROWS).fill(null),
            });
          }
        }
        cols.push({ start, slots: new Array(ROWS).fill(null) });
      }
      cols[cols.length - 1].slots[rowOf(date)] = day;
    }
    return cols;
  }, [weeks]);

  const monthMarks = useMemo(() => {
    const marks: { index: number; label: string }[] = [];
    let prev = -1;
    columns.forEach((col, i) => {
      const month = col.start.getUTCMonth();
      if (month !== prev) {
        marks.push({
          index: i,
          label: dateFmt(locale, { month: "short" }).format(col.start),
        });
        prev = month;
      }
    });
    return marks;
  }, [columns, locale]);

  const weekdayLabels = useMemo(() => {
    const fmt = dateFmt(locale, { weekday: "narrow" });
    const monday = parseUTCDate("2024-01-01");
    const labels: (string | null)[] = new Array(ROWS).fill(null);
    for (const r of [0, 2, 4]) {
      labels[r] = fmt.format(new Date(monday.getTime() + r * 86400000));
    }
    return labels;
  }, [locale]);

  const longDateFmt = dateFmt(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const showTip = (day: GitHubDay, el: HTMLElement) => {
    const container = containerRef.current;
    if (!container) return;
    const cr = container.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setTip({
      day,
      top: r.top - cr.top,
      left: r.left - cr.left + r.width / 2,
      below: r.top - cr.top < TOOLTIP_ABOVE_MIN,
    });
  };

  if (weeks.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
        {t(lang, "about.githubNoData")}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative overflow-x-auto">
      <div className="inline-block">
        <div className="flex">
          <div className="mr-1.5 flex flex-col gap-[3px] pt-5">
            {weekdayLabels.map((label, r) => (
              <div
                key={r}
                className="flex items-center text-[10px] leading-none text-muted-foreground"
                style={{ height: CELL }}
              >
                {label ?? ""}
              </div>
            ))}
          </div>

          <div className="flex flex-col">
            <div className="relative mb-1 h-4 text-[10px] leading-4 text-muted-foreground">
              {monthMarks.map((m) => (
                <span
                  key={m.index}
                  className="absolute whitespace-nowrap"
                  style={{ left: m.index * STRIDE }}
                >
                  {m.label}
                </span>
              ))}
            </div>

            <div className="flex gap-[3px]">
              {columns.map((col, wi) => (
                <div key={wi} className="flex flex-col gap-[3px]">
                  {col.slots.map((day, r) =>
                    day ? (
                      <button
                        key={r}
                        type="button"
                        tabIndex={0}
                        aria-label={`${longDateFmt.format(parseUTCDate(day.date))}: ${day.count} ${t(lang, "about.githubCommits")}`}
                        onMouseEnter={(e) => showTip(day, e.currentTarget)}
                        onMouseLeave={() => setTip(null)}
                        onFocus={(e) => showTip(day, e.currentTarget)}
                        onBlur={() => setTip(null)}
                        className="cursor-default rounded-[2px] focus:outline-none focus:ring-2 focus:ring-ring/60"
                        style={{
                          width: CELL,
                          height: CELL,
                          backgroundColor: `hsl(var(--gh-level-${day.level}))`,
                        }}
                      />
                    ) : (
                      <div key={r} style={{ width: CELL, height: CELL }} />
                    ),
                  )}
                </div>
              ))}
            </div>

            <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
              <span>
                {typeof totalContributions === "number"
                  ? `${totalContributions.toLocaleString(locale)} ${t(lang, "about.githubContributions")}`
                  : ""}
              </span>
              <span className="flex items-center gap-1">
                <span>{t(lang, "about.githubLess")}</span>
                {[0, 1, 2, 3, 4].map((l) => (
                  <span
                    key={l}
                    className="inline-block rounded-[2px]"
                    style={{
                      width: CELL,
                      height: CELL,
                      backgroundColor: `hsl(var(--gh-level-${l}))`,
                    }}
                  />
                ))}
                <span>{t(lang, "about.githubMore")}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {tip && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md"
          style={{
            top: tip.below ? tip.top + CELL + GAP : tip.top - 8,
            left: tip.left,
            transform: tip.below
              ? "translate(-50%, 0)"
              : "translate(-50%, -100%)",
          }}
        >
          <p className="font-semibold">
            {tip.day.count} {t(lang, "about.githubCommits")}
          </p>
          <p className="text-muted-foreground">
            {longDateFmt.format(parseUTCDate(tip.day.date))}
          </p>
        </div>
      )}
    </div>
  );
}
