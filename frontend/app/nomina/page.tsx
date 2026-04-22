"use client";

import { useState, useEffect } from "react";
import FileUpload from "@/components/FileUpload";
import KpiCard from "@/components/KpiCard";
import PlotChart, { COLOR_SEQ } from "@/components/PlotChart";
import TabBar from "@/components/TabBar";
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

const TABS = [
  { id: "distribucion", label: "Distribución" },
  { id: "demografia",   label: "Demografía" },
  { id: "salarios",     label: "Salarios" },
  { id: "liderazgo",    label: "Liderazgo" },
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

  const genDist = (() => {
    const orden = ["Baby Boomers", "Generación X", "Millennials", "Generación Z", "Otra"];
    const m = groupBy(rows, "GENERACION");
    return orden.filter((g) => m[g]).map((g) => ({ Generacion: g, Cantidad: m[g].length }));
  })();

  const lidRows = rows.filter((r) => r.LIDER === "SI");
  const lidFem  = lidRows.filter((r) => r.SEXO === "F").length;
  const lidMasc = lidRows.filter((r) => r.SEXO === "M").length;
  const lidEmp  = (() => {
    const allEmp   = groupBy(rows, "EMPRESA");
    const lidByEmp = groupBy(lidRows, "EMPRESA");
    return Object.entries(allEmp).map(([emp, r]) => ({
      EMPRESA: emp,
      pct_lideres: Math.round((lidByEmp[emp]?.length ?? 0) / r.length * 1000) / 10,
    }));
  })();

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

  const nac = {
    resumen: {
      labels: ["Paraguayos", "Extranjeros"],
      values: [rows.filter(esParaguay).length, extranjeros],
    },
  };

  return { kpis, genero, genDist, lidFem, lidMasc, lidEmp, salEmp, brechaNivel, nac };
}

function barColors(n: number) {
  return Array.from({ length: n }, (_, i) => COLOR_SEQ[i % COLOR_SEQ.length]);
}

function ChartCard({ title, children, span2 = false }: { title: string; children: React.ReactNode; span2?: boolean }) {
  return (
    <div className={`chart-card${span2 ? " md:col-span-2" : ""}`}>
      <h3 className="chart-title mb-4">{title}</h3>
      {children}
    </div>
  );
}

export default function NominaPage() {
  const { nominaData, setNominaData } = useDashboard();
  const { selected, register } = useFilter();
  const [data, setData] = useState<AnyObj | null>(nominaData);
  const [showUpload, setShowUpload] = useState(false);
  const [tab, setTab] = useState("distribucion");

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
        <div className="text-center">
          <p className="label-xs mb-2" style={{ color: "var(--accent)" }}>Módulo de Nómina</p>
          <h1 className="page-title">Análisis de Colaboradores</h1>
          <p className="mt-2 text-sm max-w-sm mx-auto" style={{ color: "var(--text2)" }}>
            Subí el Excel de nómina para analizar headcount, géneros, generaciones y brecha salarial por empresa.
          </p>
        </div>
        <div className="w-full max-w-md">
          <FileUpload endpoint="/api/nomina" fieldName="file" multiple={false} onResult={handleResult} />
        </div>
      </div>
    );
  }

  const rawRows: Row[]  = (data.tabla as Row[]) ?? [];
  const filteredRows    = applyFilters(rawRows, selected);
  const { kpis, genero, genDist, lidFem, lidMasc, lidEmp, salEmp, brechaNivel, nac } =
    computeFromRows(filteredRows);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="label-xs mb-1" style={{ color: "var(--accent)" }}>Módulo de Nómina</p>
          <h1 className="page-title">Análisis de Colaboradores</h1>
        </div>
        <button
          onClick={() => setShowUpload((v) => !v)}
          className="rounded-lg px-4 py-2 text-sm font-medium transition-all"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            color: "var(--text2)",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text2)";
          }}
        >
          Actualizar datos
        </button>
      </div>

      {showUpload && (
        <div className="mb-6 rounded-xl p-4" style={{ border: "1px solid var(--accent)", background: "var(--card)" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium" style={{ color: "var(--text)" }}>Cargar nuevos datos de nómina</p>
            <button onClick={() => setShowUpload(false)} className="text-xs transition" style={{ color: "var(--text3)" }}>Cancelar</button>
          </div>
          <FileUpload endpoint="/api/nomina" fieldName="file" multiple={false} onResult={handleResult} />
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <KpiCard title="Colaboradores"  value={fmt(kpis.total)}          accentColor="var(--accent)" />
        <KpiCard title="Empresas"       value={fmt(kpis.empresas)} />
        <KpiCard title="Líderes"        value={`${kpis.lider_pct}%`}     subtitle={`${fmt(kpis.lideres)} personas`} />
        <KpiCard title="Mujeres"        value={`${kpis.pct_mujeres}%`}   accentColor="var(--pink)" />
        <KpiCard title="Extranjeros"    value={`${kpis.pct_extranjeros}%`} />
        <KpiCard title="Salario Prom."  value={kpis.salario_promedio != null ? `₲ ${fmt(kpis.salario_promedio)}` : "—"} accentColor="var(--green)" />
      </div>

      {/* Tabs */}
      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      {/* Tab: Distribución */}
      {tab === "distribucion" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ChartCard title="Distribución por Género">
            <PlotChart
              data={[{
                type: "pie", labels: genero.labels, values: genero.values,
                hole: 0.45, textinfo: "label+percent",
                textfont: { color: "#6b7a99" },
                marker: { colors: ["#d946ef", "#818cf8"] },
              }]}
              layout={{ margin: { t: 16, r: 16, b: 16, l: 16 } }}
              height={280}
            />
          </ChartCard>
          {genero.por_empresa.length > 0 && (
            <ChartCard title="Género por Empresa">
              <PlotChart
                data={[
                  { type: "bar", name: "Mujeres", x: genero.por_empresa.map((r) => r.EMPRESA), y: genero.por_empresa.map((r) => r.Mujeres), marker: { color: "#d946ef" } },
                  { type: "bar", name: "Hombres", x: genero.por_empresa.map((r) => r.EMPRESA), y: genero.por_empresa.map((r) => r.Hombres), marker: { color: "#818cf8" } },
                ]}
                layout={{ barmode: "group" }}
                height={280}
              />
            </ChartCard>
          )}
        </div>
      )}

      {/* Tab: Demografía */}
      {tab === "demografia" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {genDist.length > 0 && (
            <ChartCard title="Distribución por Generaciones">
              <PlotChart
                data={[{ type: "bar", x: genDist.map((r) => r.Generacion), y: genDist.map((r) => r.Cantidad), marker: { color: barColors(genDist.length) } }]}
                height={280}
              />
            </ChartCard>
          )}
          {nac.resumen.values[1] >= 0 && (
            <ChartCard title="Nacionalidad">
              <PlotChart
                data={[{
                  type: "pie", labels: nac.resumen.labels, values: nac.resumen.values,
                  hole: 0.45, textinfo: "label+percent",
                  textfont: { color: "#6b7a99" },
                  marker: { colors: ["#7c5af6", "#10b981"] },
                }]}
                layout={{ margin: { t: 16, r: 16, b: 16, l: 16 } }}
                height={280}
              />
            </ChartCard>
          )}
        </div>
      )}

      {/* Tab: Salarios */}
      {tab === "salarios" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {salEmp.length > 0 && (
            <ChartCard title="Salario Promedio por Empresa">
              <PlotChart
                data={[{ type: "bar", x: salEmp.map((r) => r.empresa), y: salEmp.map((r) => r.promedio), marker: { color: barColors(salEmp.length) } }]}
                height={280}
              />
            </ChartCard>
          )}
          {brechaNivel.length > 0 && (
            <ChartCard title="Brecha Salarial por Nivel">
              <PlotChart
                data={[
                  { type: "bar", name: "Mujeres", x: brechaNivel.map((r) => r.nivel), y: brechaNivel.map((r) => r.prom_mujeres), marker: { color: "#d946ef" } },
                  { type: "bar", name: "Hombres", x: brechaNivel.map((r) => r.nivel), y: brechaNivel.map((r) => r.prom_hombres), marker: { color: "#818cf8" } },
                ]}
                layout={{ barmode: "group" }}
                height={280}
              />
            </ChartCard>
          )}
        </div>
      )}

      {/* Tab: Liderazgo */}
      {tab === "liderazgo" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ChartCard title="Líderes por Género">
            <PlotChart
              data={[{
                type: "pie", labels: ["Mujeres", "Hombres"], values: [lidFem, lidMasc],
                hole: 0.45, textinfo: "label+percent",
                textfont: { color: "#6b7a99" },
                marker: { colors: ["#d946ef", "#818cf8"] },
              }]}
              layout={{ margin: { t: 16, r: 16, b: 16, l: 16 } }}
              height={280}
            />
          </ChartCard>
          {lidEmp.length > 0 && (
            <ChartCard title="% Líderes por Empresa">
              <PlotChart
                data={[{ type: "bar", x: lidEmp.map((r) => r.EMPRESA), y: lidEmp.map((r) => r.pct_lideres), marker: { color: barColors(lidEmp.length) } }]}
                layout={{ yaxis: { ticksuffix: "%" } }}
                height={280}
              />
            </ChartCard>
          )}
        </div>
      )}

      <div className="mt-6">
        <DataTable rows={rawRows} title="Detalle de Nómina" />
      </div>
    </div>
  );
}
