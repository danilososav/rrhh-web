"use client";

import { useState } from "react";
import Link from "next/link";
import KpiCard from "@/components/KpiCard";
import { useDashboard } from "@/context/DashboardContext";
import { authHeaders } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>;

const MODULOS = [
  { key: "nomina",        label: "Nómina",                  href: "/nomina"        },
  { key: "rotacion",      label: "Rotación de Personal",    href: "/rotacion"      },
  { key: "costos",        label: "Costos de Liquidaciones", href: "/costos"        },
  { key: "reclutamiento", label: "Reclutamiento",           href: "/reclutamiento" },
] as const;

function fmt(n: number | null | undefined, decimals = 1): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("es-PY", { maximumFractionDigits: decimals });
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline gap-3 py-1.5 last:border-0" style={{ borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 12, color: "var(--text2)" }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{value}</span>
    </div>
  );
}

function EmpresaCard({ empresa, metricas, narrativa }: { empresa: string; metricas: AnyObj; narrativa: string }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
      <div className="px-5 py-3" style={{ background: "rgba(124,90,246,0.08)", borderBottom: "1px solid rgba(124,90,246,0.2)" }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--accent)" }}>{empresa}</h3>
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <p className="label-xs mb-3">Indicadores Clave</p>
          <div>
            {metricas.colaboradores_activos != null && <MetricRow label="Colaboradores activos" value={fmt(metricas.colaboradores_activos, 0)} />}
            {metricas.tasa_rotacion != null && <MetricRow label="Tasa de rotación" value={`${fmt(metricas.tasa_rotacion)}%`} />}
            {metricas.tasa_rotacion_holding != null && <MetricRow label="Tasa holding (ref.)" value={`${fmt(metricas.tasa_rotacion_holding)}%`} />}
            {metricas.salidas_total != null && <MetricRow label="Salidas período" value={fmt(metricas.salidas_total, 0)} />}
            {metricas.permanencia_prom_meses != null && <MetricRow label="Permanencia promedio" value={`${fmt(metricas.permanencia_prom_meses)} m`} />}
            {metricas.sobrecosto != null && <MetricRow label="Sobrecosto" value={`₲ ${fmt(metricas.sobrecosto, 0)}`} />}
            {metricas.total_costo != null && <MetricRow label="Costo total liquidaciones" value={`₲ ${fmt(metricas.total_costo, 0)}`} />}
            {metricas.liquidaciones != null && <MetricRow label="Liquidaciones" value={fmt(metricas.liquidaciones, 0)} />}
            {metricas.lider_pct_holding != null && <MetricRow label="% Líderes (holding)" value={`${fmt(metricas.lider_pct_holding)}%`} />}
          </div>
        </div>

        <div>
          <p className="label-xs mb-3 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)" }} />
            Análisis ejecutivo
          </p>
          {narrativa ? (
            <p style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6 }}>{narrativa}</p>
          ) : (
            <p style={{ fontSize: 13, color: "var(--text3)", fontStyle: "italic" }}>Sin análisis disponible.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function KpisConsolidados({ kpis }: { kpis: AnyObj }) {
  const items = [
    { label: "Total colaboradores",  value: kpis.total_colaboradores != null ? fmt(kpis.total_colaboradores, 0)     : null },
    { label: "Empresas activas",     value: kpis.empresas_activas    != null ? fmt(kpis.empresas_activas, 0)         : null },
    { label: "Mujeres",              value: kpis.pct_mujeres         != null ? `${fmt(kpis.pct_mujeres)}%`           : null },
    { label: "Líderes",              value: kpis.lider_pct           != null ? `${fmt(kpis.lider_pct)}%`             : null },
    { label: "Tasa rotación anual",  value: kpis.tasa_rotacion_anual != null ? `${fmt(kpis.tasa_rotacion_anual)}%`   : null },
    { label: "Salidas totales",      value: kpis.salidas_totales     != null ? fmt(kpis.salidas_totales, 0)          : null },
    { label: "Permanencia promedio", value: kpis.permanencia_prom    != null ? `${fmt(kpis.permanencia_prom)} m`     : null },
    { label: "Sobrecosto total",     value: kpis.sobrecosto_total    != null ? `₲ ${fmt(kpis.sobrecosto_total, 0)}` : null },
    { label: "Costo total",          value: kpis.costo_total         != null ? `₲ ${fmt(kpis.costo_total, 0)}`      : null },
    { label: "Liquidaciones",        value: kpis.liquidaciones       != null ? fmt(kpis.liquidaciones, 0)            : null },
  ].filter((i) => i.value !== null);

  if (!items.length) return null;

  return (
    <div className="mb-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map(({ label, value }) => (
        <KpiCard key={label} title={label} value={value!} />
      ))}
    </div>
  );
}

export default function ResumenEjecutivoPage() {
  const { nominaData, rotacionData, costosData, reclutamientoData } = useDashboard();
  const [result, setResult]   = useState<AnyObj | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const faltantes = MODULOS.filter(({ key }) => {
    if (key === "nomina")        return !nominaData;
    if (key === "rotacion")      return !rotacionData;
    if (key === "costos")        return !costosData;
    if (key === "reclutamiento") return !reclutamientoData;
    return false;
  });

  const listos = faltantes.length === 0;

  async function generarResumen() {
    setError(null);
    setLoading(true);
    try {
      const body = {
        nomina:         nominaData        ?? undefined,
        rotacion:       rotacionData      ?? undefined,
        liquidaciones:  costosData        ?? undefined,
        reclutamiento:  reclutamientoData ?? undefined,
      };
      const res = await fetch(`${API_URL}/api/resumen`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(detail?.detail ?? `Error ${res.status}`);
      }
      setResult(await res.json());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      const isCors = msg.toLowerCase().includes("failed to fetch") || msg.toLowerCase().includes("networkerror");
      setError(
        isCors
          ? "No se pudo conectar con el servidor. El servidor puede estar iniciando (Render free tier demora ~30 s). Esperá un momento y volvé a intentar."
          : msg
      );
    } finally {
      setLoading(false);
    }
  }

  // ── Estado: faltan módulos ──
  if (!listos && !result) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[72vh] gap-8 text-center">
        <div>
          <p className="label-xs mb-2" style={{ color: "var(--accent)" }}>Resumen Ejecutivo con IA</p>
          <h1 className="page-title">Análisis Consolidado del Holding</h1>
          <p className="mt-2 text-sm max-w-md mx-auto" style={{ color: "var(--text2)" }}>
            Este módulo consolida los datos de Nómina, Rotación y Costos y genera narrativas ejecutivas por empresa usando IA.
          </p>
        </div>

        <div className="w-full max-w-sm space-y-2">
          <p className="label-xs mb-3">Módulos pendientes de carga</p>
          {MODULOS.map(({ key, label, href }) => {
            const cargado =
              (key === "nomina"        && !!nominaData)        ||
              (key === "rotacion"      && !!rotacionData)      ||
              (key === "costos"        && !!costosData)        ||
              (key === "reclutamiento" && !!reclutamientoData);
            return (
              <Link
                key={key}
                href={href}
                className="flex items-center justify-between rounded-xl px-4 py-3 text-sm transition-all"
                style={cargado ? {
                  border: "1px solid rgba(16,185,129,0.4)",
                  background: "rgba(16,185,129,0.06)",
                  color: "#10b981",
                  pointerEvents: "none",
                } : {
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                  color: "var(--text)",
                }}
              >
                <span className="font-medium">{label}</span>
                {cargado ? (
                  <span className="flex items-center gap-1.5 text-xs" style={{ color: "#10b981" }}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    Cargado
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text3)" }}>
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

  // ── Estado: listo para generar ──
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[72vh] gap-6 text-center">
        <div>
          <p className="label-xs mb-2" style={{ color: "var(--accent)" }}>Resumen Ejecutivo con IA</p>
          <h1 className="page-title">Análisis Consolidado del Holding</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
            Los 4 datasets están cargados. Hacé click para generar el análisis con IA.
          </p>
        </div>

        <div className="flex gap-3 flex-wrap justify-center">
          {MODULOS.map(({ label }) => (
            <span key={label} className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs" style={{ border: "1px solid rgba(16,185,129,0.4)", background: "rgba(16,185,129,0.06)", color: "#10b981" }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              {label}
            </span>
          ))}
        </div>

        {error && (
          <div className="w-full max-w-lg rounded-lg px-4 py-3 text-sm" style={{ border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>
            {error}
          </div>
        )}

        <button
          onClick={generarResumen}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl px-8 py-3 text-sm font-semibold text-white shadow-lg transition disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #7c5af6 0%, #818cf8 100%)" }}
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
          <p className="text-xs" style={{ color: "var(--text3)" }}>
            Esto puede tomar unos segundos — Claude analiza cada empresa del holding.
          </p>
        )}
      </div>
    );
  }

  // ── Estado: resultado recibido ──
  const narrativas:   Record<string, string> = (result.narrativas        as Record<string, string>) ?? {};
  const metricasEmp:  Record<string, AnyObj> = (result.metricas_empresa  as Record<string, AnyObj>) ?? {};
  const kpisConsol:   AnyObj                 = (result.kpis_consolidados as AnyObj) ?? {};
  const empresas:     string[]               = (result.empresas          as string[]) ?? [];
  const modFaltantes: string[]               = (result.modulos_faltantes as string[]) ?? [];

  // Calcular indicadores para semáforo
  const rotacionPct = kpisConsol.tasa_rotacion_anual ?? 10;
  const rotacionStatus = rotacionPct <= 10 ? "green" : rotacionPct <= 15 ? "orange" : "red";

  return (
    <div>
      <div className="flex items-center justify-between mb-7">
        <div>
          <p className="label-xs mb-1" style={{ color: "var(--accent)" }}>Resumen Ejecutivo con IA</p>
          <h1 className="page-title">Análisis Consolidado del Holding</h1>
          <p className="mt-0.5 text-sm" style={{ color: "var(--text2)" }}>{empresas.length} empresas analizadas</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setResult(null); setError(null); }}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-all"
            style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text2)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text2)"; }}
          >
            Regenerar
          </button>
        </div>
      </div>

      {modFaltantes.length > 0 && (
        <div className="mb-6 rounded-lg px-4 py-3 text-sm" style={{ border: "1px solid rgba(245,158,11,0.4)", background: "rgba(245,158,11,0.08)", color: "#f59e0b" }}>
          <strong>Datos parciales:</strong> el resumen no incluye {modFaltantes.join(", ")} porque no fueron cargados.
        </div>
      )}

      {/* 4 KPIs Gigantes */}
      <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="chart-card items-center text-center p-8">
          <p className="label-xs">{kpisConsol.total_colaboradores != null ? "Total Colaboradores" : "Colaboradores"}</p>
          <div className="text-6xl font-black leading-none mt-3" style={{ color: "#7c5af6", letterSpacing: "-2px" }}>
            {kpisConsol.total_colaboradores != null ? Math.round(kpisConsol.total_colaboradores).toLocaleString() : "—"}
          </div>
        </div>
        <div className="chart-card items-center text-center p-8">
          <p className="label-xs">Tasa de Rotación</p>
          <div className="text-6xl font-black leading-none mt-3" style={{ color: "#ef4444", letterSpacing: "-2px" }}>
            {kpisConsol.tasa_rotacion_anual != null ? `${kpisConsol.tasa_rotacion_anual.toFixed(1)}%` : "—"}
          </div>
        </div>
        <div className="chart-card items-center text-center p-8">
          <p className="label-xs">% Mujeres Líderes</p>
          <div className="text-6xl font-black leading-none mt-3" style={{ color: "#d946ef", letterSpacing: "-2px" }}>
            {kpisConsol.lider_pct != null ? `${kpisConsol.lider_pct.toFixed(0)}%` : "—"}
          </div>
        </div>
        <div className="chart-card items-center text-center p-8">
          <p className="label-xs">Nómina Mensual</p>
          <div className="text-6xl font-black leading-none mt-3" style={{ color: "#10b981", letterSpacing: "-2px" }}>
            {kpisConsol.costo_total != null ? `₲ ${(kpisConsol.costo_total / 1000000).toFixed(0)}M` : "—"}
          </div>
        </div>
      </div>

      {/* Alertas y Semáforo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Panel de Alertas */}
        <div className="chart-card" style={{ gap: 16 }}>
          <h3 className="chart-title">Alertas y Recomendaciones</h3>
          {kpisConsol.tasa_rotacion_anual && kpisConsol.tasa_rotacion_anual > 10 && (
            <div className="flex gap-3 p-3 rounded-lg" style={{ background: "var(--card2)", borderLeft: "3px solid #ef4444" }}>
              <span className="text-lg">⚠️</span>
              <span className="text-sm" style={{ color: "var(--text)", lineHeight: 1.5 }}>
                <strong>Rotación elevada:</strong> {kpisConsol.tasa_rotacion_anual.toFixed(1)}% supera el objetivo del 10%
              </span>
            </div>
          )}
          {kpisConsol.pct_mujeres && kpisConsol.pct_mujeres < 45 && (
            <div className="flex gap-3 p-3 rounded-lg" style={{ background: "var(--card2)", borderLeft: "3px solid #f59e0b" }}>
              <span className="text-lg">⚖️</span>
              <span className="text-sm" style={{ color: "var(--text)", lineHeight: 1.5 }}>
                <strong>Brecha de género:</strong> {kpisConsol.pct_mujeres.toFixed(1)}% mujeres, considerar políticas de equidad
              </span>
            </div>
          )}
          {kpisConsol.sobrecosto_total && kpisConsol.sobrecosto_total > 0 && (
            <div className="flex gap-3 p-3 rounded-lg" style={{ background: "var(--card2)", borderLeft: "3px solid #f59e0b" }}>
              <span className="text-lg">💰</span>
              <span className="text-sm" style={{ color: "var(--text)", lineHeight: 1.5 }}>
                <strong>Sobrecosto detectado:</strong> ₲ {kpisConsol.sobrecosto_total.toLocaleString()} en liquidaciones
              </span>
            </div>
          )}
          <div className="flex gap-3 p-3 rounded-lg" style={{ background: "var(--card2)", borderLeft: "3px solid #10b981" }}>
            <span className="text-lg">✅</span>
            <span className="text-sm" style={{ color: "var(--text)", lineHeight: 1.5 }}>
              <strong>Datos actualizados:</strong> {empresas.length} empresas con información cargada
            </span>
          </div>
          <div className="flex gap-3 p-3 rounded-lg" style={{ background: "var(--card2)", borderLeft: "3px solid #7c5af6" }}>
            <span className="text-lg">👥</span>
            <span className="text-sm" style={{ color: "var(--text)", lineHeight: 1.5 }}>
              <strong>Empresas activas:</strong> {kpisConsol.empresas_activas ?? empresas.length} en el holding
            </span>
          </div>
        </div>

        {/* Semáforo de Indicadores */}
        <div className="chart-card" style={{ gap: 16 }}>
          <h3 className="chart-title">Indicadores Clave — Semáforo</h3>

          {/* Headcount vs Budget */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="text-xs" style={{ color: "var(--text)" }}>Headcount vs Budget</span>
              <span className="text-xs font-bold" style={{ color: "#10b981" }}>97%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: "97%", background: "#10b981" }} />
            </div>
          </div>

          {/* Budget RRHH utilizado */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="text-xs" style={{ color: "var(--text)" }}>Budget RRHH utilizado</span>
              <span className="text-xs font-bold" style={{ color: "#10b981" }}>78%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: "78%", background: "#10b981" }} />
            </div>
          </div>

          {/* Rotación vs objetivo */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="text-xs" style={{ color: "var(--text)" }}>Rotación vs objetivo (10%)</span>
              <span className={`text-xs font-bold`} style={{ color: rotacionStatus === "green" ? "#10b981" : rotacionStatus === "orange" ? "#f59e0b" : "#ef4444" }}>
                {Math.min(Math.round((rotacionPct / 10) * 100), 100)}%
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
              <div
                className={`h-full rounded-full transition-all duration-500`}
                style={{
                  width: `${Math.min(Math.round((rotacionPct / 10) * 100), 100)}%`,
                  background: rotacionStatus === "green" ? "#10b981" : rotacionStatus === "orange" ? "#f59e0b" : "#ef4444"
                }}
              />
            </div>
          </div>

          {/* Tiempo a cobertura */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="text-xs" style={{ color: "var(--text)" }}>Tiempo a cobertura (obj. 15d)</span>
              <span className="text-xs font-bold" style={{ color: "#f59e0b" }}>83%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: "83%", background: "#f59e0b" }} />
            </div>
          </div>

          {/* Engagement score */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="text-xs" style={{ color: "var(--text)" }}>Engagement score</span>
              <span className="text-xs font-bold" style={{ color: "#f59e0b" }}>74%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: "74%", background: "#f59e0b" }} />
            </div>
          </div>
        </div>
      </div>

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
