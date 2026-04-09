"use client";

import { useState } from "react";
import FileUpload from "@/components/FileUpload";
import KpiCard from "@/components/KpiCard";
import PlotChart from "@/components/PlotChart";
import DataTable from "@/components/DataTable";
import { useDashboard } from "@/context/DashboardContext";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>;

function groupBy<T extends AnyObj>(arr: T[], key: string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, row) => {
    const k = String(row[key] ?? "");
    (acc[k] = acc[k] ?? []).push(row);
    return acc;
  }, {});
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-5">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
        {title}
      </h3>
      {children}
    </div>
  );
}

const MESES: Record<number, string> = {
  1: "Ene", 2: "Feb", 3: "Mar", 4: "Abr", 5: "May", 6: "Jun",
  7: "Jul", 8: "Ago", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dic",
};

function UploadIllustration() {
  return (
    <svg width="140" height="100" viewBox="0 0 140 100" fill="none">
      {/* Funnel */}
      <path d="M20 20h100l-40 40v30l-20-10V60L20 20Z" fill="#1a1f2e" stroke="#2d3748" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M34 34h72l-32 32v16l-8-4V66L34 34Z" fill="#4f8ef7" opacity="0.25" />
      {/* People dots */}
      <circle cx="50" cy="12" r="5" fill="#2d3748" />
      <circle cx="70" cy="12" r="5" fill="#4f8ef7" opacity="0.6" />
      <circle cx="90" cy="12" r="5" fill="#2d3748" />
      <circle cx="60" cy="12" r="5" fill="#2d3748" />
      <circle cx="80" cy="12" r="5" fill="#2d3748" />
      {/* Star (selected candidate) */}
      <path d="M70 72l2 5h5l-4 3 1.5 5L70 82l-4.5 3 1.5-5-4-3h5Z" fill="#4f8ef7" opacity="0.8" />
    </svg>
  );
}

export default function ReclutamientoPage() {
  const { setReclutamientoData } = useDashboard();
  const [data, setData] = useState<AnyObj | null>(null);

  function handleResult(result: AnyObj) {
    setData(result);
    setReclutamientoData(result);
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[72vh] gap-6">
        <UploadIllustration />
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4f8ef7] mb-2">
            Módulo de Reclutamiento
          </p>
          <h1 className="page-title">Análisis de Búsquedas de Personal</h1>
          <p className="mt-2 text-sm text-slate-400 max-w-sm">
            Subí uno o más archivos Excel con el historial de búsquedas.
            Incluye tiempos de cierre, canales y eficiencia por responsable.
          </p>
        </div>
        <div className="w-full max-w-md">
          <FileUpload endpoint="/api/reclutamiento" fieldName="files" multiple onResult={handleResult} />
        </div>
      </div>
    );
  }

  const kpis: AnyObj      = (data.kpis             as AnyObj) ?? {};
  const porAg: AnyObj     = (data.por_agencia       as AnyObj) ?? {};
  const porNiv: AnyObj    = (data.por_nivel         as AnyObj) ?? {};
  const porPuesto: AnyObj = (data.por_puesto        as AnyObj) ?? {};
  const porResp: AnyObj   = (data.por_responsable   as AnyObj) ?? {};
  const tendencia: AnyObj = (data.tendencia_cierre  as AnyObj) ?? {};
  const tabla: AnyObj[]   = (data.tabla             as AnyObj[]) ?? [];

  const agBusc: AnyObj[]   = porAg.busquedas ?? [];
  const agDias: AnyObj[]   = porAg.dias_promedio ?? [];
  const canal              = porNiv.canal_ingreso;
  const top15: AnyObj[]    = porPuesto.top15_busquedas ?? [];
  const tasaResp: AnyObj[] = porResp.tasa_exito ?? [];
  const mensual: AnyObj[]  = tendencia.mensual ?? [];
  const byAno              = groupBy(mensual, "ano");
  const lineTraces         = Object.entries(byAno).map(([ano, rows]) => ({
    type: "scatter" as const,
    mode: "lines+markers" as const,
    name: ano,
    x: rows.map((r) => MESES[Number(r.mes)] ?? r.mes),
    y: rows.map((r) => Number(r.busquedas ?? 0)),
  }));
  const diasAno: AnyObj[] = tendencia.dias_por_ano ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-7">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4f8ef7] mb-1">
            Módulo de Reclutamiento
          </p>
          <h1 className="page-title">Búsquedas de Personal</h1>
        </div>
        <button
          onClick={() => setData(null)}
          className="rounded-lg border border-white/[0.08] bg-[#1a1f2e] px-4 py-2 text-sm text-slate-400 transition hover:border-[#4f8ef7]/40 hover:text-[#4f8ef7]"
        >
          Nueva carga
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
        <KpiCard title="Total Búsquedas" value={kpis.total_busquedas} accent />
        <KpiCard title="Abiertas" value={kpis.abiertas} />
        <KpiCard title="Cerradas" value={kpis.cerradas_pct != null ? `${kpis.cerradas_pct}%` : "—"} subtitle={`${kpis.cerradas ?? 0} búsquedas`} />
        <KpiCard title="Canceladas" value={kpis.canceladas} />
        <KpiCard title="Pausadas" value={kpis.pausadas} />
        <KpiCard title="Días Promedio" value={kpis.dias_promedio != null ? `${kpis.dias_promedio}d` : "—"} />
        <KpiCard title="Candidatos" value={kpis.total_candidatos} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {agBusc.length > 0 && (
          <ChartCard title="Búsquedas por Agencia">
            <PlotChart
              data={[{ type: "bar", orientation: "h", x: agBusc.map((r) => Number(r.busquedas ?? 0)), y: agBusc.map((r) => r.AGENCIA), marker: { color: "#4f8ef7" } }]}
              layout={{ margin: { t: 16, r: 16, b: 36, l: 110 } }}
              height={300}
            />
          </ChartCard>
        )}

        {agDias.length > 0 && (
          <ChartCard title="Días Promedio de Cierre por Agencia">
            <PlotChart
              data={[{ type: "bar", x: agDias.map((r) => r.AGENCIA), y: agDias.map((r) => Number(r.dias_promedio ?? 0)), marker: { color: "#f59e0b" } }]}
              layout={{ yaxis: { ticksuffix: "d" } }}
              height={300}
            />
          </ChartCard>
        )}

        {canal && (
          <ChartCard title="Canal de Ingreso">
            <PlotChart
              data={[{ type: "pie", labels: canal.labels, values: canal.values, hole: 0.4, textinfo: "label+percent", textfont: { color: "#cbd5e1" } }]}
              layout={{ margin: { t: 16, r: 16, b: 16, l: 16 } }}
              height={300}
            />
          </ChartCard>
        )}

        {top15.length > 0 && (
          <ChartCard title="Top 15 Puestos más Solicitados">
            <PlotChart
              data={[{ type: "bar", orientation: "h", x: top15.map((r) => Number(r.busquedas ?? 0)), y: top15.map((r) => r.POSICION), marker: { color: "#06b6d4" } }]}
              layout={{ margin: { t: 16, r: 16, b: 36, l: 200 } }}
              height={380}
            />
          </ChartCard>
        )}

        {tasaResp.length > 0 && (
          <ChartCard title="Tasa de Éxito por Responsable">
            <PlotChart
              data={[{ type: "bar", x: tasaResp.map((r) => r.RESPONSABLE), y: tasaResp.map((r) => Number(r.tasa_exito_pct ?? 0)), customdata: tasaResp.map((r) => [`${r.cerradas}/${r.total}`]), hovertemplate: "%{x}<br>%{y}%<br>%{customdata[0]}<extra></extra>", marker: { color: "#10b981" } }]}
              layout={{ yaxis: { ticksuffix: "%" } }}
              height={300}
            />
          </ChartCard>
        )}

        {lineTraces.length > 0 && (
          <ChartCard title="Tendencia de Búsquedas Mensual">
            <PlotChart data={lineTraces} height={300} />
          </ChartCard>
        )}

        {diasAno.length > 0 && (
          <ChartCard title="Días Promedio de Cierre por Año">
            <PlotChart
              data={[{ type: "bar", x: diasAno.map((r) => String(r.ANO ?? r.ano)), y: diasAno.map((r) => Number(r.dias_promedio ?? 0)), marker: { color: "#8b5cf6" } }]}
              layout={{ yaxis: { ticksuffix: "d" } }}
              height={300}
            />
          </ChartCard>
        )}
      </div>

      <DataTable rows={tabla} title="Detalle de Búsquedas" />
    </div>
  );
}
