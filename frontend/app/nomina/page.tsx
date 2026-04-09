"use client";

import { useState } from "react";
import FileUpload from "@/components/FileUpload";
import KpiCard from "@/components/KpiCard";
import PlotChart from "@/components/PlotChart";
import DataTable from "@/components/DataTable";
import { useDashboard } from "@/context/DashboardContext";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>;

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("es-PY", { maximumFractionDigits: 0 });
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
  const { setNominaData } = useDashboard();
  const [data, setData] = useState<AnyObj | null>(null);

  function handleResult(result: AnyObj) {
    setData(result);
    setNominaData(result);
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[72vh] gap-6">
        <UploadIllustration />
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4f8ef7] mb-2">
            Módulo de Nómina
          </p>
          <h1 className="page-title">Análisis de Colaboradores</h1>
          <p className="mt-2 text-sm text-slate-400 max-w-sm">
            Subí el Excel de nómina para analizar headcount, géneros,
            generaciones y brecha salarial por empresa.
          </p>
        </div>
        <div className="w-full max-w-md">
          <FileUpload endpoint="/api/nomina" fieldName="file" multiple={false} onResult={handleResult} />
        </div>
      </div>
    );
  }

  const kpis: AnyObj      = (data.kpis            as AnyObj) ?? {};
  const genero: AnyObj    = (data.genero           as AnyObj) ?? {};
  const liderazgo: AnyObj = (data.liderazgo        as AnyObj) ?? {};
  const nac: AnyObj       = (data.nacionalidad     as AnyObj) ?? {};
  const gens: AnyObj      = (data.generaciones     as AnyObj) ?? {};
  const brecha: AnyObj    = (data.brecha_salarial  as AnyObj) ?? {};
  const tabla: AnyObj[]   = (data.tabla            as AnyObj[]) ?? [];

  const gpeRows: AnyObj[]     = genero.por_empresa ?? [];
  const lidEmp: AnyObj[]      = liderazgo.pct_por_empresa ?? [];
  const salEmp: AnyObj[]      = brecha.por_empresa ?? [];
  const brechaNivel: AnyObj[] = brecha.por_nivel_sexo ?? [];
  const genDist: AnyObj[]     = gens.distribucion ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-7">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4f8ef7] mb-1">
            Módulo de Nómina
          </p>
          <h1 className="page-title">Análisis de Colaboradores</h1>
        </div>
        <button
          onClick={() => setData(null)}
          className="rounded-lg border border-white/[0.08] bg-[#1a1f2e] px-4 py-2 text-sm text-slate-400 transition hover:border-[#4f8ef7]/40 hover:text-[#4f8ef7]"
        >
          Nueva carga
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <KpiCard title="Colaboradores" value={fmt(kpis.total)} accent />
        <KpiCard title="Empresas" value={fmt(kpis.empresas)} />
        <KpiCard
          title="Líderes"
          value={kpis.lider_pct != null ? `${kpis.lider_pct}%` : "—"}
          subtitle={`${fmt(kpis.lideres)} personas`}
        />
        <KpiCard title="Mujeres" value={kpis.pct_mujeres != null ? `${kpis.pct_mujeres}%` : "—"} />
        <KpiCard title="Extranjeros" value={kpis.pct_extranjeros != null ? `${kpis.pct_extranjeros}%` : "—"} />
        <KpiCard
          title="Salario Prom."
          value={kpis.salario_promedio != null ? `₲ ${fmt(kpis.salario_promedio)}` : "—"}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {genero.labels && (
          <ChartCard title="Distribución por Género">
            <PlotChart
              data={[{ type: "pie", labels: genero.labels, values: genero.values, hole: 0.45, textinfo: "label+percent", textfont: { color: "#cbd5e1" } }]}
              layout={{ margin: { t: 16, r: 16, b: 16, l: 16 } }}
              height={280}
            />
          </ChartCard>
        )}

        {gpeRows.length > 0 && (
          <ChartCard title="Género por Empresa">
            <PlotChart
              data={[
                { type: "bar", name: "Mujeres", x: gpeRows.map((r) => r.EMPRESA), y: gpeRows.map((r) => Number(r.Mujeres ?? 0)), marker: { color: "#8b5cf6" } },
                { type: "bar", name: "Hombres",  x: gpeRows.map((r) => r.EMPRESA), y: gpeRows.map((r) => Number(r.Hombres  ?? 0)), marker: { color: "#4f8ef7" } },
              ]}
              layout={{ barmode: "group" }}
              height={280}
            />
          </ChartCard>
        )}

        {nac.resumen && (
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
              data={[{ type: "bar", x: genDist.map((r) => r.Generacion), y: genDist.map((r) => Number(r.Cantidad ?? 0)), marker: { color: "#06b6d4" } }]}
              height={280}
            />
          </ChartCard>
        )}

        {liderazgo.por_sexo && (
          <ChartCard title="Líderes por Género">
            <PlotChart
              data={[{ type: "pie", labels: liderazgo.por_sexo.labels, values: liderazgo.por_sexo.values, hole: 0.45, textinfo: "label+percent", textfont: { color: "#cbd5e1" } }]}
              layout={{ margin: { t: 16, r: 16, b: 16, l: 16 } }}
              height={280}
            />
          </ChartCard>
        )}

        {lidEmp.length > 0 && (
          <ChartCard title="% Líderes por Empresa">
            <PlotChart
              data={[{ type: "bar", x: lidEmp.map((r) => r.EMPRESA), y: lidEmp.map((r) => Number(r.pct_lideres ?? 0)), marker: { color: "#f59e0b" } }]}
              layout={{ yaxis: { ticksuffix: "%" } }}
              height={280}
            />
          </ChartCard>
        )}

        {salEmp.length > 0 && (
          <ChartCard title="Salario Promedio por Empresa">
            <PlotChart
              data={[{ type: "bar", x: salEmp.map((r) => r.empresa), y: salEmp.map((r) => Number(r.promedio ?? 0)), marker: { color: "#10b981" } }]}
              height={280}
            />
          </ChartCard>
        )}

        {brechaNivel.length > 0 && (
          <ChartCard title="Brecha Salarial por Nivel">
            <PlotChart
              data={[
                { type: "bar", name: "Mujeres", x: brechaNivel.map((r) => r.nivel), y: brechaNivel.map((r) => Number(r.prom_mujeres ?? 0)), marker: { color: "#8b5cf6" } },
                { type: "bar", name: "Hombres",  x: brechaNivel.map((r) => r.nivel), y: brechaNivel.map((r) => Number(r.prom_hombres ?? 0)), marker: { color: "#4f8ef7" } },
              ]}
              layout={{ barmode: "group" }}
              height={280}
            />
          </ChartCard>
        )}
      </div>

      <DataTable rows={tabla} title="Detalle de Nómina" />
    </div>
  );
}
