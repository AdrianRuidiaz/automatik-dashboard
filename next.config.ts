import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // qpdf-compress es un addon nativo (N-API, .node binario) usado en
  // /api/pdf. Turbopack intenta bundlear su dist/index.js como si fuera
  // ESM puro y falla el build ("non-ecmascript placeable asset ... asset
  // is not placeable in ESM chunks") porque ese archivo carga el binario
  // nativo con require() dinamico. serverExternalPackages le dice a
  // Next.js que deje este paquete fuera del bundle y lo cargue tal cual
  // desde node_modules en tiempo de ejecucion (igual que en un Node
  // normal), que es como este tipo de addon nativo debe consumirse.
  serverExternalPackages: ["qpdf-compress"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "sorotjyyefdpylwntyyr.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  // Sin esto, el navegador (Safari/iOS en particular es mas agresivo con
  // el cacheo de archivos estaticos que Chrome/Android) puede servir una
  // copia vieja de sw.js desde cache al hacer registration.update(), lo
  // que hace que la deteccion de version nueva nunca dispare aunque el
  // codigo de pwa-register.tsx este pidiendola correctamente. sw.js debe
  // revalidarse siempre contra el servidor. manifest.json se deja con el
  // mismo criterio por si cambian nombre/iconos de la app.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
      {
        source: "/manifest.json",
        headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
