import type { Metadata } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import { RoleProvider } from "@/lib/role-context";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "automatik.io — Gestion de pedidos",
  description: "Panel de gestion de pedidos para marketplaces",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#fafaf8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${serif.variable}`}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <RoleProvider>{children}</RoleProvider>
      </body>
    </html>
  );
}
