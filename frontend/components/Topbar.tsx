"use client";

import { useState, useEffect } from "react";

interface TopbarProps {
  moduleLabel: string;
  pageTitle: string;
  onRefresh?: () => void;
}

export default function Topbar({ moduleLabel, pageTitle, onRefresh }: TopbarProps) {
  const [presenting, setPresenting] = useState(false);

  // Forzar siempre modo claro
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("light");
    html.classList.remove("dark");
    localStorage.removeItem("rrhh-theme");
  }, []);

  // Manejar modo presentación
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && presenting) {
        setPresenting(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [presenting]);

  useEffect(() => {
    const html = document.documentElement;
    if (presenting) {
      html.classList.add("presentation-mode");
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      html.classList.remove("presentation-mode");
      document.exitFullscreen?.().catch(() => {});
    }
  }, [presenting]);

  const togglePresentation = () => {
    setPresenting((p) => !p);
  };

  return (
    <header
      className="fixed top-0 right-0 left-[270px] h-[60px] z-30 transition-all"
      style={{
        background: "var(--bg2)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="h-full flex items-center justify-between px-7">
        {/* Left: Module info */}
        <div className="flex flex-col gap-0.5">
          <span
            className="text-[10px] font-bold tracking-[0.2em] uppercase"
            style={{ color: "var(--accent)" }}
          >
            {moduleLabel}
          </span>
          <h1
            className="page-title"
            style={{ fontSize: presenting ? "28px" : "22px", transition: "font-size 0.3s" }}
          >
            {pageTitle}
          </h1>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {/* Presentación button */}
          <button
            onClick={togglePresentation}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: presenting ? "rgba(124,90,246,0.15)" : "var(--card2)",
              border: presenting ? "1px solid var(--accent)" : "1px solid var(--border)",
              color: presenting ? "var(--accent)" : "var(--text2)",
            }}
            onMouseEnter={(e) => {
              if (!presenting) {
                e.currentTarget.style.borderColor = "var(--accent)";
                e.currentTarget.style.color = "var(--text)";
              }
            }}
            onMouseLeave={(e) => {
              if (!presenting) {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.color = "var(--text2)";
              }
            }}
          >
            {presenting ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Salir
              </>
            ) : (
              <>
                <span>📺</span>
                Presentación
              </>
            )}
          </button>

          {/* Actualizar datos button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: "var(--accent)",
                color: "#fff",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "0.85";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
            >
              Actualizar datos
            </button>
          )}

        </div>
      </div>
    </header>
  );
}
