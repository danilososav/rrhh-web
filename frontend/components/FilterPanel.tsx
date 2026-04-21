"use client";

import { useState } from "react";
import { uniqueValues, Row, FilterConfig } from "@/lib/filterUtils";

export type { FilterConfig };

type Props = {
  configs: FilterConfig[];
  rows: Row[];
  selected: Record<string, string[]>;
  onChange: (field: string, values: string[]) => void;
};

function FilterGroup({
  config,
  rows,
  selected,
  onChange,
}: {
  config: FilterConfig;
  rows: Row[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(true);
  const options = uniqueValues(rows, config.field);

  function toggle(val: string) {
    if (selected.includes(val)) {
      onChange(selected.filter((v) => v !== val));
    } else {
      onChange([...selected, val]);
    }
  }

  function clearAll() {
    onChange([]);
  }

  return (
    <div className="border-b border-white/[0.06] pb-3 mb-3 last:border-0 last:mb-0 last:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          {config.label}
        </span>
        <div className="flex items-center gap-1">
          {selected.length > 0 && (
            <button
              onClick={clearAll}
              title="Limpiar filtro"
              className="rounded-full w-4 h-4 flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                <path d="M4.293 4.293a1 1 0 0 1 1.414 0L8 6.586l2.293-2.293a1 1 0 1 1 1.414 1.414L9.414 8l2.293 2.293a1 1 0 0 1-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 0 1-1.414-1.414L6.586 8 4.293 5.707a1 1 0 0 1 0-1.414Z" />
              </svg>
            </button>
          )}
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded w-4 h-4 flex items-center justify-center text-slate-500 hover:text-slate-300 transition"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className={`w-3 h-3 transition-transform ${open ? "" : "-rotate-90"}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l5 5 5-5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Chips */}
      {open && (
        <div className="flex flex-wrap gap-1.5">
          {options.map((opt) => {
            const active = selected.includes(opt);
            return (
              <button
                key={opt}
                onClick={() => toggle(opt)}
                className={[
                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-all",
                  active
                    ? "bg-[#4f8ef7]/15 text-[#4f8ef7] border border-[#4f8ef7]/40"
                    : "bg-white/[0.04] text-slate-400 border border-white/[0.08] hover:border-white/20 hover:text-slate-300",
                ].join(" ")}
              >
                {opt}
                {active && (
                  <svg viewBox="0 0 12 12" fill="currentColor" className="w-2.5 h-2.5 opacity-70">
                    <path d="M2.293 2.293a1 1 0 0 1 1.414 0L6 4.586l2.293-2.293a1 1 0 1 1 1.414 1.414L7.414 6l2.293 2.293a1 1 0 0 1-1.414 1.414L6 7.414l-2.293 2.293a1 1 0 0 1-1.414-1.414L4.586 6 2.293 3.707a1 1 0 0 1 0-1.414Z" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function FilterPanel({ configs, rows, selected, onChange }: Props) {
  const hasAny = Object.values(selected).some((v) => v.length > 0);

  function clearAll() {
    configs.forEach((c) => onChange(c.field, []));
  }

  return (
    <aside className="w-64 shrink-0">
      <div className="sticky top-4 rounded-xl border border-white/[0.06] bg-[#111827] p-4">
        {/* Title */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-base">🔵</span>
            <span className="text-sm font-semibold text-slate-200">Filtros</span>
          </div>
          {hasAny && (
            <button
              onClick={clearAll}
              className="text-[11px] text-slate-500 hover:text-[#4f8ef7] transition"
            >
              Limpiar todo
            </button>
          )}
        </div>

        {/* Filter groups */}
        {configs.map((cfg) => (
          <FilterGroup
            key={cfg.field}
            config={cfg}
            rows={rows}
            selected={selected[cfg.field] ?? []}
            onChange={(vals) => onChange(cfg.field, vals)}
          />
        ))}
      </div>
    </aside>
  );
}
