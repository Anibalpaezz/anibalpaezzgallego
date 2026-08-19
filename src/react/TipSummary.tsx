import { useEffect, useState } from "react";
import { t } from "@/lib/t";
import type { TipSummary as TipSummaryData, Turno } from "@/lib/propinas";

type Lang = "es" | "en" | "fr" | "de" | "zh";

interface TipSummaryProps {
  lang: Lang;
}

const LOCALES: Record<string, string> = {
  es: "es-ES",
  en: "en-US",
  fr: "fr-FR",
  de: "de-DE",
  zh: "zh-CN",
};

const TURNO_KEYS: Record<Turno, string> = {
  mañana: "propinas.morning",
  tarde: "propinas.afternoon",
  noche: "propinas.evening",
};

export default function TipSummary({ lang }: TipSummaryProps) {
  const locale = LOCALES[lang] ?? "es-ES";
  const [data, setData] = useState<TipSummaryData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/propina-summary")
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error(String(res.status))),
      )
      .then((body) => {
        if (cancelled) return;
        if (body && body.ok) setData(body.summary as TipSummaryData);
        else setError(true);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
  });
  const integer = new Intl.NumberFormat(locale);

  if (error) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {t(lang, "propinas.error")}
      </p>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-3 py-1" aria-live="polite">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg bg-secondary/60"
            />
          ))}
        </div>
        <div className="h-28 animate-pulse rounded-lg bg-secondary/60" />
      </div>
    );
  }

  const tiles = [
    {
      label: t(lang, "propinas.totalAmount"),
      value: money.format(data.totalAmount),
      emphasize: true,
    },
    {
      label: t(lang, "propinas.totalTips"),
      value: integer.format(data.totalTips),
      emphasize: false,
    },
    {
      label: t(lang, "propinas.averageTip"),
      value: money.format(data.averageTip),
      emphasize: false,
    },
    {
      label: t(lang, "propinas.maxTip"),
      value: money.format(data.maxTip),
      emphasize: false,
    },
  ];

  const shifts: { key: Turno; total: number; count: number }[] = (
    ["mañana", "tarde", "noche"] as Turno[]
  ).map((key) => ({ key, ...data.byShift[key] }));

  const maxShift = Math.max(
    data.byShift.mañana.total,
    data.byShift.tarde.total,
    data.byShift.noche.total,
    1,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-lg border border-border bg-secondary/40 px-3 py-2.5"
          >
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {tile.label}
            </p>
            <p
              className={
                tile.emphasize
                  ? "mt-0.5 truncate text-lg font-extrabold text-primary"
                  : "mt-0.5 truncate text-base font-bold"
              }
            >
              {tile.value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2.5">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {t(lang, "propinas.byShift")}
        </p>
        {shifts.map((s) => (
          <div key={s.key} className="flex items-center gap-3 py-1">
            <span className="w-16 shrink-0 text-sm">
              {t(lang, TURNO_KEYS[s.key])}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                style={{ width: `${(s.total / maxShift) * 100}%` }}
              />
            </div>
            <span className="w-32 shrink-0 text-right text-sm tabular-nums">
              {integer.format(s.count)} · {money.format(s.total)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
