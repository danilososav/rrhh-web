interface KpiCardProps {
  title: string;
  value: string | number | null | undefined;
  subtitle?: string;
  /** Highlight this card with the accent colour */
  accent?: boolean;
  /** Optional SVG icon node */
  icon?: React.ReactNode;
}

export default function KpiCard({ title, value, subtitle, accent, icon }: KpiCardProps) {
  return (
    <div
      className={[
        "relative rounded-xl px-5 py-4 overflow-hidden",
        accent
          ? "bg-[#1a2240] border border-[#4f8ef7]/25"
          : "bg-[#1a1f2e] border border-white/[0.06]",
      ].join(" ")}
    >
      {/* Top accent line */}
      {accent && (
        <span
          className="absolute inset-x-0 top-0 h-[2px] rounded-t-xl"
          style={{ background: "linear-gradient(90deg, #4f8ef7 0%, #7fb3ff 100%)" }}
        />
      )}

      <div className="flex items-start justify-between gap-2">
        <p
          className="text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: "#64748b" }}
        >
          {title}
        </p>
        {icon && (
          <span className="text-slate-600 mt-0.5 shrink-0">{icon}</span>
        )}
      </div>

      <p
        className="mt-2 text-3xl font-bold tracking-tight leading-none"
        style={{ color: accent ? "#93c5fd" : "#f1f5f9" }}
      >
        {value ?? "—"}
      </p>

      {subtitle && (
        <p className="mt-1.5 text-[11px]" style={{ color: "#475569" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
