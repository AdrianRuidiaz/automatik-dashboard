import type { Metadata, Viewport } from "next";
import { RoleProvider } from "@/lib/role-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "automatik.io \u2014 Gesti\u00f3n de pedidos",
  description: "Panel de gesti\u00f3n de pedidos para marketplaces",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#fafaf8",
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
        <RoleProvider>{children}</RoleProvider>
      </body>
    </html>
  );
}
