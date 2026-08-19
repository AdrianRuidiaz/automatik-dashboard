"use client";

import { useState } from "react";
import { CheckCircle2, Download, Loader2, Share2 } from "lucide-react";
import { useInstallPrompt } from "@/lib/pwa-install";

// Tarea: la instalacion nativa via beforeinstallprompt solo existe en
// Chrome/Edge/Android -- en iOS Safari ese evento nunca se dispara (no hay
// API programatica), asi que el boton "Instalar" del navbar simplemente no
// aparece ahi y mucha gente en iPhone se queda sin saber que la app se
// puede instalar. Esta seccion cubre los 3 estados posibles en vez de
// asumir que "no hay boton" significa "no se puede instalar":
// 1) Chrome/Edge/Android con el evento disponible -> boton real que
//    reusa el mismo hook que el navbar (useInstallPrompt).
// 2) iOS Safari -> instrucciones manuales del flujo "Compartir > Agregar
//    a pantalla de inicio" (unica forma de instalar ahi).
// 3) Ya instalada (standalone) -> confirmacion, ni boton ni instrucciones.
export function InstalarAppSeccion() {
  const { puedeInstalar, instalada, esIOS, instalar } = useInstallPrompt();
  const [instalando, setInstalando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const handleInstalar = async () => {
    setMensaje(null);
    setInstalando(true);
    const aceptado = await instalar();
    setInstalando(false);
    if (!aceptado) setMensaje("Instalación cancelada.");
  };

  return (
    <div className="border-t border-white/[0.06] pt-5">
      <p className="eyebrow mb-1">Instalar app</p>
      <p className="mb-3 text-sm text-muted-foreground">
        Úsala como una app aparte, con ícono propio y sin la barra del navegador.
      </p>

      {instalada ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-3 py-2.5 text-sm text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Ya tienes la app instalada
        </div>
      ) : puedeInstalar ? (
        <div className="space-y-2">
          <button
            onClick={handleInstalar}
            disabled={instalando}
            className="btn-premium flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {instalando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Instalar Automatik
          </button>
          {mensaje && <p className="text-xs text-muted-foreground">{mensaje}</p>}
        </div>
      ) : esIOS ? (
        <div className="max-w-sm space-y-2 rounded-lg border border-input bg-card px-3 py-3 text-sm">
          <p className="flex items-start gap-2">
            <Share2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <span>
              1. Toca el ícono de <strong>Compartir</strong> (□↑) en la barra de Safari.
            </span>
          </p>
          <p className="pl-6 text-muted-foreground">
            2. Desplázate y toca <strong className="text-foreground">&quot;Agregar a pantalla de inicio&quot;</strong>.
          </p>
          <p className="pl-6 text-muted-foreground">
            3. Confirma tocando <strong className="text-foreground">&quot;Agregar&quot;</strong>.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Busca el ícono de instalar en la barra de direcciones o el menú de tu navegador. Si no aparece, tu
          navegador actual no soporta instalación de apps.
        </p>
      )}
    </div>
  );
}
