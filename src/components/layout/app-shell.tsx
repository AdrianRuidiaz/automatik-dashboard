"use client";

import { Navbar } from "./navbar";
import { useRole } from "@/lib/role-context";
import type { RolUsuario } from "@/lib/types";

interface Props {
  children: ((rol: RolUsuario) => React.ReactNode) | React.ReactNode;
}

export function AppShell({ children }: Props) {
  const { rol, listo, signOut } = useRole();

  return (
    <div className="relative min-h-screen">
      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 left-1/4 h-[500px] w-[600px] rounded-full bg-amber-500/[0.03] blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 h-[400px] w-[500px] rounded-full bg-violet-500/[0.02] blur-[100px]" />
      </div>
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-8">
        {!listo ? null : rol === null ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <p className="max-w-sm text-sm text-muted-foreground">
              Tu cuenta no tiene un rol activo asignado en este panel. Pide a un administrador que te invite.
            </p>
            <button
              onClick={() => signOut()}
              className="rounded-lg border border-input bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-primary/40"
            >
              Cerrar sesión
            </button>
          </div>
        ) : typeof children === "function" ? (
          children(rol)
        ) : (
          children
        )}
      </main>
    </div>
  );
}
