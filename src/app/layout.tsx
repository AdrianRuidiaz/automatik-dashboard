import type { Metadata, Viewport } from "next";
import { RoleProvider } from "@/lib/role-context";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "automatik.io — Gestión de pedidos",
  description: "Panel de gestión de pedidos para marketplaces",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Automatik",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  // Antes quedaba en "#fafaf8" (heredado de la plantilla de Next, tema
  // claro) mientras la app entera usa un fondo oscuro -- se notaba como una
  // franja blanca en la barra de estado/direcciones en mobile y como fondo
  // de splash screen al abrir la PWA instalada. Ahora coincide con
  // --background (hsl(230 15% 7%)).
  themeColor: "#0f1015",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300..700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <PwaRegister />
        <RoleProvider>{children}</RoleProvider>
      </body>
    </html>
  );
}
