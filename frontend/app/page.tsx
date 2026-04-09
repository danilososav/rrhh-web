"use client";

import Link from "next/link";
import { useDashboard } from "@/context/DashboardContext";

const MODULES = [
  {
    href: "/reclutamiento",
    label: "Reclutamiento",
    desc: "Búsquedas, tiempos de cierre y canales de ingreso",
    key: "reclutamiento" as const,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
      </svg>
    ),
  },
  {
    href: "/rotacion",
    label: "Rotación",
    desc: "Tasa anual, motivos de salida y tendencias",
    key: "rotacion" as const,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
      </svg>
    ),
  },
  {
    href: "/costos",
    label: "Costos",
    desc: "Sobrecostos, liquidaciones y composición de egresos",
    key: "costos" as const,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
      </svg>
    ),
  },
  {
    href: "/nomina",
    label: "Nómina",
    desc: "Headcount, géneros, generaciones y brecha salarial",
    key: "nomina" as const,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
      </svg>
    ),
  },
] as const;

export default function HomePage() {
  const { nominaData, rotacionData, costosData, reclutamientoData } = useDashboard();

  function isLoaded(key: "nomina" | "rotacion" | "costos" | "reclutamiento") {
    if (key === "nomina")        return !!nominaData;
    if (key === "rotacion")      return !!rotacionData;
    if (key === "costos")        return !!costosData;
    if (key === "reclutamiento") return !!reclutamientoData;
    return false;
  }

  const totalLoaded = MODULES.filter((m) => isLoaded(m.key)).length;
  const allForResumen = !!nominaData && !!rotacionData && !!costosData;

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-10">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4f8ef7] mb-2">
          Holding Texo — Paraguay
        </p>
        <h1 className="text-3xl font-semibold text-slate-100 leading-tight">
          Portal de Recursos Humanos
        </h1>
        <p className="mt-2 text-slate-400 text-sm max-w-lg">
          Dashboard ejecutivo de HR Analytics. Cargá los archivos Excel de cada módulo
          para generar análisis con inteligencia artificial.
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-8 rounded-xl bg-[#1a1f2e] border border-white/[0.06] px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            Módulos cargados
          </span>
          <span className="text-sm font-bold text-slate-300">
            {totalLoaded} / {MODULES.length}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(totalLoaded / MODULES.length) * 100}%`,
              background: "linear-gradient(90deg, #4f8ef7, #7fb3ff)",
            }}
          />
        </div>
      </div>

      {/* Module cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {MODULES.map(({ href, label, desc, key, icon }) => {
          const loaded = isLoaded(key);
          return (
            <Link
              key={key}
              href={href}
              className={[
                "group relative rounded-xl p-5 border transition-all",
                loaded
                  ? "bg-[#1a1f2e] border-[#4f8ef7]/20 hover:border-[#4f8ef7]/40"
                  : "bg-[#1a1f2e] border-white/[0.06] hover:border-white/[0.12] hover:bg-[#1f2640]",
              ].join(" ")}
            >
              {loaded && (
                <span
                  className="absolute top-0 inset-x-0 h-[2px] rounded-t-xl"
                  style={{ background: "linear-gradient(90deg, #4f8ef7, #7fb3ff)" }}
                />
              )}

              <div className="flex items-start justify-between mb-3">
                <span className={loaded ? "text-[#4f8ef7]" : "text-slate-600"}>
                  {icon}
                </span>
                {loaded ? (
                  <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    Cargado
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-700 group-hover:text-slate-500 transition">
                    Cargar →
                  </span>
                )}
              </div>

              <p className="text-sm font-semibold text-slate-200 mb-1">{label}</p>
              <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
            </Link>
          );
        })}
      </div>

      {/* Resumen ejecutivo CTA */}
      <Link
        href="/resumen-ejecutivo"
        className={[
          "flex items-center justify-between rounded-xl px-5 py-4 border transition-all",
          allForResumen
            ? "bg-[#1a2240] border-[#4f8ef7]/30 hover:border-[#4f8ef7]/50"
            : "bg-[#1a1f2e] border-white/[0.06] opacity-60 cursor-not-allowed pointer-events-none",
        ].join(" ")}
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4f8ef7] mb-0.5">
            {allForResumen ? "Listo para generar" : "Requiere Nómina + Rotación + Costos"}
          </p>
          <p className="text-sm font-semibold text-slate-200">Resumen Ejecutivo con IA</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Narrativas automáticas por empresa del holding
          </p>
        </div>
        <svg className="w-5 h-5 text-[#4f8ef7] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"
          />
        </svg>
      </Link>
    </div>
  );
}
