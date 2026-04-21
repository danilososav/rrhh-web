// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

export type FilterConfig = {
  label: string;
  field: string;
};

/** Sumar campo numérico en arreglo de filas */
export function sumField(rows: Row[], field: string): number {
  return rows.reduce((acc, r) => acc + (Number(r[field]) || 0), 0);
}

/** Agrupar filas por valor de un campo */
export function groupBy(rows: Row[], field: string): Record<string, Row[]> {
  return rows.reduce<Record<string, Row[]>>((acc, r) => {
    const k = String(r[field] ?? "");
    if (k && k !== "null" && k !== "undefined") {
      (acc[k] = acc[k] ?? []).push(r);
    }
    return acc;
  }, {});
}

/** Unique non-null values for a field, sorted */
export function uniqueValues(rows: Row[], field: string): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    const v = r[field];
    if (v != null && String(v).trim() !== "" && String(v) !== "null") {
      set.add(String(v).trim());
    }
  }
  return Array.from(set).sort();
}

/** Format Guaraní amounts like the backend fmt_gs */
export function fmtGs(n: number): string {
  if (n == null || isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `₲ ${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `₲ ${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `₲ ${(n / 1_000).toFixed(0)}K`;
  return `₲ ${n.toFixed(0)}`;
}

/** Apply multi-field filter to raw rows */
export function applyFilters(rows: Row[], selected: Record<string, string[]>): Row[] {
  return rows.filter((r) =>
    Object.entries(selected).every(([field, vals]) => {
      if (!vals.length) return true;
      return vals.includes(String(r[field] ?? "").trim());
    })
  );
}
