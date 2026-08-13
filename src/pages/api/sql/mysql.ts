import type { APIRoute } from "astro";

export const prerender = false;

const MAX_ROWS = 200;
const MAX_SQL_LENGTH = 8192;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const host = import.meta.env.MYSQL_HOST as string | undefined;
  const user = import.meta.env.MYSQL_USER as string | undefined;
  const database = import.meta.env.MYSQL_DATABASE as string | undefined;

  if (!host || !user || !database) {
    return json(
      { ok: false, code: "NOT_CONFIGURED", error: "MySQL is not configured" },
      503,
    );
  }

  let body: { sql?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const sql = typeof body.sql === "string" ? body.sql.trim() : "";
  if (!sql || sql.length > MAX_SQL_LENGTH) {
    return json(
      {
        ok: false,
        error: `sql is required and must be under ${MAX_SQL_LENGTH} characters`,
      },
      400,
    );
  }

  // mysql2 disables multi-statement execution by default in `query()`: a single
  // statement is the most this endpoint can ever run, which keeps it sandboxed.
  const { default: mysql } = await import("mysql2/promise");

  let conn: Awaited<ReturnType<typeof mysql.createConnection>>;
  try {
    conn = await mysql.createConnection({
      host,
      port: Number(import.meta.env.MYSQL_PORT ?? 3306),
      user,
      password: (import.meta.env.MYSQL_PASSWORD as string | undefined) ?? "",
      database,
      connectTimeout: 8000,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return json(
      { ok: false, error: `Could not connect to MySQL: ${message}` },
      502,
    );
  }

  try {
    const [rowsRaw, fieldsRaw] = (await conn.query(sql)) as [any, any[] | undefined];

    if (Array.isArray(rowsRaw)) {
      // Result set (SELECT / SHOW / DESCRIBE / etc.)
      const list = rowsRaw;
      const columns =
        Array.isArray(fieldsRaw) && fieldsRaw.length > 0
          ? fieldsRaw.map((f) => String(f.name))
          : list.length > 0
            ? Object.keys(list[0])
            : [];
      const rows = list
        .slice(0, MAX_ROWS)
        .map((r) => ({ ...r }));
      return json({
        ok: true,
        kind: "rows",
        columns,
        rows,
        rowCount: list.length,
        truncated: list.length > MAX_ROWS,
      });
    }

    if (rowsRaw && typeof rowsRaw === "object") {
      // OkPacket / ResultSetHeader (INSERT / UPDATE / DELETE / DDL …)
      const affected =
        typeof (rowsRaw as any).affectedRows === "number"
          ? (rowsRaw as any).affectedRows
          : 0;
      return json({
        ok: true,
        kind: "affected",
        columns: [],
        rows: [],
        rowCount: 0,
        affectedRows: affected,
        truncated: false,
      });
    }

    return json({
      ok: true,
      kind: "none",
      columns: [],
      rows: [],
      rowCount: 0,
      affectedRows: null,
      truncated: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return json({ ok: false, error: message }, 400);
  } finally {
    conn.end().catch(() => {});
  }
};