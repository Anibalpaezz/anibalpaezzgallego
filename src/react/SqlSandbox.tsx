import { useEffect, useRef, useState } from "react";
import type { PGlite } from "@electric-sql/pglite";
import { translations } from "@/lib/translations";

type Lang = "es" | "en" | "fr" | "de" | "zh";
type Engine = "postgres" | "mysql";

function tr(lang: Lang, key: string): string {
  let value: any = (translations[lang] as any) ?? translations.es;
  for (const k of key.split(".")) value = value?.[k];
  return typeof value === "string" ? value : key;
}

function fmt(tpl: string, vars: Record<string, unknown>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

const MAX_ROWS = 200;

const SEED_SQL = `CREATE TABLE IF NOT EXISTS inventario (
  id INT PRIMARY KEY,
  producto TEXT NOT NULL,
  stock INT,
  precio NUMERIC(8,2)
);
INSERT INTO inventario (id, producto, stock, precio) VALUES
  (1, 'React', 120, 9.99),
  (2, 'PostgreSQL', 340, 0),
  (3, 'TypeScript', 210, 19.50)
ON CONFLICT (id) DO NOTHING;
`;

const POSTGRES_EXAMPLE = `-- PostgreSQL (PGlite) en el navegador
SELECT
  i.id,
  i.producto,
  i.stock,
  i.precio,
  (i.stock * i.precio) AS valor_total
FROM inventario AS i
ORDER BY valor_total DESC;`;

const MYSQL_EXAMPLE = `-- MySQL vía API (configura MYSQL_* en el .env)
SELECT VERSION() AS version, CURRENT_DATE() AS hoy, NOW() AS ahora;`;

interface LogLine {
  kind: "cmd" | "info" | "ok" | "err";
  text: string;
}

interface TableResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
  elapsedMs: number;
}

export default function SqlSandbox({ lang }: { lang: Lang }) {
  const [engine, setEngine] = useState<Engine>("postgres");
  const [sql, setSql] = useState(POSTGRES_EXAMPLE);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [result, setResult] = useState<TableResult | null>(null);
  const [running, setRunning] = useState(false);

  const dbRef = useRef<PGlite | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = terminalRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  const log = (kind: LogLine["kind"], text: string) => {
    setLogs((prev) => [...prev, { kind, text }]);
  };

  function loadExample() {
    const next = engine === "postgres" ? POSTGRES_EXAMPLE : MYSQL_EXAMPLE;
    setSql(next);
  }

  async function runPostgres(text: string) {
    if (!dbRef.current) {
      log("info", tr(lang, "sandbox.startup"));
      const { PGlite } = await import("@electric-sql/pglite");
      const db = new PGlite();
      dbRef.current = db;
      await db.exec(SEED_SQL);
      log("ok", tr(lang, "sandbox.seeded"));
    }

    const db = dbRef.current;
    const t0 = performance.now();
    const results = await db.exec(text);
    const elapsed = Math.round(performance.now() - t0);
    const last = results[results.length - 1];

    if (!last) {
      setResult(null);
      log("ok", `${tr(lang, "sandbox.noRows")} ${fmt(tr(lang, "sandbox.elapsed"), { ms: elapsed })}`);
      return;
    }

    if (last.fields.length > 0) {
      const rows = last.rows as unknown as Record<string, unknown>[];
      const columns = last.fields.map((f) => f.name);
      setResult({
        columns,
        rows: rows.slice(0, MAX_ROWS),
        rowCount: rows.length,
        truncated: rows.length > MAX_ROWS,
        elapsedMs: elapsed,
      });
      const note =
        rows.length > MAX_ROWS
          ? fmt(tr(lang, "sandbox.truncated"), { n: MAX_ROWS })
          : "";
      log(
        "ok",
        `${fmt(tr(lang, "sandbox.rowsReturned"), { n: rows.length })} ${fmt(tr(lang, "sandbox.elapsed"), { ms: elapsed })} ${note}`.trim(),
      );
    } else {
      const affected = last.affectedRows ?? last.rowCount ?? 0;
      setResult(null);
      log(
        "ok",
        `${fmt(tr(lang, "sandbox.rowsAffected"), { n: affected })} ${fmt(tr(lang, "sandbox.elapsed"), { ms: elapsed })}`,
      );
    }
  }

  async function runMysql(text: string) {
    log("info", tr(lang, "sandbox.connectingMysql"));
    const t0 = performance.now();
    const res = await fetch("/api/sql/mysql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql: text }),
    });
    const data = await res.json();
    const elapsed = Math.round(performance.now() - t0);

    if (!data.ok) {
      const message =
        data.code === "NOT_CONFIGURED"
          ? tr(lang, "sandbox.mysqlNotConfigured")
          : data.error || "MySQL error";
      throw new Error(message);
    }

    if (data.kind === "rows") {
      const rows = data.rows as Record<string, unknown>[];
      setResult({
        columns: data.columns as string[],
        rows,
        rowCount: rows.length,
        truncated: Boolean(data.truncated),
        elapsedMs: elapsed,
      });
      const note = data.truncated
        ? fmt(tr(lang, "sandbox.truncated"), { n: MAX_ROWS })
        : "";
      log(
        "ok",
        `${fmt(tr(lang, "sandbox.rowsReturned"), { n: data.rowCount })} ${fmt(tr(lang, "sandbox.elapsed"), { ms: elapsed })} ${note}`.trim(),
      );
    } else if (data.kind === "affected") {
      setResult(null);
      log(
        "ok",
        `${fmt(tr(lang, "sandbox.rowsAffected"), { n: data.affectedRows })} ${fmt(tr(lang, "sandbox.elapsed"), { ms: elapsed })}`,
      );
    } else {
      setResult(null);
      log(
        "ok",
        `${tr(lang, "sandbox.noRows")} ${fmt(tr(lang, "sandbox.elapsed"), { ms: elapsed })}`,
      );
    }
  }

  async function run() {
    if (running) return;
    const text = sql.trim();
    if (!text) return;
    setRunning(true);
    const firstLine = text.split("\n")[0].slice(0, 160);
    try {
      if (engine === "postgres") {
        log("cmd", `postgres> ${firstLine}`);
        await runPostgres(text);
      } else {
        log("cmd", `mysql> ${firstLine}`);
        await runMysql(text);
      }
    } catch (err) {
      log("err", `${tr(lang, "sandbox.errorLabel")}: ${errMsg(err)}`);
    } finally {
      setRunning(false);
    }
  }

  const activeEngine = (e: Engine) =>
    engine === e
      ? "bg-primary text-primary-foreground border-primary"
      : "bg-background text-foreground border-border hover:bg-secondary";

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-5 pb-3 space-y-1">
        <h3 className="text-2xl font-bold tracking-tight">{tr(lang, "sandbox.title")}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{tr(lang, "sandbox.subtitle")}</p>
      </div>

      <div className="px-5 pb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-input overflow-hidden">
          <button
            type="button"
            onClick={() => setEngine("postgres")}
            disabled={running}
            className={`px-4 py-1.5 text-sm font-medium border-r border-border transition-colors ${activeEngine("postgres")}`}
          >
            {tr(lang, "sandbox.postgres")}
          </button>
          <button
            type="button"
            onClick={() => setEngine("mysql")}
            disabled={running}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${activeEngine("mysql")}`}
          >
            {tr(lang, "sandbox.mysql")}
          </button>
        </div>

        <button
          type="button"
          onClick={loadExample}
          disabled={running}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-60"
        >
          {tr(lang, "sandbox.loadExample")}
        </button>
        <button
          type="button"
          onClick={() => {
            setLogs([]);
            setResult(null);
          }}
          disabled={running}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-60"
        >
          {tr(lang, "sandbox.clear")}
        </button>

        <button
          type="button"
          onClick={run}
          disabled={running}
          className="ml-auto rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60 transition-colors"
        >
          {running ? tr(lang, "sandbox.running") : tr(lang, "sandbox.run")}
        </button>
      </div>

      <div className="px-5 pb-3">
        <textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              run();
            }
          }}
          spellCheck={false}
          placeholder={tr(lang, "sandbox.placeholder")}
          className="w-full min-h-[160px] resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono leading-relaxed outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition-colors"
        />
      </div>

      <div className="px-5 pb-3">
        <div className="rounded-lg border border-black/80 bg-[#0d1117] dark:border-white/10 overflow-hidden">
          <div className="px-4 py-2 border-b border-white/10 flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]"></span>
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]"></span>
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]"></span>
            <span className="ml-2 text-[11px] text-[#8b949e] font-mono">{tr(lang, "sandbox.terminal")}</span>
          </div>
          <div
            ref={terminalRef}
            className="max-h-60 overflow-y-auto px-4 py-3 font-mono text-[13px] leading-relaxed"
          >
            {logs.length === 0 ? (
              <span className="text-[#8b949e]">{tr(lang, "sandbox.noRows")}</span>
            ) : (
              logs.map((line, i) => (
                <div
                  key={i}
                  className={
                    line.kind === "cmd"
                      ? "text-[#7ee787] whitespace-pre-wrap break-words"
                      : line.kind === "ok"
                        ? "text-[#58a6ff] whitespace-pre-wrap break-words"
                        : line.kind === "err"
                          ? "text-[#f85149] whitespace-pre-wrap break-words"
                          : "text-[#8b949e] whitespace-pre-wrap break-words"
                  }
                >
                  {line.text}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {result && (
        <div className="mx-5 mb-4 rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-2 border-b border-border flex items-center justify-between bg-secondary/40">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {tr(lang, "sandbox.output")}
            </h4>
            <span className="text-xs text-muted-foreground font-mono">
              {result.columns.length > 0
                ? `${fmt(tr(lang, "sandbox.rowsReturned"), { n: result.rowCount })} ${fmt(tr(lang, "sandbox.elapsed"), { ms: result.elapsedMs })}`
                : null}
            </span>
          </div>
          {result.columns.length > 0 && result.rows.length > 0 ? (
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary/40">
                    {result.columns.map((col) => (
                      <th
                        key={col}
                        className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap border-b border-border"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i} className="border-b border-border/60 last:border-0">
                      {result.columns.map((col) => (
                        <td
                          key={col}
                          className="px-3 py-1.5 align-top whitespace-nowrap font-mono text-[13px]"
                        >
                          {cell(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-4 py-3 text-sm text-muted-foreground">{tr(lang, "sandbox.noRows")}</p>
          )}
          {result.truncated && (
            <p className="px-4 py-2 text-xs text-amber-600 dark:text-amber-400 border-t border-border">
              {fmt(tr(lang, "sandbox.truncated"), { n: MAX_ROWS })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}