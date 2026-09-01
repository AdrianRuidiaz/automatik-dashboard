import type { NextConfig } from "next";

// Tarea 2026-09-01 ("aun no funciona" tras el revert a descarga forzada,
// PR #22): se investigo por que un fix ya confirmado como desplegado en el
// servidor podia seguir sin notarse del lado del usuario. Se encontro que
// public/sw.js no cambia de contenido entre despliegues de la app (es un
// archivo estatico minimo, sin cache de fetch, que no necesita tocarse
// para ningun cambio de src/) -- por lo tanto registration.update() en
// pwa-register.tsx NUNCA detecta una version nueva por esta via, porque
// nunca hay bytes distintos que comparar. El mecanismo de auto-recarga
// basado en "controllerchange" quedo, en la practica, inactivo durante TODO
// este historial de fixes (PR #14 a #22): una pestana de la PWA que ya
// estaba abierta antes de un despliegue puede seguir corriendo JS viejo
// indefinidamente, sin que nada se lo avise.
//
// Fix: exponer al cliente, en build time, el commit SHA que Vercel ya
// setea automaticamente como variable de entorno del lado del servidor
// (VERCEL_GIT_COMMIT_SHA -- disponible siempre en cada build, sin depender
// de que el toggle "Automatically expose System Environment Variables"
// este activado en el dashboard del proyecto). pwa-register.tsx lo compara
// contra /api/version (ver esa ruta), que devuelve el SHA del deploy
// actualmente corriendo en el servidor, en la MISMA cadencia ya usada para
// chequear el service worker. Si difieren, se fuerza un reload -- deteccion
// de version nueva que no depende en absoluto de que sw.js haya cambiado.
const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? "",
  },
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
