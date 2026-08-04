"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

export default function SetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // El link de invitacion trae la sesion en el hash de la URL; el cliente
    // de Supabase la detecta y crea la sesion automaticamente al cargar.
    supabase.auth.getSession().then(({ data }) => {
      setReady(Boolean(data.session));
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la contraseña");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card-premium w-full max-w-sm p-6">
        <h1 className="mb-1 text-lg font-medium">Crea tu contraseña</h1>
        <p className="mb-5 text-sm text-muted-foreground">Ya fuiste invitado al panel. Define una contraseña para tu cuenta.</p>
        {!ready ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Verificando invitación...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input required type="password" minLength={8} placeholder="Nueva contraseña (min. 8 caracteres)"
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary" />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button disabled={loading} type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Guardar y entrar
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
