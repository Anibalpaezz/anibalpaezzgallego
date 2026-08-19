import type { APIRoute } from "astro";
import { fetchTipSummary } from "@/lib/propinas";

export const prerender = false;

function json(data: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export const GET: APIRoute = async () => {
  const summary = await fetchTipSummary();
  if (!summary) {
    return json({ ok: false, error: "Failed to load tip summary" }, 500);
  }
  return json({ ok: true, summary });
};
