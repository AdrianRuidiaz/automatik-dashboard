"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { useRole } from "@/lib/role-context";
import { supabase } from "@/lib/supabase";

export function SeccionCuenta() {
  const { usuario } = useRole();
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMensaje(null);
    if (password.length < 8) {
      setMensaje({ tipo: "error", texto: "La contraseña debe tener al menos 8 caracteres" });
      return;
    }
    if (password !== confirmar) {
      setMensaje({ tipo: "error", texto: "Las contraseñas no coinciden" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMensaje({ tipo: "ok", texto: "Contraseña actualizada" });
      setPassword("");
      setConfirmar("");
    } catch (err) {
      setMensaje({
        tipo: "error",
        texto: err instanceof Error ? err.message : "No se pudo actualizar la contraseña",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow mb-3">Perfil</p>
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Nombre</p>
            <p>{usuario?.nombre ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Correo</p>
            <p>{usuario?.email ?? "—"}</p>
          </div>
        </div>
      </div>

      <div>
        <p className="eyebrow mb-3">Cambiar contraseña</p>
        <form onSubmit={handleSubmit} className="max-w-sm space-y-3">
          <input
            required
            type="password"
            minLength={8}
            placeholder="Nueva contraseña (mín. 8 caracteres)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <input
            required
            type="password"
            minLength={8}
            placeholder="Confirmar contraseña"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary"
          />
          {mensaje && (
            <p className={mensaje.tipo === "ok" ? "text-xs text-emerald-400" : "text-xs text-red-500"}>
              {mensaje.texto}
            </p>
          )}
          <button
            disabled={loading}
            type="submit"
            className="btn-premium flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Guardar contraseña
          </button>
        </form>
      </div>
    </div>
  );
}
