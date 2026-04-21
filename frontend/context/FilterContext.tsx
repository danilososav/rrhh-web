"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { FilterConfig, Row } from "@/lib/filterUtils";

interface FilterContextValue {
  configs: FilterConfig[];
  rows: Row[];
  selected: Record<string, string[]>;
  onChange: (field: string, values: string[]) => void;
  register: (configs: FilterConfig[], rows: Row[]) => void;
  reset: () => void;
}

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [configs, setConfigs] = useState<FilterConfig[]>([]);
  const [rows, setRows]       = useState<Row[]>([]);
  const [selected, setSelected] = useState<Record<string, string[]>>({});

  const register = useCallback((newConfigs: FilterConfig[], newRows: Row[]) => {
    setConfigs(newConfigs);
    setRows(newRows);
    setSelected({});
  }, []);

  const reset = useCallback(() => {
    setConfigs([]);
    setRows([]);
    setSelected({});
  }, []);

  const onChange = useCallback((field: string, values: string[]) => {
    setSelected((prev) => ({ ...prev, [field]: values }));
  }, []);

  return (
    <FilterContext.Provider value={{ configs, rows, selected, onChange, register, reset }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter(): FilterContextValue {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilter must be used inside FilterProvider");
  return ctx;
}
