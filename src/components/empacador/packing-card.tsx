"use client";

import { useState, useRef } from "react";
import { Camera, Plus, X, Check, Clock, AlertTriangle, CheckCircle, Loader2, PackageCheck, User, Timer } from "lucide-react";
import { cn, formatFechaCorta } from "@/lib/utils";
import { uploadArchivo, registrarArchivo, updateEstadoPedido } from "@/lib/api";
import type { Pedido } from "@/lib/types";

interface PackingCardProps {
  pedido: Pedido;
  onConfirm: () => void;
}

function DeadlineBadge({ fecha }: { fecha: string | null }) {
  if (!fecha) return <span className="text-xs text-muted-foreground">Sin fecha límite</span>;

  const ahora = new Date();
  const limite = new Date(fecha);
  const diffMs = limite.getTime() - ahora.getTime();
  const diffHoras = diffMs / 36e5;

  if (diffHoras < 0) {
    return (
      <span className="flex items-center gap-1 rounded-full bg-rose-500/20 px-2 py-0.5 text-xs font-semibold text-rose-400 animate-pulse">
        <AlertTriangle className="h-3 w-3" /> Atrasado
      </span>
    );
  }
  if (diffHoras < 24) {
    return (
      <span className="flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-xs font-medium text-rose-500">
        <Timer className="h-3 w-3" /> Vence hoy
      </span>
    );
  }
  if (diffHoras < 48) {
    return (
      <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-500">
        <Clock className="h-3 w-3" /> Vence mañana
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Clock className="h-3 w-3" /> {formatFechaCorta(fecha)}
    </span>
  );
}

export function PackingCard({ pedido, onConfirm }: PackingCardProps) {
  const [fotos, setFotos] = useState<{ file: File; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [marking, setMarking] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [packed, setPacked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const handleMarkPacked = async () => {
    setMarking(true);
    setError(null);
    try {
      await updateEstadoPedido(pedido.id, "ready_to_ship");
      setPacked(true);
      onConfirm();
    } catch (err) {
      console.error(err);
      setError("No se pudo actualizar el estado. Reintenta.");
    } finally {
      setMarking(false);
    }
  };

  const isDone = confirmed || packed;

  return (
    <div className={cn("rounded-xl border border-border bg-card p-3 transition-all sm:p-4", isDone && "opacity-60")}>
      {/* Header: order number + platform badge + deadline */}
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold sm:text-base">{pedido.id_plataforma}</span>
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium",
            pedido.plataforma === "ML" ? "bg-ml-light text-ml-dark" : "bg-fa-light text-fa-dark")}>
            {pedido.plataforma === "ML" ? "ML" : "FA"}
          </span>
        </div>
        {isDone ? (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-500">
            <CheckCircle className="h-3.5 w-3.5" /> Empacado
          </span>
        ) : (
          <DeadlineBadge fecha={pedido.fecha_limite_despacho} />
        )}
      </div>

      {/* Client name */}
      <p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <User className="h-3 w-3 shrink-0" />
        <span className="truncate">{pedido.cliente_nombre || "Cliente no registrado"}</span>
      </p>

      {/* Items */}
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

      {/* Evidence upload section */}
      <div className="border-t border-border pt-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Camera className="h-3.5 w-3.5" /> Evidencia de empaque (1 a 3 fotos)
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {fotos.map((foto, i) => (
            <div key={i} className="relative h-20 w-20 overflow-hidden rounded-lg border border-border">
              <img src={foto.preview} alt={`Evidencia ${i + 1}`} className="h-full w-full object-cover" />
              {!isDone && (
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

          {fotos.length < 3 && !isDone && (
            <button
              onClick={() => fileRef.current?.click()}
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-input bg-background text-muted-foreground active:bg-secondary"
            >
              <Plus className="h-5 w-5" />
              <span className="text-[10px]">Foto {fotos.length + 1}</span>
            </button>
          )}
        </div>

        {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}

        {/* Action buttons */}
        {!isDone && (
          <div className="mt-3 flex flex-wrap gap-2">
            {fotos.length > 0 && (
              <button
                onClick={handleConfirm}
                disabled={uploading || marking}
                className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white active:bg-emerald-700 disabled:opacity-60"
              >
                {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Subiendo...</> : <><Check className="h-4 w-4" /> Confirmar evidencia</>}
              </button>
            )}
            <button
              onClick={handleMarkPacked}
              disabled={marking || uploading}
              className="flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary active:bg-primary/20 disabled:opacity-60"
            >
              {marking ? <><Loader2 className="h-4 w-4 animate-spin" /> Marcando...</> : <><PackageCheck className="h-4 w-4" /> Marcar empacado</>}
            </button>
          </div>
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
