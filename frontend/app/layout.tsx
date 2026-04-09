import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import LayoutShell from "@/components/LayoutShell";
import { DashboardProvider } from "@/context/DashboardContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
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
    <html lang="es" className={inter.variable}>
      <body className="bg-[#0f1117] text-slate-200 antialiased">
        <DashboardProvider>
          <LayoutShell>{children}</LayoutShell>
        </DashboardProvider>
      </body>
    </html>
  );
}
