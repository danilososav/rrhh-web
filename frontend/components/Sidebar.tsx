"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { clearToken } from "@/lib/auth";
import { useFilter } from "@/context/FilterContext";
import { uniqueValues } from "@/lib/filterUtils";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Inicio",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
        />
      </svg>
    ),
  },
  {
    href: "/reclutamiento",
    label: "Reclutamiento",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
        />
      </svg>
    ),
  },
  {
    href: "/rotacion",
    label: "Rotación",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
        />
      </svg>
    ),
  },
  {
    href: "/costos",
    label: "Costos",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z"
        />
      </svg>
    ),
  },
  {
    href: "/nomina",
    label: "Nómina",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
        />
      </svg>
    ),
  },
  {
    href: "/resumen-ejecutivo",
    label: "Resumen Ejecutivo",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605"
        />
      </svg>
    ),
  },
];

function FilterGroups() {
  const { configs, rows, selected, onChange } = useFilter();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  if (!configs.length || !rows.length) return null;

  const hasAny = Object.values(selected).some((v) => v.length > 0);

  return (
    <div className="mt-2 border-t border-white/[0.06] pt-3 px-2.5">
      {/* Header filtros */}
      <div className="flex items-center justify-between mb-2.5 px-1">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Filtros
        </span>
        {hasAny && (
          <button
            onClick={() => configs.forEach((c) => onChange(c.field, []))}
            className="text-[10px] text-slate-600 hover:text-[#4f8ef7] transition"
          >
            Limpiar todo
          </button>
        )}
      </div>

      <div className="space-y-2.5">
        {configs.map((cfg) => {
          const opts = uniqueValues(rows, cfg.field);
          const sel  = selected[cfg.field] ?? [];
          const open = !collapsed[cfg.field];

          function toggle(val: string) {
            onChange(cfg.field, sel.includes(val) ? sel.filter((v) => v !== val) : [...sel, val]);
          }

          return (
            <div key={cfg.field}>
              {/* Group header */}
              <div className="flex items-center justify-between mb-1 px-1">
                <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                  {cfg.label}
                </span>
                <div className="flex items-center gap-1">
                  {sel.length > 0 && (
                    <button
                      onClick={() => onChange(cfg.field, [])}
                      className="text-slate-600 hover:text-slate-400 transition"
                    >
                      <svg viewBox="0 0 12 12" fill="currentColor" className="w-2.5 h-2.5">
                        <path d="M2.293 2.293a1 1 0 0 1 1.414 0L6 4.586l2.293-2.293a1 1 0 1 1 1.414 1.414L7.414 6l2.293 2.293a1 1 0 0 1-1.414 1.414L6 7.414l-2.293 2.293a1 1 0 0 1-1.414-1.414L4.586 6 2.293 3.707a1 1 0 0 1 0-1.414Z" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => setCollapsed((p) => ({ ...p, [cfg.field]: open }))}
                    className="text-slate-600 hover:text-slate-400 transition"
                  >
                    <svg
                      viewBox="0 0 12 12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      className={`w-2.5 h-2.5 transition-transform ${open ? "" : "-rotate-90"}`}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2 4l4 4 4-4" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Chips */}
              {open && (
                <div className="flex flex-wrap gap-1 px-1">
                  {opts.map((opt) => {
                    const active = sel.includes(opt);
                    return (
                      <button
                        key={opt}
                        onClick={() => toggle(opt)}
                        className={[
                          "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium transition-all leading-tight",
                          active
                            ? "bg-[#4f8ef7]/15 text-[#4f8ef7] border border-[#4f8ef7]/35"
                            : "bg-white/[0.03] text-slate-500 border border-white/[0.07] hover:text-slate-300 hover:border-white/[0.15]",
                        ].join(" ")}
                      >
                        <span className="max-w-[120px] truncate">{opt}</span>
                        {active && (
                          <svg viewBox="0 0 10 10" fill="currentColor" className="w-2 h-2 shrink-0 opacity-70">
                            <path d="M1.707 1.707a1 1 0 0 1 1.414 0L5 3.586l1.879-1.879a1 1 0 1 1 1.414 1.414L6.414 5l1.879 1.879a1 1 0 0 1-1.414 1.414L5 6.414 3.121 8.293a1 1 0 0 1-1.414-1.414L3.586 5 1.707 3.121a1 1 0 0 1 0-1.414Z" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const [imgError, setImgError] = useState(false);

  function handleLogout() {
    clearToken();
    router.push("/login");
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-72 flex flex-col bg-[#0d1117] border-r border-white/[0.06] z-40">
      {/* Logo */}
      <div className="flex items-center justify-center px-4 py-5 border-b border-white/[0.06]">
        {!imgError ? (
          <Image
            src="/logo.jpg"
            alt="Texo"
            width={220}
            height={60}
            style={{ width: "100%", height: "auto", maxWidth: 220 }}
            priority
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="text-lg font-bold tracking-widest text-slate-200 uppercase">Texo</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="px-2.5 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={[
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-[#4f8ef7]/12 text-[#4f8ef7] border border-[#4f8ef7]/20"
                  : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-200 border border-transparent",
              ].join(" ")}
            >
              <span className={active ? "text-[#4f8ef7]" : "text-slate-600"}>{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Filters (contextual, scrollable) */}
      <div className="flex-1 overflow-y-auto">
        <FilterGroups />
      </div>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-white/[0.06] space-y-2">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-red-400 hover:bg-red-900/10 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
            />
          </svg>
          Cerrar sesión
        </button>
        <p className="text-[10px] uppercase tracking-widest text-slate-700 text-center">
          Portal RRHH &copy; {new Date().getFullYear()}
        </p>
      </div>
    </aside>
  );
}
