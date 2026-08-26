"use client";

import { useEffect } from "react";

// Registra el service worker de public/sw.js apenas carga la app. Es lo
// que le falta al manifest.json para que el navegador ofrezca "Instalar
// app" / "Agregar a pantalla de inicio".
//
// Ademas de registrar, se encarga de que una instancia ya instalada de la
// PWA detecte y adopte una version nueva sin que el usuario tenga que
// borrar y reinstalar la app manualmente:
//  - Escucha "controllerchange": se dispara justo cuando un service worker
//    nuevo toma el control (sw.js ya llama a skipWaiting()/clients.claim()
//    para esto). Al detectarlo, recarga la pagina para que la app quede
//    corriendo la version nueva.
//  - Llama a registration.update() cuando la app vuelve a primer plano
//    (visibilitychange / focus), en vez de depender del chequeo automatico
//    del navegador (que puede tardar hasta ~24hs o no correr si la app
//    quedo en segundo plano/congelada en el celular).
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

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // Revisa si hay una version nueva cada vez que la app vuelve a
        // primer plano (por ejemplo, al reabrir la app instalada despues
        // de que se publico un deploy nuevo).
        const checkForUpdate = () => {
          registration.update().catch(() => {
            // Sin conexion o falla la red: no hacemos nada, se reintenta
            // la proxima vez que la app vuelva a primer plano.
          });
        };

        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") checkForUpdate();
        });
        window.addEventListener("focus", checkForUpdate);
      })
      .catch((err) => {
        console.error("No se pudo registrar el service worker:", err);
      });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}
