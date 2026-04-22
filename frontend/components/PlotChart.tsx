"use client";

import dynamic from "next/dynamic";
import type { PlotParams } from "react-plotly.js";

const Plot = dynamic<PlotParams>(
  () => import("react-plotly.js").then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 animate-pulse rounded-lg" style={{ background: "var(--card2)" }} />
    ),
  }
);

/* Palette matches handoff design system */
const COLOR_SEQ = [
  "#7c5af6", "#10b981", "#06b6d4", "#f59e0b",
  "#d946ef", "#818cf8", "#ef4444", "#fb923c",
  "#84cc16", "#14b8a6",
];

export { COLOR_SEQ };

const DARK_BASE: Partial<Plotly.Layout> = {
  paper_bgcolor: "rgba(0,0,0,0)",
  plot_bgcolor:  "rgba(0,0,0,0)",
  font:   { color: "#6b7a99", size: 12, family: "DM Sans, system-ui, sans-serif" },
  legend: { bgcolor: "rgba(0,0,0,0)", font: { color: "#6b7a99", size: 11 } },
  colorway: COLOR_SEQ,
};

const DARK_AXIS: Partial<Plotly.LayoutAxis> = {
  gridcolor:     "#1e2e47",
  linecolor:     "#1e2e47",
  tickfont:      { color: "#6b7a99", size: 11 },
  zerolinecolor: "#1e2e47",
};

interface PlotChartProps extends Omit<PlotParams, "layout"> {
  layout?: Partial<Plotly.Layout>;
  height?: number;
}

export default function PlotChart({ data, layout, height = 300, ...rest }: PlotChartProps) {
  const merged: Partial<Plotly.Layout> = {
    ...DARK_BASE,
    height,
    margin: { t: 24, r: 16, b: 48, l: 64 },
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
