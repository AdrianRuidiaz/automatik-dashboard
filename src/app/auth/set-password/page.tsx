"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

export default function SetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // El redirect ya paso por /auth/callback, que intercambia el "?code="
    // del link (flujo PKCE) por una sesion real antes de llegar aca -- por
    // eso alcanza con getSession(). Igual se cubre con onAuthStateChange
    // por si la sesion (cookies) tarda un tick en estar lista, y con un
    // timeout + chequeo de errores en la URL para no quedar pegado en
    // "Verificando invitacion..." para siempre si el link ya se uso o vencio.
    let activo = true;

    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const errorDesc = params.get("error_description") || hashParams.get("error_description");
    if (errorDesc) {
      setLinkError(decodeURIComponent(errorDesc.replace(/\+/g, " ")));
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (activo && data.session) setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (activo && session) setReady(true);
    });

    const timeout = setTimeout(() => {
      if (activo) {
        setReady((yaListo) => {
          if (!yaListo) setLinkError("El link no es válido o ya venció.");
          return yaListo;
        });
      }
    }, 8000);

    return () => {
      activo = false;
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
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
        {linkError ? (
          <div className="space-y-3">
            <p className="text-sm text-red-500">{linkError}</p>
            <p className="text-xs text-muted-foreground">Pide que te reenvíen la invitación o el link de recuperación.</p>
            <button onClick={() => router.push("/login")}
              className="w-full rounded-lg border border-input px-3 py-2 text-sm text-muted-foreground hover:bg-secondary">
              Volver a iniciar sesión
            </button>
          </div>
        ) : !ready ? (
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
