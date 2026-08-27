import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import { RoleProvider } from "@/lib/role-context";
import { PwaRegister } from "@/components/pwa-register";
import { TEMA_INLINE_SCRIPT } from "@/lib/theme";
import "./globals.css";

// next/font/google descarga y self-hostea las fuentes en build time (en vez
// de pedirlas a fonts.googleapis.com en cada visita): elimina la solicitud
// externa render-blocking que antes hacian los <link rel="stylesheet"> en
// <head> (mas los dos <link rel="preconnect">) y evita el parpadeo de
// fuente (FOUT/FOIT), porque Next inyecta el @font-face con los archivos ya
// servidos desde el mismo origen. Los nombres de variable
// (--font-inter / --font-instrument-serif) se consumen desde --font-sans y
// --font-serif en globals.css, asi que el resto del codigo (Tailwind
// fontFamily.sans/serif, la clase .display, etc.) no cambia.
const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

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
    <html lang="es" className={`${inter.variable} ${instrumentSerif.variable}`}>
      <head>
        {/* Aplica la clase .light (si el usuario la eligio en Configuracion
            > Apariencia) antes del primer paint -- ver src/lib/theme.ts */}
        <script dangerouslySetInnerHTML={{ __html: TEMA_INLINE_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <PwaRegister />
        <RoleProvider>{children}</RoleProvider>
      </body>
    </html>
  );
}
