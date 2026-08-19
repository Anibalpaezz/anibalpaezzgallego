/**
 * Server-only helpers for the `propinas` table (personal tip records from a
 * delivery job). Like src/lib/supabase-server.ts, this file must never be
 * imported by any module that gets bundled for the browser: it uses the
 * SUPABASE_SERVICE_ROLE_KEY to bypass RLS.
 */
import { supabaseAdmin } from "@/lib/supabase-server";
import type { Tables } from "@/integrations/supabase/types";

export type PropinaRow = Tables<"propinas">;
export type Turno = "mañana" | "tarde" | "noche";
export type MetodoPago = "efectivo" | "tarjeta";

export const TURNOS: Turno[] = ["mañana", "tarde", "noche"];
export const METODOS_PAGO: MetodoPago[] = ["efectivo", "tarjeta"];

export interface ShiftStat {
  total: number;
  count: number;
}

export interface TipSummary {
  totalAmount: number;
  totalTips: number;
  averageTip: number;
  maxTip: number;
  byShift: Record<Turno, ShiftStat>;
}

export interface PropinaRecords {
  records: PropinaRow[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export function isTurno(value: string | null): value is Turno {
  return value !== null && (TURNOS as readonly string[]).includes(value);
}

export function isMetodoPago(value: string | null): value is MetodoPago {
  return value !== null && (METODOS_PAGO as readonly string[]).includes(value);
}

function emptyShiftStats(): Record<Turno, ShiftStat> {
  return {
    mañana: { total: 0, count: 0 },
    tarde: { total: 0, count: 0 },
    noche: { total: 0, count: 0 },
  };
}

export async function fetchTipSummary(): Promise<TipSummary | null> {
  const { data, error } = await supabaseAdmin
    .from("propinas")
    .select("cantidad, turno");

  if (error || !data) return null;

  const byShift = emptyShiftStats();
  let totalAmount = 0;
  let maxTip = 0;

  for (const row of data) {
    const amount = Number(row.cantidad) || 0;
    totalAmount += amount;
    if (amount > maxTip) maxTip = amount;
    if (row.turno) {
      byShift[row.turno].total += amount;
      byShift[row.turno].count += 1;
    }
  }

  const totalTips = data.length;
  return {
    totalAmount,
    totalTips,
    averageTip: totalTips > 0 ? totalAmount / totalTips : 0,
    maxTip,
    byShift,
  };
}

export interface TipRecordsOptions {
  page: number;
  perPage: number;
  turno?: Turno | null;
  metodo?: MetodoPago | null;
}

export async function fetchTipRecords({
  page,
  perPage,
  turno = null,
  metodo = null,
}: TipRecordsOptions): Promise<PropinaRecords | null> {
  let query = supabaseAdmin
    .from("propinas")
    .select("*", { count: "exact" })
    .order("fecha", { ascending: false });

  if (turno) query = query.eq("turno", turno);
  if (metodo) query = query.eq("metodo_pago", metodo);

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  const { data, count, error } = await query.range(from, to);

  if (error || !data) return null;

  const total = count ?? 0;
  return {
    records: data as PropinaRow[],
    page,
    perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}
