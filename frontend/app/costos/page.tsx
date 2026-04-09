"use client";

import { useState } from "react";
import FileUpload from "@/components/FileUpload";
import KpiCard from "@/components/KpiCard";
import PlotChart from "@/components/PlotChart";
import DataTable from "@/components/DataTable";
import { useDashboard } from "@/context/DashboardContext";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>;

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

function UploadIllustration() {
  return (
    <svg width="140" height="100" viewBox="0 0 140 100" fill="none">
      {/* Coin stack */}
      <ellipse cx="70" cy="72" rx="28" ry="8" fill="#1a1f2e" stroke="#2d3748" strokeWidth="1.5" />
      <rect x="42" y="52" width="56" height="20" rx="2" fill="#1a1f2e" stroke="#2d3748" strokeWidth="1.5" />
      <ellipse cx="70" cy="52" rx="28" ry="8" fill="#1a1f2e" stroke="#2d3748" strokeWidth="1.5" />
      <rect x="42" y="36" width="56" height="16" rx="2" fill="#1a1f2e" stroke="#2d3748" strokeWidth="1.5" />
      <ellipse cx="70" cy="36" rx="28" ry="8" fill="#4f8ef7" opacity="0.25" stroke="#4f8ef7" strokeWidth="1" strokeOpacity="0.4" />
      {/* Dollar sign */}
      <text x="70" y="40" textAnchor="middle" fontSize="10" fill="#4f8ef7" opacity="0.7" fontWeight="bold">₲</text>
      {/* Arrow up */}
      <path d="M105 28V16M101 20l4-4 4 4" stroke="#4f8ef7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      {/* Warning triangle for overcost */}
      <path d="M22 38l8-14 8 14H22Z" fill="#f59e0b" opacity="0.2" stroke="#f59e0b" strokeWidth="1.2" strokeOpacity="0.5" strokeLinejoin="round" />
      <text x="30" y="36" textAnchor="middle" fontSize="8" fill="#f59e0b" opacity="0.8">!</text>
    </svg>
  );
}

export default function CostosPage() {
  const { setCostosData } = useDashboard();
  const [data, setData] = useState<AnyObj | null>(null);

  function handleResult(result: AnyObj) {
    setData(result);
    setCostosData(result);
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[72vh] gap-6">
        <UploadIllustration />
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4f8ef7] mb-2">
            Módulo de Costos
          </p>
          <h1 className="page-title">Análisis de Costos de Liquidaciones</h1>
          <p className="mt-2 text-sm text-slate-400 max-w-sm">
            Subí uno o más archivos Excel de liquidaciones para analizar
            sobrecostos, composición de egresos y tendencias por agencia.
          </p>
        </div>
        <div className="w-full max-w-md">
          <FileUpload endpoint="/api/costos" fieldName="files" multiple onResult={handleResult} />
        </div>
      </div>
    );
  }

  const kpis: AnyObj      = (data.kpis            as AnyObj) ?? {};
  const porAg: AnyObj     = (data.por_agencia      as AnyObj) ?? {};
  const porTipo: AnyObj   = (data.por_tipo_salida  as AnyObj) ?? {};
  const porNivel: AnyObj  = (data.por_nivel        as AnyObj) ?? {};
  const comp: AnyObj      = (data.composicion      as AnyObj) ?? {};
  const tendencia: AnyObj = (data.tendencia        as AnyObj) ?? {};
  const tabla: AnyObj[]   = (data.tabla            as AnyObj[]) ?? [];

  const agSob: AnyObj[]  = porAg.sobrecosto_total ?? [];
  const agCant: AnyObj[] = porAg.cantidad ?? [];
  const tipoData         = porTipo.por_tipo;
  const nivCosto: AnyObj[] = porNivel.costo_total ?? [];
  const nivComp: AnyObj[]  = porNivel.comparativo ?? [];
  const sobAno: AnyObj[]   = tendencia.sobrecosto_por_ano ?? [];
  const liqAno: AnyObj[]   = tendencia.liquidaciones_por_ano ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-7">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4f8ef7] mb-1">
            Módulo de Costos
          </p>
          <h1 className="page-title">Costos de Liquidaciones</h1>
        </div>
        <button
          onClick={() => setData(null)}
          className="rounded-lg border border-white/[0.08] bg-[#1a1f2e] px-4 py-2 text-sm text-slate-400 transition hover:border-[#4f8ef7]/40 hover:text-[#4f8ef7]"
        >
          Nueva carga
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <KpiCard title="Liquidaciones" value={kpis.total_liquidaciones} accent />
        <KpiCard title="Sobrecosto" value={kpis.sobrecosto_fmt ?? "—"} />
        <KpiCard title="Costo Total" value={kpis.total_costo_fmt ?? "—"} />
        <KpiCard title="Total Bruto" value={kpis.total_bruto_fmt ?? "—"} />
        <KpiCard title="Neto" value={kpis.total_neto_fmt ?? "—"} />
        <KpiCard title="Aporte Patronal" value={kpis.aporte_patronal_fmt ?? "—"} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {agSob.length > 0 && (
          <ChartCard title="Sobrecosto por Agencia">
            <PlotChart
              data={[{ type: "bar", orientation: "h", x: agSob.map((r) => Number(r.SOBRECOSTO ?? 0)), y: agSob.map((r) => r.AGENCIA), marker: { color: "#f43f5e" } }]}
              layout={{ margin: { t: 16, r: 16, b: 36, l: 110 } }}
              height={300}
            />
          </ChartCard>
        )}

        {agCant.length > 0 && (
          <ChartCard title="Liquidaciones por Agencia">
            <PlotChart
              data={[{ type: "bar", x: agCant.map((r) => r.AGENCIA), y: agCant.map((r) => Number(r.cantidad ?? 0)), marker: { color: "#4f8ef7" } }]}
              height={300}
            />
          </ChartCard>
        )}

        {comp.labels && (
          <ChartCard title="Composición Global de Costos">
            <PlotChart
              data={[{ type: "pie", labels: comp.labels, values: comp.values, textinfo: "label+percent", textfont: { color: "#cbd5e1" } }]}
              layout={{ margin: { t: 16, r: 16, b: 16, l: 16 } }}
              height={320}
            />
          </ChartCard>
        )}

        {tipoData && (
          <ChartCard title="Sobrecosto por Tipo de Salida">
            <PlotChart
              data={[{ type: "pie", labels: tipoData.labels, values: tipoData.values, hole: 0.4, textinfo: "label+percent", textfont: { color: "#cbd5e1" } }]}
              layout={{ margin: { t: 16, r: 16, b: 16, l: 16 } }}
              height={300}
            />
          </ChartCard>
        )}

        {nivCosto.length > 0 && (
          <ChartCard title="Costo Total por Nivel AIC">
            <PlotChart
              data={[{ type: "bar", x: nivCosto.map((r) => r.nivel), y: nivCosto.map((r) => Number(r.total_costo ?? 0)), marker: { color: "#8b5cf6" } }]}
              height={300}
            />
          </ChartCard>
        )}

        {nivComp.length > 0 && (
          <ChartCard title="Sobrecosto vs Costo Total por Nivel">
            <PlotChart
              data={[
                { type: "bar", name: "Total Costo", x: nivComp.map((r) => r.nivel), y: nivComp.map((r) => Number(r.total_costo ?? 0)), marker: { color: "#4f8ef7" } },
                { type: "bar", name: "Sobrecosto",  x: nivComp.map((r) => r.nivel), y: nivComp.map((r) => Number(r.sobrecosto  ?? 0)), marker: { color: "#f43f5e" } },
              ]}
              layout={{ barmode: "group" }}
              height={300}
            />
          </ChartCard>
        )}

        {sobAno.length > 0 && (
          <ChartCard title="Sobrecosto por Año">
            <PlotChart
              data={[{ type: "bar", x: sobAno.map((r) => String(r.ano)), y: sobAno.map((r) => Number(r.sobrecosto ?? 0)), marker: { color: "#f59e0b" } }]}
              height={300}
            />
          </ChartCard>
        )}

        {liqAno.length > 0 && (
          <ChartCard title="Liquidaciones por Año">
            <PlotChart
              data={[{ type: "scatter", mode: "lines+markers", x: liqAno.map((r) => String(r.ano)), y: liqAno.map((r) => Number(r.liquidaciones ?? 0)), line: { color: "#06b6d4", width: 2 }, marker: { color: "#06b6d4", size: 7 } }]}
              height={300}
            />
          </ChartCard>
        )}
      </div>

      <DataTable rows={tabla} title="Detalle de Liquidaciones" />
    </div>
  );
}
