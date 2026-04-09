"use client";

import { useState } from "react";
import Link from "next/link";
import { useDashboard } from "@/context/DashboardContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>;

const MODULOS = [
  { key: "nomina",   label: "Nómina",                href: "/nomina"   },
  { key: "rotacion", label: "Rotación de Personal",  href: "/rotacion" },
  { key: "costos",   label: "Costos de Liquidaciones", href: "/costos" },
] as const;

function fmt(n: number | null | undefined, decimals = 1): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("es-PY", { maximumFractionDigits: decimals });
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline gap-3 py-1 border-b border-white/[0.05] last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs font-semibold text-slate-200 text-right">{value}</span>
    </div>
  );
}

function EmpresaCard({
  empresa,
  metricas,
  narrativa,
}: {
  empresa: string;
  metricas: AnyObj;
  narrativa: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#1a1f2e] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 bg-[#4f8ef7]/10 border-b border-[#4f8ef7]/20">
        <h3 className="text-base font-semibold tracking-wide text-[#93c5fd]">{empresa}</h3>
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Métricas */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3">
            Indicadores Clave
          </p>
          <div>
            {metricas.colaboradores_activos != null && (
              <MetricRow label="Colaboradores activos" value={fmt(metricas.colaboradores_activos, 0)} />
            )}
            {metricas.tasa_rotacion != null && (
              <MetricRow label="Tasa de rotación" value={`${fmt(metricas.tasa_rotacion)}%`} />
            )}
            {metricas.tasa_rotacion_holding != null && (
              <MetricRow label="Tasa holding (ref.)" value={`${fmt(metricas.tasa_rotacion_holding)}%`} />
            )}
            {metricas.salidas_total != null && (
              <MetricRow label="Salidas período" value={fmt(metricas.salidas_total, 0)} />
            )}
            {metricas.permanencia_prom_meses != null && (
              <MetricRow label="Permanencia promedio" value={`${fmt(metricas.permanencia_prom_meses)} m`} />
            )}
            {metricas.sobrecosto != null && (
              <MetricRow label="Sobrecosto" value={`₲ ${fmt(metricas.sobrecosto, 0)}`} />
            )}
            {metricas.total_costo != null && (
              <MetricRow label="Costo total liquidaciones" value={`₲ ${fmt(metricas.total_costo, 0)}`} />
            )}
            {metricas.liquidaciones != null && (
              <MetricRow label="Liquidaciones" value={fmt(metricas.liquidaciones, 0)} />
            )}
            {metricas.lider_pct_holding != null && (
              <MetricRow label="% Líderes (holding)" value={`${fmt(metricas.lider_pct_holding)}%`} />
            )}
          </div>
        </div>

        {/* Narrativa IA */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#4f8ef7]" />
            Análisis ejecutivo
          </p>
          {narrativa ? (
            <p className="text-sm text-slate-300 leading-relaxed">{narrativa}</p>
          ) : (
            <p className="text-sm text-slate-600 italic">Sin análisis disponible.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function KpisConsolidados({ kpis }: { kpis: AnyObj }) {
  const items = [
    { label: "Total colaboradores",  value: kpis.total_colaboradores != null ? fmt(kpis.total_colaboradores, 0) : null },
    { label: "Empresas activas",     value: kpis.empresas_activas    != null ? fmt(kpis.empresas_activas, 0)    : null },
    { label: "Mujeres",              value: kpis.pct_mujeres         != null ? `${fmt(kpis.pct_mujeres)}%`      : null },
    { label: "Líderes",              value: kpis.lider_pct           != null ? `${fmt(kpis.lider_pct)}%`        : null },
    { label: "Tasa rotación anual",  value: kpis.tasa_rotacion_anual != null ? `${fmt(kpis.tasa_rotacion_anual)}%` : null },
    { label: "Salidas totales",      value: kpis.salidas_totales     != null ? fmt(kpis.salidas_totales, 0)     : null },
    { label: "Permanencia promedio", value: kpis.permanencia_prom    != null ? `${fmt(kpis.permanencia_prom)} m` : null },
    { label: "Sobrecosto total",     value: kpis.sobrecosto_total    != null ? `₲ ${fmt(kpis.sobrecosto_total, 0)}` : null },
    { label: "Costo total",          value: kpis.costo_total         != null ? `₲ ${fmt(kpis.costo_total, 0)}`  : null },
    { label: "Liquidaciones",        value: kpis.liquidaciones       != null ? fmt(kpis.liquidaciones, 0)       : null },
  ].filter((i) => i.value !== null);

  if (!items.length) return null;

  return (
    <div className="mb-8 rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-4">
        KPIs Consolidados del Holding
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {items.map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-white/[0.06] bg-[#0f1117] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">{label}</p>
            <p className="mt-1.5 text-xl font-bold text-slate-100">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ResumenEjecutivoPage() {
  const { nominaData, rotacionData, costosData } = useDashboard();
  const [result, setResult]   = useState<AnyObj | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const faltantes = MODULOS.filter(({ key }) => {
    if (key === "nomina")   return !nominaData;
    if (key === "rotacion") return !rotacionData;
    if (key === "costos")   return !costosData;
    return false;
  });

  const listos = faltantes.length === 0;

  async function generarResumen() {
    setError(null);
    setLoading(true);
    try {
      const body = {
        nomina:        nominaData   ?? undefined,
        rotacion:      rotacionData ?? undefined,
        liquidaciones: costosData   ?? undefined,
      };
      const res = await fetch(`${API_URL}/api/resumen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(detail?.detail ?? `Error ${res.status}`);
      }
      setResult(await res.json());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  // ── Estado: faltan módulos ──────────────────────────────────────────────────
  if (!listos && !result) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[72vh] gap-8 text-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4f8ef7] mb-2">
            Resumen Ejecutivo con IA
          </p>
          <h1 className="page-title">Análisis Consolidado del Holding</h1>
          <p className="mt-2 text-sm text-slate-400 max-w-md">
            Este módulo consolida los datos de Nómina, Rotación y Costos y genera
            narrativas ejecutivas por empresa usando IA.
          </p>
        </div>

        <div className="w-full max-w-sm space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3">
            Módulos pendientes de carga
          </p>
          {MODULOS.map(({ key, label, href }) => {
            const cargado =
              (key === "nomina"   && !!nominaData)   ||
              (key === "rotacion" && !!rotacionData) ||
              (key === "costos"   && !!costosData);
            return (
              <Link
                key={key}
                href={href}
                className={[
                  "flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition",
                  cargado
                    ? "border-emerald-700/50 bg-emerald-900/10 text-emerald-300 cursor-default pointer-events-none"
                    : "border-white/[0.08] bg-[#1a1f2e] text-slate-300 hover:border-[#4f8ef7]/40 hover:text-[#4f8ef7]",
                ].join(" ")}
              >
                <span className="font-medium">{label}</span>
                {cargado ? (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    Cargado
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    Ir al módulo
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Estado: listo para generar ─────────────────────────────────────────────
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[72vh] gap-6 text-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4f8ef7] mb-2">
            Resumen Ejecutivo con IA
          </p>
          <h1 className="page-title">Análisis Consolidado del Holding</h1>
          <p className="mt-2 text-sm text-slate-400">
            Los 3 datasets están cargados. Hacé click para generar el análisis con IA.
          </p>
        </div>

        {/* Módulos listos */}
        <div className="flex gap-3 flex-wrap justify-center">
          {MODULOS.map(({ label }) => (
            <span key={label} className="flex items-center gap-1.5 rounded-full border border-emerald-700/50 bg-emerald-900/10 px-3 py-1 text-xs text-emerald-400">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              {label}
            </span>
          ))}
        </div>

        {error && (
          <div className="w-full max-w-lg rounded-lg border border-red-700 bg-red-900/30 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <button
          onClick={generarResumen}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl px-8 py-3 text-sm font-semibold text-white shadow-lg transition disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #4f8ef7 0%, #7fb3ff 100%)" }}
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generando análisis con IA…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"
                />
              </svg>
              Generar Resumen Ejecutivo
            </>
          )}
        </button>

        {loading && (
          <p className="text-xs text-slate-500">
            Esto puede tomar unos segundos — Claude analiza cada empresa del holding.
          </p>
        )}
      </div>
    );
  }

  // ── Estado: resultado recibido ─────────────────────────────────────────────
  const narrativas:   Record<string, string> = (result.narrativas        as Record<string, string>) ?? {};
  const metricasEmp:  Record<string, AnyObj> = (result.metricas_empresa  as Record<string, AnyObj>) ?? {};
  const kpisConsol:   AnyObj                 = (result.kpis_consolidados as AnyObj) ?? {};
  const empresas:     string[]               = (result.empresas          as string[]) ?? [];
  const modFaltantes: string[]               = (result.modulos_faltantes as string[]) ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-7">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4f8ef7] mb-1">
            Resumen Ejecutivo con IA
          </p>
          <h1 className="page-title">Análisis Consolidado del Holding</h1>
          <p className="text-sm text-slate-500 mt-0.5">{empresas.length} empresas analizadas</p>
        </div>
        <button
          onClick={() => { setResult(null); setError(null); }}
          className="rounded-lg border border-white/[0.08] bg-[#1a1f2e] px-4 py-2 text-sm text-slate-400 transition hover:border-[#4f8ef7]/40 hover:text-[#4f8ef7]"
        >
          Regenerar
        </button>
      </div>

      {modFaltantes.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber-700/50 bg-amber-900/10 px-4 py-3 text-sm text-amber-400">
          <strong>Datos parciales:</strong> el resumen no incluye {modFaltantes.join(", ")} porque no fueron cargados.
        </div>
      )}

      <KpisConsolidados kpis={kpisConsol} />

      <div className="space-y-5">
        {empresas.map((empresa) => (
          <EmpresaCard
            key={empresa}
            empresa={empresa}
            metricas={metricasEmp[empresa] ?? {}}
            narrativa={narrativas[empresa] ?? ""}
          />
        ))}
      </div>
    </div>
  );
}
