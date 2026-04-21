"use client";

import { useState, useEffect } from "react";
import FileUpload from "@/components/FileUpload";
import KpiCard from "@/components/KpiCard";
import PlotChart from "@/components/PlotChart";
import DataTable from "@/components/DataTable";
import { useDashboard } from "@/context/DashboardContext";
import { useFilter } from "@/context/FilterContext";
import { Row, sumField, groupBy, applyFilters, FilterConfig } from "@/lib/filterUtils";

type AnyObj = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const FILTER_CONFIGS: FilterConfig[] = [
  { label: "Empresa",    field: "EMPRESA" },
  { label: "Nivel AIC",  field: "NIVEL_AIC" },
  { label: "Género",     field: "SEXO" },
  { label: "Generación", field: "GENERACION" },
  { label: "Lider",      field: "LIDER" },
];

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("es-PY", { maximumFractionDigits: 0 });
}

function computeFromRows(rows: Row[]) {
  const total      = rows.length;
  const empresas   = new Set(rows.map((r) => r.EMPRESA).filter(Boolean)).size;
  const lideres    = rows.filter((r) => r.LIDER === "SI").length;
  const mujeres    = rows.filter((r) => r.SEXO === "F").length;
  const esParaguay = (r: Row) => String(r.NACIONALIDAD ?? "").toUpperCase().includes("PARAGUAY");
  const extranjeros = rows.filter((r) => !esParaguay(r) && r.NACIONALIDAD).length;
  const salRows    = rows.filter((r) => r.SALARIO != null);
  const salProm    = salRows.length ? sumField(salRows, "SALARIO") / salRows.length : null;

  const kpis = {
    total,
    empresas,
    lideres,
    lider_pct:       total ? Math.round(lideres / total * 1000) / 10 : 0,
    pct_mujeres:     total ? Math.round(mujeres / total * 1000) / 10 : 0,
    pct_extranjeros: total ? Math.round(extranjeros / total * 1000) / 10 : 0,
    salario_promedio: salProm ? Math.round(salProm) : null,
  };

  // Género
  const genero = {
    labels: ["Mujeres", "Hombres"],
    values: [mujeres, rows.filter((r) => r.SEXO === "M").length],
    por_empresa: (() => {
      const m = groupBy(rows, "EMPRESA");
      return Object.entries(m).map(([emp, r]) => ({
        EMPRESA: emp,
        Mujeres: r.filter((x) => x.SEXO === "F").length,
        Hombres: r.filter((x) => x.SEXO === "M").length,
      }));
    })(),
  };

  // Generaciones
  const genDist = (() => {
    const orden = ["Baby Boomers", "Generación X", "Millennials", "Generación Z", "Otra"];
    const m = groupBy(rows, "GENERACION");
    return orden.filter((g) => m[g]).map((g) => ({ Generacion: g, Cantidad: m[g].length }));
  })();

  // Liderazgo
  const lidRows  = rows.filter((r) => r.LIDER === "SI");
  const lidFem   = lidRows.filter((r) => r.SEXO === "F").length;
  const lidMasc  = lidRows.filter((r) => r.SEXO === "M").length;
  const lidEmp   = (() => {
    const allEmp = groupBy(rows, "EMPRESA");
    const lidByEmp = groupBy(lidRows, "EMPRESA");
    return Object.entries(allEmp).map(([emp, r]) => ({
      EMPRESA: emp,
      pct_lideres: Math.round((lidByEmp[emp]?.length ?? 0) / r.length * 1000) / 10,
    }));
  })();

  // Brecha salarial
  const salEmp = (() => {
    const m = groupBy(salRows, "EMPRESA");
    return Object.entries(m).map(([emp, r]) => ({
      empresa: emp,
      promedio: Math.round(sumField(r, "SALARIO") / r.length),
    }));
  })();

  const brechaNivel = (() => {
    const m = groupBy(salRows, "NIVEL_AIC");
    return Object.entries(m).map(([niv, r]) => {
      const f = r.filter((x) => x.SEXO === "F");
      const h = r.filter((x) => x.SEXO === "M");
      return {
        nivel:        niv,
        prom_mujeres: f.length ? Math.round(sumField(f, "SALARIO") / f.length) : 0,
        prom_hombres: h.length ? Math.round(sumField(h, "SALARIO") / h.length) : 0,
      };
    });
  })();

  // Nacionalidad
  const nac = {
    resumen: {
      labels: ["Paraguayos", "Extranjeros"],
      values: [rows.filter(esParaguay).length, extranjeros],
    },
  };

  return { kpis, genero, genDist, lidFem, lidMasc, lidEmp, salEmp, brechaNivel, nac };
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
      <line x1="12" y1="88" x2="128" y2="88" stroke="#2d3748" strokeWidth="1" />
      <rect x="16" y="52" width="20" height="36" rx="3" fill="#1a1f2e" stroke="#2d3748" />
      <rect x="42" y="32" width="20" height="56" rx="3" fill="#1a1f2e" stroke="#2d3748" />
      <rect x="68" y="42" width="20" height="46" rx="3" fill="#1a1f2e" stroke="#2d3748" />
      <rect x="94" y="22" width="20" height="66" rx="3" fill="#1a1f2e" stroke="#2d3748" />
      <rect x="16" y="64" width="20" height="24" rx="3" fill="#4f8ef7" opacity="0.3" />
      <rect x="42" y="52" width="20" height="36" rx="3" fill="#4f8ef7" opacity="0.45" />
      <rect x="68" y="58" width="20" height="30" rx="3" fill="#4f8ef7" opacity="0.3" />
      <rect x="94" y="42" width="20" height="46" rx="3" fill="#4f8ef7" opacity="0.6" />
      <circle cx="118" cy="20" r="16" fill="#0f1117" stroke="#4f8ef7" strokeWidth="1.5" opacity="0.85" />
      <path d="M118 26V14M114 18l4-4 4 4" stroke="#4f8ef7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function NominaPage() {
  const { nominaData, setNominaData } = useDashboard();
  const { selected, register } = useFilter();
  const [data, setData] = useState<AnyObj | null>(nominaData);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    if (nominaData) register(FILTER_CONFIGS, (nominaData.tabla as Row[]) ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleResult(result: AnyObj) {
    setData(result);
    setNominaData(result);
    setShowUpload(false);
    register(FILTER_CONFIGS, (result.tabla as Row[]) ?? []);
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[72vh] gap-6">
        <UploadIllustration />
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4f8ef7] mb-2">Módulo de Nómina</p>
          <h1 className="page-title">Análisis de Colaboradores</h1>
          <p className="mt-2 text-sm text-slate-400 max-w-sm">
            Subí el Excel de nómina para analizar headcount, géneros, generaciones y brecha salarial por empresa.
          </p>
        </div>
        <div className="w-full max-w-md">
          <FileUpload endpoint="/api/nomina" fieldName="file" multiple={false} onResult={handleResult} />
        </div>
      </div>
    );
  }

  const rawRows: Row[] = (data.tabla as Row[]) ?? [];
  const filteredRows   = applyFilters(rawRows, selected);
  const { kpis, genero, genDist, lidFem, lidMasc, lidEmp, salEmp, brechaNivel, nac } =
    computeFromRows(filteredRows);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4f8ef7] mb-1">Módulo de Nómina</p>
          <h1 className="page-title">Análisis de Colaboradores</h1>
        </div>
        <button
          onClick={() => setShowUpload((v) => !v)}
          className="rounded-lg border border-white/[0.08] bg-[#1a1f2e] px-4 py-2 text-sm text-slate-400 transition hover:border-[#4f8ef7]/40 hover:text-[#4f8ef7]"
        >
          Actualizar datos
        </button>
      </div>

      {showUpload && (
        <div className="mb-6 rounded-xl border border-[#4f8ef7]/30 bg-[#1a1f2e] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-slate-300">Cargar nuevos datos de nómina</p>
            <button onClick={() => setShowUpload(false)} className="text-xs text-slate-500 hover:text-slate-300 transition">Cancelar</button>
          </div>
          <FileUpload endpoint="/api/nomina" fieldName="file" multiple={false} onResult={handleResult} />
        </div>
      )}

      <div>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <KpiCard title="Colaboradores"  value={fmt(kpis.total)} accent />
            <KpiCard title="Empresas"       value={fmt(kpis.empresas)} />
            <KpiCard title="Líderes"        value={`${kpis.lider_pct}%`} subtitle={`${fmt(kpis.lideres)} personas`} />
            <KpiCard title="Mujeres"        value={`${kpis.pct_mujeres}%`} />
            <KpiCard title="Extranjeros"    value={`${kpis.pct_extranjeros}%`} />
            <KpiCard title="Salario Prom."  value={kpis.salario_promedio != null ? `₲ ${fmt(kpis.salario_promedio)}` : "—"} />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <ChartCard title="Distribución por Género">
              <PlotChart
                data={[{ type: "pie", labels: genero.labels, values: genero.values, hole: 0.45, textinfo: "label+percent", textfont: { color: "#cbd5e1" } }]}
                layout={{ margin: { t: 16, r: 16, b: 16, l: 16 } }}
                height={280}
              />
            </ChartCard>

            {genero.por_empresa.length > 0 && (
              <ChartCard title="Género por Empresa">
                <PlotChart
                  data={[
                    { type: "bar", name: "Mujeres", x: genero.por_empresa.map((r) => r.EMPRESA), y: genero.por_empresa.map((r) => r.Mujeres), marker: { color: "#8b5cf6" } },
                    { type: "bar", name: "Hombres", x: genero.por_empresa.map((r) => r.EMPRESA), y: genero.por_empresa.map((r) => r.Hombres), marker: { color: "#4f8ef7" } },
                  ]}
                  layout={{ barmode: "group" }}
                  height={280}
                />
              </ChartCard>
            )}

            {nac.resumen.values[1] >= 0 && (
              <ChartCard title="Nacionalidad">
                <PlotChart
                  data={[{ type: "pie", labels: nac.resumen.labels, values: nac.resumen.values, hole: 0.45, textinfo: "label+percent", textfont: { color: "#cbd5e1" } }]}
                  layout={{ margin: { t: 16, r: 16, b: 16, l: 16 } }}
                  height={280}
                />
              </ChartCard>
            )}

            {genDist.length > 0 && (
              <ChartCard title="Generaciones">
                <PlotChart
                  data={[{ type: "bar", x: genDist.map((r) => r.Generacion), y: genDist.map((r) => r.Cantidad), marker: { color: "#06b6d4" } }]}
                  height={280}
                />
              </ChartCard>
            )}

            <ChartCard title="Líderes por Género">
              <PlotChart
                data={[{ type: "pie", labels: ["Mujeres", "Hombres"], values: [lidFem, lidMasc], hole: 0.45, textinfo: "label+percent", textfont: { color: "#cbd5e1" } }]}
                layout={{ margin: { t: 16, r: 16, b: 16, l: 16 } }}
                height={280}
              />
            </ChartCard>

            {lidEmp.length > 0 && (
              <ChartCard title="% Líderes por Empresa">
                <PlotChart
                  data={[{ type: "bar", x: lidEmp.map((r) => r.EMPRESA), y: lidEmp.map((r) => r.pct_lideres), marker: { color: "#f59e0b" } }]}
                  layout={{ yaxis: { ticksuffix: "%" } }}
                  height={280}
                />
              </ChartCard>
            )}

            {salEmp.length > 0 && (
              <ChartCard title="Salario Promedio por Empresa">
                <PlotChart
                  data={[{ type: "bar", x: salEmp.map((r) => r.empresa), y: salEmp.map((r) => r.promedio), marker: { color: "#10b981" } }]}
                  height={280}
                />
              </ChartCard>
            )}

            {brechaNivel.length > 0 && (
              <ChartCard title="Brecha Salarial por Nivel">
                <PlotChart
                  data={[
                    { type: "bar", name: "Mujeres", x: brechaNivel.map((r) => r.nivel), y: brechaNivel.map((r) => r.prom_mujeres), marker: { color: "#8b5cf6" } },
                    { type: "bar", name: "Hombres", x: brechaNivel.map((r) => r.nivel), y: brechaNivel.map((r) => r.prom_hombres), marker: { color: "#4f8ef7" } },
                  ]}
                  layout={{ barmode: "group" }}
                  height={280}
                />
              </ChartCard>
            )}
          </div>

          <DataTable rows={rawRows} title="Detalle de Nómina" />
      </div>
    </div>
  );
}
