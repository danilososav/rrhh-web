"use client";

import { useState } from "react";
import FileUpload from "@/components/FileUpload";
import KpiCard from "@/components/KpiCard";
import PlotChart from "@/components/PlotChart";
import DataTable from "@/components/DataTable";
import FilterPanel, { FilterConfig } from "@/components/FilterPanel";
import { useDashboard } from "@/context/DashboardContext";
import { Row, sumField, groupBy, applyFilters } from "@/lib/filterUtils";

type AnyObj = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const FILTER_CONFIGS: FilterConfig[] = [
  { label: "Agencia",    field: "AGENCIA" },
  { label: "Nivel",      field: "NIVEL" },
  { label: "Estado",     field: "SITUACION" },
  { label: "Año",        field: "ANO" },
];

const MESES: Record<number, string> = {
  1: "Ene", 2: "Feb", 3: "Mar", 4: "Abr", 5: "May", 6: "Jun",
  7: "Jul", 8: "Ago", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dic",
};

function isCerrada(r: Row) {
  return String(r.SITUACION ?? "").toUpperCase().includes("CERR") ||
         String(r.STATUS ?? "").toUpperCase().includes("CERR");
}

function computeFromRows(rows: Row[]) {
  const total     = rows.length;
  const cerradas  = rows.filter(isCerrada).length;
  const abiertas  = rows.filter((r) => String(r.SITUACION ?? "").toUpperCase().includes("ABIERT") || String(r.STATUS ?? "").toUpperCase().includes("ABIERT")).length;
  const canceladas = rows.filter((r) => String(r.SITUACION ?? "").toUpperCase().includes("CANCEL") || String(r.STATUS ?? "").toUpperCase().includes("CANCEL")).length;
  const pausadas  = rows.filter((r) => String(r.SITUACION ?? "").toUpperCase().includes("PAUS") || String(r.STATUS ?? "").toUpperCase().includes("PAUS")).length;
  const diasRows  = rows.filter((r) => r.DIAS_CIERRE != null && Number(r.DIAS_CIERRE) > 0);
  const diasProm  = diasRows.length ? Math.round(sumField(diasRows, "DIAS_CIERRE") / diasRows.length) : null;
  const candidatos = rows.reduce((a, r) => a + (Number(r.N_CANDIDATOS) || 0), 0);

  const kpis = {
    total_busquedas: total,
    abiertas,
    cerradas,
    cerradas_pct:   total ? Math.round(cerradas / total * 1000) / 10 : 0,
    canceladas,
    pausadas,
    dias_promedio:  diasProm,
    total_candidatos: candidatos,
  };

  // Por agencia
  const agMap   = groupBy(rows, "AGENCIA");
  const agBusc  = Object.entries(agMap)
    .map(([ag, r]) => ({ AGENCIA: ag, busquedas: r.length }))
    .sort((a, b) => b.busquedas - a.busquedas);
  const agDias  = Object.entries(agMap)
    .map(([ag, r]) => {
      const dr = r.filter((x) => x.DIAS_CIERRE != null && Number(x.DIAS_CIERRE) > 0);
      return { AGENCIA: ag, dias_promedio: dr.length ? Math.round(sumField(dr, "DIAS_CIERRE") / dr.length) : 0 };
    })
    .filter((r) => r.dias_promedio > 0);

  // Canal de ingreso
  const canalMap = groupBy(rows, "TIPO_INGRESO");
  const canal = Object.keys(canalMap).length > 0
    ? { labels: Object.keys(canalMap), values: Object.values(canalMap).map((r) => r.length) }
    : null;

  // Top 15 posiciones
  const posMap  = groupBy(rows, "POSICION");
  const top15   = Object.entries(posMap)
    .map(([pos, r]) => ({ POSICION: pos, busquedas: r.length }))
    .sort((a, b) => b.busquedas - a.busquedas)
    .slice(0, 15);

  // Tasa éxito por responsable
  const respMap  = groupBy(rows, "RESPONSABLE");
  const tasaResp = Object.entries(respMap)
    .map(([resp, r]) => {
      const cerr = r.filter(isCerrada).length;
      return {
        RESPONSABLE:    resp,
        total:          r.length,
        cerradas:       cerr,
        tasa_exito_pct: Math.round(cerr / r.length * 1000) / 10,
      };
    })
    .filter((r) => r.total >= 2)
    .sort((a, b) => b.tasa_exito_pct - a.tasa_exito_pct);

  // Tendencia mensual
  const byAnoMes: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    if (!r.ANO) continue;
    const ano = String(r.ANO);
    // Try to extract month from RECEPCION date
    const mes = r.MES ?? (r.RECEPCION ? new Date(r.RECEPCION).getMonth() + 1 : null);
    if (!mes) continue;
    byAnoMes[ano] = byAnoMes[ano] ?? {};
    const k = String(mes);
    byAnoMes[ano][k] = (byAnoMes[ano][k] ?? 0) + 1;
  }
  const lineTraces = Object.entries(byAnoMes).map(([ano, meses]) => ({
    type: "scatter" as const,
    mode: "lines+markers" as const,
    name: ano,
    x: Object.keys(meses).sort((a, b) => Number(a) - Number(b)).map((m) => MESES[Number(m)] ?? m),
    y: Object.keys(meses).sort((a, b) => Number(a) - Number(b)).map((m) => meses[m]),
  }));

  // Días promedio por año
  const anoMap  = groupBy(rows, "ANO");
  const diasAno = Object.entries(anoMap)
    .map(([ano, r]) => {
      const dr = r.filter((x) => x.DIAS_CIERRE != null && Number(x.DIAS_CIERRE) > 0);
      return { ANO: String(ano), dias_promedio: dr.length ? Math.round(sumField(dr, "DIAS_CIERRE") / dr.length) : 0 };
    })
    .filter((r) => r.dias_promedio > 0)
    .sort((a, b) => a.ANO.localeCompare(b.ANO));

  return { kpis, agBusc, agDias, canal, top15, tasaResp, lineTraces, diasAno };
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-5">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500">{title}</h3>
      {children}
    </div>
  );
}

function UploadIllustration() {
  return (
    <svg width="140" height="100" viewBox="0 0 140 100" fill="none">
      <path d="M20 20h100l-40 40v30l-20-10V60L20 20Z" fill="#1a1f2e" stroke="#2d3748" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M34 34h72l-32 32v16l-8-4V66L34 34Z" fill="#4f8ef7" opacity="0.25" />
      <circle cx="50" cy="12" r="5" fill="#2d3748" />
      <circle cx="70" cy="12" r="5" fill="#4f8ef7" opacity="0.6" />
      <circle cx="90" cy="12" r="5" fill="#2d3748" />
      <circle cx="60" cy="12" r="5" fill="#2d3748" />
      <circle cx="80" cy="12" r="5" fill="#2d3748" />
      <path d="M70 72l2 5h5l-4 3 1.5 5L70 82l-4.5 3 1.5-5-4-3h5Z" fill="#4f8ef7" opacity="0.8" />
    </svg>
  );
}

export default function ReclutamientoPage() {
  const { setReclutamientoData } = useDashboard();
  const [data, setData]     = useState<AnyObj | null>(null);
  const [selected, setSelected] = useState<Record<string, string[]>>({});

  function handleResult(result: AnyObj) {
    setData(result);
    setReclutamientoData(result);
    setSelected({});
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[72vh] gap-6">
        <UploadIllustration />
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4f8ef7] mb-2">Módulo de Reclutamiento</p>
          <h1 className="page-title">Análisis de Búsquedas de Personal</h1>
          <p className="mt-2 text-sm text-slate-400 max-w-sm">
            Subí uno o más archivos Excel con el historial de búsquedas. Incluye tiempos de cierre, canales y eficiencia por responsable.
          </p>
        </div>
        <div className="w-full max-w-md">
          <FileUpload endpoint="/api/reclutamiento" fieldName="files" multiple onResult={handleResult} />
        </div>
      </div>
    );
  }

  const rawRows: Row[] = (data.tabla as Row[]) ?? [];
  const filteredRows   = applyFilters(rawRows, selected);
  const { kpis, agBusc, agDias, canal, top15, tasaResp, lineTraces, diasAno } =
    computeFromRows(filteredRows);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4f8ef7] mb-1">Módulo de Reclutamiento</p>
          <h1 className="page-title">Búsquedas de Personal</h1>
        </div>
        <button
          onClick={() => { setData(null); setSelected({}); }}
          className="rounded-lg border border-white/[0.08] bg-[#1a1f2e] px-4 py-2 text-sm text-slate-400 transition hover:border-[#4f8ef7]/40 hover:text-[#4f8ef7]"
        >
          Nueva carga
        </button>
      </div>

      <div className="flex gap-5 items-start">
        {rawRows.length > 0 && (
          <FilterPanel
            configs={FILTER_CONFIGS}
            rows={rawRows}
            selected={selected}
            onChange={(field, values) => setSelected((prev) => ({ ...prev, [field]: values }))}
          />
        )}

        <div className="flex-1 min-w-0">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            <KpiCard title="Total Búsquedas" value={kpis.total_busquedas} accent />
            <KpiCard title="Abiertas"        value={kpis.abiertas} />
            <KpiCard title="Cerradas"        value={kpis.cerradas_pct != null ? `${kpis.cerradas_pct}%` : "—"} subtitle={`${kpis.cerradas ?? 0} búsquedas`} />
            <KpiCard title="Canceladas"      value={kpis.canceladas} />
            <KpiCard title="Pausadas"        value={kpis.pausadas} />
            <KpiCard title="Días Promedio"   value={kpis.dias_promedio != null ? `${kpis.dias_promedio}d` : "—"} />
            <KpiCard title="Candidatos"      value={kpis.total_candidatos} />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {agBusc.length > 0 && (
              <ChartCard title="Búsquedas por Agencia">
                <PlotChart
                  data={[{ type: "bar", orientation: "h", x: agBusc.map((r) => r.busquedas), y: agBusc.map((r) => r.AGENCIA), marker: { color: "#4f8ef7" } }]}
                  layout={{ margin: { t: 16, r: 16, b: 36, l: 110 } }}
                  height={300}
                />
              </ChartCard>
            )}

            {agDias.length > 0 && (
              <ChartCard title="Días Promedio de Cierre por Agencia">
                <PlotChart
                  data={[{ type: "bar", x: agDias.map((r) => r.AGENCIA), y: agDias.map((r) => r.dias_promedio), marker: { color: "#f59e0b" } }]}
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
                  data={[{ type: "bar", orientation: "h", x: top15.map((r) => r.busquedas), y: top15.map((r) => r.POSICION), marker: { color: "#06b6d4" } }]}
                  layout={{ margin: { t: 16, r: 16, b: 36, l: 200 } }}
                  height={380}
                />
              </ChartCard>
            )}

            {tasaResp.length > 0 && (
              <ChartCard title="Tasa de Éxito por Responsable">
                <PlotChart
                  data={[{ type: "bar", x: tasaResp.map((r) => r.RESPONSABLE), y: tasaResp.map((r) => r.tasa_exito_pct), marker: { color: "#10b981" } }]}
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
                  data={[{ type: "bar", x: diasAno.map((r) => r.ANO), y: diasAno.map((r) => r.dias_promedio), marker: { color: "#8b5cf6" } }]}
                  layout={{ yaxis: { ticksuffix: "d" } }}
                  height={300}
                />
              </ChartCard>
            )}
          </div>

          <DataTable rows={rawRows} title="Detalle de Búsquedas" />
        </div>
      </div>
    </div>
  );
}
