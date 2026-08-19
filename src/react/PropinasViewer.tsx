import { useEffect, useState } from "react";
import { t } from "@/lib/t";
import type { MetodoPago, PropinaRow, Turno } from "@/lib/propinas";

type Lang = "es" | "en" | "fr" | "de" | "zh";

interface PropinasViewerProps {
  lang: Lang;
}

const LOCALES: Record<string, string> = {
  es: "es-ES",
  en: "en-US",
  fr: "fr-FR",
  de: "de-DE",
  zh: "zh-CN",
};

const MADRID_TZ = "Europe/Madrid";
const PER_PAGE = 25;

const TURNO_KEYS: Record<Turno, string> = {
  mañana: "propinas.morning",
  tarde: "propinas.afternoon",
  noche: "propinas.evening",
};

const METODO_KEYS: Record<MetodoPago, string> = {
  efectivo: "propinas.cash",
  tarjeta: "propinas.card",
};

interface RecordsResponse {
  ok: boolean;
  records: PropinaRow[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  error?: string;
}

function interpolate(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    String(vars[key] ?? `{${key}}`),
  );
}

export default function PropinasViewer({ lang }: PropinasViewerProps) {
  const locale = LOCALES[lang] ?? "es-ES";
  const [turno, setTurno] = useState<"" | Turno>("");
  const [metodo, setMetodo] = useState<"" | MetodoPago>("");
  const [page, setPage] = useState(1);
  const [state, setState] = useState<{
    loading: boolean;
    error: boolean;
    data: RecordsResponse | null;
  }>({ loading: true, error: false, data: null });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: false }));

    const params = new URLSearchParams({
      page: String(page),
      perPage: String(PER_PAGE),
    });
    if (turno) params.set("turno", turno);
    if (metodo) params.set("metodo", metodo);

    fetch(`/api/propina-records?${params.toString()}`)
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error(String(res.status))),
      )
      .then((body) => {
        if (cancelled) return;
        if (body && body.ok) {
          setState({ loading: false, error: false, data: body });
        } else {
          setState({ loading: false, error: true, data: null });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ loading: false, error: true, data: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [turno, metodo, page]);

  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
  });
  const dateFmt = new Intl.DateTimeFormat(locale, {
    timeZone: MADRID_TZ,
    dateStyle: "medium",
    timeStyle: "short",
  });

  const shiftLabel = (value: Turno | null) =>
    value ? t(lang, TURNO_KEYS[value]) : "—";
  const metodoLabel = (value: MetodoPago | null) =>
    value ? t(lang, METODO_KEYS[value]) : "—";

  const data = state.data;
  const totalPages = data?.totalPages ?? 1;
  const prevDisabled = state.loading || !data || page <= 1;
  const nextDisabled = state.loading || !data || page >= totalPages;

  return (
    <div className="min-h-screen py-16 md:py-24">
      <div className="container mx-auto px-4 md:px-8">
        <div className="mx-auto mb-12 max-w-2xl animate-fade-in text-center">
          <h1 className="mb-3 text-3xl font-bold tracking-tight md:text-5xl">
            {t(lang, "propinas.recordsTitle")}
          </h1>
          <p className="text-base text-muted-foreground md:text-lg">
            {t(lang, "propinas.recordsSubtitle")}
          </p>
        </div>

        <div className="mx-auto max-w-6xl animate-slide-up rounded-xl border border-border bg-card p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <select
                value={turno}
                onChange={(e) => {
                  setTurno(e.target.value as "" | Turno);
                  setPage(1);
                }}
                className="cursor-pointer rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
                aria-label={t(lang, "propinas.selectFilter")}
              >
                <option value="">{t(lang, "propinas.all")}</option>
                {(["mañana", "tarde", "noche"] as Turno[]).map((key) => (
                  <option key={key} value={key}>
                    {t(lang, TURNO_KEYS[key])}
                  </option>
                ))}
              </select>
            </label>

            <select
              value={metodo}
              onChange={(e) => {
                setMetodo(e.target.value as "" | MetodoPago);
                setPage(1);
              }}
              className="cursor-pointer rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
              aria-label={t(lang, "propinas.selectFilter")}
            >
              <option value="">{t(lang, "propinas.all")}</option>
              {(["efectivo", "tarjeta"] as MetodoPago[]).map((key) => (
                <option key={key} value={key}>
                  {t(lang, METODO_KEYS[key])}
                </option>
              ))}
            </select>

            <span className="ml-auto text-xs text-muted-foreground">
              {data
                ? interpolate(t(lang, "propinas.totalRecords"), {
                    n: data.total,
                  })
                : "…"}
            </span>
          </div>

          {state.error ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t(lang, "propinas.error")}
            </p>
          ) : state.loading ? (
            <div className="space-y-2" aria-live="polite">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 animate-pulse rounded-md bg-secondary/60"
                />
              ))}
            </div>
          ) : data && data.records.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t(lang, "propinas.empty")}
            </p>
          ) : data ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-2">{t(lang, "propinas.date")}</th>
                      <th className="px-3 py-2">{t(lang, "propinas.shift")}</th>
                      <th className="px-3 py-2">
                        {t(lang, "propinas.amount")}
                      </th>
                      <th className="px-3 py-2">
                        {t(lang, "propinas.paymentMethod")}
                      </th>
                      <th className="px-3 py-2">
                        {t(lang, "propinas.address")}
                      </th>
                      <th className="px-3 py-2">
                        {t(lang, "propinas.weather")}
                      </th>
                      <th className="px-3 py-2">{t(lang, "propinas.notes")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.records.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-border/60 last:border-0"
                      >
                        <td className="whitespace-nowrap px-3 py-2">
                          {dateFmt.format(new Date(row.fecha))}
                        </td>
                        <td className="px-3 py-2">{shiftLabel(row.turno)}</td>
                        <td className="whitespace-nowrap px-3 py-2 font-semibold tabular-nums">
                          {money.format(Number(row.cantidad) || 0)}
                        </td>
                        <td className="px-3 py-2">
                          {metodoLabel(row.metodo_pago)}
                        </td>
                        <td
                          className="max-w-[180px] truncate px-3 py-2"
                          title={row.direccion ?? ""}
                        >
                          {row.direccion ?? "—"}
                        </td>
                        <td
                          className="max-w-[120px] truncate px-3 py-2"
                          title={row.clima ?? ""}
                        >
                          {row.clima ?? "—"}
                        </td>
                        <td
                          className="max-w-[220px] truncate px-3 py-2"
                          title={row.notas ?? ""}
                        >
                          {row.notas ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={prevDisabled}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t(lang, "propinas.previous")}
                </button>
                <span className="text-xs text-muted-foreground">
                  {interpolate(t(lang, "propinas.page"), {
                    n: data.page,
                    m: totalPages,
                  })}
                </span>
                <button
                  type="button"
                  disabled={nextDisabled}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t(lang, "propinas.next")}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
