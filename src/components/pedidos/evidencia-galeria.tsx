"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Loader2, RefreshCw, Trash2, UserCheck } from "lucide-react";
import { eliminarArchivo, reemplazarArchivo } from "@/lib/api";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { Archivo } from "@/lib/types";

interface EvidenciaGaleriaProps {
  evidencias: Archivo[];
  /** id_plataforma del pedido: carpeta usada al subir el archivo de reemplazo (mismo patron que ya usa PackingCard). */
  idPlataforma: string;
  /** true para admin/vendedor/super_admin -- habilita reemplazar/eliminar. El empacador nunca debe recibir true aca. */
  editable: boolean;
  /** Se llama con la lista actualizada despues de eliminar o reemplazar, para que el padre refresque su estado sin recargar todo. */
  onChange: (nuevas: Archivo[]) => void;
}

export function EvidenciaGaleria({ evidencias, idPlataforma, editable, onChange }: EvidenciaGaleriaProps) {
  const [procesando, setProcesando] = useState<string | null>(null);
  const [aEliminar, setAEliminar] = useState<Archivo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleEliminar = async () => {
    if (!aEliminar) return;
    setProcesando(aEliminar.id);
    setError(null);
    try {
      await eliminarArchivo(aEliminar, "evidencias");
      onChange(evidencias.filter((e) => e.id !== aEliminar.id));
      setAEliminar(null);
    } catch (err) {
      console.error("No se pudo eliminar la evidencia:", err);
      setError("No se pudo eliminar la evidencia. Intenta nuevamente.");
    } finally {
      setProcesando(null);
    }
  };

  const handleReemplazar = async (archivo: Archivo, file: File) => {
    setProcesando(archivo.id);
    setError(null);
    try {
      const nuevaUrl = await reemplazarArchivo(archivo, "evidencias", file, idPlataforma);
      onChange(evidencias.map((e) => (e.id === archivo.id ? { ...e, url: nuevaUrl, nombre_archivo: file.name } : e)));
    } catch (err) {
      console.error("No se pudo reemplazar la evidencia:", err);
      setError("No se pudo reemplazar la evidencia. Intenta nuevamente.");
    } finally {
      setProcesando(null);
    }
  };

  const empacadoPor = evidencias.find((e) => e.subido_por_usuario?.nombre)?.subido_por_usuario?.nombre;

  if (evidencias.length === 0) {
    return <p className="text-xs text-muted-foreground">Sin evidencias</p>;
  }

  return (
    <>
      {empacadoPor && (
        <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <UserCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
          Subido por <span className="font-medium text-foreground">{empacadoPor}</span>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {evidencias.map((ev) => (
          <div key={ev.id} className="group relative h-16 w-16 overflow-hidden rounded-lg border border-border bg-secondary">
            <a href={ev.url} target="_blank" rel="noopener noreferrer" className="block h-full w-full">
              <Image
                src={ev.url}
                alt={ev.nombre_archivo ?? "Evidencia"}
                fill
                sizes="64px"
                className="object-cover transition-transform group-hover:scale-105"
              />
            </a>

            {editable && (
              <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                {procesando === ev.id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                ) : (
                  <>
                    <button
                      type="button"
                      title="Reemplazar foto"
                      aria-label="Reemplazar foto"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); fileInputs.current[ev.id]?.click(); }}
                      className="rounded-full bg-white/90 p-1.5 text-foreground transition-colors hover:bg-white"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      title="Eliminar foto"
                      aria-label="Eliminar foto"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setError(null); setAEliminar(ev); }}
                      className="rounded-full bg-white/90 p-1.5 text-rose-600 transition-colors hover:bg-white"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </>
                )}
              </div>
            )}

            {editable && (
              <input
                ref={(el) => { fileInputs.current[ev.id] = el; }}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleReemplazar(ev, file);
                  e.target.value = "";
                }}
              />
            )}
          </div>
        ))}
      </div>

      {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}

      <ConfirmDialog
        open={!!aEliminar}
        title="Eliminar evidencia"
        description="Esta foto de evidencia de empaque se va a eliminar permanentemente. No se puede deshacer."
        confirmLabel="Eliminar"
        danger
        loading={procesando === aEliminar?.id}
        onConfirm={handleEliminar}
        onCancel={() => setAEliminar(null)}
      />
    </>
  );
}
