"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

const SIDEBAR_W = 270;

interface LayoutShellProps {
  children: React.ReactNode;
  moduleLabel?: string;
  pageTitle?: string;
  onRefresh?: () => void;
}

export default function LayoutShell({ children, moduleLabel, pageTitle, onRefresh }: LayoutShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const isLogin = pathname === "/login";
  const isHome  = pathname === "/";
  const showTopbar = moduleLabel && pageTitle && !isLogin && !isHome;

  if (isLogin) return <>{children}</>;

  return (
    <>
      <Sidebar open={sidebarOpen} />

      {/* Toggle button — floats at the right edge of the sidebar */}
      <button
        onClick={() => setSidebarOpen((p) => !p)}
        title={sidebarOpen ? "Ocultar menú" : "Mostrar menú"}
        style={{
          position: "fixed",
          top: 22,
          left: sidebarOpen ? SIDEBAR_W - 14 : 8,
          transition: "left 0.25s ease",
          zIndex: 50,
          width: 28,
          height: 28,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg2)",
          border: "1px solid var(--border)",
          color: "var(--text3)",
          cursor: "pointer",
          boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = "var(--accent)";
          e.currentTarget.style.color = "var(--accent)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = "var(--border)";
          e.currentTarget.style.color = "var(--text3)";
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          style={{
            width: 14,
            height: 14,
            transform: sidebarOpen ? "rotate(0deg)" : "rotate(180deg)",
            transition: "transform 0.25s ease",
          }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
      </button>

      {showTopbar && <Topbar moduleLabel={moduleLabel} pageTitle={pageTitle} onRefresh={onRefresh} />}

      <main
        className="min-h-screen"
        style={{
          marginLeft: sidebarOpen ? SIDEBAR_W : 0,
          transition: "margin-left 0.25s ease",
          paddingTop: showTopbar ? 80 : 24,
          padding: showTopbar ? "80px 28px 24px" : "24px 28px",
        }}
      >
        {children}
      </main>
    </>
  );
}
