import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Inter, Instrument_Serif } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { RoleProvider } from "@/lib/role-context";
import { PwaRegister } from "@/components/pwa-register";
import { PdfViewerProvider } from "@/lib/pdf-viewer-context";
import { TEMA_INLINE_SCRIPT } from "@/lib/theme";
import { getPerfilServidor } from "@/lib/auth-server";
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

// Tarea (Speed Insights móvil, 2026-09-10): RootLayout envuelve TODAS las
// rutas, así que un await bloqueante acá (getPerfilServidor: auth.getUser()
// + consulta a usuarios_roles) retrasaba el primer byte de HTML de CADA
// página de la app, incluidas las que no necesitan ese dato para pintar --
// ej. "/pedidos" (puro "use client", cero adelanto del lado del servidor)
// medía 91 en Speed Insights antes de que existiera este adelanto en
// RootLayout, y ahora mide 64 sin haber cambiado en sí misma: el cuello de
// botella no estaba en esa página, estaba en el layout que la envuelve. En
// móvil (Supabase en us-west-2, función de Vercel en iad1, visitante en
// Chile) ese await sin Suspense estaba empujando el FCP real a ~5.5s en las
// tres rutas medidas (RES 55 agregado).
//
// Mismo fix que ya se aplicó en app/page.tsx y app/pedidos/[id]/page.tsx:
// aislar el await en un Server Component hijo (RootShellContent) dentro de
// <Suspense>, para que <html>/<head>/<body> salgan de inmediato y el resto
// (RoleProvider + children, con o sin perfil adelantado) llegue en un chunk
// aparte. El fallback es <RoleProvider initialProfile={null}>, el mismo
// estado "sin adelanto" que RoleProvider ya sabía manejar antes de que
// existiera este adelanto server-side (carga su propio perfil en el
// cliente al montar, igual que ya hacía con el caché de localStorage).
// Como getPerfilServidor() usa cache() de React, si alguna página (ej. "/")
// también lo llama en el mismo request, sigue sin duplicar la consulta a
// Supabase.
async function RootShellContent({ children }: { children: React.ReactNode }) {
  const perfilInicial = await getPerfilServidor();
  return (
    <RoleProvider initialProfile={perfilInicial}>
      {/* Visor de PDF en pantalla completa (pdf.js sobre canvas), montado
          una sola vez para toda la app -- ver src/lib/pdf-viewer-context.tsx
          y el comentario "novena vuelta" en src/lib/pdf.ts. */}
      <PdfViewerProvider>{children}</PdfViewerProvider>
    </RoleProvider>
  );
}

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
        <Suspense
          fallback={
            <RoleProvider initialProfile={null}>
              <PdfViewerProvider>{children}</PdfViewerProvider>
            </RoleProvider>
          }
        >
          <RootShellContent>{children}</RootShellContent>
        </Suspense>
        <SpeedInsights />
      </body>
    </html>
  );
}
