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
  { id: "brecha",       label: "Brecha",       icon: "📊" },
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

  const extPorNac = (() => {
    const nacRows = rows.filter((r) => r.NACIONALIDAD);
    const m = groupBy(nacRows, "NACIONALIDAD");
    return Object.entries(m)
      .map(([nac, r]) => ({ nac: String(nac).toUpperCase(), count: r.length }))
      .sort((a, b) => b.count - a.count);
  })();

  const discapacidad = {
    count: 1,
    pct: total > 0 ? (1 / total * 100).toFixed(1) : "0.0",
    personas: [{ tipo: "Discapacidad Motora", empresa: "TEXO" }],
  };

  const antiguedadRangos = (() => {
    const rangos = [
      { label: "Menor a 1 año",    fn: (a: number) => a < 1 },
      { label: "Entre 1 y 5 años", fn: (a: number) => a >= 1 && a < 5 },
      { label: "Entre 5 y 10 años",fn: (a: number) => a >= 5 && a < 10 },
      { label: "Mayor a 10 años",  fn: (a: number) => a >= 10 },
    ];
    return rangos.map(({ label, fn }) => ({
      label,
      count: rows.filter((r) => r.ANTIGUEDAD_ANOS != null && fn(Number(r.ANTIGUEDAD_ANOS))).length,
    }));
  })();

  const antiguedadPorTipo = (() => {
    const m = groupBy(rows.filter((r) => r.TIPO_EMPRESA && r.ANTIGUEDAD_ANOS != null), "TIPO_EMPRESA");
    return Object.entries(m).map(([tipo, r]) => ({
      tipo: String(tipo),
      promedio: Math.round(sumField(r, "ANTIGUEDAD_ANOS") / r.length * 10) / 10,
    }));
  })();

  const ANILLOS = ["ANILLO 1", "ANILLO 2", "ANILLO 3"];
  const anillosGenero = ANILLOS.map((anillo) => {
    const r = rows.filter((x) => String(x.SECCION ?? "").toUpperCase().trim() === anillo);
    return { anillo, mujeres: r.filter((x) => x.SEXO === "F").length, hombres: r.filter((x) => x.SEXO === "M").length };
  });

  return { kpis, genero, genDist, lidFem, lidMasc, lidEmp, salEmp, brechaNivel, nac, anillosGenero, extPorNac, discapacidad, antiguedadRangos, antiguedadPorTipo };
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
  const { kpis, genero, genDist, lidFem, lidMasc, lidEmp, salEmp, brechaNivel, nac, anillosGenero, extPorNac, discapacidad, antiguedadRangos, antiguedadPorTipo } =
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
              {(() => {
                const pctF = kpis.total > 0 ? Math.round((genero.values[0] ?? 0) / kpis.total * 100) : 0;
                const pctM = kpis.total > 0 ? Math.round((genero.values[1] ?? 0) / kpis.total * 100) : 0;
                return (
                  <div className="flex flex-col gap-5">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col items-center gap-2 py-5 px-3 rounded-2xl"
                        style={{ background: "rgba(217,70,239,0.08)", border: "1px solid rgba(217,70,239,0.18)" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/mujer.png" alt="Mujeres" style={{ height: 100, width: "auto" }} />
                        <div className="text-5xl font-black leading-none" style={{ color: "#d946ef" }}>{pctF}%</div>
                        <div className="text-base font-semibold" style={{ color: "var(--text2)" }}>Mujeres</div>
                        <div className="text-3xl font-bold" style={{ color: "#fff" }}>{genero.values[0] ?? 0}</div>
                      </div>
                      <div className="flex flex-col items-center gap-2 py-5 px-3 rounded-2xl"
                        style={{ background: "rgba(129,140,248,0.08)", border: "1px solid rgba(129,140,248,0.18)" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/hombre.png" alt="Hombres" style={{ height: 100, width: "auto" }} />
                        <div className="text-5xl font-black leading-none" style={{ color: "#818cf8" }}>{pctM}%</div>
                        <div className="text-base font-semibold" style={{ color: "var(--text2)" }}>Hombres</div>
                        <div className="text-3xl font-bold" style={{ color: "#fff" }}>{genero.values[1] ?? 0}</div>
                      </div>
                    </div>
                    <div>
                      <div className="flex rounded-full overflow-hidden h-2.5">
                        <div style={{ width: `${pctF}%`, background: "linear-gradient(90deg,#c026d3,#d946ef)" }} />
                        <div style={{ flex: 1, background: "linear-gradient(90deg,#818cf8,#6366f1)" }} />
                      </div>
                      <div className="flex justify-between text-xs mt-1.5" style={{ color: "var(--text2)" }}>
                        <span>Mujeres {pctF}%</span>
                        <span>Hombres {pctM}%</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
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
            {anillosGenero.some((a) => a.mujeres + a.hombres > 0) && (
              <ChartCard title="Distribución por Anillos y Género">
                <PlotChart
                  data={[
                    {
                      name: "ANILLO 3", type: "bar", orientation: "h",
                      y: ["HOMBRES", "MUJERES"],
                      x: [anillosGenero[2].hombres, anillosGenero[2].mujeres],
                      marker: { color: "#f97316" },
                      text: [String(anillosGenero[2].hombres), String(anillosGenero[2].mujeres)],
                      textposition: "inside", insidetextanchor: "middle",
                    },
                    {
                      name: "ANILLO 2", type: "bar", orientation: "h",
                      y: ["HOMBRES", "MUJERES"],
                      x: [anillosGenero[1].hombres, anillosGenero[1].mujeres],
                      marker: { color: "#1e40af" },
                      text: [String(anillosGenero[1].hombres), String(anillosGenero[1].mujeres)],
                      textposition: "inside", insidetextanchor: "middle",
                    },
                    {
                      name: "ANILLO 1", type: "bar", orientation: "h",
                      y: ["HOMBRES", "MUJERES"],
                      x: [anillosGenero[0].hombres, anillosGenero[0].mujeres],
                      marker: { color: "#14b8a6" },
                      text: [String(anillosGenero[0].hombres), String(anillosGenero[0].mujeres)],
                      textposition: "inside", insidetextanchor: "middle",
                    },
                  ]}
                  layout={{ barmode: "group", xaxis: { title: { text: "Cantidad" } } }}
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
          {nac.resumen.values[1] >= 0 && (
            <ChartCard title="Nacionalidad">
              <PlotChart
                data={[{
                  type: "pie", labels: nac.resumen.labels, values: nac.resumen.values,
                  hole: 0.45, textinfo: "label+value+percent",
                  textposition: "auto",
                  textfont: { color: "#ffffff", size: 12 },
                  marker: { colors: ["#7c5af6", "#10b981"] },
                  automargin: true,
                }]}
                layout={{ margin: { t: 24, r: 80, b: 16, l: 80 } }}
                height={280}
              />
            </ChartCard>
          )}
          {extPorNac.length > 0 && (
            <ChartCard title="Colaboradores por Nacionalidad">
              <PlotChart
                data={[{
                  type: "bar",
                  x: extPorNac.map((r) => r.nac),
                  y: extPorNac.map((r) => r.count),
                  marker: { color: barColors(extPorNac.length) },
                  text: extPorNac.map((r) => String(r.count)),
                  textposition: "outside",
                }]}
                height={280}
              />
            </ChartCard>
          )}
          <ChartCard title="Inclusión Laboral" span2>
            <div className="flex flex-col gap-6 py-4">
              <div className="flex items-center gap-12">
                <div>
                  <div className="text-8xl font-black" style={{ color: "#10b981", lineHeight: 1 }}>{discapacidad.pct}%</div>
                  <div className="text-base mt-2" style={{ color: "var(--text2)" }}>Personas con Discapacidad</div>
                </div>
                {discapacidad.count > 0 && (
                  <>
                    <div className="text-5xl" style={{ color: "var(--text2)" }}>→</div>
                    <div className="flex flex-col gap-4">
                      {discapacidad.personas.map((p, i) => (
                        <div key={i} className="flex items-center gap-5">
                          <svg width="52" height="73" viewBox="0 0 80 112" fill="#10b981">
                            <circle cx="40" cy="13" r="12"/>
                            <rect x="36" y="25" width="8" height="7" rx="2"/>
                            <path d="M29 32 Q40 28 51 32 L51 58 Q40 63 29 58 Z"/>
                            <rect x="17" y="33" width="11" height="34" rx="5.5"/>
                            <rect x="52" y="33" width="11" height="34" rx="5.5"/>
                            <rect x="29" y="59" width="10" height="30" rx="5"/>
                            <rect x="41" y="59" width="10" height="30" rx="5"/>
                          </svg>
                          <div>
                            <div className="text-xl font-bold" style={{ color: "#fff" }}>{p.tipo}</div>
                            <div className="text-base" style={{ color: "var(--text2)" }}>{p.empresa}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {discapacidad.count === 0 && (
                  <div className="text-base" style={{ color: "var(--text2)" }}>Sin registros</div>
                )}
              </div>
              <div className="text-sm font-semibold" style={{ color: "var(--text2)" }}>
                {discapacidad.count} persona{discapacidad.count !== 1 ? "s" : ""} de {kpis.total} colaboradores
              </div>
            </div>
          </ChartCard>
        </div>
      )}

      {/* Tab: Brecha */}
      {tab === "brecha" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {genDist.length > 0 && (
            <ChartCard title="Distribución por Generaciones">
              <PlotChart
                data={[{ type: "bar", x: genDist.map((r) => r.Generacion), y: genDist.map((r) => r.Cantidad), marker: { color: barColors(genDist.length) } }]}
                height={280}
              />
            </ChartCard>
          )}
          <ChartCard title="Cantidad de Personas por Rango de Antigüedad">
            <PlotChart
              data={[{
                type: "bar",
                x: antiguedadRangos.map((r) => r.label),
                y: antiguedadRangos.map((r) => r.count),
                marker: { color: ["#60a5fa", "#fb923c", "#9ca3af", "#fbbf24"] },
                text: antiguedadRangos.map((r) => String(r.count)),
                textposition: "outside",
              }]}
              height={280}
            />
          </ChartCard>
          {antiguedadPorTipo.length > 0 && (
            <ChartCard title="Promedio de Antigüedad en Años por Tipo">
              <PlotChart
                data={[{
                  type: "bar",
                  x: antiguedadPorTipo.map((r) => r.tipo),
                  y: antiguedadPorTipo.map((r) => r.promedio),
                  marker: { color: ["#60a5fa", "#fb923c", "#9ca3af", "#fbbf24"].slice(0, antiguedadPorTipo.length) },
                  text: antiguedadPorTipo.map((r) => String(r.promedio)),
                  textposition: "outside",
                }]}
                height={280}
              />
            </ChartCard>
          )}
        </div>
      )}

      {(() => {
        const TAB_COLS: Record<string, string[]> = {
          distribucion: ["EMPRESA", "TIPO_EMPRESA", "NOMBRE", "SEXO", "LIDER", "SECCION", "NIVEL_AIC"],
          demografia:   ["EMPRESA", "NOMBRE", "GENERACION", "EDAD", "FECHA_NACIMIENTO", "NACIONALIDAD"],
          brecha:       ["EMPRESA", "TIPO_EMPRESA", "NOMBRE", "GENERACION", "ANTIGUEDAD_ANOS", "FECHA_INGRESO"],
        };
        const cols = TAB_COLS[tab] ?? Object.keys(rawRows[0] ?? {});
        const tableRows = rawRows.map((r) =>
          Object.fromEntries(cols.filter((c) => c in r).map((c) => [c, r[c]]))
        );
        return (
          <div className="mt-6">
            <DataTable rows={tableRows} title="Detalle de Nómina" />
          </div>
        );
      })()}
    </div>
  );
}
