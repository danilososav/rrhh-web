"use client";

import { createContext, useContext, useState, ReactNode } from "react";

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
  const [nominaData, setNominaData] = useState<Record<string, unknown> | null>(null);
  const [rotacionData, setRotacionData] = useState<Record<string, unknown> | null>(null);
  const [costosData, setCostosData] = useState<Record<string, unknown> | null>(null);
  const [reclutamientoData, setReclutamientoData] = useState<Record<string, unknown> | null>(null);

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
