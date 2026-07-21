"use client";

import { useState, useRef } from "react";
import {
  Camera,
  Plus,
  X,
  Check,
  Clock,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
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
  const fileRef = useRef<HTMLInputElement>(null);

  const horasRestantes = pedido.fecha_limite_despacho
    ? Math.max(
        0,
        (new Date(pedido.fecha_limite_despacho).getTime() - Date.now()) /
          (1000 * 60 * 60)
      )
    : null;

  const venceHoy = horasRestantes !== null && horasRestantes < 24;

  const addFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const nuevas = files.slice(0, 3 - fotos.length).map((f) => ({
      file: f,
      preview: URL.createObjectURL(f),
    }));
    setFotos((prev) => [...prev, ...nuevas]);
  };

  const removeFoto = (idx: number) => {
    setFotos((prev) => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleConfirm = async () => {
    if (fotos.length === 0) return;
    setUploading(true);
    try {
      for (let i = 0; i < fotos.length; i++) {
        const path = `${pedido.id_plataforma}/evidencia_${i + 1}.jpg`;
        const url = await uploadArchivo("evidencias", path, fotos[i].file);
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
      console.error("Error subiendo evidencia:", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-background p-4",
        confirmed && "opacity-50"
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{pedido.id_plataforma}</span>
          <span
            className={cn(
              "rounded px-2 py-0.5 text-[11px]",
              pedido.plataforma === "ML"
                ? "bg-ml-light text-ml-dark"
                : "bg-fa-light text-fa-dark"
            )}
          >
            {pedido.plataforma === "ML" ? "ML" : "FA"}
          </span>
        </div>
        {confirmed ? (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <CheckCircle className="h-3.5 w-3.5" /> Empacado
          </span>
        ) : venceHoy ? (
          <span className="flex items-center gap-1 text-xs text-red-600">
            <AlertTriangle className="h-3.5 w-3.5" /> Vence hoy
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Despachar antes del{" "}
            {formatFechaCorta(pedido.fecha_limite_despacho)}
          </span>
        )}
      </div>

      <div className="mb-3 space-y-1">
        {(pedido.items ?? []).map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">
              x{item.quantity}
            </span>
            <span className="text-muted-foreground">{item.title}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-border pt-3">
        <div className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
          <Camera className="h-3.5 w-3.5" /> Evidencia de empaque (1 a 3 fotos)
        </div>
        <div className="flex items-center gap-2">
          {fotos.map((foto, i) => (
            <div
              key={i}
              className="group relative h-[72px] w-[72px] overflow-hidden rounded-md border border-primary/30 bg-primary/5"
            >
              <img
                src={foto.preview}
                alt={`Evidencia ${i + 1}`}
                className="h-full w-full object-cover"
              />
              <button
                onClick={() => removeFoto(i)}
                className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-4 w-4 text-white" />
              </button>
            </div>
          ))}

          {fotos.length < 3 && !confirmed && (
            <button
              onClick={() => fileRef.current?.click()}
              className="flex h-[72px] w-[72px] flex-col items-center justify-center gap-1 rounded-md border border-dashed border-input bg-card text-muted-foreground hover:border-primary hover:bg-primary/5"
            >
              <Plus className="h-5 w-5" />
              <span className="text-[9px]">Foto {fotos.length + 1}</span>
            </button>
          )}

          {fotos.length > 0 && !confirmed && (
            <button
              onClick={handleConfirm}
              disabled={uploading}
              className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
            >
              {uploading ? (
                "Subiendo..."
              ) : (
                <>
                  <Check className="h-4 w-4" /> Confirmar empaque
                </>
              )}
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={addFoto}
        />
      </div>
    </div>
  );
}
