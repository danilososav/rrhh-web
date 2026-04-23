"use client";

import { useState, useEffect } from "react";
import FileUpload from "@/components/FileUpload";
import KpiCard from "@/components/KpiCard";
import PlotChart, { COLOR_SEQ } from "@/components/PlotChart";
import TabBar from "@/components/TabBar";
import DataTable from "@/components/DataTable";
import { useDashboard } from "@/context/DashboardContext";
import LayoutShell from "@/components/LayoutShell";
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
  { id: "distribucion", label: "Distribución", icon: "👥" },
  { id: "demografia",   label: "Demografía",   icon: "🌍" },
  { id: "salarios",     label: "Salarios",     icon: "💰" },
  { id: "liderazgo",    label: "Liderazgo",    icon: "🏆" },
];

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("es-PY", { maximumFractionDigits: 0 });
}

function computeFromRows(rows: Row[]) {
  const total    = rows.length;
  const empresas = new Set(rows.map((r) => r.EMPRESA).filter(Boolean)).size;

  const tipoNorm = (r: Row) => String(r.TIPO_EMPRESA ?? "").toUpperCase().trim();
  const agencias = rows.filter((r) => tipoNorm(r) === "AGENCIA").length;
  const tacMedia = rows.filter((r) => tipoNorm(r) === "TAC MEDIA").length;
  const csc      = rows.filter((r) => tipoNorm(r) === "CSC").length;

  const mujeres     = rows.filter((r) => r.SEXO === "F").length;
  const salRows     = rows.filter((r) => r.SALARIO != null);
  const esParaguay  = (r: Row) => String(r.NACIONALIDAD ?? "").toUpperCase().includes("PARAGUAY");
  const extranjeros = rows.filter((r) => !esParaguay(r) && r.NACIONALIDAD).length;

  const kpis = {
    total,
    empresas,
    agencias,
    tac_media: tacMedia,
    csc,
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

// Pictograma SVG Mujer
function FemalePictogram({ size = 60, color = "#d946ef" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size * 1.5} viewBox="0 0 60 90" fill="none">
      {/* Cabeza */}
      <circle cx="30" cy="13" r="11" fill={color} />
      {/* Vestido */}
      <path d="M14 32 L22 28 L30 30 L38 28 L46 32 L40 72 L20 72 Z" fill={color} opacity="0.9" />
      {/* Brazos */}
      <line x1="14" y1="32" x2="6" y2="50" stroke={color} strokeWidth="5" strokeLinecap="round" />
      <line x1="46" y1="32" x2="54" y2="50" stroke={color} strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

// Pictograma SVG Hombre
function MalePictogram({ size = 60, color = "#818cf8" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size * 1.5} viewBox="0 0 60 90" fill="none">
      {/* Cabeza */}
      <circle cx="30" cy="13" r="11" fill={color} />
      {/* Torso */}
      <rect x="16" y="27" width="28" height="26" rx="4" fill={color} opacity="0.9" />
      {/* Brazos */}
      <line x1="16" y1="30" x2="6" y2="50" stroke={color} strokeWidth="5" strokeLinecap="round" />
      <line x1="44" y1="30" x2="54" y2="50" stroke={color} strokeWidth="5" strokeLinecap="round" />
      {/* Piernas */}
      <rect x="16" y="53" width="12" height="26" rx="4" fill={color} opacity="0.9" />
      <rect x="32" y="53" width="12" height="26" rx="4" fill={color} opacity="0.9" />
    </svg>
  );
}

export default function NominaPage() {
  const { nominaData, setNominaData } = useDashboard();
  const { selected, register } = useFilter();
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<AnyObj | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [tab, setTab] = useState("distribucion");

  useEffect(() => {
    setMounted(true);
    if (nominaData) {
      setData(nominaData);
      register(FILTER_CONFIGS, (nominaData.tabla as Row[]) ?? []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted) return null;

  function handleRefresh() {
    setShowUpload(true);
  }

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
      {/* Encabezado con botón actualizar */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="label-xs" style={{ color: "var(--accent)" }}>Módulo de Nómina</p>
          <h1 className="page-title">Análisis de Colaboradores</h1>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium transition-all"
          style={{ background: "var(--card2)", color: "var(--text2)", border: "1px solid var(--border)" }}
        >
          ↺ Actualizar datos
        </button>
      </div>

      {/* Panel actualizar datos */}
      {showUpload && (
        <div className="mb-6 p-4 rounded-xl border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>Actualizar datos de nómina</span>
            <button onClick={() => setShowUpload(false)} className="text-xs px-3 py-1 rounded-lg" style={{ background: "var(--card2)", color: "var(--text2)" }}>Cancelar</button>
          </div>
          <FileUpload endpoint="/api/nomina" fieldName="file" multiple={false} onResult={handleResult} />
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <KpiCard title="Colaboradores"  value={fmt(kpis.total)}          accentColor="var(--accent)" />
        <KpiCard title="Empresas"       value={fmt(kpis.empresas)} />
        <KpiCard title="Agencias"       value={fmt(kpis.agencias)} />
        <KpiCard title="TAC Media"      value={fmt(kpis.tac_media)} />
        <KpiCard title="CSC"            value={fmt(kpis.csc)} />
      </div>

      {/* Tabs */}
      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      {/* Tab: Distribución */}
      {tab === "distribucion" && (
        <div className="tab-content" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ChartCard title="DISTRIBUCIÓN POR GÉNERO">
              <div className="flex items-center gap-6">
                <div className="w-52 h-52 flex-shrink-0">
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
                </div>
                <div className="flex flex-col gap-5">
                  <div>
                    <div className="text-5xl font-black" style={{ color: "#d946ef", lineHeight: 1 }}>{genero.values[0] ?? 0}%</div>
                    <div className="text-sm" style={{ color: "var(--text2)" }}>Mujeres · {genero.values[0] != null ? Math.round(genero.values[0] * kpis.total / 100) : "—"}</div>
                  </div>
                  <div>
                    <div className="text-5xl font-black" style={{ color: "#818cf8", lineHeight: 1 }}>{genero.values[1] ?? 0}%</div>
                    <div className="text-sm" style={{ color: "var(--text2)" }}>Hombres · {genero.values[1] != null ? Math.round(genero.values[1] * kpis.total / 100) : "—"}</div>
                  </div>
                </div>
              </div>
            </ChartCard>
            {genero.por_empresa.length > 0 && (
              <ChartCard title="GÉNERO POR EMPRESA">
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
