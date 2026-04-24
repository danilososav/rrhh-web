"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const STORAGE_KEYS = {
  nomina: "rrhh_nomina",
  rotacion: "rrhh_rotacion",
  costos: "rrhh_costos",
  reclutamiento: "rrhh_reclutamiento",
} as const;

type Module = keyof typeof STORAGE_KEYS;

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

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("rrhh_token");
}

async function fetchFromCache(module: Module): Promise<Record<string, unknown> | null> {
  const token = getAuthToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_URL}/api/cache/${module}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      console.error(`[cache] GET ${module} → ${res.status}`);
      return null;
    }
    const { data } = await res.json();
    return data ?? null;
  } catch (err) {
    console.error(`[cache] GET ${module} error:`, err);
    return null;
  }
}

function pushToCache(module: Module, data: Record<string, unknown>): void {
  const token = getAuthToken();
  if (!token) return;
  fetch(`${API_URL}/api/cache/${module}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data }),
  })
    .then((res) => {
      if (!res.ok) console.error(`[cache] PUT ${module} → ${res.status}`);
    })
    .catch((err) => console.error(`[cache] PUT ${module} error:`, err));
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
  const [nominaData, setNominaDataState] = useState<Record<string, unknown> | null>(null);
  const [rotacionData, setRotacionDataState] = useState<Record<string, unknown> | null>(null);
  const [costosData, setCostosDataState] = useState<Record<string, unknown> | null>(null);
  const [reclutamientoData, setReclutamientoDataState] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    async function hydrate() {
      const [nomina, rotacion, costos, reclutamiento] = await Promise.all([
        fetchFromCache("nomina"),
        fetchFromCache("rotacion"),
        fetchFromCache("costos"),
        fetchFromCache("reclutamiento"),
      ]);
      setNominaDataState(nomina ?? loadFromStorage(STORAGE_KEYS.nomina));
      setRotacionDataState(rotacion ?? loadFromStorage(STORAGE_KEYS.rotacion));
      setCostosDataState(costos ?? loadFromStorage(STORAGE_KEYS.costos));
      setReclutamientoDataState(reclutamiento ?? loadFromStorage(STORAGE_KEYS.reclutamiento));
    }
    hydrate();
  }, []);

  function setNominaData(data: Record<string, unknown>) {
    setNominaDataState(data);
    saveToStorage(STORAGE_KEYS.nomina, data);
    pushToCache("nomina", data);
  }

  function setRotacionData(data: Record<string, unknown>) {
    setRotacionDataState(data);
    saveToStorage(STORAGE_KEYS.rotacion, data);
    pushToCache("rotacion", data);
  }

  function setCostosData(data: Record<string, unknown>) {
    setCostosDataState(data);
    saveToStorage(STORAGE_KEYS.costos, data);
    pushToCache("costos", data);
  }

  function setReclutamientoData(data: Record<string, unknown>) {
    setReclutamientoDataState(data);
    saveToStorage(STORAGE_KEYS.reclutamiento, data);
    pushToCache("reclutamiento", data);
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
