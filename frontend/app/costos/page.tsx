"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import KpiCard from "@/components/KpiCard";
import PlotChart from "@/components/PlotChart";
import DataTable from "@/components/DataTable";
import { useDashboard } from "@/context/DashboardContext";
import { useFilter } from "@/context/FilterContext";
import { authHeaders } from "@/lib/auth";
import { Row, sumField, groupBy, fmtGs, applyFilters, FilterConfig } from "@/lib/filterUtils";

type AnyObj = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const FILTER_CONFIGS: FilterConfig[] = [
  { label: "Agencia",       field: "AGENCIA" },
  { label: "Nivel AIC",     field: "NIVEL_AIC" },
  { label: "Tipo Salida",   field: "TIPO_SALIDA" },
  { label: "Motivo Salida", field: "MOTIVO_SALIDA" },
  { label: "Año",           field: "ANO_SALIDA" },
];

const CONCEPTOS: [string, string][] = [
  ["Salario Base",        "SALARIO_BASE"],
  ["Vac. Causadas",       "VAC_CAUSADAS"],
  ["Vac. Proporcionales", "VAC_PROPORCIONALES"],
  ["Indemnización",       "INDEMNIZACION"],
  ["Preaviso",            "PREAVISO"],
  ["Aguinaldo",           "AGUINALDO"],
  ["Gratificación",       "GRATIFICACION"],
  ["Comisiones",          "COMISIONES"],
  ["Horas Extras",        "HORAS_EXTRAS"],
  ["Bonif. Familiar",     "BONIF_FAMILIAR"],
  ["IPS Total",           "IPS_TOTAL"],
  ["Sobrecosto",          "SOBRECOSTO"],
];

// Paleta de colores por agencia (Plotly-compatible)
const AG_PALETTE = [
  "#06b6d4","#8b5cf6","#f59e0b","#10b981","#f43f5e",
  "#4f8ef7","#ec4899","#84cc16","#ff7c3d","#6366f1",
];
function agColors(n: number) {
  return Array.from({ length: n }, (_, i) => AG_PALETTE[i % AG_PALETTE.length]);
}

const TABS = [
  { id: "agencia",     label: "Por Agencia",          icon: "🏢" },
  { id: "composicion", label: "Composición de Costos", icon: "🌿" },
  { id: "tipo",        label: "Por Tipo / Motivo",     icon: "📋" },
  { id: "tendencia",   label: "Tendencia",             icon: "📈" },
  { id: "detalle",     label: "Detalle",               icon: "📄" },
];

function computeFromRows(rows: Row[]) {
  const kpis = {
    total_liquidaciones: rows.length,
    sobrecosto_fmt:      fmtGs(sumField(rows, "SOBRECOSTO")),
    total_costo_fmt:     fmtGs(sumField(rows, "TOTAL_COSTO")),
    total_bruto_fmt:     fmtGs(sumField(rows, "TOTAL_BRUTO")),
    total_neto_fmt:      fmtGs(sumField(rows, "NETO")),
    aporte_patronal_fmt: fmtGs(sumField(rows, "APORTE_PATRONAL")),
  };

  // ── Por Agencia ─────────────────────────────────────────────────────────
  const agMap   = groupBy(rows, "AGENCIA");
  const agSob   = Object.entries(agMap)
    .map(([ag, r]) => ({ AGENCIA: ag, SOBRECOSTO: sumField(r, "SOBRECOSTO") }))
    .sort((a, b) => a.SOBRECOSTO - b.SOBRECOSTO);
  const agCant  = Object.entries(agMap)
    .map(([ag, r]) => ({ AGENCIA: ag, cantidad: r.length }))
    .sort((a, b) => a.cantidad - b.cantidad);
  const agProm  = Object.entries(agMap)
    .map(([ag, r]) => ({ AGENCIA: ag, prom: r.length ? sumField(r, "SOBRECOSTO") / r.length : 0 }))
    .sort((a, b) => b.prom - a.prom);

  // ── Composición ─────────────────────────────────────────────────────────
  const comp = CONCEPTOS
    .map(([label, field]) => [label, sumField(rows, field)] as [string, number])
    .filter(([, v]) => v > 0);
  const composicion = comp.length > 0
    ? { labels: comp.map(([l]) => l), values: comp.map(([, v]) => v) }
    : null;

  // ── Por Tipo / Motivo ───────────────────────────────────────────────────
  const tipoMap  = groupBy(rows, "TIPO_SALIDA");
  const tipoData = Object.keys(tipoMap).length > 0
    ? { labels: Object.keys(tipoMap), values: Object.values(tipoMap).map((r) => sumField(r, "SOBRECOSTO")) }
    : null;

  const motivoMap  = groupBy(rows, "MOTIVO_SALIDA");
  const top10motivo = Object.entries(motivoMap)
    .map(([motivo, r]) => ({ motivo, sobrecosto: sumField(r, "SOBRECOSTO") }))
    .sort((a, b) => b.sobrecosto - a.sobrecosto)
    .slice(0, 10);

  const nivMap   = groupBy(rows, "NIVEL_AIC");
  const nivCosto = Object.entries(nivMap)
    .map(([n, r]) => ({ nivel: n, total_costo: sumField(r, "TOTAL_COSTO") }));
  const nivComp  = Object.entries(nivMap)
    .map(([n, r]) => ({ nivel: n, total_costo: sumField(r, "TOTAL_COSTO"), sobrecosto: sumField(r, "SOBRECOSTO") }));

  // ── Tendencia ───────────────────────────────────────────────────────────
  const anoMap = groupBy(rows, "ANO_SALIDA");
  const sobAno = Object.entries(anoMap)
    .map(([ano, r]) => ({ ano: String(ano), sobrecosto: sumField(r, "SOBRECOSTO") }))
    .sort((a, b) => a.ano.localeCompare(b.ano));
  const liqAno = Object.entries(anoMap)
    .map(([ano, r]) => ({ ano: String(ano), liquidaciones: r.length }))
    .sort((a, b) => a.ano.localeCompare(b.ano));

  return { kpis, agSob, agCant, agProm, composicion, tipoData, top10motivo, nivCosto, nivComp, sobAno, liqAno };
}

function ChartCard({ title, children, fullWidth }: { title: string; children: React.ReactNode; fullWidth?: boolean }) {
  return (
    <div className={`rounded-xl border border-white/[0.06] bg-[#1a1f2e] p-5 ${fullWidth ? "col-span-2" : ""}`}>
      <h3 className="mb-3 text-sm font-semibold text-slate-300">{title}</h3>
      {children}
    </div>
  );
}

function UploadIllustration() {
  return (
    <svg width="140" height="100" viewBox="0 0 140 100" fill="none">
      <ellipse cx="70" cy="72" rx="28" ry="8" fill="#1a1f2e" stroke="#2d3748" strokeWidth="1.5" />
      <rect x="42" y="52" width="56" height="20" rx="2" fill="#1a1f2e" stroke="#2d3748" strokeWidth="1.5" />
      <ellipse cx="70" cy="52" rx="28" ry="8" fill="#1a1f2e" stroke="#2d3748" strokeWidth="1.5" />
      <rect x="42" y="36" width="56" height="16" rx="2" fill="#1a1f2e" stroke="#2d3748" strokeWidth="1.5" />
      <ellipse cx="70" cy="36" rx="28" ry="8" fill="#4f8ef7" opacity="0.25" stroke="#4f8ef7" strokeWidth="1" strokeOpacity="0.4" />
      <text x="70" y="40" textAnchor="middle" fontSize="10" fill="#4f8ef7" opacity="0.7" fontWeight="bold">₲</text>
      <path d="M105 28V16M101 20l4-4 4 4" stroke="#4f8ef7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
    </svg>
  );
}

export default function CostosPage() {
  const { setCostosData } = useDashboard();
  const { selected, register, reset } = useFilter();
  const [data, setData]               = useState<AnyObj | null>(null);
  const [storedFiles, setStoredFiles] = useState<File[]>([]);
  const [hojas, setHojas]             = useState<string[]>([]);
  const [hojaActiva, setHojaActiva]   = useState<string>("");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [dragging, setDragging]       = useState(false);
  const [activeTab, setActiveTab]     = useState("agencia");
  const inputRef = useRef<HTMLInputElement>(null);

  async function postFiles(files: File[], hoja?: string) {
    setLoading(true);
    setError(null);
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    if (hoja) form.append("hoja", hoja);
    try {
      const res = await fetch(`${API_URL}/api/costos`, {
        method: "POST",
        headers: authHeaders(),
        body: form,
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(detail?.detail ?? `Error ${res.status}`);
      }
      const json = await res.json();
      setData(json);
      setCostosData(json);
      setHojas(json.hojas ?? []);
      setHojaActiva(json.hoja_activa ?? "");
      setActiveTab("agencia");
      register(FILTER_CONFIGS, (json.raw_rows as Row[]) ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  function handleFiles(files: FileList) {
    const arr = Array.from(files);
    setStoredFiles(arr);
    setData(null);
    setHojas([]);
    setHojaActiva("");
    postFiles(arr);
  }

  function handleHojaChange(h: string) {
    if (!storedFiles.length || h === hojaActiva) return;
    postFiles(storedFiles, h);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) handleFiles(e.target.files);
  }

  // ── Sin datos ─────────────────────────────────────────────────────────────
  if (!data && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[72vh] gap-6">
        <UploadIllustration />
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4f8ef7] mb-2">Módulo de Costos</p>
          <h1 className="page-title">Análisis de Costos de Liquidaciones</h1>
          <p className="mt-2 text-sm text-slate-400 max-w-sm">
            Subí uno o más archivos Excel de liquidaciones para analizar sobrecostos, composición de egresos y tendencias por agencia.
          </p>
        </div>
        <div className="w-full max-w-md">
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={[
              "relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 cursor-pointer transition-colors select-none",
              dragging ? "border-[#4f8ef7] bg-[#4f8ef7]/8" : "border-white/[0.08] bg-[#1a1f2e] hover:border-[#4f8ef7]/50 hover:bg-[#1a2240]",
            ].join(" ")}
          >
            <svg className={`w-10 h-10 ${dragging ? "text-[#4f8ef7]" : "text-slate-400"}`} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0-3 3m3-3 3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.338-2.032A4.5 4.5 0 0 1 17.25 19.5H6.75Z" />
            </svg>
            <p className="text-sm text-slate-300 text-center">Arrastrá los archivos Excel aquí o hacé clic para seleccionar</p>
            <p className="text-xs text-slate-500">Formatos: .xlsx .xls</p>
            <input ref={inputRef} type="file" multiple accept=".xlsx,.xls" className="hidden" onChange={handleChange} />
          </div>
          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-700 bg-red-900/30 px-4 py-3 text-sm text-red-300">
              <svg className="mt-0.5 w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Cargando ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[72vh] gap-4">
        <svg className="animate-spin w-8 h-8 text-[#4f8ef7]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm text-slate-400">Procesando liquidaciones…</p>
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  const rawRows: Row[] = (data!.raw_rows as Row[]) ?? [];
  const filteredRows   = applyFilters(rawRows, selected);
  const { kpis, agSob, agCant, agProm, composicion, tipoData, top10motivo, nivCosto, nivComp, sobAno, liqAno } =
    computeFromRows(filteredRows);
  const tabla: AnyObj[] = (data!.tabla as AnyObj[]) ?? [];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4f8ef7] mb-1">Módulo de Costos</p>
          <h1 className="page-title">Costos de Liquidaciones</h1>
        </div>
        <button
          onClick={() => { setData(null); setHojas([]); setHojaActiva(""); setStoredFiles([]); setError(null); reset(); }}
          className="rounded-lg border border-white/[0.08] bg-[#1a1f2e] px-4 py-2 text-sm text-slate-400 transition hover:border-[#4f8ef7]/40 hover:text-[#4f8ef7]"
        >
          Nueva carga
        </button>
      </div>

      {/* Selector de hoja */}
      {hojas.length > 1 && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 mr-1">Hoja:</span>
          {hojas.map((h) => (
            <button
              key={h}
              onClick={() => handleHojaChange(h)}
              className={[
                "rounded-md px-3 py-1 text-xs font-medium transition",
                h === hojaActiva ? "bg-[#4f8ef7] text-white" : "border border-white/[0.08] bg-[#1a1f2e] text-slate-400 hover:border-[#4f8ef7]/40 hover:text-[#4f8ef7]",
              ].join(" ")}
            >
              {h}
            </button>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <KpiCard title="Liquidaciones"   value={kpis.total_liquidaciones} accent />
        <KpiCard title="Sobrecosto"      value={kpis.sobrecosto_fmt} />
        <KpiCard title="Costo Total"     value={kpis.total_costo_fmt} />
        <KpiCard title="Total Bruto"     value={kpis.total_bruto_fmt} />
        <KpiCard title="Neto"            value={kpis.total_neto_fmt} />
        <KpiCard title="Aporte Patronal" value={kpis.aporte_patronal_fmt} />
      </div>

      {/* Tabs */}
      <div className="border-b border-white/[0.08] mb-6">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all",
                activeTab === tab.id
                  ? "border-[#4f8ef7] text-[#4f8ef7]"
                  : "border-transparent text-slate-500 hover:text-slate-300",
              ].join(" ")}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab: Por Agencia ─────────────────────────────────────────────── */}
      {activeTab === "agencia" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {agSob.length > 0 && (
              <ChartCard title="⚠️ Sobrecosto por Agencia (costo de desvinculaciones)">
                <PlotChart
                  data={[{
                    type: "bar", orientation: "h",
                    x: agSob.map((r) => r.SOBRECOSTO),
                    y: agSob.map((r) => r.AGENCIA),
                    marker: {
                      color: agSob.map((r) => r.SOBRECOSTO),
                      colorscale: [[0, "#ffc8c8"], [1, "#c00000"]] as [number, string][],
                      showscale: false,
                    },
                  }]}
                  layout={{ xaxis: { title: { text: "SOBRECOSTO" } }, yaxis: { title: { text: "AGENCIA" } }, margin: { t: 8, r: 16, b: 48, l: 100 } }}
                  height={340}
                />
              </ChartCard>
            )}
            {agCant.length > 0 && (
              <ChartCard title="Cantidad de Liquidaciones por Agencia">
                <PlotChart
                  data={[{
                    type: "bar", orientation: "h",
                    x: agCant.map((r) => r.cantidad),
                    y: agCant.map((r) => r.AGENCIA),
                    marker: { color: agColors(agCant.length) },
                  }]}
                  layout={{ xaxis: { title: { text: "Cantidad" } }, yaxis: { title: { text: "AGENCIA" } }, margin: { t: 8, r: 16, b: 48, l: 100 } }}
                  height={340}
                />
              </ChartCard>
            )}
          </div>

          {agProm.length > 0 && (
            <ChartCard title="⚠️ Sobrecosto Promedio por Liquidación por Agencia">
              <PlotChart
                data={[{
                  type: "bar",
                  x: agProm.map((r) => r.AGENCIA),
                  y: agProm.map((r) => r.prom),
                  marker: { color: agColors(agProm.length) },
                }]}
                layout={{ xaxis: { title: { text: "Agencia" } }, yaxis: { title: { text: "Sobrecosto Promedio" } }, margin: { t: 8, r: 16, b: 60, l: 80 } }}
                height={320}
              />
            </ChartCard>
          )}
        </div>
      )}

      {/* ── Tab: Composición de Costos ────────────────────────────────────── */}
      {activeTab === "composicion" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {composicion && (
            <ChartCard title="Composición Global de Costos">
              <PlotChart
                data={[{ type: "pie", labels: composicion.labels, values: composicion.values, textinfo: "label+percent", textfont: { color: "#cbd5e1" } }]}
                layout={{ margin: { t: 16, r: 16, b: 16, l: 16 } }}
                height={380}
              />
            </ChartCard>
          )}
          {composicion && (
            <ChartCard title="Distribución de Costos (barras)">
              <PlotChart
                data={[{
                  type: "bar", orientation: "h",
                  x: [...composicion.values].sort((a, b) => a - b),
                  y: composicion.labels.slice().sort((a, b) => {
                    const ia = composicion.labels.indexOf(a);
                    const ib = composicion.labels.indexOf(b);
                    return composicion.values[ia] - composicion.values[ib];
                  }),
                  marker: { color: "#4f8ef7" },
                }]}
                layout={{ margin: { t: 8, r: 16, b: 48, l: 150 } }}
                height={380}
              />
            </ChartCard>
          )}
        </div>
      )}

      {/* ── Tab: Por Tipo / Motivo ────────────────────────────────────────── */}
      {activeTab === "tipo" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {tipoData && (
              <ChartCard title="Sobrecosto por Tipo de Salida">
                <PlotChart
                  data={[{ type: "pie", labels: tipoData.labels, values: tipoData.values, hole: 0.4, textinfo: "label+percent", textfont: { color: "#cbd5e1" } }]}
                  layout={{ margin: { t: 16, r: 16, b: 16, l: 16 } }}
                  height={320}
                />
              </ChartCard>
            )}
            {top10motivo.length > 0 && (
              <ChartCard title="Top 10 Motivos por Sobrecosto">
                <PlotChart
                  data={[{
                    type: "bar", orientation: "h",
                    x: top10motivo.map((r) => r.sobrecosto),
                    y: top10motivo.map((r) => r.motivo),
                    marker: { color: "#f59e0b" },
                  }]}
                  layout={{ margin: { t: 8, r: 16, b: 48, l: 200 } }}
                  height={320}
                />
              </ChartCard>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {nivCosto.length > 0 && (
              <ChartCard title="Costo Total por Nivel AIC">
                <PlotChart
                  data={[{ type: "bar", x: nivCosto.map((r) => r.nivel), y: nivCosto.map((r) => r.total_costo), marker: { color: "#8b5cf6" } }]}
                  layout={{ margin: { t: 8, r: 16, b: 48, l: 80 } }}
                  height={300}
                />
              </ChartCard>
            )}
            {nivComp.length > 0 && (
              <ChartCard title="Sobrecosto vs Costo Total por Nivel">
                <PlotChart
                  data={[
                    { type: "bar", name: "Total Costo", x: nivComp.map((r) => r.nivel), y: nivComp.map((r) => r.total_costo), marker: { color: "#4f8ef7" } },
                    { type: "bar", name: "Sobrecosto",  x: nivComp.map((r) => r.nivel), y: nivComp.map((r) => r.sobrecosto),  marker: { color: "#f43f5e" } },
                  ]}
                  layout={{ barmode: "group", margin: { t: 8, r: 16, b: 48, l: 80 } }}
                  height={300}
                />
              </ChartCard>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Tendencia ───────────────────────────────────────────────── */}
      {activeTab === "tendencia" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {sobAno.length > 0 && (
            <ChartCard title="Sobrecosto por Año">
              <PlotChart
                data={[{ type: "bar", x: sobAno.map((r) => r.ano), y: sobAno.map((r) => r.sobrecosto), marker: { color: "#f59e0b" } }]}
                layout={{ xaxis: { title: { text: "Año" } }, yaxis: { title: { text: "Sobrecosto" } }, margin: { t: 8, r: 16, b: 48, l: 80 } }}
                height={360}
              />
            </ChartCard>
          )}
          {liqAno.length > 0 && (
            <ChartCard title="Liquidaciones por Año">
              <PlotChart
                data={[{ type: "scatter", mode: "lines+markers", x: liqAno.map((r) => r.ano), y: liqAno.map((r) => r.liquidaciones), line: { color: "#06b6d4", width: 2 }, marker: { color: "#06b6d4", size: 8 } }]}
                layout={{ xaxis: { title: { text: "Año" } }, yaxis: { title: { text: "Liquidaciones" } }, margin: { t: 8, r: 16, b: 48, l: 80 } }}
                height={360}
              />
            </ChartCard>
          )}
        </div>
      )}

      {/* ── Tab: Detalle ─────────────────────────────────────────────────── */}
      {activeTab === "detalle" && (
        <DataTable rows={tabla} title="Detalle de Liquidaciones" />
      )}
    </div>
  );
}
