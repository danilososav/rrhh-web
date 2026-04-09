"use client";

import dynamic from "next/dynamic";
import type { PlotParams } from "react-plotly.js";

const Plot = dynamic<PlotParams>(
  () => import("react-plotly.js").then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 animate-pulse rounded-lg bg-slate-800" />
    ),
  }
);

const COLOR_SEQ = [
  "#6366f1", "#8b5cf6", "#06b6d4", "#f59e0b",
  "#10b981", "#f43f5e", "#84cc16", "#fb923c",
];

const DARK_BASE: Partial<Plotly.Layout> = {
  paper_bgcolor: "rgba(0,0,0,0)",
  plot_bgcolor: "rgba(0,0,0,0)",
  font: { color: "#cbd5e1", size: 12 },
  legend: { bgcolor: "rgba(0,0,0,0)", font: { color: "#94a3b8" } },
  colorway: COLOR_SEQ,
};

const DARK_AXIS: Partial<Plotly.LayoutAxis> = {
  gridcolor: "#334155",
  linecolor: "#475569",
  tickfont: { color: "#94a3b8" },
  zerolinecolor: "#334155",
};

interface PlotChartProps extends Omit<PlotParams, "layout"> {
  layout?: Partial<Plotly.Layout>;
  height?: number;
}

export default function PlotChart({ data, layout, height = 320, ...rest }: PlotChartProps) {
  const merged: Partial<Plotly.Layout> = {
    ...DARK_BASE,
    height,
    margin: { t: 36, r: 16, b: 56, l: 70 },
    ...layout,
    xaxis: { ...DARK_AXIS, ...(layout?.xaxis as object) },
    yaxis: { ...DARK_AXIS, ...(layout?.yaxis as object) },
  };

  return (
    <Plot
      data={data}
      layout={merged}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: "100%" }}
      {...rest}
    />
  );
}
