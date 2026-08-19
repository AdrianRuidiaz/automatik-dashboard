"use client";

import { Check } from "lucide-react";
import { useTema } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { InstalarAppSeccion } from "@/components/configuracion/instalar-app-seccion";

export function SeccionApariencia() {
  const { tema, setTema } = useTema();

  return (
    <div className="space-y-6">
      <div className="space-y-5">
        <div>
          <p className="eyebrow mb-1">Tema</p>
          <p className="text-sm text-muted-foreground">Se guarda en este dispositivo/navegador.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setTema("dark")}
            className={cn(
              "w-36 rounded-xl border-2 p-3 text-left transition-colors",
              tema === "dark" ? "border-amber-400" : "border-input"
            )}
          >
            <div
              className="mb-2 h-9 w-full rounded-md border border-white/10"
              style={{ background: "linear-gradient(135deg,#14151c,#1c1d26)" }}
            />
            <p className="flex items-center gap-1.5 text-sm font-medium">
              Oscuro {tema === "dark" && <Check className="h-3.5 w-3.5 text-amber-400" />}
            </p>
            <p className="text-xs text-muted-foreground">Dark luxury</p>
          </button>
          <button
            onClick={() => setTema("light")}
            className={cn(
              "w-36 rounded-xl border-2 p-3 text-left transition-colors",
              tema === "light" ? "border-amber-400" : "border-input"
            )}
          >
            <div
              className="mb-2 h-9 w-full rounded-md border border-black/10"
              style={{ background: "linear-gradient(135deg,#faf6ee,#f0e9d8)" }}
            />
            <p className="flex items-center gap-1.5 text-sm font-medium">
              Claro {tema === "light" && <Check className="h-3.5 w-3.5 text-amber-400" />}
            </p>
            <p className="text-xs text-muted-foreground">Misma paleta, invertida</p>
          </button>
        </div>
      </div>

      <InstalarAppSeccion />
    </div>
  );
}
