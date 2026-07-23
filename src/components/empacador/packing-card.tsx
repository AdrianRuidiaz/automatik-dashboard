"use client";

import { useState, useRef } from "react";
import { Camera, Plus, X, Check, Clock, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { cn, formatFechaCorta } from "@/lib/utils";
import { uploadArchivo, registrarArchivo } from "@/lib/api";
import type { Pedido } from "@/lib/types";

interface PackingCardProps {
  pedido: Pedido;
  onConfirm: () => void;
}

export function PackingCard({ pedido, onConfirm }: PackingCardProps) {
  const [fotos, setFotos] = useState<{ file: File; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const horasRestantes = pedido.fecha_limite_despacho
    ? (new Date(pedido.fecha_limite_despacho).getTime() - Date.now()) / 36e5
    : null;
  const venceHoy = horasRestantes !== null && horasRestantes < 24;

  const addFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const nuevas = files.slice(0, 3 - fotos.length).map((f) => ({ file: f, preview: URL.createObjectURL(f) }));
    setFotos((prev) => [...prev, ...nuevas]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeFoto = (idx: number) => {
    setFotos((prev) => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleConfirm = async () => {
    if (!fotos.length) return;
    setUploading(true);
    setError(null);
    try {
      for (let i = 0; i < fotos.length; i++) {
        const ext = (fotos[i].file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${pedido.id_plataforma}/evidencia_${i + 1}.${ext}`;
        await uploadArchivo("evidencias", path, fotos[i].file);
        await registrarArchivo({
          pedido_id: pedido.id,
          tipo: "evidencia",
          storage_path: path,
          nombre_archivo: fotos[i].file.name,
        });
      }
      setConfirmed(true);
      onConfirm();
    } catch (err) {
      console.error(err);
      setError("No se pudo subir la evidencia. Reintenta.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={cn("rounded-xl border border-border bg-card p-3 transition-opacity sm:p-4", confirmed && "opacity-60")}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold sm:text-base">{pedido.id_plataforma}</span>
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium",
            pedido.plataforma === "ML" ? "bg-ml-light text-ml-dark" : "bg-fa-light text-fa-dark")}>
            {pedido.plataforma === "ML" ? "ML" : "FA"}
          </span>
        </div>
        {confirmed ? (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
            <CheckCircle className="h-3.5 w-3.5" /> Empacado
          </span>
        ) : venceHoy ? (
          <span className="flex items-center gap-1 text-xs font-medium text-rose-600">
            <AlertTriangle className="h-3.5 w-3.5" /> Vence hoy
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> {formatFechaCorta(pedido.fecha_limite_despacho)}
          </span>
        )}
      </div>

      <div className="mb-3 space-y-1">
        {(pedido.items ?? []).map((item, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            <span className="mt-0.5 shrink-0 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
              x{item.quantity}
            </span>
            <span className="text-muted-foreground">{item.title}</span>
          </div>
        ))}
        {(pedido.items ?? []).length === 0 && (
          <p className="text-xs text-muted-foreground">Sin items registrados</p>
        )}
      </div>

      <div className="border-t border-border pt-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Camera className="h-3.5 w-3.5" /> Evidencia de empaque (1 a 3 fotos)
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {fotos.map((foto, i) => (
            <div key={i} className="relative h-20 w-20 overflow-hidden rounded-lg border border-border">
              <img src={foto.preview} alt={`Evidencia ${i + 1}`} className="h-full w-full object-cover" />
              {!confirmed && (
                <button
                  onClick={() => removeFoto(i)}
                  aria-label="Quitar foto"
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}

          {fotos.length < 3 && !confirmed && (
            <button
              onClick={() => fileRef.current?.click()}
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-input bg-background text-muted-foreground active:bg-secondary"
            >
              <Plus className="h-5 w-5" />
              <span className="text-[10px]">Foto {fotos.length + 1}</span>
            </button>
          )}
        </div>

        {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}

        {fotos.length > 0 && !confirmed && (
          <button
            onClick={handleConfirm}
            disabled={uploading}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white active:bg-emerald-700 disabled:opacity-60 sm:w-auto"
          >
            {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Subiendo...</> : <><Check className="h-4 w-4" /> Confirmar empaque</>}
          </button>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={addFoto}
        />
      </div>
    </div>
  );
}
