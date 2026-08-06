"use client";

import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Modal de confirmacion propio, en el mismo lenguaje visual que el resto de
// la app (card-premium + btn-premium). Reemplaza window.confirm/alert, que
// son dialogos nativos del navegador y rompen por completo la estetica
// "dark luxury" -- se ven identicos sin importar el diseño de la pagina.
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in-soft"
        onClick={loading ? undefined : onCancel}
      />
      <div className="card-premium animate-in-soft relative w-full max-w-sm p-5">
        <h3 id="confirm-dialog-title" className="display text-lg">{title}</h3>
        {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="btn-premium rounded-lg border border-input px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "btn-premium rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50",
              danger ? "bg-red-500/90 text-white hover:bg-red-500" : "bg-primary text-primary-foreground"
            )}
          >
            {loading ? "Procesando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
