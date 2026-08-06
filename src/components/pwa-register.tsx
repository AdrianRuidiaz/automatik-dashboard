"use client";

import { useEffect } from "react";

// Registra el service worker de public/sw.js apenas carga la app. Es lo
// que le falta al manifest.json para que el navegador ofrezca "Instalar
// app" / "Agregar a pantalla de inicio".
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("No se pudo registrar el service worker:", err);
    });
  }, []);

  return null;
}
