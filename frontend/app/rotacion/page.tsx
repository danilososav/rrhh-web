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
  { label: "Año",         field: "ANO_REPORTE" },
  { label: "Departamento", field: "DEPARTAMENTO" },
];

const MESES_NOMBRE: Record<number, string> = {
  1: "Ene", 2: "Feb", 3: "Mar", 4: "Abr", 5: "May", 6: "Jun",
  7: "Jul", 8: "Ago", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dic",
};

const TABS = [
  "Rotación General",
  "Por Empresa",
  "Por Cargo / Área",
  "Tendencia",
  "Entrevistas de Salida",
  "Detalle",
];

function isSalida(r: Row) {
  const sit  = String(r.SITUACION ?? "").trim().toUpperCase();
  const tipo = String(r.TIPO_SALIDA ?? "").trim().toUpperCase();
  return sit === "I" && tipo !== "" && tipo !== "NAN";
}

function computeFromRows(allRows: Row[]) {
  const salidas  = allRows.filter(isSalida);
  const hcEnero  = allRows.filter((r) => Number(r.MES_REPORTE) === 1).length;
  const empresas = new Set(allRows.map((r) => r.EMPRESA).filter(Boolean)).size;
  const vol      = salidas.filter((r) => String(r.TIPO_SALIDA ?? "").toUpperCase().includes("VOL")).length;
  const invol    = salidas.filter((r) => String(r.TIPO_SALIDA ?? "").toUpperCase().includes("INV")).length;
  const permArr  = salidas.map((r) => Number(r.MESES_PERMANENCIA)).filter((v) => !isNaN(v) && v > 0);
  const permProm = permArr.length ? Math.round((permArr.reduce((a, b) => a + b, 0) / permArr.length) * 10) / 10 : null;
  const tasa     = hcEnero > 0 ? Math.round(salidas.length / hcEnero * 1000) / 10 : null;

  const kpis = { tasa_anual: tasa, salidas_totales: salidas.length, empresas, voluntarias: vol, involuntarias: invol, permanencia_prom_meses: permProm };

  // ── Tab 1: Rotación General ──────────────────────────────────────────────
  const tipoSalida = (() => {
    const m = groupBy(salidas.filter((r) => r.TIPO_SALIDA && String(r.TIPO_SALIDA).toUpperCase() !== "NAN"), "TIPO_SALIDA");
    return { labels: Object.keys(m), values: Object.values(m).map((v) => v.length) };
  })();

  const motOrig = (() => {
    const m = groupBy(salidas.filter((r) => r.MOTIVO_SALIDA && String(r.MOTIVO_SALIDA).toUpperCase() !== "NAN"), "MOTIVO_SALIDA");
    return Object.entries(m).map(([motivo, r]) => ({ motivo, cantidad: r.length })).sort((a, b) => b.cantidad - a.cantidad).slice(0, 10);
  })();

  const tasaMensual = (() => {
    const byAnoMes: Record<string, Record<number, { sal: number; hc: number }>> = {};
    for (const r of allRows) {
      const ano = String(r.ANO_REPORTE ?? "");
      const mes = Number(r.MES_REPORTE);
      if (!ano || isNaN(mes)) continue;
      byAnoMes[ano] = byAnoMes[ano] ?? {};
      byAnoMes[ano][mes] = byAnoMes[ano][mes] ?? { sal: 0, hc: 0 };
      byAnoMes[ano][mes].hc++;
      if (isSalida(r)) byAnoMes[ano][mes].sal++;
    }
    const rows: AnyObj[] = [];
    for (const [ano, meses] of Object.entries(byAnoMes)) {
      for (const [mes, d] of Object.entries(meses)) {
        const tasa = d.hc > 0 ? Math.round(d.sal / d.hc * 1000) / 10 : 0;
        rows.push({ ano, mes: Number(mes), mes_nombre: MESES_NOMBRE[Number(mes)], tasa });
      }
    }
    return rows.sort((a, b) => Number(a.ano) - Number(b.ano) || a.mes - b.mes);
  })();

  // ── Tab 2: Por Empresa ───────────────────────────────────────────────────
  const salEmp = Object.entries(groupBy(salidas, "EMPRESA"))
    .map(([EMPRESA, r]) => ({ EMPRESA, salidas: r.length }))
    .sort((a, b) => a.salidas - b.salidas);

  const tasaEmp = (() => {
    const byEmpAno: Record<string, Record<string, { sal: number; hcEnero: number }>> = {};
    for (const r of allRows) {
      const emp = String(r.EMPRESA ?? ""); const ano = String(r.ANO_REPORTE ?? "");
      if (!emp || !ano) continue;
      byEmpAno[emp] = byEmpAno[emp] ?? {};
      byEmpAno[emp][ano] = byEmpAno[emp][ano] ?? { sal: 0, hcEnero: 0 };
      if (isSalida(r)) byEmpAno[emp][ano].sal++;
      if (Number(r.MES_REPORTE) === 1) byEmpAno[emp][ano].hcEnero++;
    }
    const rows: { empresa: string; tasa: number }[] = [];
    for (const [emp, anos] of Object.entries(byEmpAno)) {
      const sorted = Object.entries(anos).sort((a, b) => b[0].localeCompare(a[0]));
      for (const [, d] of sorted) {
        if (d.hcEnero > 0) { rows.push({ empresa: emp, tasa: Math.round(d.sal / d.hcEnero * 1000) / 10 }); break; }
      }
    }
    return rows.sort((a, b) => a.tasa - b.tasa);
  })();

  const tipoEmp = Object.entries(
    salidas.filter((r) => r.TIPO_SALIDA && String(r.TIPO_SALIDA).toUpperCase() !== "NAN")
      .reduce((acc, r) => {
        const key = `${r.EMPRESA}||${r.TIPO_SALIDA}`;
        acc[key] = (acc[key] ?? 0) + 1; return acc;
      }, {} as Record<string, number>)
  ).map(([k, n]) => { const [empresa, tipo] = k.split("||"); return { empresa, tipo, n }; });

  const permEmp = Object.entries(groupBy(salidas.filter((r) => r.MESES_PERMANENCIA != null && !isNaN(Number(r.MESES_PERMANENCIA))), "EMPRESA"))
    .map(([emp, r]) => ({ empresa: emp, meses: Math.round(r.reduce((a, x) => a + Number(x.MESES_PERMANENCIA), 0) / r.length * 10) / 10 }))
    .filter((r) => r.meses > 0).sort((a, b) => a.meses - b.meses);

  // ── Tab 3: Por Cargo / Área ──────────────────────────────────────────────
  const topCargos = Object.entries(groupBy(salidas.filter((r) => r.CARGO && String(r.CARGO).toUpperCase() !== "NAN"), "CARGO"))
    .map(([cargo, r]) => ({ cargo, salidas: r.length })).sort((a, b) => b.salidas - a.salidas).slice(0, 15);

  const permCargo = Object.entries(groupBy(salidas.filter((r) => r.CARGO && r.MESES_PERMANENCIA != null), "CARGO"))
    .map(([cargo, r]) => ({ cargo, meses: Math.round(r.reduce((a, x) => a + Number(x.MESES_PERMANENCIA), 0) / r.length * 10) / 10 }))
    .filter((r) => r.meses > 0).sort((a, b) => a.meses - b.meses).slice(0, 15);

  const topAreas = Object.entries(groupBy(salidas.filter((r) => r.AREA && String(r.AREA).toUpperCase() !== "NAN"), "AREA"))
    .map(([area, r]) => ({ area, salidas: r.length })).sort((a, b) => b.salidas - a.salidas).slice(0, 10);

  const topDept = Object.entries(groupBy(salidas.filter((r) => r.DEPARTAMENTO && String(r.DEPARTAMENTO).toUpperCase() !== "NAN"), "DEPARTAMENTO"))
    .map(([dept, r]) => ({ dept, salidas: r.length })).sort((a, b) => b.salidas - a.salidas).slice(0, 10);

  const permHist = salidas.map((r) => Number(r.MESES_PERMANENCIA)).filter((v) => !isNaN(v) && v > 0);

  // ── Tab 4: Tendencia ─────────────────────────────────────────────────────
  const byAno: Record<string, typeof tasaMensual> = {};
  for (const r of tasaMensual) { (byAno[r.ano] = byAno[r.ano] ?? []).push(r); }

  const porAno = Object.entries(groupBy(salidas, "ANO_REPORTE"))
    .map(([ano, r]) => ({ ano: String(ano), salidas: r.length })).sort((a, b) => a.ano.localeCompare(b.ano));

  const tipoAno = (() => {
    const acc: Record<string, Record<string, number>> = {};
    for (const r of salidas.filter((r) => r.TIPO_SALIDA && String(r.TIPO_SALIDA).toUpperCase() !== "NAN")) {
      const ano = String(r.ANO_REPORTE ?? ""); const tipo = String(r.TIPO_SALIDA);
      acc[ano] = acc[ano] ?? {}; acc[ano][tipo] = (acc[ano][tipo] ?? 0) + 1;
    }
    const rows: AnyObj[] = [];
    for (const [ano, tipos] of Object.entries(acc)) for (const [tipo, n] of Object.entries(tipos)) rows.push({ ano, tipo, n });
    return rows;
  })();

  const heatmap = (() => {
    const acc: Record<string, Record<number, number>> = {};
    for (const r of salidas.filter((r) => r.EMPRESA)) {
      const emp = String(r.EMPRESA); const mes = Number(r.MES_REPORTE);
      if (isNaN(mes)) continue;
      acc[emp] = acc[emp] ?? {}; acc[emp][mes] = (acc[emp][mes] ?? 0) + 1;
    }
    const rows: AnyObj[] = [];
    for (const [emp, meses] of Object.entries(acc)) for (const [mes, n] of Object.entries(meses)) rows.push({ empresa: emp, mes_nombre: MESES_NOMBRE[Number(mes)], n });
    return rows;
  })();

  return { kpis, tipoSalida, motOrig, tasaMensual, byAno, salEmp, tasaEmp, tipoEmp, permEmp, topCargos, permCargo, topAreas, topDept, permHist, porAno, tipoAno, heatmap };
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

const COLOR_SEQ = ["#4C6FFF","#22c55e","#f97316","#a855f7","#06b6d4","#f43f5e","#eab308","#10b981","#ec4899","#8b5cf6"];

export default function RotacionPage() {
  const { setRotacionData } = useDashboard();
  const { selected, register, reset } = useFilter();
  const [data, setData]     = useState<AnyObj | null>(null);
  const [activeTab, setActiveTab] = useState(0);

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

  const rawRows: Row[]         = (data.raw_rows as Row[]) ?? [];
  const filteredRows            = applyFilters(rawRows, selected);
  const advertencias: string[] = (data.advertencias as string[]) ?? [];
  const computed = computeFromRows(filteredRows);
  const { kpis, tipoSalida, motOrig, byAno, salEmp, tasaEmp, tipoEmp, permEmp, topCargos, permCargo, topAreas, topDept, permHist, porAno, tipoAno, heatmap } = computed;

  const entrevistas: AnyObj = (data.entrevistas as AnyObj) ?? {};
  const dimData = entrevistas.por_dimension
    ? Object.entries(entrevistas.por_dimension as Record<string, number>).sort((a, b) => a[1] - b[1])
    : null;

  // Líneas de tendencia (tasa mensual por año)
  const lineTraces = Object.entries(byAno).map(([ano, rows]) => ({
    type: "scatter" as const, mode: "lines+markers" as const, name: ano,
    x: rows.map((r) => r.mes_nombre), y: rows.map((r) => r.tasa),
  }));

  // Traces stacked tipo salida por empresa
  const tiposUnicos = Array.from(new Set(tipoEmp.map((r) => r.tipo)));
  const empresasUniq = Array.from(new Set(tipoEmp.map((r) => r.empresa)));
  const tipoEmpTraces = tiposUnicos.map((tipo, i) => ({
    type: "bar" as const, name: tipo,
    x: empresasUniq,
    y: empresasUniq.map((emp) => tipoEmp.find((r) => r.empresa === emp && r.tipo === tipo)?.n ?? 0),
    marker: { color: COLOR_SEQ[i % COLOR_SEQ.length] },
  }));

  // Traces stacked tipo salida por año
  const tiposUnicosAno = Array.from(new Set(tipoAno.map((r) => r.tipo)));
  const anosUniq = Array.from(new Set(tipoAno.map((r) => r.ano))).sort();
  const tipoAnoTraces = tiposUnicosAno.map((tipo, i) => ({
    type: "bar" as const, name: tipo,
    x: anosUniq,
    y: anosUniq.map((ano) => tipoAno.find((r) => r.ano === ano && r.tipo === tipo)?.n ?? 0),
    marker: { color: COLOR_SEQ[i % COLOR_SEQ.length] },
  }));

  const tablaRot: AnyObj[] = (data.tabla as AnyObj[]) ?? [];
  const salidasFiltradas = filteredRows.filter(isSalida);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4f8ef7] mb-1">Módulo de Rotación</p>
          <h1 className="page-title">Rotación de Personal</h1>
        </div>
        <button
          onClick={() => { setData(null); reset(); setActiveTab(0); }}
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

      {/* KPIs — orden igual a Streamlit */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <KpiCard title="Total Salidas"       value={kpis.salidas_totales} />
        <KpiCard title="Empresas"            value={kpis.empresas} />
        <KpiCard title="Tasa Rot. Anual"     value={kpis.tasa_anual != null ? `${kpis.tasa_anual}%` : "—"} accent />
        <KpiCard title="Voluntarias"         value={kpis.voluntarias} />
        <KpiCard title="Involuntarias"       value={kpis.involuntarias} />
        <KpiCard title="Permanencia Prom."   value={kpis.permanencia_prom_meses != null ? `${kpis.permanencia_prom_meses} meses` : "—"} />
      </div>

      {/* Tabs */}
      <div className="border-b border-white/[0.08] mb-6">
        <nav className="flex gap-1 overflow-x-auto">
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setActiveTab(i)}
              className={[
                "px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                activeTab === i
                  ? "border-[#4f8ef7] text-[#4f8ef7]"
                  : "border-transparent text-slate-400 hover:text-slate-200",
              ].join(" ")}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Tab 0: Rotación General ──────────────────────────────────────── */}
      {activeTab === 0 && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {tipoSalida.labels.length > 0 && (
              <ChartCard title="Voluntaria vs Involuntaria">
                <PlotChart
                  data={[{ type: "pie", labels: tipoSalida.labels, values: tipoSalida.values, hole: 0.4,
                    textinfo: "label+percent", textfont: { color: "#cbd5e1" },
                    marker: { colors: COLOR_SEQ } }]}
                  layout={{ margin: { t: 16, r: 16, b: 16, l: 16 } }}
                  height={300}
                />
              </ChartCard>
            )}
            {motOrig.length > 0 && (
              <ChartCard title="Top 10 Motivos de Salida">
                <PlotChart
                  data={[{ type: "bar", orientation: "h",
                    x: motOrig.map((r) => r.cantidad),
                    y: motOrig.map((r) => r.motivo),
                    marker: { color: COLOR_SEQ } }]}
                  layout={{ margin: { t: 16, r: 16, b: 36, l: 220 } }}
                  height={320}
                />
              </ChartCard>
            )}
          </div>
          {lineTraces.length > 0 && (
            <ChartCard title="Tasa de Rotación Mensual (%) — referencia por mes">
              <PlotChart data={lineTraces} height={280} />
            </ChartCard>
          )}
        </div>
      )}

      {/* ── Tab 1: Por Empresa ───────────────────────────────────────────── */}
      {activeTab === 1 && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {salEmp.length > 0 && (
              <ChartCard title="Total Salidas por Empresa">
                <PlotChart
                  data={[{ type: "bar", orientation: "h",
                    x: salEmp.map((r) => r.salidas), y: salEmp.map((r) => r.EMPRESA),
                    marker: { color: COLOR_SEQ[0] } }]}
                  layout={{ margin: { t: 16, r: 16, b: 36, l: 110 } }}
                  height={Math.max(280, salEmp.length * 28)}
                />
              </ChartCard>
            )}
            {tasaEmp.length > 0 && (
              <ChartCard title="Tasa de Rotación Anual por Empresa (%)">
                <PlotChart
                  data={[{ type: "bar", orientation: "h",
                    x: tasaEmp.map((r) => r.tasa), y: tasaEmp.map((r) => r.empresa),
                    marker: { color: tasaEmp.map((r) => r.tasa),
                      colorscale: [[0,"#22c55e"],[0.5,"#eab308"],[1,"#ef4444"]],
                      showscale: false } }]}
                  layout={{ margin: { t: 16, r: 16, b: 36, l: 110 } }}
                  height={Math.max(280, tasaEmp.length * 28)}
                />
              </ChartCard>
            )}
          </div>
          {tipoEmpTraces.length > 0 && (
            <ChartCard title="Tipo de Salida por Empresa">
              <PlotChart data={tipoEmpTraces} layout={{ barmode: "stack", margin: { t: 16, r: 16, b: 60, l: 16 } }} height={300} />
            </ChartCard>
          )}
          {permEmp.length > 0 && (
            <ChartCard title="Permanencia Promedio por Empresa (meses)">
              <PlotChart
                data={[{ type: "bar", orientation: "h",
                  x: permEmp.map((r) => r.meses), y: permEmp.map((r) => r.empresa),
                  marker: { color: permEmp.map((r) => r.meses), colorscale: "Blues", showscale: false } }]}
                layout={{ margin: { t: 16, r: 16, b: 36, l: 110 } }}
                height={Math.max(280, permEmp.length * 28)}
              />
            </ChartCard>
          )}
        </div>
      )}

      {/* ── Tab 2: Por Cargo / Área ──────────────────────────────────────── */}
      {activeTab === 2 && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {topCargos.length > 0 && (
              <ChartCard title="Top 15 Cargos con Más Rotación">
                <PlotChart
                  data={[{ type: "bar", orientation: "h",
                    x: topCargos.map((r) => r.salidas), y: topCargos.map((r) => r.cargo),
                    marker: { color: COLOR_SEQ[0] } }]}
                  layout={{ margin: { t: 16, r: 16, b: 36, l: 180 } }}
                  height={Math.max(280, topCargos.length * 24)}
                />
              </ChartCard>
            )}
            {permCargo.length > 0 && (
              <ChartCard title="Top 15 Cargos con Menor Permanencia">
                <PlotChart
                  data={[{ type: "bar", orientation: "h",
                    x: permCargo.map((r) => r.meses), y: permCargo.map((r) => r.cargo),
                    marker: { color: permCargo.map((r) => r.meses), colorscale: "RdYlGn", showscale: false } }]}
                  layout={{ margin: { t: 16, r: 16, b: 36, l: 180 } }}
                  height={Math.max(280, permCargo.length * 24)}
                />
              </ChartCard>
            )}
          </div>
          {(topAreas.length > 0 || topDept.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {topAreas.length > 0 && (
                <ChartCard title="Top 10 Áreas con Más Rotación">
                  <PlotChart
                    data={[{ type: "bar", orientation: "h",
                      x: topAreas.map((r) => r.salidas), y: topAreas.map((r) => r.area),
                      marker: { color: COLOR_SEQ[2] } }]}
                    layout={{ margin: { t: 16, r: 16, b: 36, l: 130 } }}
                    height={Math.max(260, topAreas.length * 26)}
                  />
                </ChartCard>
              )}
              {topDept.length > 0 && (
                <ChartCard title="Top 10 Departamentos con Más Rotación">
                  <PlotChart
                    data={[{ type: "bar", orientation: "h",
                      x: topDept.map((r) => r.salidas), y: topDept.map((r) => r.dept),
                      marker: { color: COLOR_SEQ[3] } }]}
                    layout={{ margin: { t: 16, r: 16, b: 36, l: 160 } }}
                    height={Math.max(260, topDept.length * 26)}
                  />
                </ChartCard>
              )}
            </div>
          )}
          {permHist.length > 0 && (
            <ChartCard title="Distribución de Permanencia al Momento de la Salida (meses)">
              <PlotChart
                data={[{ type: "histogram", x: permHist, marker: { color: "#4f8ef7" } } as AnyObj]}
                layout={{ margin: { t: 16, r: 16, b: 50, l: 50 } }}
                height={280}
              />
            </ChartCard>
          )}
          {topCargos.length === 0 && topAreas.length === 0 && (
            <p className="text-slate-500 text-sm">No hay datos de cargo o área disponibles en este archivo.</p>
          )}
        </div>
      )}

      {/* ── Tab 3: Tendencia ─────────────────────────────────────────────── */}
      {activeTab === 3 && (
        <div className="space-y-5">
          {lineTraces.length > 0 && (
            <ChartCard title="Tendencia de Salidas por Mes y Año">
              <PlotChart data={lineTraces} height={300} />
            </ChartCard>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {porAno.length > 0 && (
              <ChartCard title="Total Salidas por Año">
                <PlotChart
                  data={[{ type: "bar", x: porAno.map((r) => r.ano), y: porAno.map((r) => r.salidas),
                    marker: { color: COLOR_SEQ }, text: porAno.map((r) => String(r.salidas)),
                    textposition: "outside" as const }]}
                  layout={{ margin: { t: 30, r: 16, b: 50, l: 50 }, showlegend: false }}
                  height={280}
                />
              </ChartCard>
            )}
            {tipoAnoTraces.length > 0 && (
              <ChartCard title="Tipo de Salida por Año">
                <PlotChart data={tipoAnoTraces} layout={{ barmode: "stack", margin: { t: 16, r: 16, b: 50, l: 50 } }} height={280} />
              </ChartCard>
            )}
          </div>
          {heatmap.length > 0 && (
            <ChartCard title="Mapa de Calor: Salidas por Empresa y Mes">
              <PlotChart
                data={[{
                  type: "heatmap" as const,
                  x: heatmap.map((r) => r.mes_nombre),
                  y: heatmap.map((r) => r.empresa),
                  z: heatmap.map((r) => r.n),
                  colorscale: "Reds",
                }]}
                layout={{ margin: { t: 16, r: 16, b: 60, l: 110 } }}
                height={320}
              />
            </ChartCard>
          )}
        </div>
      )}

      {/* ── Tab 4: Entrevistas de Salida ──────────────────────────────────── */}
      {activeTab === 4 && (
        <div className="space-y-5">
          {dimData && dimData.length > 0 ? (
            <>
              {entrevistas.satisfaccion_promedio != null && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">
                  <KpiCard title="Satisfacción Promedio" value={`${entrevistas.satisfaccion_promedio} / 5`} accent />
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <ChartCard title="Promedio por Dimensión (escala 1–5)">
                  <PlotChart
                    data={[{ type: "bar", orientation: "h",
                      x: dimData.map(([, v]) => v), y: dimData.map(([k]) => k),
                      marker: { color: dimData.map(([, v]) => v), colorscale: "RdYlGn", cmin: 1, cmax: 5, showscale: false } }]}
                    layout={{ margin: { t: 16, r: 16, b: 36, l: 240 }, xaxis: { range: [0, 5] } }}
                    height={320}
                  />
                </ChartCard>
                <ChartCard title="Radar de Satisfacción">
                  <PlotChart
                    data={[{ type: "scatterpolar" as const, r: dimData.map(([, v]) => v),
                      theta: dimData.map(([k]) => k), fill: "toself",
                      line: { color: "#4f8ef7" }, name: "Puntuación" }]}
                    layout={{ polar: { radialaxis: { visible: true, range: [0, 5] } }, margin: { t: 30, r: 30, b: 30, l: 30 } }}
                    height={320}
                  />
                </ChartCard>
              </div>
              {entrevistas.insight_ia && (
                <div className="rounded-xl border border-[#4f8ef7]/20 bg-[#1a2240] p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4f8ef7] mb-2">
                    Análisis IA — Satisfacción promedio: {entrevistas.satisfaccion_promedio}
                  </p>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{entrevistas.insight_ia}</p>
                </div>
              )}
              {entrevistas.por_empresa && (
                <ChartCard title="Puntuación por Dimensión y Empresa">
                  <PlotChart
                    data={(() => {
                      const rows = entrevistas.por_empresa as AnyObj[];
                      const emps = Array.from(new Set(rows.map((r) => r.EMPRESA)));
                      return emps.map((emp, i) => ({
                        type: "bar" as const, name: String(emp), orientation: "h" as const,
                        x: rows.filter((r) => r.EMPRESA === emp).map((r) => r.promedio),
                        y: rows.filter((r) => r.EMPRESA === emp).map((r) => r.pregunta),
                        marker: { color: COLOR_SEQ[i % COLOR_SEQ.length] },
                      }));
                    })()}
                    layout={{ barmode: "group", margin: { t: 16, r: 16, b: 36, l: 240 }, xaxis: { range: [0, 5] } }}
                    height={340}
                  />
                </ChartCard>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <p className="text-slate-400 text-sm">No se encontraron columnas de entrevistas (P1–P8) en el archivo cargado.</p>
              <p className="text-slate-500 text-xs">El archivo debe contener columnas P1_ORIENTACION a P8_APERTURA_SUPERIOR.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Tab 5: Detalle ───────────────────────────────────────────────── */}
      {activeTab === 5 && (
        <div>
          <p className="text-sm text-slate-400 mb-3">
            <span className="font-medium text-slate-200">{salidasFiltradas.length}</span> salidas registradas con los filtros aplicados
          </p>
          <DataTable rows={tablaRot} title="Detalle de Rotación" />
        </div>
      )}
    </div>
  );
}
