"use client";

interface DataTableProps {
  rows: Record<string, unknown>[];
  title?: string;
}

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DataTable({ rows, title = "Detalle" }: DataTableProps) {
  if (!rows || rows.length === 0) return null;

  const headers = Object.keys(rows[0]);

  return (
    <div className="mt-8 rounded-xl border border-slate-700 bg-slate-900/60">
      <div className="flex items-center justify-between border-b border-slate-700 px-5 py-3">
        <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
        <button
          onClick={() => downloadCSV(toCSV(rows), `${title.toLowerCase().replace(/\s+/g, "-")}.csv`)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition hover:border-indigo-500 hover:text-indigo-300"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
            />
          </svg>
          Descargar CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-800">
              {headers.map((h) => (
                <th
                  key={h}
                  className="whitespace-nowrap px-4 py-2.5 text-left font-semibold text-slate-400"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-slate-800/50 transition hover:bg-slate-800/40"
              >
                {headers.map((h) => (
                  <td key={h} className="whitespace-nowrap px-4 py-2 text-slate-300">
                    {row[h] === null || row[h] === undefined ? (
                      <span className="text-slate-600">—</span>
                    ) : (
                      String(row[h])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-5 py-2 text-xs text-slate-600">{rows.length} registros</p>
      </div>
    </div>
  );
}
