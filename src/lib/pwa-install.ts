"use client";

import { useCallback, useEffect, useState } from "react";

// El evento beforeinstallprompt no esta en los tipos de TS por defecto
// (es propietario de Chromium). Se declara aca en vez de en un .d.ts
// global para no tocar la config de TS del proyecto por un solo tipo.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

// Tarea: el icono nativo de instalar (barra de direcciones / menu del
// navegador) es invisible para la mayoria de la gente. Este hook escucha
// el evento beforeinstallprompt que Chrome/Edge/Android disparan cuando la
// app cumple los criterios de instalable (manifest + service worker
// correctos), lo guarda, y deja que cualquier componente dispare el
// prompt nativo desde un boton propio dentro de la UI.
//
// Nota: Safari/iOS nunca dispara este evento -- ahi no hay forma de
// mostrar un boton que instale directamente, solo el flujo manual de
// "Compartir > Agregar a pantalla de inicio". puedeInstalar simplemente
// se queda en false en iOS, así que el boton no aparece (no hay nada que
// hacer con un click ahí).
export function useInstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [instalada, setInstalada] = useState(false);

  useEffect(() => {
    // Si ya se abrio como app instalada (standalone), nunca va a llegar
    // beforeinstallprompt -- ni vale la pena mostrar el boton.
    const yaInstalada =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalada(yaInstalada);

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredEvent(e as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setInstalada(true);
      setDeferredEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const instalar = useCallback(async () => {
    if (!deferredEvent) return false;
    await deferredEvent.prompt();
    const { outcome } = await deferredEvent.userChoice;
    // El evento solo se puede usar una vez; si el usuario lo descarta,
    // Chrome no vuelve a dispararlo hasta otra visita, asi que igual lo
    // limpiamos para no dejar el boton en un estado que ya no sirve.
    setDeferredEvent(null);
    return outcome === "accepted";
  }, [deferredEvent]);

  return {
    puedeInstalar: !!deferredEvent && !instalada,
    instalada,
    instalar,
  };
}
