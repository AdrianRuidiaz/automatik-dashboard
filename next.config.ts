import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
