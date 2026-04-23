import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import LayoutShell from "@/components/LayoutShell";
import { DashboardProvider } from "@/context/DashboardContext";
import { FilterProvider } from "@/context/FilterContext";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Portal RRHH — Texo",
  description: "Dashboard de HR Analytics para el holding Texo",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${dmSans.className} antialiased`} style={{ background: "var(--bg)", color: "var(--text)" }} suppressHydrationWarning>
        <DashboardProvider>
          <FilterProvider>
            <LayoutShell>{children}</LayoutShell>
          </FilterProvider>
        </DashboardProvider>
      </body>
    </html>
  );
}
