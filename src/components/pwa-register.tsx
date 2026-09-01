"use client";

import { useEffect } from "react";

// Cada cuanto se revisa si hay una version nueva mientras la app queda
// abierta en primer plano sin que el usuario la minimice/reabra (por
// ejemplo, tablet del empacador con la app abierta todo el turno).
const UPDATE_CHECK_INTERVAL_MS = 20 * 60 * 1000; // 20 min

// Registra el service worker de public/sw.js apenas carga la app. Es lo
// que le falta al manifest.json para que el navegador ofrezca "Instalar
// app" / "Agregar a pantalla de inicio".
//
// Ademas de registrar, se encarga de que una instancia ya instalada de la
// PWA detecte y adopte una version nueva sin que el usuario tenga que
// borrar y reinstalar la app manualmente. Pensado para andar igual en
// Android/Chrome e iOS/Safari (este ultimo es mas propenso a cachear
// sw.js y a no revisar actualizaciones en segundo plano):
//  - Escucha "controllerchange": se dispara justo cuando un service worker
//    nuevo toma el control (sw.js ya llama a skipWaiting()/clients.claim()
//    para esto). Al detectarlo, recarga la pagina para que la app quede
//    corriendo la version nueva.
//  - Llama a registration.update() apenas se registra, cada vez que la
//    app vuelve a primer plano (visibilitychange / focus) y ademas cada
//    20 minutos mientras sigue abierta, en vez de depender del chequeo
//    automatico del navegador (que en Chrome puede tardar hasta ~24hs, y
//    en iOS/standalone practicamente no corre si la app nunca se cierra
//    del todo).
//  - Ademas next.config.ts fuerza Cache-Control: no-cache en /sw.js para
//    que ese registration.update() siempre compare contra el archivo real
//    del servidor y no contra una copia vieja cacheada por el navegador.
//
// Tarea 2026-09-01 ("aun no funciona" tras un fix ya confirmado como
// desplegado): el mecanismo de arriba SOLO detecta cambios en el contenido
// de sw.js -- y sw.js no cambia entre despliegues normales de la app (no
// hay ningun motivo para tocarlo cuando lo que cambia es, por ejemplo,
// src/lib/pdf.ts). Eso significa que registration.update() nunca encuentra
// una version nueva, controllerchange nunca dispara, y una pestana/PWA que
// ya estaba abierta antes de un deploy puede seguir corriendo JS viejo
// indefinidamente. Se agrega un segundo chequeo, independiente del service
// worker, en la misma cadencia (inmediato / visibilitychange / focus / cada
// 20 min): comparar el commit SHA con el que se compilo el bundle actual
// (NEXT_PUBLIC_BUILD_SHA, ver next.config.ts) contra el SHA que devuelve
// /api/version -- que siempre refleja el deploy que esta corriendo en el
// servidor en ese momento. Si difieren, se recarga la pagina igual que con
// controllerchange. Con esto ya no hace falta que sw.js cambie para que la
// app se entere de una version nueva.
const BUILD_SHA = process.env.NEXT_PUBLIC_BUILD_SHA || "";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let reloading = false;
    const reloadOnce = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    // Si un service worker nuevo toma el control, recargamos una sola vez
    // para que la pestana/app pase a usar la version nueva.
    navigator.serviceWorker.addEventListener("controllerchange", reloadOnce);

    // Chequeo de version por SHA (ver comentario arriba): independiente del
    // service worker, cubre los deploys que no tocan sw.js -- es decir,
    // casi todos.
    const checkBuildVersion = () => {
      if (!BUILD_SHA) return; // no deberia pasar en Vercel, pero por las dudas no rompemos nada
      fetch("/api/version", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { sha: string | null } | null) => {
          if (data?.sha && data.sha !== BUILD_SHA) reloadOnce();
        })
        .catch(() => {
          // Sin conexion o falla la red: no hacemos nada, se reintenta en
          // el proximo chequeo.
        });
    };

    let cleanupListeners: (() => void) | undefined;

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        const checkForUpdate = () => {
          registration.update().catch(() => {
            // Sin conexion o falla la red: no hacemos nada, se reintenta
            // en el proximo chequeo.
          });
          checkBuildVersion();
        };

        // Chequeo inmediato: cubre el caso de que ya haya una version
        // nueva esperando desde antes de que se abriera esta pestana/app.
        checkForUpdate();

        const onVisibilityChange = () => {
          if (document.visibilityState === "visible") checkForUpdate();
        };
        document.addEventListener("visibilitychange", onVisibilityChange);
        window.addEventListener("focus", checkForUpdate);

        const intervalId = window.setInterval(() => {
          if (document.visibilityState === "visible") checkForUpdate();
        }, UPDATE_CHECK_INTERVAL_MS);

        cleanupListeners = () => {
          document.removeEventListener("visibilitychange", onVisibilityChange);
          window.removeEventListener("focus", checkForUpdate);
          window.clearInterval(intervalId);
        };
      })
      .catch((err) => {
        console.error("No se pudo registrar el service worker:", err);
        // Si el service worker no se pudo registrar igual queremos el
        // chequeo de version por SHA -- no depende de el.
        checkBuildVersion();
        const intervalId = window.setInterval(() => {
          if (document.visibilityState === "visible") checkBuildVersion();
        }, UPDATE_CHECK_INTERVAL_MS);
        cleanupListeners = () => window.clearInterval(intervalId);
      });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", reloadOnce);
      cleanupListeners?.();
    };
  }, []);

  return null;
}
