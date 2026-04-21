"use client";

import { createContext, useContext, useState, ReactNode } from "react";

const STORAGE_KEYS = {
  nomina: "rrhh_nomina",
  rotacion: "rrhh_rotacion",
  costos: "rrhh_costos",
  reclutamiento: "rrhh_reclutamiento",
} as const;

function loadFromStorage<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const item = localStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : null;
  } catch {
    return null;
  }
}

function saveToStorage(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

interface DashboardContextValue {
  nominaData: Record<string, unknown> | null;
  rotacionData: Record<string, unknown> | null;
  costosData: Record<string, unknown> | null;
  reclutamientoData: Record<string, unknown> | null;
  setNominaData: (data: Record<string, unknown>) => void;
  setRotacionData: (data: Record<string, unknown>) => void;
  setCostosData: (data: Record<string, unknown>) => void;
  setReclutamientoData: (data: Record<string, unknown>) => void;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [nominaData, setNominaDataState] = useState<Record<string, unknown> | null>(
    () => loadFromStorage(STORAGE_KEYS.nomina)
  );
  const [rotacionData, setRotacionDataState] = useState<Record<string, unknown> | null>(
    () => loadFromStorage(STORAGE_KEYS.rotacion)
  );
  const [costosData, setCostosDataState] = useState<Record<string, unknown> | null>(
    () => loadFromStorage(STORAGE_KEYS.costos)
  );
  const [reclutamientoData, setReclutamientoDataState] = useState<Record<string, unknown> | null>(
    () => loadFromStorage(STORAGE_KEYS.reclutamiento)
  );

  function setNominaData(data: Record<string, unknown>) {
    setNominaDataState(data);
    saveToStorage(STORAGE_KEYS.nomina, data);
  }

  function setRotacionData(data: Record<string, unknown>) {
    setRotacionDataState(data);
    saveToStorage(STORAGE_KEYS.rotacion, data);
  }

  function setCostosData(data: Record<string, unknown>) {
    setCostosDataState(data);
    saveToStorage(STORAGE_KEYS.costos, data);
  }

  function setReclutamientoData(data: Record<string, unknown>) {
    setReclutamientoDataState(data);
    saveToStorage(STORAGE_KEYS.reclutamiento, data);
  }

  return (
    <DashboardContext.Provider
      value={{
        nominaData,
        rotacionData,
        costosData,
        reclutamientoData,
        setNominaData,
        setRotacionData,
        setCostosData,
        setReclutamientoData,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used inside DashboardProvider");
  return ctx;
}
