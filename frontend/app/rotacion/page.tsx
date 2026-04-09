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

function UploadIllustration() {
  return (
    <svg width="140" height="100" viewBox="0 0 140 100" fill="none">
      {/* Rotation arrows */}
      <circle cx="70" cy="46" r="30" stroke="#2d3748" strokeWidth="1.5" fill="none" />
      <path d="M44 46a26 26 0 0 1 26-26" stroke="#4f8ef7" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <path d="M96 46a26 26 0 0 1-26 26" stroke="#4f8ef7" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <polygon points="70,14 76,22 64,22" fill="#4f8ef7" opacity="0.6" />
      <polygon points="70,78 64,70 76,70" fill="#4f8ef7" opacity="0.6" />
      {/* Person icons */}
      <circle cx="70" cy="46" r="12" fill="#1a1f2e" stroke="#334155" strokeWidth="1" />
      <circle cx="70" cy="43" r="4" fill="#4f8ef7" opacity="0.5" />
      <path d="M62 55a8 8 0 0 1 16 0" stroke="#4f8ef7" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" fill="none" />
    </svg>
  );
}

export default function RotacionPage() {
  const { setRotacionData } = useDashboard();
  const [data, setData] = useState<AnyObj | null>(null);

  function handleResult(result: AnyObj) {
    setData(result);
    setRotacionData(result);
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[72vh] gap-6">
        <UploadIllustration />
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4f8ef7] mb-2">
            Módulo de Rotación
          </p>
          <h1 className="page-title">Análisis de Rotación de Personal</h1>
          <p className="mt-2 text-sm text-slate-400 max-w-sm">
            Subí uno o más archivos Excel de rotación (un archivo por año).
            Claude categorizará motivos de salida automáticamente.
          </p>
        </div>
        <div className="w-full max-w-md">
          <FileUpload endpoint="/api/rotacion" fieldName="files" multiple onResult={handleResult} />
        </div>
      </div>
    );
  }

  const kpis: AnyObj        = (data.kpis        as AnyObj) ?? {};
  const porEmp: AnyObj      = (data.por_empresa  as AnyObj) ?? {};
  const porMotivo: AnyObj   = (data.por_motivo   as AnyObj) ?? {};
  const tendencia: AnyObj   = (data.tendencia    as AnyObj) ?? {};
  const entrevistas: AnyObj = (data.entrevistas  as AnyObj) ?? {};
  const advertencias: string[] = (data.advertencias as string[]) ?? [];

  const salEmp: AnyObj[]  = porEmp.salidas ?? [];
  const tasaEmp: AnyObj[] = porEmp.tasa_anual ?? [];
  const mensual: AnyObj[] = tendencia.mensual ?? [];
  const mensualByAno      = groupBy(mensual, "ano");
  const lineTraces        = Object.entries(mensualByAno).map(([ano, rows]) => ({
    type: "scatter" as const,
    mode: "lines+markers" as const,
    name: ano,
    x: rows.map((r) => r.mes_nombre ?? r.mes),
    y: rows.map((r) => Number(r.salidas ?? 0)),
  }));
  const porAno: AnyObj[] = tendencia.por_ano ?? [];
  const dimData          = entrevistas.por_dimension
    ? Object.entries(entrevistas.por_dimension as Record<string, number>).sort((a, b) => a[1] - b[1])
    : null;
  const tablaMotivos: AnyObj[] = porMotivo.detalle ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-7">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4f8ef7] mb-1">
            Módulo de Rotación
          </p>
          <h1 className="page-title">Rotación de Personal</h1>
        </div>
        <button
          onClick={() => setData(null)}
          className="rounded-lg border border-white/[0.08] bg-[#1a1f2e] px-4 py-2 text-sm text-slate-400 transition hover:border-[#4f8ef7]/40 hover:text-[#4f8ef7]"
        >
          Nueva carga
        </button>
      </div>

      {advertencias.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber-700/50 bg-amber-900/10 px-4 py-3 text-sm text-amber-400">
          <strong>Advertencias:</strong>
          <ul className="mt-1 list-disc pl-5 space-y-0.5 text-amber-500">
            {advertencias.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <KpiCard title="Tasa Rotación Anual" value={kpis.tasa_anual != null ? `${kpis.tasa_anual}%` : "—"} accent />
        <KpiCard title="Salidas Totales" value={kpis.salidas_totales} />
        <KpiCard title="HC Enero" value={kpis.hc_enero} />
        <KpiCard title="Voluntarias" value={kpis.voluntarias} />
        <KpiCard title="Involuntarias" value={kpis.involuntarias} />
        <KpiCard
          title="Permanencia Prom."
          value={kpis.permanencia_prom_meses != null ? `${kpis.permanencia_prom_meses} m` : "—"}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {salEmp.length > 0 && (
          <ChartCard title="Salidas por Empresa">
            <PlotChart
              data={[{ type: "bar", orientation: "h", x: salEmp.map((r) => Number(r.salidas ?? 0)), y: salEmp.map((r) => r.EMPRESA), marker: { color: "#f43f5e" } }]}
              layout={{ margin: { t: 16, r: 16, b: 36, l: 100 } }}
              height={300}
            />
          </ChartCard>
        )}

        {tasaEmp.length > 0 && (
          <ChartCard title="Tasa de Rotación Anual por Empresa">
            <PlotChart
              data={[{ type: "bar", x: tasaEmp.map((r) => r.empresa), y: tasaEmp.map((r) => Number(r.tasa_anual ?? 0)), marker: { color: "#f59e0b" } }]}
              layout={{ yaxis: { ticksuffix: "%" } }}
              height={300}
            />
          </ChartCard>
        )}

        {porMotivo.labels && (
          <ChartCard title="Categorías de Motivos de Salida">
            <PlotChart
              data={[{ type: "pie", labels: porMotivo.labels, values: porMotivo.values, hole: 0.4, textinfo: "label+percent", textfont: { color: "#cbd5e1" } }]}
              layout={{ margin: { t: 16, r: 16, b: 16, l: 16 } }}
              height={300}
            />
          </ChartCard>
        )}

        {(porMotivo.top10_originales as AnyObj[] ?? []).length > 0 && (
          <ChartCard title="Top 10 Motivos de Salida">
            <PlotChart
              data={[{ type: "bar", orientation: "h", x: (porMotivo.top10_originales as AnyObj[]).map((r) => Number(r.cantidad ?? 0)), y: (porMotivo.top10_originales as AnyObj[]).map((r) => r.motivo), marker: { color: "#8b5cf6" } }]}
              layout={{ margin: { t: 16, r: 16, b: 36, l: 200 } }}
              height={320}
            />
          </ChartCard>
        )}

        {lineTraces.length > 0 && (
          <ChartCard title="Tendencia de Salidas Mensual">
            <PlotChart data={lineTraces} height={300} />
          </ChartCard>
        )}

        {porAno.length > 0 && (
          <ChartCard title="Salidas por Año">
            <PlotChart
              data={[{ type: "bar", x: porAno.map((r) => String(r.ano)), y: porAno.map((r) => Number(r.salidas ?? 0)), marker: { color: "#4f8ef7" } }]}
              height={300}
            />
          </ChartCard>
        )}

        {dimData && dimData.length > 0 && (
          <ChartCard title="Satisfacción en Entrevistas de Salida (escala 1–5)">
            <PlotChart
              data={[{ type: "bar", orientation: "h", x: dimData.map(([, v]) => v), y: dimData.map(([k]) => k), marker: { color: "#06b6d4" } }]}
              layout={{ margin: { t: 16, r: 16, b: 36, l: 230 }, xaxis: { range: [0, 5] } }}
              height={320}
            />
          </ChartCard>
        )}

        {entrevistas.satisfaccion_promedio != null && entrevistas.insight_ia && (
          <div className="rounded-xl border border-[#4f8ef7]/20 bg-[#1a2240] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4f8ef7] mb-2">
              Análisis IA — Satisfacción promedio: {entrevistas.satisfaccion_promedio}
            </p>
            <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
              {entrevistas.insight_ia}
            </p>
          </div>
        )}
      </div>

      <DataTable rows={tablaMotivos} title="Motivos de Salida" />
    </div>
  );
}
