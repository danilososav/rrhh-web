import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
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
          {/* Sidebar fijo a la izquierda */}
          <Sidebar />

          {/* Contenido principal con margen izquierdo = ancho del sidebar */}
          <main className="ml-56 min-h-screen p-8">
            {children}
          </main>
        </DashboardProvider>
      </body>
    </html>
  );
}
