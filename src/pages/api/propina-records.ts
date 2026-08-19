import type { APIRoute } from "astro";
import { fetchTipRecords, isMetodoPago, isTurno } from "@/lib/propinas";

export const prerender = false;

const DEFAULT_PER_PAGE = 25;
const MAX_PER_PAGE = 100;

function json(data: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (raw === null) return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : fallback;
}

export const GET: APIRoute = async ({ url }) => {
  const page = parsePositiveInt(url.searchParams.get("page"), 1);
  const perPage = parsePositiveInt(
    url.searchParams.get("perPage"),
    DEFAULT_PER_PAGE,
  );
  const turnoRaw = url.searchParams.get("turno");
  const metodoRaw = url.searchParams.get("metodo");

  const data = await fetchTipRecords({
    page,
    perPage: Math.min(perPage, MAX_PER_PAGE),
    turno: isTurno(turnoRaw) ? turnoRaw : null,
    metodo: isMetodoPago(metodoRaw) ? metodoRaw : null,
  });

  if (!data) {
    return json({ ok: false, error: "Failed to load tip records" }, 500);
  }
  return json({ ok: true, ...data });
};
