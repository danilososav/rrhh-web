"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

interface LayoutShellProps {
  children: React.ReactNode;
  moduleLabel?: string;
  pageTitle?: string;
  onRefresh?: () => void;
}

export default function LayoutShell({ children, moduleLabel, pageTitle, onRefresh }: LayoutShellProps) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";
  const isHome = pathname === "/";
  const showTopbar = moduleLabel && pageTitle && !isLogin && !isHome;

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <>
      <Sidebar />
      {showTopbar && <Topbar moduleLabel={moduleLabel} pageTitle={pageTitle} onRefresh={onRefresh} />}
      <main
        className="min-h-screen"
        style={{
          marginLeft: 270,
          paddingTop: showTopbar ? 60 : 24,
          padding: showTopbar ? "80px 28px 24px" : "24px 28px",
        }}
      >
        {children}
      </main>
    </>
  );
}
