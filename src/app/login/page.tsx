"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Zap, Loader2 } from "lucide-react";

function getNext(): string {
  if (typeof window === "undefined") return "/";
  return new URLSearchParams(window.location.search).get("next") || "/";
}

type Modo = "login" | "olvide" | "enviado";

export default function LoginPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [modo, setModo] = useState<Modo>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/bootstrap-status")
      .then((r) => r.json())
      .then((d) => setNeedsBootstrap(Boolean(d.needsBootstrap)))
      .catch(() => setNeedsBootstrap(false))
      .finally(() => setChecking(false));
  }, []);

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/admin/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, nombre }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "No se pudo crear la cuenta de administrador");
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      router.push(getNext());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      router.push(getNext());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Correo o contraseña incorrectos");
    } finally {
      setLoading(false);
    }
  };

  // Reutiliza /auth/set-password como pantalla de destino: es el mismo
  // mecanismo que usan los links de invitacion (Supabase crea una sesion
  // temporal a partir del token del link y ahi se define la contraseña).
  const handleOlvide = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const redirectTo = `${window.location.origin}/auth/set-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (resetError) throw resetError;
      setModo("enviado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el correo");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/20">
            <Zap className="h-4.5 w-4.5 text-[hsl(230,15%,7%)]" strokeWidth={2.5} />
          </div>
          <span className="font-serif text-xl tracking-tight">
            automatik<span className="text-amber-500">.io</span>
          </span>
        </div>

        <div className="card-premium p-6">
          {needsBootstrap ? (
            <>
              <h1 className="mb-1 text-lg font-medium">Configura tu cuenta de administrador</h1>
              <p className="mb-5 text-sm text-muted-foreground">
                Este panel todavía no tiene usuarios. Crea la primera cuenta de administrador para continuar.
              </p>
              <form onSubmit={handleBootstrap} className="space-y-3">
                <input required placeholder="Tu nombre" value={nombre} onChange={(e) => setNombre(e.target.value)}
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary" />
                <input required type="email" placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary" />
                <input required type="password" minLength={8} placeholder="Contraseña (min. 8 caracteres)" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary" />
                {error && <p className="text-xs text-red-500">{error}</p>}
                <button disabled={loading} type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Crear cuenta y entrar
                </button>
              </form>
            </>
          ) : modo === "enviado" ? (
            <>
              <h1 className="mb-1 text-lg font-medium">Revisa tu correo</h1>
              <p className="mb-5 text-sm text-muted-foreground">
                Si <span className="font-medium text-foreground">{email}</span> tiene una cuenta en este panel, te llegará un link para elegir una nueva contraseña.
              </p>
              <button onClick={() => { setModo("login"); setError(null); }}
                className="w-full rounded-lg border border-input px-3 py-2 text-sm text-muted-foreground hover:bg-secondary">
                Volver a iniciar sesión
              </button>
            </>
          ) : modo === "olvide" ? (
            <>
              <h1 className="mb-1 text-lg font-medium">Recuperar contraseña</h1>
              <p className="mb-5 text-sm text-muted-foreground">
                Ingresa tu correo y te enviaremos un link para elegir una nueva contraseña.
              </p>
              <form onSubmit={handleOlvide} className="space-y-3">
                <input required type="email" placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary" />
                {error && <p className="text-xs text-red-500">{error}</p>}
                <button disabled={loading} type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Enviar link
                </button>
                <button type="button" onClick={() => { setModo("login"); setError(null); }}
                  className="w-full rounded-lg border border-input px-3 py-2 text-sm text-muted-foreground hover:bg-secondary">
                  Volver
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="mb-5 text-lg font-medium">Iniciar sesión</h1>
              <form onSubmit={handleLogin} className="space-y-3">
                <input required type="email" placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary" />
                <input required type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary" />
                {error && <p className="text-xs text-red-500">{error}</p>}
                <button disabled={loading} type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Entrar
                </button>
              </form>
              <button onClick={() => { setModo("olvide"); setError(null); }}
                className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground">
                ¿Olvidaste tu contraseña?
              </button>
              <p className="mt-4 text-center text-xs text-muted-foreground">
                ¿Primera vez? Pide una invitación al administrador.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
