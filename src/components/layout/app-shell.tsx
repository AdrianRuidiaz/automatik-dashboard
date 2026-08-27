"use client";

import { useEffect } from "react";
import { Navbar } from "./navbar";
import { useRole } from "@/lib/role-context";
import type { RolUsuario } from "@/lib/types";
import { pushSoportado, obtenerSuscripcionActual, activarNotificaciones } from "@/lib/push";

interface Props {
  children: ((rol: RolUsuario) => React.ReactNode) | React.ReactNode;
}

export function AppShell({ children }: Props) {
  const { rol, listo, signOut } = useRole();

  // Notificaciones activas por defecto: antes habia que abrir la campanita
  // del navbar (ya no existe, ver Configuracion > Notificaciones) y
  // activarlas a mano. Ahora, apenas hay sesion con un rol activo, se
  // intenta suscribir sola -- pero solo si el navegador todavia no decidio
  // nada (Notification.permission === "default"). Si el usuario ya dijo
  // que no ("denied") o ya esta suscrito ("granted" + hay suscripcion), no
  // se le vuelve a preguntar: el permiso del navegador es la unica fuente
  // de verdad de si ya se pregunto, asi que esto no re-molesta en cada
  // carga de pagina una vez que la persona ya respondio.
  useEffect(() => {
    if (!listo || !rol) return;
    if (!pushSoportado()) return;
    if (typeof Notification === "undefined" || Notification.permission !== "default") return;

    obtenerSuscripcionActual().then((sub) => {
      if (!sub) activarNotificaciones();
    });
  }, [listo, rol]);

  return (
    <div className="relative min-h-screen">
      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 left-1/4 h-[500px] w-[600px] rounded-full bg-amber-500/[0.03] blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 h-[400px] w-[500px] rounded-full bg-violet-500/[0.02] blur-[100px]" />
      </div>
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-8">
        {!listo ? (
          // Antes: null mientras se resolvia el rol -- el navegador no tenia
          // nada que pintar como First Contentful Paint hasta que terminaba
          // ese round-trip. Con el perfil cacheado (ver role-context.tsx)
          // esta ventana casi siempre es instantanea, pero en la primera
          // carga de la sesion (o sin cache) este esqueleto le da al
          // navegador contenido real que pintar de inmediato, en vez de una
          // pantalla en blanco.
          <div className="animate-in-soft space-y-6">
            <div className="flex items-center justify-between gap-3">
              <div className="skeleton h-7 w-48" />
              <div className="skeleton h-8 w-8 rounded-lg" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="skeleton h-20 w-full" />
              <div className="skeleton h-20 w-full" />
              <div className="skeleton h-20 w-full" />
              <div className="skeleton h-20 w-full" />
            </div>
            <div className="skeleton h-64 w-full" />
          </div>
        ) : rol === null ? (
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
