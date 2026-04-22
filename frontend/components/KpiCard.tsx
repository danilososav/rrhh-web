"use client";

import { useEffect, useRef, useState } from "react";

interface KpiCardProps {
  title: string;
  value: string | number | null | undefined;
  subtitle?: string;
  accent?: boolean;
  accentColor?: string;
  icon?: React.ReactNode;
}

function parseValue(raw: string | number): { prefix: string; num: number; suffix: string } | null {
  const str = String(raw).trim();
  const match = str.match(/^([^\d-]*)(-?[\d,.]+)(.*)$/);
  if (!match) return null;
  const num = parseFloat(match[2].replace(/,/g, "").replace(/\./g, (_, i, s) => i === s.lastIndexOf(".") ? "." : ""));
  if (isNaN(num)) return null;
  return { prefix: match[1], num, suffix: match[3] };
}

function formatNum(n: number, original: string): string {
  const decMatch = /[\d,.]+/.exec(original.trim())?.[0] ?? "";
  const hasDec = decMatch.includes(".");
  if (hasDec) {
    const decimals = (decMatch.split(".")[1] ?? "").length;
    return n.toFixed(decimals);
  }
  return Math.round(n).toLocaleString("es-PY");
}

export default function KpiCard({ title, value, subtitle, accent, accentColor, icon }: KpiCardProps) {
  const color = accentColor ?? (accent ? "var(--accent)" : undefined);
  const raw = value ?? "—";
  const parsed = typeof raw === "string" || typeof raw === "number" ? parseValue(raw) : null;

  const [display, setDisplay] = useState<string>(
    parsed ? `${parsed.prefix}0${parsed.suffix}` : String(raw)
  );
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!parsed || raw === "—") { setDisplay(String(raw)); return; }
    const start = performance.now();
    const duration = 900;
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplay(`${parsed!.prefix}${formatNum(parsed!.num * ease, String(raw))}${parsed!.suffix}`);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div
      className="flex flex-col gap-2 p-5 rounded-xl transition-all duration-200 cursor-default"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = color ?? "var(--accent)";
        el.style.transform = "translateY(-2px)";
        el.style.boxShadow = "0 8px 24px rgba(0,0,0,0.2)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = "var(--border)";
        el.style.transform = "translateY(0)";
        el.style.boxShadow = "none";
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="label-xs">{title}</span>
        {icon && <span style={{ color: "var(--text3)" }} className="mt-0.5 shrink-0">{icon}</span>}
      </div>

      <span
        className="kpi-value"
        style={{ color: color ?? "var(--text)" }}
      >
        {display}
      </span>

      {subtitle && (
        <span style={{ fontSize: 12, color: "var(--text2)" }}>{subtitle}</span>
      )}
    </div>
  );
}
