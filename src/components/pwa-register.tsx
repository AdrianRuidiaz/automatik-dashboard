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
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let reloading = false;

    // Si un service worker nuevo toma el control, recargamos una sola vez
    // para que la pestana/app pase a usar la version nueva.
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    let cleanupListeners: (() => void) | undefined;

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        const checkForUpdate = () => {
          registration.update().catch(() => {
            // Sin conexion o falla la red: no hacemos nada, se reintenta
            // en el proximo chequeo.
          });
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
      });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      cleanupListeners?.();
    };
  }, []);

  return null;
}
