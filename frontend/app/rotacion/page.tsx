"use client";

import { useState, useEffect } from "react";
import FileUpload from "@/components/FileUpload";
import KpiCard from "@/components/KpiCard";
import PlotChart, { COLOR_SEQ } from "@/components/PlotChart";
import TabBar from "@/components/TabBar";
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
  { id: "general",      label: "Rotación General",     icon: "🔄" },
  { id: "empresa",      label: "Por Empresa",          icon: "🏢" },
  { id: "cargo",        label: "Por Cargo / Área",     icon: "📋" },
  { id: "tendencia",    label: "Tendencia",            icon: "📈" },
  { id: "entrevistas",  label: "Entrevistas de Salida", icon: "💬" },
  { id: "detalle",      label: "Detalle",              icon: "📄" },
];

function barColors(n: number) {
  return Array.from({ length: n }, (_, i) => COLOR_SEQ[i % COLOR_SEQ.length]);
}

function isSalida(r: Row) {
  const sit  = String(r.SITUACION ?? "").trim().toUpperCase();
  const tipo = String(r.TIPO_SALIDA ?? "").trim().toUpperCase();
  return sit === "I" && tipo !== "" && tipo !== "NAN";
}

function isAnySalida(r: Row) {
  return String(r.SITUACION ?? "").trim().toUpperCase() === "I";
}

function computeFromRows(allRows: Row[]) {
  const salidas      = allRows.filter(isSalida);
  const todasSalidas = allRows.filter(isAnySalida);
  const hcEnero      = allRows.filter((r) => Number(r.MES_REPORTE) === 1).length;
  const empresas     = new Set(allRows.map((r) => r.EMPRESA).filter(Boolean)).size;
  const vol          = salidas.filter((r) => String(r.TIPO_SALIDA ?? "").toUpperCase().includes("VOL")).length;
  const invol        = salidas.filter((r) => String(r.TIPO_SALIDA ?? "").toUpperCase().includes("INV")).length;
  const permArr      = salidas.map((r) => Number(r.MESES_PERMANENCIA)).filter((v) => !isNaN(v));
  const permProm     = permArr.length ? Math.round((permArr.reduce((a, b) => a + b, 0) / permArr.length) * 10) / 10 : null;
  const tasa         = hcEnero > 0 ? Math.round(todasSalidas.length / hcEnero * 1000) / 10 : null;

  const kpis = { tasa_anual: tasa, salidas_totales: salidas.length, empresas, voluntarias: vol, involuntarias: invol, permanencia_prom_meses: permProm };

  const tipoSalida = (() => {
    const m = groupBy(salidas.filter((r) => r.TIPO_SALIDA && String(r.TIPO_SALIDA).toUpperCase() !== "NAN"), "TIPO_SALIDA");
    return { labels: Object.keys(m), values: Object.values(m).map((v) => v.length) };
  })();

  const motOrig = (() => {
    const m = groupBy(salidas.filter((r) => r.MOTIVO_SALIDA && String(r.MOTIVO_SALIDA).toUpperCase() !== "NAN"), "MOTIVO_SALIDA");
    return Object.entries(m).map(([motivo, r]) => ({ motivo, cantidad: r.length })).sort((a, b) => b.cantidad - a.cantidad).slice(0, 5);
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

  const TAC_SET      = new Set(["AMPLIFY","BPR"]);
  const CSC_SET      = new Set(["TEXO"]);

  const retencion = (() => {
    const empMap = groupBy(allRows.filter((r) => r.EMPRESA), "EMPRESA");
    return Object.entries(empMap).map(([empresa, rows]) => {
      const activos = rows.filter((r) => String(r.SITUACION ?? "").trim().toUpperCase() === "A").length;
      const egresos = rows.filter((r) => String(r.SITUACION ?? "").trim().toUpperCase() === "I").length;
      const pct     = activos > 0 ? Math.round((activos - egresos) / activos * 100) : 0;
      const empUp   = empresa.toUpperCase().trim();
      const grupo   = CSC_SET.has(empUp) ? "csc"
                    : TAC_SET.has(empUp) ? "tac"
                    : "agencia";
      return { empresa, activos, egresos, pct, grupo };
    }).sort((a, b) => a.empresa.localeCompare(b.empresa));
  })();

  const pctAvg = (arr: { pct: number }[]) => arr.length ? Math.round(arr.reduce((s, r) => s + r.pct, 0) / arr.length) : null;
  const retKpis = {
    agencias: pctAvg(retencion.filter((r) => r.grupo === "agencia")),
    tac:      pctAvg(retencion.filter((r) => r.grupo === "tac")),
    csc:      pctAvg(retencion.filter((r) => r.grupo === "csc")),
  };

  return { kpis, tipoSalida, motOrig, tasaMensual, byAno, salEmp, tasaEmp, tipoEmp, permEmp, topCargos, permCargo, topAreas, topDept, permHist, porAno, tipoAno, heatmap, retencion, retKpis };
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="chart-card">
      <h3 className="chart-title mb-4">{title}</h3>
      {children}
    </div>
  );
}

export default function RotacionPage() {
  const { rotacionData, setRotacionData } = useDashboard();
  const { selected, register } = useFilter();
  const [data, setData]       = useState<AnyObj | null>(rotacionData);
  const [activeTab, setActiveTab] = useState("general");
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    if (rotacionData) register(FILTER_CONFIGS, (rotacionData.raw_rows as Row[]) ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleResult(result: AnyObj) {
    setData(result);
    setRotacionData(result);
    setShowUpload(false);
    register(FILTER_CONFIGS, (result.raw_rows as Row[]) ?? []);
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[72vh] gap-6">
        <div className="text-center">
          <p className="label-xs mb-2" style={{ color: "var(--accent)" }}>Módulo de Rotación</p>
          <h1 className="page-title">Análisis de Rotación de Personal</h1>
          <p className="mt-2 text-sm max-w-sm mx-auto" style={{ color: "var(--text2)" }}>
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
  const { kpis, tipoSalida, motOrig, byAno, salEmp, tasaEmp, tipoEmp, permEmp, topCargos, permCargo, topAreas, topDept, permHist, porAno, tipoAno, heatmap, retencion, retKpis } = computed;

  const entrevistas: AnyObj = (data.entrevistas as AnyObj) ?? {};
  const dimData = entrevistas.por_dimension
    ? Object.entries(entrevistas.por_dimension as Record<string, number>).sort((a, b) => a[1] - b[1])
    : null;

  const lineTraces = Object.entries(byAno).map(([ano, rows]) => ({
    type: "scatter" as const, mode: "lines+markers" as const, name: ano,
    x: rows.map((r) => r.mes_nombre), y: rows.map((r) => r.tasa),
  }));

  const tiposUnicos   = Array.from(new Set(tipoEmp.map((r) => r.tipo)));
  const empresasUniq  = Array.from(new Set(tipoEmp.map((r) => r.empresa)));
  const tipoEmpTraces = tiposUnicos.map((tipo, i) => ({
    type: "bar" as const, name: tipo,
    x: empresasUniq,
    y: empresasUniq.map((emp) => tipoEmp.find((r) => r.empresa === emp && r.tipo === tipo)?.n ?? 0),
    marker: { color: COLOR_SEQ[i % COLOR_SEQ.length] },
  }));

  const tiposUnicosAno = Array.from(new Set(tipoAno.map((r) => r.tipo)));
  const anosUniq       = Array.from(new Set(tipoAno.map((r) => r.ano))).sort();
  const tipoAnoTraces  = tiposUnicosAno.map((tipo, i) => ({
    type: "bar" as const, name: tipo,
    x: anosUniq,
    y: anosUniq.map((ano) => tipoAno.find((r) => r.ano === ano && r.tipo === tipo)?.n ?? 0),
    marker: { color: COLOR_SEQ[i % COLOR_SEQ.length] },
  }));

  const tablaRot: AnyObj[]     = (data.tabla as AnyObj[]) ?? [];
  const salidasFiltradas        = filteredRows.filter(isSalida);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="label-xs mb-1" style={{ color: "var(--accent)" }}>Módulo de Rotación</p>
          <h1 className="page-title">Rotación de Personal</h1>
        </div>
        <button
          onClick={() => setShowUpload((v) => !v)}
          className="rounded-lg px-4 py-2 text-sm font-medium transition-all"
          style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text2)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text2)"; }}
        >
          Actualizar datos
        </button>
      </div>

      {showUpload && (
        <div className="mb-6 rounded-xl p-4" style={{ border: "1px solid var(--accent)", background: "var(--card)" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium" style={{ color: "var(--text)" }}>Cargar nuevos datos de rotación</p>
            <button onClick={() => setShowUpload(false)} className="text-xs transition" style={{ color: "var(--text3)" }}>Cancelar</button>
          </div>
          <FileUpload endpoint="/api/rotacion" fieldName="files" multiple onResult={handleResult} />
        </div>
      )}

      {advertencias.length > 0 && (
        <div className="mb-5 rounded-lg px-4 py-3 text-sm" style={{ border: "1px solid rgba(245,158,11,0.4)", background: "rgba(245,158,11,0.08)", color: "#f59e0b" }}>
          <strong>Advertencias:</strong>
          <ul className="mt-1 list-disc pl-5 space-y-0.5 opacity-80">
            {advertencias.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <KpiCard title="Total Salidas"     value={kpis.salidas_totales} />
        <KpiCard title="Empresas"          value={kpis.empresas} />
        <KpiCard title="Tasa Rot. Anual"   value={kpis.tasa_anual != null ? `${kpis.tasa_anual}%` : "—"} accentColor="var(--accent)" />
        <KpiCard title="Voluntarias"       value={kpis.voluntarias} accentColor="var(--green)" />
        <KpiCard title="Involuntarias"     value={kpis.involuntarias} accentColor="var(--red)" />
        <KpiCard title="Permanencia Prom." value={kpis.permanencia_prom_meses != null ? `${kpis.permanencia_prom_meses} m` : "—"} />
      </div>

      {/* Tabs */}
      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {/* ── Tab: Rotación General ── */}
      {activeTab === "general" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tipoSalida.labels.length > 0 && (
              <ChartCard title="Voluntaria vs Involuntaria">
                <PlotChart
                  data={[{ type: "pie", labels: tipoSalida.labels, values: tipoSalida.values, hole: 0.4,
                    textinfo: "label+percent", textfont: { color: "#6b7a99" },
                    marker: { colors: COLOR_SEQ } }]}
                  layout={{ margin: { t: 16, r: 16, b: 16, l: 16 } }}
                  height={300}
                />
              </ChartCard>
            )}
            {motOrig.length > 0 && (
              <ChartCard title="Top 5 Motivos de Salida">
                <PlotChart
                  data={[{ type: "bar", orientation: "h",
                    x: motOrig.map((r) => r.cantidad),
                    y: motOrig.map((r) => r.motivo),
                    marker: { color: "#7c5af6" } }]}
                  layout={{ margin: { t: 16, r: 16, b: 36, l: 220 } }}
                  height={320}
                />
              </ChartCard>
            )}
          </div>

          {/* Retención del Talento */}
          {retencion.length > 0 && (
            <div className="chart-card">
              <h3 className="chart-title mb-4">Retención del Talento</h3>
              <div className="flex gap-8">
                {/* KPIs laterales */}
                <div className="flex flex-col justify-center gap-6 min-w-[140px]">
                  {retKpis.agencias != null && (
                    <div>
                      <div className="text-4xl font-black" style={{ color: "#f97316" }}>{retKpis.agencias}%</div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--text2)" }}>Promedio<br/><span className="font-bold" style={{ color: "var(--text)" }}>Agencias</span></div>
                    </div>
                  )}
                  {retKpis.tac != null && (
                    <div>
                      <div className="text-4xl font-black" style={{ color: "#3b82f6" }}>{retKpis.tac}%</div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--text2)" }}>Promedio<br/><span className="font-bold" style={{ color: "var(--text)" }}>TAC Media</span></div>
                    </div>
                  )}
                  {retKpis.csc != null && (
                    <div>
                      <div className="text-4xl font-black" style={{ color: "#10b981" }}>{retKpis.csc}%</div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--text2)" }}>Promedio<br/><span className="font-bold" style={{ color: "var(--text)" }}>CSC</span></div>
                    </div>
                  )}
                </div>
                {/* Gráfico combinado */}
                <div className="flex-1 min-w-0">
                  <PlotChart
                    data={[
                      {
                        type: "bar", name: "Activos",
                        x: retencion.map((r) => r.empresa),
                        y: retencion.map((r) => r.activos),
                        marker: { color: retencion.map((r) =>
                          r.grupo === "csc"   ? "#10b981"
                          : r.grupo === "tac" ? "#3b82f6"
                          : "#f97316"
                        )},
                        text: retencion.map((r) => String(r.activos)),
                        textposition: "outside",
                      },
                      {
                        type: "bar", name: "Egresos",
                        x: retencion.map((r) => r.empresa),
                        y: retencion.map((r) => r.egresos),
                        marker: { color: "#9ca3af" },
                        text: retencion.map((r) => String(r.egresos)),
                        textposition: "outside",
                      },
                      {
                        type: "scatter", mode: "text+lines+markers", name: "% Retención",
                        x: retencion.map((r) => r.empresa),
                        y: retencion.map((r) => r.pct),
                        yaxis: "y2",
                        line: { color: "#3b82f6", width: 2 },
                        marker: { color: "#3b82f6", size: 7 },
                        text: retencion.map((r) => `${r.pct}%`),
                        textposition: "top center",
                      },
                    ]}
                    layout={{
                      barmode: "group",
                      yaxis2: { overlaying: "y", side: "right", ticksuffix: "%", showgrid: false },
                      margin: { t: 30, r: 60, b: 60, l: 40 },
                    }}
                    height={380}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Por Empresa ── */}
      {activeTab === "empresa" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {salEmp.length > 0 && (
              <ChartCard title="Total Salidas por Empresa">
                <PlotChart
                  data={[{ type: "bar", orientation: "h",
                    x: salEmp.map((r) => r.salidas), y: salEmp.map((r) => r.EMPRESA),
                    marker: { color: barColors(salEmp.length) } }]}
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
                      colorscale: [[0,"#10b981"],[0.5,"#f59e0b"],[1,"#ef4444"]],
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

      {/* ── Tab: Por Cargo / Área ── */}
      {activeTab === "cargo" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {topCargos.length > 0 && (
              <ChartCard title="Top 15 Cargos con Más Rotación">
                <PlotChart
                  data={[{ type: "bar", orientation: "h",
                    x: topCargos.map((r) => r.salidas), y: topCargos.map((r) => r.cargo),
                    marker: { color: barColors(topCargos.length) } }]}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {topAreas.length > 0 && (
                <ChartCard title="Top 10 Áreas con Más Rotación">
                  <PlotChart
                    data={[{ type: "bar", orientation: "h",
                      x: topAreas.map((r) => r.salidas), y: topAreas.map((r) => r.area),
                      marker: { color: barColors(topAreas.length) } }]}
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
                      marker: { color: barColors(topDept.length) } }]}
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
                data={[{ type: "histogram", x: permHist, marker: { color: "#7c5af6" } } as AnyObj]}
                layout={{ margin: { t: 16, r: 16, b: 50, l: 50 } }}
                height={280}
              />
            </ChartCard>
          )}
          {topCargos.length === 0 && topAreas.length === 0 && (
            <p className="text-sm" style={{ color: "var(--text2)" }}>No hay datos de cargo o área disponibles en este archivo.</p>
          )}
        </div>
      )}

      {/* ── Tab: Tendencia ── */}
      {activeTab === "tendencia" && (
        <div className="space-y-4">
          {lineTraces.length > 0 && (
            <ChartCard title="Tendencia de Salidas por Mes y Año">
              <PlotChart data={lineTraces} height={300} />
            </ChartCard>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {porAno.length > 0 && (
              <ChartCard title="Total Salidas por Año">
                <PlotChart
                  data={[{ type: "bar", x: porAno.map((r) => r.ano), y: porAno.map((r) => r.salidas),
                    marker: { color: barColors(porAno.length) }, text: porAno.map((r) => String(r.salidas)),
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
                data={[{ type: "heatmap" as const, x: heatmap.map((r) => r.mes_nombre), y: heatmap.map((r) => r.empresa), z: heatmap.map((r) => r.n), colorscale: "Purples" }]}
                layout={{ margin: { t: 16, r: 16, b: 60, l: 110 } }}
                height={320}
              />
            </ChartCard>
          )}
        </div>
      )}

      {/* ── Tab: Entrevistas de Salida ── */}
      {activeTab === "entrevistas" && (
        <div className="space-y-4">
          {dimData && dimData.length > 0 ? (
            <>
              {entrevistas.satisfaccion_promedio != null && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">
                  <KpiCard title="Satisfacción Promedio" value={`${entrevistas.satisfaccion_promedio} / 5`} accentColor="var(--accent)" />
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      line: { color: "#7c5af6" }, name: "Puntuación" }]}
                    layout={{ polar: { radialaxis: { visible: true, range: [0, 5] } }, margin: { t: 30, r: 30, b: 30, l: 30 } }}
                    height={320}
                  />
                </ChartCard>
              </div>
              {entrevistas.insight_ia && (
                <div className="rounded-xl p-5" style={{ border: "1px solid rgba(124,90,246,0.25)", background: "rgba(124,90,246,0.07)" }}>
                  <p className="label-xs mb-2" style={{ color: "var(--accent)" }}>
                    Análisis IA — Satisfacción promedio: {entrevistas.satisfaccion_promedio}
                  </p>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: "var(--text)" }}>{entrevistas.insight_ia}</p>
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
              <p className="text-sm" style={{ color: "var(--text2)" }}>No se encontraron columnas de entrevistas (P1–P8) en el archivo cargado.</p>
              <p className="text-xs" style={{ color: "var(--text3)" }}>El archivo debe contener columnas P1_ORIENTACION a P8_APERTURA_SUPERIOR.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Detalle ── */}
      {activeTab === "detalle" && (
        <div>
          <p className="text-sm mb-3" style={{ color: "var(--text2)" }}>
            <span className="font-medium" style={{ color: "var(--text)" }}>{salidasFiltradas.length}</span> salidas registradas con los filtros aplicados
          </p>
          <DataTable rows={tablaRot} title="Detalle de Rotación" />
        </div>
      )}
    </div>
  );
}
