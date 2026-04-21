"use client";

import { useState } from "react";
import FileUpload from "@/components/FileUpload";
import KpiCard from "@/components/KpiCard";
import PlotChart from "@/components/PlotChart";
import DataTable from "@/components/DataTable";
import { useDashboard } from "@/context/DashboardContext";
import { useFilter } from "@/context/FilterContext";
import { Row, groupBy, applyFilters, FilterConfig } from "@/lib/filterUtils";

type AnyObj = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const FILTER_CONFIGS: FilterConfig[] = [
  { label: "Empresa",     field: "EMPRESA" },
  { label: "Tipo Salida", field: "TIPO_SALIDA" },
  { label: "Motivo",      field: "MOTIVO_CATEGORIA" },
  { label: "Año",         field: "ANO_REPORTE" },
];

const MESES_NOMBRE: Record<number, string> = {
  1: "Ene", 2: "Feb", 3: "Mar", 4: "Abr", 5: "May", 6: "Jun",
  7: "Jul", 8: "Ago", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dic",
};

function isSalida(r: Row) {
  return String(r.SITUACION ?? "").trim().toUpperCase() === "I";
}

function computeFromRows(allRows: Row[]) {
  const salidas  = allRows.filter(isSalida);
  const hcEnero  = allRows.filter((r) => Number(r.MES_REPORTE) === 1).length;
  const vol      = salidas.filter((r) => String(r.TIPO_SALIDA ?? "").toUpperCase().includes("VOL")).length;
  const invol    = salidas.filter((r) => String(r.TIPO_SALIDA ?? "").toUpperCase().includes("INV")).length;

  const permArr  = salidas.map((r) => Number(r.MESES_PERMANENCIA)).filter((v) => !isNaN(v) && v > 0);
  const permProm = permArr.length ? Math.round((permArr.reduce((a, b) => a + b, 0) / permArr.length) * 10) / 10 : null;

  const tasa = hcEnero > 0 ? Math.round(salidas.length / hcEnero * 1000) / 10 : null;

  const kpis = {
    tasa_anual:          tasa,
    salidas_totales:     salidas.length,
    hc_enero:            hcEnero,
    voluntarias:         vol,
    involuntarias:       invol,
    permanencia_prom_meses: permProm,
  };

  // Por empresa
  const empMap   = groupBy(salidas, "EMPRESA");
  const salEmp   = Object.entries(empMap)
    .map(([emp, r]) => ({ EMPRESA: emp, salidas: r.length }))
    .sort((a, b) => b.salidas - a.salidas);

  // Por motivo categoría
  const motMap    = groupBy(salidas, "MOTIVO_CATEGORIA");
  const motLabels = Object.keys(motMap);
  const motValues = motLabels.map((k) => motMap[k].length);
  const motDetalle = motLabels
    .map((k) => ({ categoria: k, cantidad: motMap[k].length }))
    .sort((a, b) => b.cantidad - a.cantidad);

  // Top 10 motivos originales
  const motOrig = (() => {
    const m = groupBy(salidas, "MOTIVO_SALIDA");
    return Object.entries(m)
      .map(([motivo, r]) => ({ motivo, cantidad: r.length }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10);
  })();

  // Tendencia mensual por año
  const mensual = (() => {
    const byAnoMes: Record<string, Record<number, number>> = {};
    for (const r of salidas) {
      const ano = String(r.ANO_REPORTE ?? "");
      const mes = Number(r.MES_REPORTE);
      if (!ano || isNaN(mes)) continue;
      byAnoMes[ano] = byAnoMes[ano] ?? {};
      byAnoMes[ano][mes] = (byAnoMes[ano][mes] ?? 0) + 1;
    }
    const rows: AnyObj[] = [];
    for (const [ano, meses] of Object.entries(byAnoMes)) {
      for (const [mes, salidas] of Object.entries(meses)) {
        rows.push({ ano, mes: Number(mes), mes_nombre: MESES_NOMBRE[Number(mes)], salidas });
      }
    }
    return rows.sort((a, b) => Number(a.ano) - Number(b.ano) || a.mes - b.mes);
  })();

  // Por año
  const anoMap  = groupBy(salidas, "ANO_REPORTE");
  const porAno  = Object.entries(anoMap)
    .map(([ano, r]) => ({ ano: String(ano), salidas: r.length }))
    .sort((a, b) => a.ano.localeCompare(b.ano));

  return { kpis, salEmp, motLabels, motValues, motDetalle, motOrig, mensual, porAno };
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
      <circle cx="70" cy="46" r="30" stroke="#2d3748" strokeWidth="1.5" fill="none" />
      <path d="M44 46a26 26 0 0 1 26-26" stroke="#4f8ef7" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <path d="M96 46a26 26 0 0 1-26 26" stroke="#4f8ef7" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <polygon points="70,14 76,22 64,22" fill="#4f8ef7" opacity="0.6" />
      <polygon points="70,78 64,70 76,70" fill="#4f8ef7" opacity="0.6" />
      <circle cx="70" cy="46" r="12" fill="#1a1f2e" stroke="#334155" strokeWidth="1" />
      <circle cx="70" cy="43" r="4" fill="#4f8ef7" opacity="0.5" />
      <path d="M62 55a8 8 0 0 1 16 0" stroke="#4f8ef7" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" fill="none" />
    </svg>
  );
}

export default function RotacionPage() {
  const { setRotacionData } = useDashboard();
  const { selected, register, reset } = useFilter();
  const [data, setData] = useState<AnyObj | null>(null);

  function handleResult(result: AnyObj) {
    setData(result);
    setRotacionData(result);
    register(FILTER_CONFIGS, (result.raw_rows as Row[]) ?? []);
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[72vh] gap-6">
        <UploadIllustration />
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4f8ef7] mb-2">Módulo de Rotación</p>
          <h1 className="page-title">Análisis de Rotación de Personal</h1>
          <p className="mt-2 text-sm text-slate-400 max-w-sm">
            Subí uno o más archivos Excel de rotación (un archivo por año). Claude categorizará motivos de salida automáticamente.
          </p>
        </div>
        <div className="w-full max-w-md">
          <FileUpload endpoint="/api/rotacion" fieldName="files" multiple onResult={handleResult} />
        </div>
      </div>
    );
  }

  const rawRows: Row[]      = (data.raw_rows as Row[]) ?? [];
  const filteredRows        = applyFilters(rawRows, selected);
  const advertencias: string[] = (data.advertencias as string[]) ?? [];
  const { kpis, salEmp, motLabels, motValues, motDetalle, motOrig, mensual, porAno } =
    computeFromRows(filteredRows);

  // Entrevistas (no se filtran — vienen del backend)
  const entrevistas: AnyObj = (data.entrevistas as AnyObj) ?? {};
  const dimData = entrevistas.por_dimension
    ? Object.entries(entrevistas.por_dimension as Record<string, number>).sort((a, b) => a[1] - b[1])
    : null;

  // Trazas de tendencia mensual por año
  const byAno: Record<string, typeof mensual> = {};
  for (const r of mensual) {
    (byAno[r.ano] = byAno[r.ano] ?? []).push(r);
  }
  const lineTraces = Object.entries(byAno).map(([ano, rows]) => ({
    type: "scatter" as const,
    mode: "lines+markers" as const,
    name: ano,
    x: rows.map((r) => r.mes_nombre),
    y: rows.map((r) => r.salidas),
  }));

  const tablaRot: AnyObj[] = (data.tabla as AnyObj[]) ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4f8ef7] mb-1">Módulo de Rotación</p>
          <h1 className="page-title">Rotación de Personal</h1>
        </div>
        <button
          onClick={() => { setData(null); reset(); }}
          className="rounded-lg border border-white/[0.08] bg-[#1a1f2e] px-4 py-2 text-sm text-slate-400 transition hover:border-[#4f8ef7]/40 hover:text-[#4f8ef7]"
        >
          Nueva carga
        </button>
      </div>

      {advertencias.length > 0 && (
        <div className="mb-5 rounded-lg border border-amber-700/50 bg-amber-900/10 px-4 py-3 text-sm text-amber-400">
          <strong>Advertencias:</strong>
          <ul className="mt-1 list-disc pl-5 space-y-0.5 text-amber-500">
            {advertencias.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}

      <div>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <KpiCard title="Tasa Rotación Anual"  value={kpis.tasa_anual != null ? `${kpis.tasa_anual}%` : "—"} accent />
            <KpiCard title="Salidas Totales"       value={kpis.salidas_totales} />
            <KpiCard title="HC Enero"              value={kpis.hc_enero} />
            <KpiCard title="Voluntarias"           value={kpis.voluntarias} />
            <KpiCard title="Involuntarias"         value={kpis.involuntarias} />
            <KpiCard title="Permanencia Prom."     value={kpis.permanencia_prom_meses != null ? `${kpis.permanencia_prom_meses} m` : "—"} />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {salEmp.length > 0 && (
              <ChartCard title="Salidas por Empresa">
                <PlotChart
                  data={[{ type: "bar", orientation: "h", x: salEmp.map((r) => r.salidas), y: salEmp.map((r) => r.EMPRESA), marker: { color: "#f43f5e" } }]}
                  layout={{ margin: { t: 16, r: 16, b: 36, l: 100 } }}
                  height={300}
                />
              </ChartCard>
            )}

            {motLabels.length > 0 && (
              <ChartCard title="Categorías de Motivos de Salida">
                <PlotChart
                  data={[{ type: "pie", labels: motLabels, values: motValues, hole: 0.4, textinfo: "label+percent", textfont: { color: "#cbd5e1" } }]}
                  layout={{ margin: { t: 16, r: 16, b: 16, l: 16 } }}
                  height={300}
                />
              </ChartCard>
            )}

            {motOrig.length > 0 && (
              <ChartCard title="Top 10 Motivos de Salida">
                <PlotChart
                  data={[{ type: "bar", orientation: "h", x: motOrig.map((r) => r.cantidad), y: motOrig.map((r) => r.motivo), marker: { color: "#8b5cf6" } }]}
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
                  data={[{ type: "bar", x: porAno.map((r) => r.ano), y: porAno.map((r) => r.salidas), marker: { color: "#4f8ef7" } }]}
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

          <DataTable rows={tablaRot} title="Motivos de Salida" />
      </div>
    </div>
  );
}
